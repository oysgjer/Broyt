// js/sync.js
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_CFG       = 'BRYT_SYNC_CFG';     // {binId, apiKey}
  const K_ADDRCACHE = 'BRYT_ADDR_CACHE';   // {ts, data:[...]}
  const K_RUN       = 'BRYT_RUN';          // {driver, equipment, dir, idx, roundId, type}

  const API_BASE = 'https://api.jsonbin.io/v3/b';

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
    const dot = b?.querySelector('.dot');
    if (!b || !dot) return;
    if (ok){
      b.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`;
    } else {
      b.innerHTML = `<span class="dot dot-err"></span> Synk: feil`;
    }
  }

  async function fetchLatest(){
    const { binId, apiKey } = getCfg();
    if (!binId || !apiKey) throw new Error('Sync ikke konfigurert');
    const url = `${API_BASE}/${binId}/latest`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`Henting feilet: ${res.status}`);
    const body = await res.json();
    // Forventet struktur i JSONBin:
    // { season: "2025-26", addresses: [ {id,name,lat,lon, snowStart,...} ], updatedAt: ... }
    const data = body.record?.addresses || body.record || [];
    const now  = Date.now();

    const normalized = normalizeArray(data);
    WJ(K_ADDRCACHE, { ts: now, data: normalized });
    setBadge(true);
    return normalized;
  }

  function normalizeArray(arr){
    return (arr||[]).map((a,i)=>({
      id: a.id ?? String(i+1),
      name: a.name || a.title || a.adresse || `Adresse #${i+1}`,
      lat: a.lat ?? a.latitude ?? null,
      lon: a.lon ?? a.longitude ?? null,
      snowStart: a.snowStart, snowEnd: a.snowEnd,
      gritStart: a.gritStart, gritEnd: a.gritEnd,
      driver: a.driver || '',
      skipped: !!a.skipped,
      blocked: !!a.blocked,
      pins: a.pins ?? a.brøytepinner ?? 0,
      snow: a.snow ?? true,     // hvilke oppdrag aktivert
      grit: a.grit ?? false
    }));
  }

  function cached(){
    return RJ(K_ADDRCACHE, { ts:0, data:[] }).data || [];
  }

  async function putAll(addresses){
    const { binId, apiKey } = getCfg();
    if (!binId || !apiKey) throw new Error('Sync ikke konfigurert');

    const url = `${API_BASE}/${binId}`;
    const payload = { addresses };
    const res = await fetch(url, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Lagring feilet: ${res.status}`);
    const body = await res.json();
    const data = body.record?.addresses || body.record || addresses;
    const norm = normalizeArray(data);
    WJ(K_ADDRCACHE, { ts: Date.now(), data: norm });
    setBadge(true);
    return norm;
  }

  async function saveAddresses(addresses){
    // brukes fra Admin for å lagre adresseregisteret
    return putAll(addresses);
  }

  function mergeOne(localA, incomingA){
    // enkel “sist timestamp vinner” på felt vi sporer med tidsstempler
    function ts(x){ return x ? new Date(x).getTime() : 0; }
    const out = {...localA, ...incomingA};

    // for hver tids-felt: velg nyeste
    const fields = ['snowStart','snowEnd','gritStart','gritEnd'];
    fields.forEach(f=>{
      const la = localA?.[f]; const ia = incomingA?.[f];
      out[f] = (ts(ia) >= ts(la)) ? ia : la;
    });

    // bools + driver – bare ta incoming
    ['skipped','blocked','driver'].forEach(f=>{
      if (incomingA?.hasOwnProperty(f)) out[f] = incomingA[f];
    });

    return out;
  }

  async function setStatus(addressId, patch){
    // patch: { snowStart/snowEnd/gritStart/gritEnd/skipped/blocked/driver }
    const current = cached();
    const idx = current.findIndex(a => (a.id==addressId));
    if (idx === -1) throw new Error('Adresse ikke funnet lokalt');

    // optimistisk oppdatering lokalt
    current[idx] = mergeOne(current[idx], patch);
    WJ(K_ADDRCACHE, { ts: Date.now(), data: current });

    try{
      // push til sky: hent siste, slå sammen, PUT alt
      const remote = await fetchLatest(); // siste
      const rIdx = remote.findIndex(a => (a.id==addressId));
      if (rIdx !== -1){
        remote[rIdx] = mergeOne(remote[rIdx], patch);
      } else {
        remote.push({ id: addressId, name: current[idx].name, ...patch });
      }
      const saved = await putAll(remote);
      return saved;
    }catch(e){
      setBadge(false);
      console.error(e);
      throw e;
    }
  }

  // === Polling slik at sjåfører ser hverandre ===
  let pollTimer = null;
  function startPolling(intervalMs=15000){
    stopPolling();
    pollTimer = setInterval(async ()=>{
      try{ await fetchLatest(); }catch(e){ setBadge(false); }
    }, intervalMs);
  }
  function stopPolling(){ if (pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

  async function loadAddresses({force=false} = {}){
    // brukes ved oppstart og fra Status
    if (force) return fetchLatest();
    const cachedData = cached();
    if (cachedData.length) return cachedData;
    return fetchLatest();
  }

  // eksponer
  window.Sync = Object.freeze({
    getConfig: getCfg,
    setConfig: setCfg,
    loadAddresses,
    saveAddresses,    // Admin
    setStatus,        // Work
    startPolling,
    stopPolling
  });

  // Autostart polling
  document.addEventListener('DOMContentLoaded', ()=>{
    const {binId, apiKey} = getCfg();
    if (binId && apiKey) startPolling(15000);
  });
})();