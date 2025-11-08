// js/work_log_start_done.js — logger Start/Ferdig til JSONBin (med riktig sjåførnavn)
(() => {
  'use strict';

  const BIN_HENDELSER = "68e89e3443b1c97be9611c48";
  const API = "https://api.jsonbin.io/v3/b";

  const getMK = () =>
    (localStorage.getItem('X-Master-Key') ||
     localStorage.getItem('x-master-key') ||
     localStorage.getItem('jsonbin_master_key') || '').trim();
  const getAK = () =>
    (localStorage.getItem('X-Access-Key') ||
     localStorage.getItem('x-access-key') ||
     localStorage.getItem('jsonbin_access_key') || '').trim();

  function headers(json=false){
    const h={}; if(json) h['Content-Type']='application/json';
    const mk=getMK(), ak=getAK(); if(mk) h['X-Master-Key']=mk; if(ak) h['X-Access-Key']=ak;
    return h;
  }

  async function binGetArray(){
    const r = await fetch(`${API}/${BIN_HENDELSER}/latest`, { headers: headers(false) });
    if (!r.ok) throw new Error('JSONBin GET ' + r.status);
    const js = await r.json();
    return Array.isArray(js.record) ? js.record
         : Array.isArray(js.record?.items) ? js.record.items
         : Array.isArray(js.record?.reports) ? js.record.reports
         : [];
  }
  async function binPutArray(arr){
    const r = await fetch(`${API}/${BIN_HENDELSER}`, {
      method:'PUT', headers:{ ...headers(true), 'X-Bin-Meta':'false' }, body: JSON.stringify(arr)
    });
    if (!r.ok) throw new Error('JSONBin PUT ' + r.status);
    return r.json();
  }

  function activeAddress(){
    const name = (document.getElementById('b_now')?.textContent || '').trim() || '(ukjent)';
    return { id: name, name };
  }

  function driverName(){
    if (typeof window.getDriverName === 'function') return window.getDriverName();
    return (document.getElementById('a_driver')?.value ||
            localStorage.getItem('BRYT_DRIVER') ||
            localStorage.getItem('driverName') ||
            localStorage.getItem('sjaforNavn') || 'Ukjent').trim();
  }

  async function logEvent(type){
    if (!getMK()) return; // nøkkel ikke satt, hopp stille

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
      // lagre i "reports" hvis det er formatet som brukes
      let out = arr;
      const rec = await binGetArray();
      const latest = Array.isArray(rec) ? rec : [];
      out = latest.concat([evt]);
      await binPutArray(out);
    }catch(e){
      console.warn('[work_log_start_done] Klarte ikke å lagre hendelse', e);
    }
  }

  function wire(){
    document.getElementById('act_start')?.addEventListener('click', () => logEvent('start'));
    document.getElementById('act_done') ?.addEventListener('click', () => logEvent('done'));
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
