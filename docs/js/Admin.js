<!-- js/Admin.js -->
(() => {
  'use strict';

  // ---------- små helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SEASON = 'BRYT_SEASON';        // f.eks. "2025-26"
  let   ADDR     = [];                   // arbeidstabell

  // ---------- UI-shell ----------
  function ensureUI(){
    const host = $('#admin');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Admin</h1>

      <!-- Sesong -->
      <div class="card">
        <div class="row" style="gap:10px;align-items:end;flex-wrap:wrap">
          <div>
            <div class="label-muted">Aktiv sesong</div>
            <div id="adm_season" style="font-weight:700;padding:4px 0"></div>
          </div>
          <button id="adm_copy_pins" class="btn-ghost">Kopier pinner fra forrige sesong</button>
          <button id="adm_new_season" class="btn">Start ny sesong</button>
        </div>
      </div>

      <!-- Synk-oppsett -->
      <div class="card">
        <div class="row" style="gap:10px;flex-wrap:wrap">
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

      <!-- Søk -->
      <div class="card">
        <input id="adm_filter" class="input" placeholder="Filtrer adresser..." />
      </div>

      <!-- Adresse-register -->
      <div class="adm-wrap card">
        <table id="adm_table">
          <colgroup>
            <col class="c-addr">
            <col class="c-flag">
            <col class="c-flag">
            <col class="c-pins">
            <col class="c-coord">
            <col class="c-move">
            <col class="c-del">
          </colgroup>
          <thead>
            <tr>
              <th>Adresse</th>
              <th>Snø</th>
              <th>Grus</th>
              <th>Pinner</th>
              <th>Koordinater (lat, lon)</th>
              <th>Flytt</th>
              <th>Slett</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="row" style="gap:10px;margin-top:12px">
        <button id="adm_add"  class="btn">Legg til adresse</button>
        <button id="adm_save" class="btn-ghost">Lagre</button>
      </div>
    `;
    host.dataset.enhanced = '1';

    // wire knapper
    $('#adm_add')?.addEventListener('click', addRow);
    $('#adm_save')?.addEventListener('click', saveAll);
    $('#adm_save_cfg')?.addEventListener('click', saveCfg);
    $('#adm_new_season')?.addEventListener('click', newSeason);
    $('#adm_copy_pins')?.addEventListener('click', copyPins);
    $('#adm_filter')?.addEventListener('input', render);

    // initialverdier
    const cfg = (window.Sync?.getConfig?.() || {});
    $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
    $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
    renderSeason();
  }

  // ---------- sesong ----------
  function guessSeason(){
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    return (m>=7) ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
  }
  function seasonGet(){ return RJ(K_SEASON, guessSeason()); }
  function seasonSet(v){ WJ(K_SEASON, v); renderSeason(); }
  function renderSeason(){
    const s = seasonGet();
    $('#adm_season') && ($('#adm_season').textContent = s);
  }
  function newSeason(){
    const cur = seasonGet();
    if (!confirm(`Start ny sesong? (nåværende: ${cur})`)) return;
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    const next = (m>=7) ? `${y+1}-${String(y+2).slice(-2)}`
                        : `${y}-${String(y+1).slice(-2)}`;
    seasonSet(next);
  }
  function copyPins(){
    alert('Kopiering av pinner fra forrige sesong – notert. (Kan kobles mot historikk senere.)');
  }

  // ---------- datahjelpere ----------
  function addRow(){
    ADDR.push({ id:String(Date.now()), name:'', snow:true, grit:false, pins:0, lat:null, lon:null });
    render();
  }
  function coordToText(a){
    if (a.lat == null || a.lon == null) return '';
    return `${a.lat}, ${a.lon}`;
  }
  function parseCoord(txt){
    if (!txt) return { lat:null, lon:null };
    const s = txt.replace(/[()]/g,'').trim().replace(';',',');
    const m = s.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (!m) return { lat:null, lon:null };
    const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { lat:null, lon:null };
    return { lat, lon };
  }

  // ---------- render ----------
  function render(){
    const tb = $('#adm_table tbody'); if (!tb) return;
    const q = ($('#adm_filter')?.value || '').toLowerCase();
    const rows = ADDR.filter(a => (a.name||'').toLowerCase().includes(q));

    tb.innerHTML = rows.map(a => `
      <tr data-id="${a.id}">
        <td><input class="adm-input adm_name input" value="${a.name||''}" placeholder="Adresse ..."></td>
        <td style="text-align:center"><input type="checkbox" class="adm_snow" ${a.snow?'checked':''}></td>
        <td style="text-align:center"><input type="checkbox" class="adm_grit" ${a.grit?'checked':''}></td>
        <td><input class="adm-pins input" type="number" min="0" max="99" value="${a.pins??0}"></td>
        <td><input class="adm-coord input" placeholder="60.2661131, 11.19627" value="${coordToText(a)}"></td>
        <td class="adm-move">
          <button class="btn-ghost adm_up"   title="Flytt opp">⬆️</button>
          <button class="btn-ghost adm_down" title="Flytt ned">⬇️</button>
        </td>
        <td><button class="btn-ghost adm_del" title="Slett">🗑️</button></td>
      </tr>
    `).join('');

    // wire per rad
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;

      tr.querySelector('.adm_up')?.addEventListener('click', ()=>{
        const i = ADDR.findIndex(x=>x.id===id);
        if (i>0){ const [x]=ADDR.splice(i,1); ADDR.splice(i-1,0,x); render(); }
      });
      tr.querySelector('.adm_down')?.addEventListener('click', ()=>{
        const i = ADDR.findIndex(x=>x.id===id);
        if (i>=0 && i<ADDR.length-1){ const [x]=ADDR.splice(i,1); ADDR.splice(i+1,0,x); render(); }
      });
      tr.querySelector('.adm_del')?.addEventListener('click', ()=>{
        ADDR = ADDR.filter(x=>x.id!==id); render();
      });
    });
  }

  function pullFromDOM(){
    const tb = $('#adm_table tbody'); if (!tb) return [];
    const out = [];
    tb.querySelectorAll('tr').forEach(tr=>{
      const id    = tr.dataset.id;
      const name  = tr.querySelector('.adm_name')?.value.trim() || '';
      const snow  = !!tr.querySelector('.adm_snow')?.checked;
      const grit  = !!tr.querySelector('.adm_grit')?.checked;
      const pins  = Math.max(0, Math.min(99, Number(tr.querySelector('.adm-pins')?.value || 0)));
      const coord = parseCoord(tr.querySelector('.adm-coord')?.value || '');

      const old = ADDR.find(a=>a.id===id) || {};
      out.push({ ...old, id, name, snow, grit, pins, lat:coord.lat, lon:coord.lon });
    });
    return out;
  }

  // ---------- lagre/lese ----------
  async function saveAll(){
    try{
      const prepared = pullFromDOM();

      // Ta hensyn til Sync-format: inkluder tasks
      const toSave = prepared.map(a => ({
        id: a.id, name: a.name, pins: a.pins,
        lat: a.lat, lon: a.lon,
        tasks: { snow: !!a.snow, grit: !!a.grit }
      }));

      // Noen backends aksepterer også snow/grit i rot; behold de felt også:
      toSave.forEach((x,i)=>{ x.snow = prepared[i].snow; x.grit = prepared[i].grit; });

      ADDR = await window.Sync.saveAddresses(toSave);
      alert('Lagret ✅');
      render();
    }catch(e){
      console.error(e); alert('Kunne ikke lagre: '+e.message);
    }
  }

  function saveCfg(){
    const binId = $('#adm_bin')?.value.trim() || '';
    const apiKey = $('#adm_key')?.value.trim() || '';
    window.Sync.setConfig({ binId, apiKey });
    window.Sync.startPolling?.(15000);
    alert('Synk-oppsett lagret ✅');
  }

  async function load(){
    try{
      const list = await window.Sync.loadAddresses({ force:true });
      // Normaliser til vårt UI-format
      ADDR = (list||[]).map(a => ({
        id: a.id,
        name: a.name || '',
        pins: a.pins ?? 0,
        lat: a.lat ?? null,
        lon: a.lon ?? null,
        snow: !!(a.snow ?? a.tasks?.snow),
        grit: !!(a.grit ?? a.tasks?.grit)
      }));
      render();
    }catch(e){
      console.error(e);
    }
  }

  // ---------- boot ----------
  function boot(){
    ensureUI();
    if (location.hash === '#admin') load();
  }

  window.addEventListener('hashchange', ()=>{
    if (location.hash === '#admin') boot();
  });
  document.addEventListener('DOMContentLoaded', boot);

  // Oppdater visning om Sync endrer noe i bakgrunnen
  window.Sync?.on?.('change', ()=>{
    if (location.hash === '#admin') load();
  });
})();