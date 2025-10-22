// js/Admin.js
(() => {
  'use strict';

  const $  = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SEASON = 'BRYT_SEASON';   // f.eks. "2025-26"

  let ADDR = [];

  /* -------------------- UI skeleton -------------------- */
  function ensureUI(){
    const host = $('#admin');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Admin</h1>

      <div class="card">
        <div class="row" style="gap:10px; align-items:end; flex-wrap:wrap">
          <div>
            <div class="label-muted">Aktiv sesong</div>
            <div id="adm_season" style="font-weight:700; padding:4px 0"></div>
          </div>
          <button id="adm_copy_pins" class="btn-ghost">Kopier pinner fra forrige sesong</button>
          <button id="adm_new_season" class="btn">Start ny sesong</button>
        </div>
      </div>

      <div class="card">
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <label class="field" style="min-width:260px">
            <span>JSONBin ID</span>
            <input id="adm_bin" class="input" placeholder="68e7b4d2ae596e708f0bde7d" />
          </label>
          <label class="field" style="min-width:320px">
            <span>Master Key</span>
            <input id="adm_key" class="input" placeholder="••••••" />
          </label>
          <button id="adm_save_cfg" class="btn">Lagre synk-oppsett</button>
        </div>
      </div>

      <div class="card">
        <input id="adm_filter" class="input" placeholder="Filtrer adresser..." />
      </div>

      <div class="card" style="overflow:auto">
        <table id="adm_table" style="width:100%; border-collapse:collapse; table-layout:fixed">
          <thead style="position:sticky; top:0; background:var(--surface);">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:86px">Rekkefølge</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:44%">Adresse</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--sep);width:8%">Snø</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--sep);width:8%">Grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:10%">Pinner</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:20%">Koordinater (lat, lon)</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:8%">Slett</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="row" style="gap:10px">
        <button id="adm_add" class="btn">Legg til adresse</button>
        <button id="adm_save" class="btn-ghost">Lagre</button>
      </div>
    `;
    host.dataset.enhanced='1';

    $('#adm_add')?.addEventListener('click', addRow);
    $('#adm_save')?.addEventListener('click', saveAll);
    $('#adm_save_cfg')?.addEventListener('click', saveCfg);
    $('#adm_new_season')?.addEventListener('click', newSeason);
    $('#adm_copy_pins')?.addEventListener('click', copyPins);
    $('#adm_filter')?.addEventListener('input', render);

    // init cfg felt
    const cfg = Sync.getConfig?.() || {};
    $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
    $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
    renderSeason();
  }

  /* -------------------- Sesong -------------------- */
  function seasonGet(){ return RJ(K_SEASON, guessSeason()); }
  function seasonSet(v){ WJ(K_SEASON, v); renderSeason(); }
  function guessSeason(){
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    return (m>=7) ? `${y}-${(y+1).toString().slice(-2)}` : `${y-1}-${y.toString().slice(-2)}`;
  }
  function renderSeason(){
    $('#adm_season') && ($('#adm_season').textContent = seasonGet());
  }

  /* -------------------- Hjelpere -------------------- */
  function formatCoords(a){
    if (a?.lat==null || a?.lon==null) return '';
    return `${a.lat}, ${a.lon}`; // vises i lat, lon-rekkefølge
  }
  function parseCoords(str){
    let s = String(str||'').trim();
    if (!s) return {lat:null, lon:null};
    s = s.replace(/[()]/g,'').replace(';',',').replace(/\s+/g,' ').trim();
    let parts = s.includes(',') ? s.split(',') : s.split(' ');
    parts = parts.map(p=>p.trim()).filter(Boolean);
    if (parts.length < 2) return {lat:null, lon:null};
    const lat = parseFloat(parts[0].replace(',','.'));
    const lon = parseFloat(parts[1].replace(',','.'));
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat>=-90 && lat<=90 && lon>=-180 && lon<=180){
      return {lat, lon};
    }
    return {lat:null, lon:null};
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  /* -------------------- Data → tabell -------------------- */
  function addRow(){
    ADDR.push({ id: String(Date.now()), name:'', snow:true, grit:false, pins:0, lat:null, lon:null });
    render();
  }

  function render(){
    const tb = $('#adm_table tbody'); if (!tb) return;
    const q = ($('#adm_filter')?.value || '').toLowerCase();

    // Lag en visningsliste med ekte indeks (for reordering selv ved filter)
    const view = ADDR
      .map((a,idx)=>({a,idx}))
      .filter(x => (x.a.name||'').toLowerCase().includes(q));

    tb.innerHTML = view.map(({a,idx})=>`
      <tr data-id="${a.id}" data-idx="${idx}">
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <div class="row" style="gap:6px; flex-wrap:nowrap">
            <button class="btn-ghost adm_up"   title="Flytt opp">⬆️</button>
            <button class="btn-ghost adm_down" title="Flytt ned">⬇️</button>
            <span class="muted" style="min-width:34px;text-align:right">${idx+1}</span>
          </div>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_name input" style="width:100%" value="${escapeHtml(a.name||'')}" />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:center">
          <input type="checkbox" class="adm_snow" ${a.snow?'checked':''} />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:center">
          <input type="checkbox" class="adm_grit" ${a.grit?'checked':''} />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); max-width:90px">
          <input class="adm_pins input" type="number" min="0" max="99" style="max-width:90px" value="${a.pins??0}">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_coords input" style="width:100%" placeholder="60.2661131, 11.1962700" value="${escapeHtml(formatCoords(a))}">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <button class="btn-ghost adm_del">Slett</button>
        </td>
      </tr>
    `).join('');

    // wire rad-hendelser
    tb.querySelectorAll('tr').forEach(tr=>{
      const id  = tr.dataset.id;
      const idx = Number(tr.dataset.idx);

      tr.querySelector('.adm_del')?.addEventListener('click', ()=>{
        ADDR = ADDR.filter(a => a.id!==id);
        render();
      });
      tr.querySelector('.adm_up')?.addEventListener('click', ()=>{
        if (idx <= 0) return;
        [ADDR[idx-1], ADDR[idx]] = [ADDR[idx], ADDR[idx-1]];
        render();
      });
      tr.querySelector('.adm_down')?.addEventListener('click', ()=>{
        if (idx >= ADDR.length-1) return;
        [ADDR[idx+1], ADDR[idx]] = [ADDR[idx], ADDR[idx+1]];
        render();
      });
    });
  }

  /* -------------------- DOM → Data -------------------- */
  function pullFromDOM(){
    const tb = $('#adm_table tbody'); if (!tb) return [];
    const out = [];
    tb.querySelectorAll('tr').forEach(tr=>{
      const id   = tr.dataset.id;
      const name = tr.querySelector('.adm_name')?.value.trim() || '';
      const snow = !!tr.querySelector('.adm_snow')?.checked;
      const grit = !!tr.querySelector('.adm_grit')?.checked;
      const pins = Number(tr.querySelector('.adm_pins')?.value || 0);
      const coordStr = tr.querySelector('.adm_coords')?.value || '';
      const {lat,lon} = parseCoords(coordStr);
      out.push({ id, name, snow, grit, pins, lat, lon });
    });
    // bevar uendrede felt fra eksisterende liste
    return out.map(row=>{
      const old = ADDR.find(a=>a.id===row.id) || {};
      return { ...old, ...row };
    });
  }

  /* -------------------- Sync og handlinger -------------------- */
  async function saveAll(){
    try{
      const prepared = pullFromDOM();

      // Snill validering av coords
      const bad = prepared.filter(a => (a.lat!=null && (a.lat<-90 || a.lat>90)) || (a.lon!=null && (a.lon<-180 || a.lon>180)));
      if (bad.length){
        alert('Obs: Noen koordinater ser feil ut (lat -90..90, lon -180..180). Kontroller disse etter lagring.');
      }

      ADDR = await Sync.saveAddresses(prepared);  // JSONBin oppdateres inkl. rekkefølge
      alert('Lagret ✅');
      render();
    }catch(e){ console.error(e); alert('Kunne ikke lagre: '+(e.message||e)); }
  }

  function saveCfg(){
    const binId = $('#adm_bin')?.value.trim() || '';
    const apiKey = $('#adm_key')?.value.trim() || '';
    Sync.setConfig({binId, apiKey});
    Sync.startPolling?.(15000);
    alert('Synk-oppsett lagret ✅');
  }

  function newSeason(){
    const cur = seasonGet();
    if (!confirm(`Start ny sesong? (nåværende: ${cur})`)) return;
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    const next = (m>=7) ? `${y+1}-${(y+2).toString().slice(-2)}` : `${y}-${(y+1).toString().slice(-2)}`;
    seasonSet(next);
  }

  function copyPins(){
    alert('Kopiering av pinner fra forrige sesong er notert – kan kobles til historikk senere.');
  }

  async function load(){
    try{
      ADDR = await Sync.loadAddresses({force:true});
      render();
    }catch(e){ console.error(e); }
  }

  /* -------------------- Boot -------------------- */
  function boot(){
    ensureUI();
    if (location.hash==='#admin') load();
  }
  window.addEventListener('hashchange', ()=>{ if (location.hash==='#admin') boot(); });
  document.addEventListener('DOMContentLoaded', boot);
})();