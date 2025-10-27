(function(){
  'use strict';
  // Scope guard: run only on Admin page (admin.html, /admin, or #admin)
  (function(){
    const p = (location.pathname || '').toLowerCase();
    const h = (location.hash || '').toLowerCase();
    const t = (document.title || '').toLowerCase();
    const isAdmin = /(^|\/)admin(\.html)?$/.test(p) || h === '#admin' || /\badmin\b/.test(t);
    if (!isAdmin) return; // do nothing on other pages
  })();

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const LS_SETTINGS='BRYT_SETTINGS';
  const LS_CFG='BRYT_CFG';

  const $ = (sel, r=document)=> r.querySelector(sel);
  const el = (tag, props={})=> Object.assign(document.createElement(tag), props);

  function settings(){ return RJ(LS_SETTINGS, {}); }
  function getCfg(){ return RJ(LS_CFG, { binId:'', apiKey:'' }); }
  function setCfg(obj){ const next = { ...getCfg(), ...(obj||{}) }; WJ(LS_CFG, next); return next; }

  function ensureMarkup(){
    // Only inject if we are truly on admin context
    const p = (location.pathname || '').toLowerCase();
    const h = (location.hash || '').toLowerCase();
    const t = (document.title || '').toLowerCase();
    const isAdmin = /(^|\/)admin(\.html)?$/.test(p) || h === '#admin' || /\badmin\b/.test(t);
    if (!isAdmin) return;

    const hasInputs = $('#cfg_bin_drift') || $('#cfg_master_key') || $('#cfg_bin_report');
    if (hasInputs) return;

    const main = document.querySelector('main') || document.body;
    const wrap = el('div', { className: 'wrap' });
    const css = document.createElement('style');
    css.textContent = `
      .wrap{padding:12px}
      .card{background:#fff;border:1px solid #e3e5ea;border-radius:12px;padding:12px;margin:10px 0}
      label{display:block;margin:.5rem 0 .25rem;font-weight:600}
      input[type=text],input[type=password],input[type=email],input[type=number]{width:100%;padding:10px;border:1px solid #e3e5ea;border-radius:10px;background:#fff}
      .row{display:flex;gap:8px;flex-wrap:wrap}
      .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:12px;border:1px solid #e3e5ea;background:#fff;font-weight:700}
      .btn-primary{background:#3b82f6;color:#fff;border-color:transparent}
      h1,h2,h3{margin:.6rem 0}
      .spacer{height:10px}
    `;
    document.head.appendChild(css);

    wrap.innerHTML = `
      <div class="card">
        <h1>Oppsett</h1>
        <label for="cfg_bin_drift">JSONBin ID – Drift</label>
        <input id="cfg_bin_drift" type="text" placeholder="f.eks. 68ed425cae596e708f11d25f">
        <label for="cfg_bin_report">JSONBin ID – Rapporter</label>
        <input id="cfg_bin_report" type="text" placeholder="f.eks. 68e89e3443b1c97be9611c48">
        <label for="cfg_master_key">JSONBin Master Key</label>
        <input id="cfg_master_key" type="password" placeholder="skriv master key">
        <label for="cfg_incident_email">Uhell e‑post (mottaker)</label>
        <input id="cfg_incident_email" type="email" placeholder="f.eks. drift@firma.no">
        <div class="spacer"></div>
        <button id="admin_save_bins" class="btn btn-primary">Lagre</button>
      </div>

      <div class="card">
        <h2>Destinasjoner (snarveier)</h2>
        <p class="small">Fyll inn lat/lon for nøyaktig navigering. Hvis tomt, brukes «Spørring».</p>
        <h3>⛽ Diesel</h3>
        <label>Navn</label><input id="ns_diesel_name" type="text" placeholder="f.eks. Esso Råholt">
        <label>Spørring</label><input id="ns_diesel_query" type="text" placeholder="f.eks. Esso Råholt, Norge">
        <div class="row">
          <input id="ns_diesel_lat" type="number" step="any" placeholder="lat">
          <input id="ns_diesel_lon" type="number" step="any" placeholder "lon">
        </div>
        <h3>🪨 Grus</h3>
        <label>Navn</label><input id="ns_grus_name" type="text" placeholder="f.eks. Sandtak Eidsvoll">
        <label>Spørring</label><input id="ns_grus_query" type="text" placeholder="f.eks. Sandtak Eidsvoll, Norge">
        <div class="row">
          <input id="ns_grus_lat" type="number" step="any" placeholder="lat">
          <input id="ns_grus_lon" type="number" step="any" placeholder="lon">
        </div>
        <h3>🏠 Base</h3>
        <label>Navn</label><input id="ns_base_name" type="text" placeholder="f.eks. Lager Hasler">
        <label>Spørring</label><input id="ns_base_query" type="text" placeholder="f.eks. Haslervegen 1, 2034 Holter">
        <div class="row">
          <input id="ns_base_lat" type="number" step="any" placeholder="lat">
          <input id="ns_base_lon" type="number" step="any" placeholder="lon">
        </div>
      </div>

      <div class="card">
        <h2>Adresse‑register</h2>
        <div class="row">
          <button id="addr_reload" class="btn">Last fra sky</button>
          <button id="addr_add" class="btn">Ny adresse</button>
          <button id="addr_save_all" class="btn btn-primary">Lagre alle</button>
        </div>
        <div id="addr_list" class="spacer"></div>
      </div>
    `;
    main.appendChild(wrap);
  }

  function adminLoadBase(){
    const cfg = getCfg();
    const st  = settings();
    const setVal = (id, val)=>{ const n=$(id); if (n) n.value = val ?? ''; };
    setVal('#cfg_bin_drift', cfg.binId || '');
    setVal('#cfg_bin_report', st.reportBin || '');
    setVal('#cfg_master_key', cfg.apiKey || '');
    setVal('#cfg_incident_email', st.incidentEmail || '');
  }
  function adminSaveBase(){
    const v = (id)=> ($(id)?.value || '').trim();
    const driftBin   = v('#cfg_bin_drift');
    const reportBin  = v('#cfg_bin_report');
    const masterKey  = v('#cfg_master_key');
    const incidentTo = v('#cfg_incident_email');
    setCfg({ binId: driftBin, apiKey: masterKey });
    const st = settings();
    st.reportBin = reportBin;
    st.incidentEmail = incidentTo;
    WJ(LS_SETTINGS, st);
    alert('Lagret ✅');
  }

  function cache(){ return (window.Sync?.getCache?.() || { addresses: RJ('BRYT_ADDR_LOCAL', []), status: RJ('BRYT_STATUS_LOCAL', {}) }); }
  function currentAddresses(){ return (cache().addresses || []).map(x=>({...x})); }
  function rowTemplate(a){
    const checked = a.active ? 'checked' : '';
    const tSnow = (a?.tasks?.snow ? 'checked' : '');
    const tGrit = (a?.tasks?.grit ? 'checked' : '');
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
        <div class="row">
          <input class="a_lat" type="number" step="any" placeholder="lat" value="${a.lat??''}">
          <input class="a_lon" type="number" step="any" placeholder="lon" value="${a.lon??''}">
        </div>
      </div>`;
  }
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
      const lat  = row.querySelector('.a_lat')?.value;
      const lon  = row.querySelector('.a_lon')?.value;
      out.push({ id, name, active, tasks:{snow,grit}, pins:{}, lat: lat===''?null:Number(lat), lon: lon===''?null:Number(lon) });
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
    list.push({ id:String(Date.now()), name:'', active:true, tasks:{snow:true,grit:true}, pins:{}, lat:null, lon:null });
    renderAddr(list);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // run only on admin
    const p = (location.pathname || '').toLowerCase();
    const h = (location.hash || '').toLowerCase();
    const t = (document.title || '').toLowerCase();
    const isAdmin = /(^|\/)admin(\.html)?$/.test(p) || h === '#admin' || /\badmin\b/.test(t);
    if (!isAdmin) return;

    ensureMarkup();
    adminLoadBase();
    $('#admin_save_bins')?.addEventListener('click', adminSaveBase);
    $('#addr_reload')?.addEventListener('click', reloadAddr);
    $('#addr_add')?.addEventListener('click', addAddr);
    $('#addr_save_all')?.addEventListener('click', saveAddr);
    renderAddr(currentAddresses());
  });
})();