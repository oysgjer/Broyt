// js/admin-navshortcuts.js
// Små hjelpefunksjoner for å laste/lagre destinasjoner (Diesel/Grus/Base) i BRYT_SETTINGS.navShortcuts
(function(root){
  'use strict';
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const LS_SETTINGS='BRYT_SETTINGS';

  function _settings(){ return RJ(LS_SETTINGS, {}); }

  function adminLoadNavShortcuts(){
    const st = _settings();
    const ns = st.navShortcuts || {};
    const fill = (key)=>{
      const sc = ns[key] || {};
      const g = id => document.getElementById('ns_'+key+'_'+id);
      if (g('name'))  g('name').value  = sc.name  || '';
      if (g('query')) g('query').value = sc.query || '';
      if (g('lat'))   g('lat').value   = (typeof sc.lat==='number' ? sc.lat : '');
      if (g('lon'))   g('lon').value   = (typeof sc.lon==='number' ? sc.lon : '');
    };
    ['diesel','grus','base'].forEach(fill);
  }

  function adminSaveNavShortcuts(){
    const st = _settings();
    st.navShortcuts = st.navShortcuts || {};
    const take = (key)=>{
      const g = id => document.getElementById('ns_'+key+'_'+id);
      const name  = (g('name')?.value  || '').trim();
      const query = (g('query')?.value || '').trim();
      const latR  = (g('lat')?.value   || '').trim();
      const lonR  = (g('lon')?.value   || '').trim();
      const lat = latR==='' ? undefined : Number(latR);
      const lon = lonR==='' ? undefined : Number(lonR);
      st.navShortcuts[key] = {
        name: name || undefined,
        query: query || undefined,
        lat: (typeof lat==='number' && !Number.isNaN(lat)) ? lat : undefined,
        lon: (typeof lon==='number' && !Number.isNaN(lon)) ? lon : undefined
      };
    };
    ['diesel','grus','base'].forEach(take);
    WJ(LS_SETTINGS, st);
  }

  // Eksponer for din eksisterende Admin-kode
  root.AdminNavShortcuts = { load: adminLoadNavShortcuts, save: adminSaveNavShortcuts };

  // Auto-hook: hvis feltene er på siden og en knapp med id=admin_save_bins finnes,
  // laster vi verdier ved DOMContentLoaded, og pusher lagring når admin_save_bins trykkes.
  document.addEventListener('DOMContentLoaded', ()=>{
    // Finn om feltene eksisterer (valgfri automatikk)
    const hasFields = ['diesel','grus','base'].some(k => document.getElementById('ns_'+k+'_name'));
    if (hasFields){
      try{ adminLoadNavShortcuts(); }catch(e){ console.warn('AdminNavShortcuts load:', e); }
      const saveBtn = document.getElementById('admin_save_bins');
      if (saveBtn){
        saveBtn.addEventListener('click', ()=>{
          try{ adminSaveNavShortcuts(); }catch(e){ console.warn('AdminNavShortcuts save:', e); }
        });
      }
    }
  });
})(window);