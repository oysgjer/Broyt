// js/Sync.js
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_CFG       = 'BRYT_SYNC_CFG';     // {binId, apiKey}
  const K_ADDRCACHE = 'BRYT_ADDR_CACHE';   // {ts, data:[...]}
  const API_BASE    = 'https://api.jsonbin.io/v3/b';

  function getCfg(){ return RJ(K_CFG, {binId:'', apiKey:''}); }
  function setCfg(c){ WJ(K_CFG, c); }

  function headers(){
    const { apiKey } = getCfg();
    return {
      'Content-Type': 'application/json',
      'X-Master-Key': apiKey || ''
    };
  }

  function setBadge(ok){
    const b = $('#sync_badge');
    if (!b) return;
    b.innerHTML = ok
      ? `<span class="dot dot-ok"></span> Synk: OK`
      : `<span class="dot dot-err"></span> Synk: feil`;
  }

  function normalizeArray(arr){
    return (arr||[]).map((a,i)=>({
      id: a.id ?? String(i+1),
      name: a.name || a.title || a.adresse || `Adresse #${i+1}`,
      lat: a.lat ?? a.latitude ?? null,
      lon: a.lon ?? a.longitude ?? null,

      snow:  a.snow ?? true,     // hvilke oppdrag som finnes
      grit:  a.grit ?? false,

      snowStart: a.snowStart, snowEnd: a.snowEnd,
      gritStart: a.gritStart, gritEnd: a.gritEnd,
      skipped: !!a.skipped, blocked: !!a.blocked,

      driver: a.driver || '',
      pins: a.pins ?? a.brøytepinner ?? 0
    }));
  }

  function cached(){ return RJ('BRYT_ADDR_CACHE', {ts:0,data:[]}).data || []; }

  async function fetchLatest(){
    const { binId, apiKey } = getCfg();
    if (!binId || !apiKey) throw new Error('Sync ikke konfigurert');
    const res = await fetch(`${API_BASE}/${binId}/latest`, { headers: headers() });
    if (!res.ok) throw new Error(`Henting feilet: ${res.status}`);
    const body = await res.json();
    const data = body.record?.addresses || body.record || [];
    const norm = normalizeArray(data);
    WJ('BRYT_ADDR_CACHE', { ts: Date.now(), data: norm });
    setBadge(true);
    return norm;
  }

  async function putAll(addresses){
    const { binId, apiKey } = getCfg();
    if (!binId || !apiKey) throw new Error('Sync ikke konfigurert');
    const res = await fetch(`${API_BASE}/${binId}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ addresses })
    });
    if (!res.ok) throw new Error(`Lagring feilet: ${res.status}`);
    const body = await res.json();
    const data = body.record?.addresses || body.record || addresses;
    const norm = normalizeArray(data);
    WJ('BRYT_ADDR_CACHE', { ts: Date.now(), data: norm });
    setBadge(true);
    return norm;
  }

  function ts(x){ return x ? new Date(x).getTime() : 0; }
  function mergeOne(localA, incomingA){
    const out = { ...localA, ...incomingA };
    ['snowStart','snowEnd','gritStart','gritEnd'].forEach(f=>{
      const lv = localA?.[f], iv = incomingA?.[f];
      out[f] = (ts(iv) >= ts(lv)) ? iv : lv;
    });
    ['skipped','blocked','driver','pins','snow','grit'].forEach(f=>{
      if (incomingA?.hasOwnProperty(f)) out[f] = incomingA[f];
    });
    return out;
  }

  async function setStatus(addressId, patch){
    const cur = cached();
    const i = cur.findIndex(a => a.id==addressId);
    if (i === -1) throw new Error('Adresse ikke funnet lokalt');
    cur[i] = mergeOne(cur[i], patch);                        // optimistisk lokalt
    WJ('BRYT_ADDR_CACHE', { ts: Date.now(), data: cur });
    try{
      const remote = await fetchLatest();                    // hent siste
      const j = remote.findIndex(a => a.id==addressId);
      if (j !== -1) remote[j] = mergeOne(remote[j], patch);  // slå sammen
      else remote.push({ id: addressId, ...patch });
      return await putAll(remote);                           // lagre alt
    }catch(e){ setBadge(false); throw e; }
  }

  async function loadAddresses({force=false}={}){
    if (force) return fetchLatest();
    const c = cached();
    return (c && c.length) ? c : fetchLatest();
  }

  async function saveAddresses(addresses){ return putAll(addresses); }

  // Polling for 2 sjåfører
  let pollTimer=null;
  function startPolling(ms=15000){
    stopPolling();
    pollTimer = setInterval(async ()=>{ try{ await fetchLatest(); }catch{ setBadge(false);} }, ms);
  }
  function stopPolling(){ if (pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

  window.Sync = Object.freeze({
    getConfig: getCfg,
    setConfig: setCfg,
    loadAddresses,
    saveAddresses,
    setStatus,
    startPolling,
    stopPolling
  });

  document.addEventListener('DOMContentLoaded', ()=>{
    const {binId, apiKey} = getCfg();
    if (binId && apiKey) startPolling(15000);
  });
})();