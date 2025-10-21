// js/sync.js
(() => {
  'use strict';

  const K_SYNC_CFG   = 'BRYT_SYNC_CFG';   // {binId, apiKey}
  const K_ADDR_CACHE = 'BRYT_ADDR_CACHE'; // {ts, data}

  const $ = (s, r = document) => r.querySelector(s);

  function readJSON(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
  function writeJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  const state = {
    binId:  readJSON(K_SYNC_CFG, {})?.binId  || '',
    apiKey: readJSON(K_SYNC_CFG, {})?.apiKey || '',
  };

  function isConfigured(){
    return !!(state.binId && state.apiKey);
  }

  function setConfig({binId, apiKey} = {}){
    if (typeof binId === 'string')  state.binId  = binId.trim();
    if (typeof apiKey === 'string') state.apiKey = apiKey.trim();
    writeJSON(K_SYNC_CFG, { binId: state.binId, apiKey: state.apiKey });
    paintBadge('unknown'); // tving oppdatering
  }

  function getConfig(){
    return { binId: state.binId, apiKey: state.apiKey };
  }

  function paintBadge(status, at = new Date()){
    const badge = $('#sync_badge');
    if (!badge) return;
    const dot = badge.querySelector('.dot') || badge;
    let label = 'Synk: ';
    dot.classList.remove('dot-ok','dot-warn','dot-err','dot-unknown');

    switch(status){
      case 'ok':      dot.classList.add('dot-ok');      label += 'OK'; break;
      case 'warn':    dot.classList.add('dot-warn');    label += 'advarsel'; break;
      case 'err':     dot.classList.add('dot-err');     label += 'feil'; break;
      default:        dot.classList.add('dot-unknown'); label += 'ukjent';
    }
    // legg til klokkeslett når vi faktisk har vært i kontakt
    if (status === 'ok') {
      const hh = at.getHours().toString().padStart(2,'0');
      const mm = at.getMinutes().toString().padStart(2,'0');
      badge.textContent = `Synk: OK • ${hh}:${mm}`;
    } else {
      badge.textContent = label;
    }
  }

  async function fetchJSON(url, opts = {}){
    const { apiKey } = getConfig();
    const headers = {
      'X-Master-Key': apiKey,
      'Accept': 'application/json'
    };
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // Hent adresser fra JSONBin og cache i localStorage
  async function loadAddresses({force = false} = {}){
    if (!isConfigured()) throw new Error('Sync ikke konfigurert (binId/apiKey).');

    if (!force){
      const cache = readJSON(K_ADDR_CACHE, null);
      if (cache && Array.isArray(cache.data) && cache.data.length){
        paintBadge('ok', new Date(cache.ts));
        return cache.data;
      }
    }

    const { binId } = getConfig();
    const base = 'https://api.jsonbin.io/v3/b';
    const url  = `${base}/${encodeURIComponent(binId)}/latest`;

    const json = await fetchJSON(url);
    // JSONBin v3: {record: <din-data>, metadata:{...}}
    const record = json?.record;
    // Forvent format: { addresses: [...] } eller en ren array
    const addrs = Array.isArray(record) ? record
                 : Array.isArray(record?.addresses) ? record.addresses
                 : [];

    writeJSON(K_ADDR_CACHE, { ts: Date.now(), data: addrs });
    paintBadge('ok', new Date());
    return addrs;
  }

  // Stub – når vi kobler på sky-skriving kan denne oppdateres
  async function setStatus(id, payload){
    // Lokal oppdatering bare for nå
    try {
      const cache = readJSON(K_ADDR_CACHE, {ts:Date.now(), data:[]});
      const i = cache.data.findIndex(a => a.id === id || a.name === id);
      if (i >= 0) cache.data[i] = { ...cache.data[i], ...payload };
      writeJSON(K_ADDR_CACHE, cache);
      paintBadge('ok', new Date());
      return true;
    } catch (e){
      paintBadge('err');
      throw e;
    }
  }

  // Eksporter
  window.Sync = {
    isConfigured,
    setConfig,
    getConfig,
    loadAddresses,
    setStatus,
    paintBadge
  };

  // Sett initial badge-farge
  paintBadge(isConfigured() ? 'unknown' : 'unknown');
})();