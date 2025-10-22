// js/Admin.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);

  let ADDR = [];

  function ensureUI(){
    const host = $('#admin');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Admin</h1>

      <div class="card">
        <div class="row" style="gap:10px; flex-wrap:wrap; align-items:flex-end">
          <label class="field" style="min-width:240px; flex:1">
            <span>JSONBin ID</span>
            <input id="adm_bin" class="input" placeholder="68e7b4d2ae596e708f0bde7d" />
          </label>
          <label class="field" style="min-width:260px; flex:1">
            <span>Master Key</span>
            <input id="adm_key" class="input" placeholder="••••••" />
          </label>
          <button id="adm_save_cfg" class="btn">Lagre synk-oppsett</button>
        </div>
      </div>

      <div class="card" style="overflow:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead style="position:sticky; top:0; background:var(--surface);">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);min-width:260px">Adresse</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:70px">Snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:70px">Grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:90px">Pinner</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:120px">Lat</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep);width:120px">Lon</th>
            </tr>
          </thead>
          <tbody id="adm_tbody"></tbody>
        </table>
      </div>

      <div class="row" style="gap:10px">
        <button id="adm_add" class="btn">Legg til adresse</button>
        <button id="adm_save" class="btn-ghost">Lagre adresser</button>
      </div>
    `;
    host.dataset.enhanced='1';

    $('#adm_add')?.addEventListener('click', addRow);
    $('#adm_save')?.addEventListener('click', saveAll);
    $('#adm_save_cfg')?.addEventListener('click', saveCfg);

    const cfg = Sync.getConfig();
    $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
    $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
  }

  function addRow(){
    ADDR.push({ id: String(Date.now()), name:'', tasks:{snow:true,grit:false}, pins:0, lat:null, lon:null });
    render();
  }

  function render(){
    const tb = $('#adm_tbody'); if (!tb) return;
    tb.innerHTML = (ADDR||[]).map(a=>{
      const snow = !!(a.tasks?.snow ?? a.flags?.snow ?? true);
      const grit = !!(a.tasks?.grit ?? a.flags?.grit ?? false);
      return `
        <tr data-id="${a.id}">
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_name input"
                   style="width:100%;min-width:240px"
                   value="${(a.name||'').replace(/"/g,'&quot;')}" />
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep);text-align:center">
            <input type="checkbox" class="adm_snow" ${snow?'checked':''} />
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep);text-align:center">
            <input type="checkbox" class="adm_grit" ${grit?'checked':''} />
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_pins input"
                   type="number" min="0" inputmode="numeric"
                   style="width:64px;text-align:center"
                   value="${a.pins??0}">
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_lat input"
                   type="number" step="any" inputmode="decimal"
                   style="max-width:140px"
                   value="${a.lat??''}">
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_lon input"
                   type="number" step="any" inputmode="decimal"
                   style="max-width:140px"
                   value="${a.lon??''}">
          </td>
        </tr>
      `;
    }).join('');
  }

  function pullFromDOM(){
    const tb = $('#adm_tbody'); if (!tb) return [];
    const out = [];
    tb.querySelectorAll('tr').forEach(tr=>{
      out.push({
        id:   tr.dataset.id,
        name: tr.querySelector('.adm_name')?.value.trim() || '',
        tasks:{
          snow: !!tr.querySelector('.adm_snow')?.checked,
          grit: !!tr.querySelector('.adm_grit')?.checked
        },
        pins: Number(tr.querySelector('.adm_pins')?.value || 0),
        lat:  parseFloat(tr.querySelector('.adm_lat')?.value || 'NaN'),
        lon:  parseFloat(tr.querySelector('.adm_lon')?.value || 'NaN'),
      });
    });
    return out.map(a=>({
      ...a,
      lat: isNaN(a.lat)?null:a.lat,
      lon: isNaN(a.lon)?null:a.lon
    }));
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
    alert('Synk-oppsett lagret ✅');
  }

  async function load(){
    try{
      await Sync.loadAddresses({force:true});
      ADDR = Sync.getCache().addresses || [];
      render();
    }catch(e){ console.error(e); }
  }

  function boot(){
    ensureUI();
    if (location.hash==='#admin') load();
  }
  window.addEventListener('hashchange', ()=>{ if (location.hash==='#admin') boot(); });
  document.addEventListener('DOMContentLoaded', boot);

  Sync.on('change', ()=>{
    if (location.hash==='#admin'){
      ADDR = Sync.getCache().addresses || [];
      render();
    }
  });
})();