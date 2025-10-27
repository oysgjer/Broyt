
(function(){
  'use strict';
  const $  = (s,r=document)=> r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const LS_SETTINGS='BRYT_SETTINGS';

  function settings(){ return RJ(LS_SETTINGS, {}); }
  function getCfg(){ if (window.Sync?.getConfig) return window.Sync.getConfig(); return RJ('BRYT_CFG', { binId:'', apiKey:'' }); }
  function setCfg(obj){ if (window.Sync?.setConfig) return window.Sync.setConfig(obj); WJ('BRYT_CFG', obj); }

  function adminLoadBase(){
    const cfg = getCfg();
    const st  = settings();
    $('#cfg_bin_drift')  && ($('#cfg_bin_drift').value  = (cfg.binId || ''));
    $('#cfg_bin_report') && ($('#cfg_bin_report').value = (st.reportBin || ''));
    $('#cfg_master_key') && ($('#cfg_master_key').value = (cfg.apiKey || ''));
  }
  function adminSaveBase(){
    const driftBin  = ($('#cfg_bin_drift')?.value || '').trim();
    const reportBin = ($('#cfg_bin_report')?.value || '').trim();
    const masterKey = ($('#cfg_master_key')?.value || '').trim();
    setCfg({ binId: driftBin, apiKey: masterKey });
    const st = settings(); st.reportBin = reportBin; WJ(LS_SETTINGS, st);
    alert('Lagret ✅');
  }

  function rowTemplate(a){
    const checked = a.active ? 'checked' : '';
    const tSnow = (a?.tasks?.snow ? 'checked' : '');
    const tGrit = (a?.tasks?.grit ? 'checked' : '');
    return `
      <div class="addr_row" data-id="${a.id}" style="border:1px solid #e3e5ea;border-radius:8px;padding:8px;margin:6px 0">
        <div style="display:grid;gap:6px">
          <label>Navn/adresse
            <input class="a_name" type="text" value="${(a.name||'').replace(/"/g,'&quot;')}" />
          </label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <label><input class="a_active" type="checkbox" ${checked}> Aktiv</label>
            <label><input class="a_snow"   type="checkbox" ${tSnow}> Snø</label>
            <label><input class="a_grit"   type="checkbox" ${tGrit}> Grus</label>
          </div>
          <div style="display:flex;gap:8px">
            <input class="a_lat" type="number" step="any" placeholder="lat" value="${a.lat??''}">
            <input class="a_lon" type="number" step="any" placeholder="lon" value="${a.lon??''}">
          </div>
        </div>
      </div>`;
  }
  function currentAddresses(){ const cache = (window.Sync?.getCache?.() || {}); return (cache.addresses || RJ('BRYT_ADDR_LOCAL', [])).map(x=>({...x})); }
  function renderAddr(list){
    const el = document.getElementById('addr_list');
    if (!el) return;
    if (!Array.isArray(list) || !list.length){ el.innerHTML = `<div style="opacity:.7">Ingen adresser.</div>`; return; }
    el.innerHTML = list.map(rowTemplate).join('');
  }
  async function reloadAddr(){ try{ await window.Sync?.reload?.(); }catch{} renderAddr(currentAddresses()); }
  function collectAddr(){
    const out = [];
    document.querySelectorAll('#addr_list .addr_row').forEach(row=>{
      const id   = row.dataset.id || String(Date.now())+Math.random().toString(36).slice(2);
      const name = row.querySelector('.a_name')?.value || '';
      const active = row.querySelector('.a_active')?.checked || false;
      const snow = row.querySelector('.a_snow')?.checked || false;
      const grit = row.querySelector('.a_grit')?.checked || false;
      const lat  = row.querySelector('.a_lat')?.value;
      const lon  = row.querySelector('.a_lon')?.value;
      out.push({ id, name, active, tasks:{snow,grit}, pins:{}, lat: lat===''?null:Number(lat), lon: lon===''?null:Number(lon) });
    });
    return out;
  }
  async function saveAddr(){
    const list = collectAddr();
    if (window.Sync?.setAddresses){ await window.Sync.setAddresses(list); alert('Lagret (setAddresses) ✅'); return; }
    const patch = { snapshot:{ addresses: list } };
    if (window.Sync?.setStatusPatch){ await window.Sync.setStatusPatch(patch); alert('Lagret (snapshot) ✅'); }
    else { localStorage.setItem('BRYT_ADDR_LOCAL', JSON.stringify(list)); alert('Lagret lokalt (midlertidig)'); }
  }
  function addAddr(){ const list = currentAddresses(); list.push({ id:String(Date.now()), name:'', active:true, tasks:{snow:true,grit:true}, pins:{}, lat:null, lon:null }); renderAddr(list); }

  document.addEventListener('DOMContentLoaded', ()=>{
    adminLoadBase();
    document.getElementById('admin_save_bins')?.addEventListener('click', ()=>{
      adminSaveBase();
      // nav shortcuts stored by admin-navshortcuts.js
    });
    document.getElementById('addr_reload')?.addEventListener('click', reloadAddr);
    document.getElementById('addr_add')?.addEventListener('click', addAddr);
    document.getElementById('addr_save_all')?.addEventListener('click', saveAddr);
    renderAddr(currentAddresses());
  });
})();
