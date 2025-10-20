/* =========================================================
   Admin.js — Skyoppsett, test-tilkobling og cache-rydding
   - Leser / lagrer GET-URL, PUT-URL og X-Master-Key i localStorage
   - Tester tilkobling mot JSONBin (GET)
   - Tøm lokal cache (BROYT_LOCAL_DATA)
   - Leser/skriver service-lokasjoner (grus/diesel/base) til sky (JSONBin)
   ---------------------------------------------------------
   Forventer at Admin-siden har følgende elementer (ID-er):
   - adm_geturl, adm_puturl, adm_key
   - adm_urls_save, adm_urls_clear, adm_test, adm_test_status
   - adm_cache_clear
   - adm_grus, adm_diesel, adm_base, adm_settings_save, adm_settings_status
   ---------------------------------------------------------
   Nøkkel-lagring:
   BROYT_BIN_URL   = JSONBin GET (helst .../latest)
   BROYT_BIN_PUT   = JSONBin PUT (bin basen uten /latest)
   BROYT_XKEY      = JSONBin X-Master-Key
   BROYT_LOCAL_DATA= Lokal sky-cache (tømmes fra knappen)
   ========================================================= */

(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  /* ---------- LocalStorage helpers ---------- */
  const LS={
    get getUrl(){ return localStorage.getItem('BROYT_BIN_URL') || ''; },
    set getUrl(v){ v?localStorage.setItem('BROYT_BIN_URL',v):localStorage.removeItem('BROYT_BIN_URL'); },

    get putUrl(){ return localStorage.getItem('BROYT_BIN_PUT') || ''; },
    set putUrl(v){ v?localStorage.setItem('BROYT_BIN_PUT',v):localStorage.removeItem('BROYT_BIN_PUT'); },

    get key(){ return localStorage.getItem('BROYT_XKEY') || ''; },
    set key(v){ v?localStorage.setItem('BROYT_XKEY',v):localStorage.removeItem('BROYT_XKEY'); },
  };

  function jsonbinHeaders(){
    const h = {'Content-Type':'application/json'};
    const k = LS.key.trim();
    if(k) h['X-Master-Key'] = k;
    return h;
  }

  /* ---------- UI: Prefill felter ---------- */
  function prefill(){
    const g=$('#adm_geturl'), p=$('#adm_puturl'), k=$('#adm_key');
    if(g) g.value = LS.getUrl;
    if(p) p.value = LS.putUrl;
    if(k) k.value = LS.key;
  }

  /* ---------- Lagre / fjerne URL-er og nøkkel ---------- */
  function saveUrlsAndKey(){
    const g=($('#adm_geturl')?.value||'').trim();
    const p=($('#adm_puturl')?.value||'').trim();
    const k=($('#adm_key')?.value||'').trim();

    LS.getUrl = g;
    LS.putUrl = p;
    LS.key    = k;

    toast('✅ Lagret sky-oppsett.');
  }
  function clearUrlsAndKey(){
    $('#adm_geturl') && ($('#adm_geturl').value='');
    $('#adm_puturl') && ($('#adm_puturl').value='');
    $('#adm_key')    && ($('#adm_key').value='');

    LS.getUrl = '';
    LS.putUrl = '';
    LS.key    = '';

    toast('🧹 Fjernet URL-er og nøkkel fra denne enheten.');
  }

  /* ---------- Test tilkobling mot JSONBin (GET) ---------- */
  async function testConnection(){
    const el = $('#adm_test_status');
    if(el){ el.textContent='Tester…'; el.style.color=''; }

    const url = LS.getUrl.trim();
    if(!url){
      if(el){ el.textContent='Manglende GET-URL'; el.style.color='#ef4444'; }
      return;
    }
    try{
      const r = await fetch(url, {headers: jsonbinHeaders()});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      const rec = j && (j.record||j);
      const ver = rec?.version || '(ukjent versjon)';
      if(el){ el.textContent = 'Tilkoblet ✔ ('+ver+')'; el.style.color='#22c55e'; }
      toast('✅ Tilkobling OK');
    }catch(err){
      if(el){ el.textContent = 'Feil: '+(err.message||'ukjent'); el.style.color='#ef4444'; }
      toast('❌ Klarte ikke å hente fra skyen.');
    }
  }

  /* ---------- Tøm lokal cache ---------- */
  function clearLocalCache(){
    localStorage.removeItem('BROYT_LOCAL_DATA');
    toast('🧽 Lokal cache er tømt.');
  }

  /* ---------- Hent/Skriv service-lokasjoner (grus/diesel/base) ---------- */
  async function fetchSettingsFromCloud(){
    const sEl = $('#adm_settings_status');
    if(sEl){ sEl.textContent='Henter…'; sEl.style.color=''; }

    const gUrl = LS.getUrl.trim();
    if(!gUrl){
      if(sEl){ sEl.textContent='Manglende GET-URL'; sEl.style.color='#ef4444'; }
      return;
    }
    try{
      const r = await fetch(gUrl, {headers: jsonbinHeaders()});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      const rec = j && (j.record||j) || {};
      const st  = rec.settings || {};
      if($('#adm_grus'))   $('#adm_grus').value   = st.grusDepot || '';
      if($('#adm_diesel')) $('#adm_diesel').value = st.diesel    || '';
      if($('#adm_base'))   $('#adm_base').value   = st.base      || '';
      if(sEl){ sEl.textContent='Hentet fra sky ✔'; sEl.style.color='#22c55e'; }
    }catch(err){
      if(sEl){ sEl.textContent='Feil: '+(err.message||'ukjent'); sEl.style.color='#ef4444'; }
    }
  }

  async function saveSettingsToCloud(){
    const sEl = $('#adm_settings_status');
    if(sEl){ sEl.textContent='Lagrer…'; sEl.style.color=''; }

    const putUrl = LS.putUrl.trim();
    const getUrl = LS.getUrl.trim();
    if(!putUrl || !getUrl){
      if(sEl){ sEl.textContent='Mangler PUT-URL/GET-URL'; sEl.style.color='#ef4444'; }
      return;
    }
    try{
      // 1) Hent nåværende dokument
      const r = await fetch(getUrl, {headers: jsonbinHeaders()});
      if(!r.ok) throw new Error('GET '+r.status);
      const j = await r.json();
      const rec = (j && (j.record||j)) || {};

      // 2) Patch settings
      const st = Object.assign({}, rec.settings||{});
      st.grusDepot = ($('#adm_grus')?.value||'').trim();
      st.diesel    = ($('#adm_diesel')?.value||'').trim();
      st.base      = ($('#adm_base')?.value||'').trim();

      rec.settings = st;
      rec.updated  = Date.now();
      try{ rec.by = (JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}').driver) || 'admin'; }catch{ rec.by='admin'; }

      // 3) PUT tilbake
      const pr = await fetch(putUrl, {
        method:'PUT',
        headers: jsonbinHeaders(),
        body: JSON.stringify(rec)
      });
      if(!pr.ok) throw new Error('PUT '+pr.status);

      if(sEl){ sEl.textContent='Lagret i sky ✔'; sEl.style.color='#22c55e'; }
      toast('✅ Service-lokasjoner lagret.');
    }catch(err){
      if(sEl){ sEl.textContent='Feil: '+(err.message||'ukjent'); sEl.style.color='#ef4444'; }
      toast('❌ Klarte ikke å lagre i skyen.');
    }
  }

  /* ---------- Små helpers ---------- */
  let toastTimer=null;
  function toast(msg){
    let el = $('#admin_toast');
    if(!el){
      el = document.createElement('div');
      el.id='admin_toast';
      el.style.position='fixed';
      el.style.left='50%';
      el.style.bottom='18px';
      el.style.transform='translateX(-50%)';
      el.style.background='rgba(0,0,0,.75)';
      el.style.color='#fff';
      el.style.padding='10px 14px';
      el.style.borderRadius='10px';
      el.style.fontSize='14px';
      el.style.zIndex='3000';
      el.style.backdropFilter='saturate(140%) blur(6px)';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    el.style.opacity='1';
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{ el.style.opacity='0'; }, 1800);
  }

  /* ---------- Wire events ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    prefill();

    $('#adm_urls_save')   && $('#adm_urls_save').addEventListener('click', saveUrlsAndKey);
    $('#adm_urls_clear')  && $('#adm_urls_clear').addEventListener('click', clearUrlsAndKey);
    $('#adm_test')        && $('#adm_test').addEventListener('click', testConnection);
    $('#adm_cache_clear') && $('#adm_cache_clear').addEventListener('click', clearLocalCache);

    // Service-lokasjoner
    $('#adm_settings_save')  && $('#adm_settings_save').addEventListener('click', saveSettingsToCloud);

    // Hent automatisk lokasjoner fra sky ved åpning (om GET-URL finnes)
    if(LS.getUrl.trim()){
      fetchSettingsFromCloud();
    }
  });
})();