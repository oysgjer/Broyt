// js/work_block_reason.js — lagre årsak for "Ikke mulig" til hendelser
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

  function activeAddress(){
    // foretrekk Work.js-hook hvis den finnes
    if (typeof window.__getCurrentAddress === 'function'){
      const o = window.__getCurrentAddress();
      if (o) return o;
    }
    // fallback: hent fra tekstfelt i UI
    const name = (document.getElementById('b_now')?.textContent || '').trim() || '(ukjent)';
    return { id: name, name };
  }
  function driverName(){
    const v = (document.getElementById('a_driver')?.value ||
               localStorage.getItem('driverName') ||
               localStorage.getItem('sjaforNavn') || '').trim();
    return v || 'Ukjent sjåfør';
  }

  async function onBlock(){
    // sikre at nøkkel finnes
    if (!getMK()){
      alert('Mangler JSONBin-nøkkel. Gå til Admin og legg inn X-Master-Key.');
      location.hash = '#admin';
      return;
    }

    const reason = prompt('Hvorfor var det ikke mulig? (lagres i loggen)');
    if (reason == null) return; // avbrutt
    const trimmed = reason.trim();
    if (trimmed.length < 3){
      alert('Skriv minst 3 tegn.');
      return;
    }

    try{
      const list = await binGetArray();
      const addr = activeAddress();
      list.push({
        type: 'skip',
        addressId: addr?.id || addr?.name || '(ukjent)',
        addressName: addr?.name || '',
        at: new Date().toISOString(),
        by: driverName(),
        reason: trimmed
      });
      await binPutArray(list);
      alert('“Ikke mulig” lagret i loggen.');
      document.getElementById('act_next')?.click();
    }catch(e){
      console.error(e);
      alert('Klarte ikke å lagre i loggen: ' + (e.message||e));
    }
  }

  function wire(){
    document.getElementById('act_block')?.addEventListener('click', onBlock);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
