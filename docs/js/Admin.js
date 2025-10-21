// js/Admin.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SEASON = 'BRYT_SEASON';   // f.eks. "2025-26"

  let ADDR = [];

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
        <table id="adm_table" style="width:100%; border-collapse:collapse">
          <thead style="position:sticky; top:0; background:var(--surface);">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Adresse</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Brøytepinner <span id="adm_seas_hdr"></span></th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Lat</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Lon</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Slett</th>
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
    const cfg = Sync.getConfig();
    $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
    $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
    renderSeason();
  }

  function seasonGet(){ return RJ(K_SEASON, guessSeason()); }
  function seasonSet(v){ WJ(K_SEASON, v); renderSeason(); }
  function guessSeason(){
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    return (m>=7) ? `${y}-${(y+1).toString().slice(-2)}` : `${y-1}-${y.toString().slice(-2)}`;
  }
  function renderSeason(){
    $('#adm_season') && ($('#adm_season').textContent = seasonGet());
    $('#adm_seas_hdr') && ($('#adm_seas_hdr').textContent = seasonGet());
  }

  function addRow(){
    ADDR.push({ id: String(Date.now()), name:'', snow:true, grit:false, pins:0, lat:null, lon:null });
    render();
  }

  function render(){
    const tb = $('#adm_table tbody'); if (!tb) return;
    const q = ($('#adm_filter')?.value || '').toLowerCase();
    const rows = ADDR.filter(a => a.name.toLowerCase().includes(q));

    tb.innerHTML = rows.map((a,ix)=>`
      <tr data-id="${a.id}">
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_name input" value="${a.name||''}" />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input type="checkbox" class="adm_snow" ${a.snow?'checked':''} />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input type="checkbox" class="adm_grit" ${a.grit?'checked':''} />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_pins input" type="number" min="0" value="${a.pins??0}">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_lat input" type="number" step="any" value="${a.lat??''}">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_lon input" type="number" step="any" value="${a.lon??''}">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <button class="btn-ghost adm_del">Slett</button>
        </td>
      </tr>
    `).join('');

    // wire rad-hendelser
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector('.adm_del')?.addEventListener('click', ()=>{
        ADDR = ADDR.filter(a => a.id!==id);
        render();
      });
    });
  }

  function pullFromDOM(){
    const tb = $('#adm_table tbody'); if (!tb) return [];
    const out = [];
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;
      out.push({
        id,
        name: tr.querySelector('.adm_name')?.value.trim() || '',
        snow: !!tr.querySelector('.adm_snow')?.checked,
        grit: !!tr.querySelector('.adm_grit')?.checked,
        pins: Number(tr.querySelector('.adm_pins')?.value || 0),
        lat:  parseFloat(tr.querySelector('.adm_lat')?.value || 'NaN'),
        lon:  parseFloat(tr.querySelector('.adm_lon')?.value || 'NaN'),
      });
    });
    // bevar statusfelt fra eksisterende liste
    return out.map(raw=>{
      const old = ADDR.find(a=>a.id===raw.id) || {};
      return {
        ...old,
        ...raw,
        lat: isNaN(raw.lat) ? null : raw.lat,
        lon: isNaN(raw.lon) ? null : raw.lon
      };
    });
  }

  async function saveAll(){
    try{
      const prepared = pullFromDOM();
      ADDR = await Sync.saveAddresses(prepared);
      alert('Lagret ✅');
      render();
    }catch(e){ console.error(e); alert('Kunne ikke lagre: '+e.message); }
  }

  function saveCfg(){
    const binId = $('#adm_bin')?.value.trim() || '';
    const apiKey = $('#adm_key')?.value.trim() || '';
    Sync.setConfig({binId, apiKey});
    Sync.startPolling(15000);
    alert('Synk-oppsett lagret ✅');
  }

  function newSeason(){
    const cur = seasonGet();
    if (!confirm(`Start ny sesong? (nåværende: ${cur})`)) return;
    // enkel årsrulling: YYYY-YY
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    const next = (m>=7) ? `${y+1}-${(y+2).toString().slice(-2)}` : `${y}-${(y+1).toString().slice(-2)}`;
    seasonSet(next);
  }

  function copyPins(){
    alert('Kopiering av pinner fra forrige sesong er notert – vi kan senere koble mot historikk hvis ønskelig.');
  }

  async function load(){
    try{ ADDR = await Sync.loadAddresses({force:true}); render(); }
    catch(e){ console.error(e); }
  }

  function boot(){
    ensureUI();
    if (location.hash==='#admin') load();
  }
  window.addEventListener('hashchange', ()=>{ if (location.hash==='#admin') boot(); });
  document.addEventListener('DOMContentLoaded', boot);
})();