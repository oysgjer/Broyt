// js/Service.js
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const readJSON  = (k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;}};
  const writeJSON = (k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const K_SERVICE = 'BRYT_SERVICE_LOGS';

  function collectForm(){
    return {
      skjaer: $('#svc_skjaer')?.checked,
      fres: $('#svc_fres')?.checked,
      forstilling: $('#svc_forstilling')?.checked,
      olje_foran: $('#svc_olje_foran')?.checked,
      olje_bak: $('#svc_olje_bak')?.checked,
      olje_etterfylt: $('#svc_olje_etterfylt')?.checked,
      diesel: $('#svc_diesel')?.checked,
      grus: $('#svc_grus')?.value || '',
      annet: $('#svc_annet')?.value || '',
      tid: new Date().toLocaleString()
    };
  }

  function saveService(){
    const entry = collectForm();
    const logs = readJSON(K_SERVICE, []);
    logs.push(entry);
    writeJSON(K_SERVICE, logs);
    $('#svc_status').textContent = '✅ Service lagret ' + entry.tid;

    // Til testing: send valg om e-post
    setTimeout(()=>{
      if(confirm('Vil du sende servicerapport på e-post til oysgjer@gmail.com?')){
        window.open(`mailto:oysgjer@gmail.com?subject=Servicerapport&body=${encodeURIComponent(JSON.stringify(entry,null,2))}`);
      }
    },300);
  }

  function wire(){
    $('#svc_save')?.addEventListener('click', saveService);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();