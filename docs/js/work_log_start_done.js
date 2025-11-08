// js/work_log_start_done.js — logger Start/Ferdig til JSONBin (uten å endre Work.js)
(() => {
  'use strict';

  const BIN_HENDELSER = "68e89e3443b1c97be9611c48";
  const API = "https://api.jsonbin.io/v3/b";

  // --- Nøkler fra Admin ---
  const getMK = () =>
    (localStorage.getItem('X-Master-Key') ||
     localStorage.getItem('x-master-key') ||
     localStorage.getItem('jsonbin_master_key') || '').trim();
  const getAK = () =>
    (localStorage.getItem('X-Access-Key') ||
     localStorage.getItem('x-access-key') ||
     localStorage.getItem('jsonbin_access_key') || '').trim();

  function headers(json=false){
    const h={};
    if (json) h['Content-Type']='application/json';
    const mk=getMK(); const ak=getAK();
    if (mk) h['X-Master-Key']=mk;
    if (ak) h['X-Access-Key']=ak;
    return h;
  }

  async function binGetArray(){
    const r = await fetch(`${API}/${BIN_HENDELSER}/latest`, { headers: headers(false) });
    if (!r.ok) throw new Error('JSONBin GET ' + r.status);
    const js = await r.json();
    return Array.isArray(js.record) ? js.record : (js.record?.items || []);
  }
  async function binPutArray(arr){
    const r = await fetch(`${API}/${BIN_HENDELSER}`, {
      method:'PUT',
      headers:{ ...headers(true), 'X-Bin-Meta':'false' },
      body: JSON.stringify(arr)
    });
    if (!r.ok) throw new Error('JSONBin PUT ' + r.status);
    return r.json();
  }

  // --- Hjelpere fra UI ---
  function activeAddress(){
    // Foretrekk Work.js-hook hvis den finnes
    if (typeof window.__getCurrentAddress === 'function'){
      const o = window.__getCurrentAddress();
      if (o) return o; // {id, name}
    }
    // Fallback: les teksten i "Nå"
    const name = (document.getElementById('b_now')?.textContent || '').trim() || '(ukjent)';
    return { id: name, name };
  }
  function driverName(){
    const v = (document.getElementById('a_driver')?.value ||
               localStorage.getItem('driverName') ||
               localStorage.getItem('sjaforNavn') || '').trim();
    return v || 'Ukjent sjåfør';
  }

  async function logEvent(type){
    if (!getMK()){
      // vennlig hint – ingen blocking
      console.warn('[work_log_start_done] Mangler JSONBin-nøkkel. Gå til Admin og legg inn X-Master-Key.');
      return;
    }
    const addr = activeAddress();
    const evt = {
      type, // 'start' | 'done'
      addressId: addr?.id || addr?.name || '(ukjent)',
      addressName: addr?.name || '',
      at: new Date().toISOString(),
      by: driverName()
    };
    try{
      const arr = await binGetArray();
      arr.push(evt);
      await binPutArray(arr);
    }catch(e){
      console.warn('[work_log_start_done] Klarte ikke å lagre hendelse', e);
    }
  }

  function wire(){
    // Lytt på knappene – logger samtidig som Work.js oppdaterer status
    document.getElementById('act_start')?.addEventListener('click', () => logEvent('start'));
    document.getElementById('act_done') ?.addEventListener('click', () => logEvent('done'));

    // Ekstra robusthet: hvis Sync finnes, lytt på endringer og fang opp overganger
    if (window.Sync && typeof window.Sync.on === 'function'){
      let lastState = null;
      window.Sync.on('change', () => {
        try {
          const addr = activeAddress();
          const cache = window.Sync.getCache?.() || {};
          const lane = (JSON.parse(localStorage.getItem('BRYT_RUN')||'{}').lane) || 'snow';
          const s = cache.status?.[addr?.id]?.[lane];
          const st = s?.state || null; // 'venter' | 'pågår' | 'ferdig' | ...
          if (st && st !== lastState){
            if (st === 'pågår') logEvent('start');
            if (st === 'ferdig') logEvent('done');
            lastState = st;
          }
        } catch {}
      });
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
