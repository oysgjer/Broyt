(function(){
  'use strict';
  // Scope guard
  function isAdminPage(){
    const p = (location.pathname || '').toLowerCase();
    const h = (location.hash || '').toLowerCase();
    const t = (document.title || '').toLowerCase();
    return /(^|\/)admin(\.html)?$/.test(p) || h === '#admin' || /\badmin\b/.test(t);
  }
  if (!isAdminPage()) return;

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const LS_SETTINGS='BRYT_SETTINGS';
  const LS_CFG='BRYT_CFG';

  const $ = (sel, r=document)=> r.querySelector(sel);

  function settings(){ return RJ(LS_SETTINGS, {}); }
  function getCfg(){ return RJ(LS_CFG, { binId:'', apiKey:'' }); }
  function setCfg(obj){ const next = { ...getCfg(), ...(obj||{}) }; WJ(LS_CFG, next); return next; }

  function ensureMarkup(){
    if (document.getElementById('cfg_bin_drift')) return;
    const main = document.querySelector('main') || document.body;
    const box = document.createElement('div');
    box.className='wrap';
    box.innerHTML = `
      <div class="card">
        <h1>Oppsett</h1>
        <label>JSONBin ID – Drift</label><input id="cfg_bin_drift" type="text">
        <label>JSONBin ID – Rapporter</label><input id="cfg_bin_report" type="text">
        <label>JSONBin ID – Kartlag (ruter)</label><input id="cfg_routes_bin" type="text" placeholder="Maplayers BIN ID">
        <label>JSONBin Master Key</label><input id="cfg_master_key" type="password">
        <label>Uhell e‑post (mottaker)</label><input id="cfg_incident_email" type="email">
        <div class="spacer"></div><button id="admin_save_bins" class="btn btn-primary">Lagre</button>
      </div>
      <div class="card">
        <h2>Adresse‑register</h2>
        <div class="row">
          <button id="addr_reload" class="btn">Last fra sky</button>
          <button id="addr_add" class="btn">Ny adresse</button>
          <button id="addr_save_all" class="btn btn-primary">Lagre alle</button>
        </div>
        <div id="addr_list" class="spacer"></div>
      </div>`;
    main.appendChild(box);
  }

  function adminLoadBase(){
    const cfg = getCfg();
    const st  = settings();
    $('#cfg_bin_drift')  && ($('#cfg_bin_drift').value  = (cfg.binId || ''));
    $('#cfg_bin_report') && ($('#cfg_bin_report').value = (st.reportBin || ''));
    $('#cfg_routes_bin') && ($('#cfg_routes_bin').value = (st.routesBin || ''));
    $('#cfg_master_key') && ($('#cfg_master_key').value = (cfg.apiKey || ''));
    $('#cfg_incident_email') && ($('#cfg_incident_email').value = (st.incidentEmail || ''));
  }
  function adminSaveBase(){
    const v = id => (document.querySelector(id)?.value || '').trim();
    const driftBin   = v('#cfg_bin_drift');
    const reportBin  = v('#cfg_bin_report');
    const routesBin  = v('#cfg_routes_bin');
    const masterKey  = v('#cfg_master_key');
    const incidentTo = v('#cfg_incident_email');
    setCfg({ binId: driftBin, apiKey: masterKey });
    const st = settings();
    st.reportBin = reportBin;
    st.routesBin = routesBin;
    st.incidentEmail = incidentTo;
    WJ(LS_SETTINGS, st);
    alert('Lagret ✅');
  }

  function rowTemplate(a){
    const checked = a.active ? 'checked' : '';
    const tSnow = (a?.tasks?.snow ? 'checked' : '');
    const tGrit = (a?.tasks?.grit ? 'checked' : '');
    const note  = (a?.note || '');
    return `
      <div class="addr_row" data-id="${a.id}" style="border:1px solid #e3e5ea;border-radius:10px;padding:10px;margin:8px 0">
        <label>Navn/adresse
          <input class="a_name" type="text" value="${(a.name||'').replace(/"/g,'&quot;')}">
        </label>
        <div class="row" style="align-items:center">
          <label><input class="a_active" type="checkbox" ${checked}> Aktiv</label>
          <label><input class="a_snow"   type="checkbox" ${tSnow}> Snø</label>
          <label><input class="a_grit"   type="checkbox" ${tGrit}> Grus</label>
        </div>
        <label>Koordinater (lat, lon eller lon, lat)</label>
        <input class="a_coords" type="text" placeholder="f.eks. 60.25628, 11.19405" value="${(a.lat!=null&&a.lon!=null)?(a.lat+', '+a.lon):''}">
        <label>Merknad</label>
        <textarea class="a_note" placeholder="valgfritt …">${(note||'').replace(/</g,'&lt;')}</textarea>
      </div>`;
  }

  function parseCoordinates(text){
    if (!text) return {lat:null, lon:null};
    const s = String(text).trim().replace(/\s+/g,' ');
    const m = s.match(/(-?\d+(\.\d+)?)[,\s;]+(-?\d+(\.\d+)?)/);
    if (!m) return {lat:null, lon:null};
    let a = parseFloat(m[1]), b = parseFloat(m[3]);
    if (isNaN(a) || isNaN(b)) return {lat:null, lon:null};
    if (Math.abs(a) > 90 && Math.abs(b) <= 90){ const t=a; a=b; b=t; }
    return { lat:a, lon:b };
  }

  function cache(){ return (window.Sync?.getCache?.() || { addresses: RJ('BRYT_ADDR_LOCAL', []), status: RJ('BRYT_STATUS_LOCAL', {}) }); }
  function currentAddresses(){ return (cache().addresses || []).map(x=>({...x})); }
  function renderAddr(list){
    const el = document.getElementById('addr_list');
    if (!el) return;
    if (!Array.isArray(list) || !list.length){ el.innerHTML = `<div style="opacity:.7">Ingen adresser.</div>`; return; }
    el.innerHTML = list.map(rowTemplate).join('');
  }
  async function reloadAddr(){ try{ await window.Sync?.reload?.(); }catch(e){} renderAddr(currentAddresses()); }
  function collectAddr(){
    const out = [];
    document.querySelectorAll('#addr_list .addr_row').forEach(row=>{
      const id   = row.dataset.id || String(Date.now())+Math.random().toString(36).slice(2);
      const name = row.querySelector('.a_name')?.value || '';
      const active = row.querySelector('.a_active')?.checked || false;
      const snow = row.querySelector('.a_snow')?.checked || false;
      const grit = row.querySelector('.a_grit')?.checked || false;
      const coordsTxt = row.querySelector('.a_coords')?.value || '';
      const note = row.querySelector('.a_note')?.value || '';
      const {lat, lon} = parseCoordinates(coordsTxt);
      out.push({ id, name, active, tasks:{snow,grit}, pins:{}, lat: lat==null?null:lat, lon: lon==null?null:lon, note });
    });
    return out;
  }
  async function saveAddr(){
    const list = collectAddr();
    if (window.Sync?.setAddresses){ await window.Sync.setAddresses(list); alert('Lagret (sky) ✅'); return; }
    localStorage.setItem('BRYT_ADDR_LOCAL', JSON.stringify(list));
    alert('Lagret lokalt ✅');
  }
  function addAddr(){
    const list = currentAddresses();
    list.push({ id:String(Date.now()), name:'', active:true, tasks:{snow:true,grit:true}, pins:{}, lat:null, lon:null, note:'' });
    renderAddr(list);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    ensureMarkup();
    adminLoadBase();
    document.getElementById('admin_save_bins')?.addEventListener('click', adminSaveBase);
    document.getElementById('addr_reload')?.addEventListener('click', reloadAddr);
    document.getElementById('addr_add')?.addEventListener('click', addAddr);
    document.getElementById('addr_save_all')?.addEventListener('click', saveAddr);
    renderAddr(currentAddresses());
  });
})();