// js/sync.js
(() => {
  'use strict';

  const API_BASE = 'https://api.jsonbin.io/v3/b';
  // Sett disse i Admin senere; midlertidig her:
  let CONFIG = {
    apiKey: localStorage.getItem('BRYT_API_KEY') || '', // legg inn via Admin senere
    binId:  localStorage.getItem('BRYT_BIN_ID')  || '68e7b4d2ae596e708f0bde7d'
  };

  const $ = (s, r = document) => r.querySelector(s);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_ADDR   = 'BRYT_ADDR_CACHE';
  const K_STORE  = 'BRYT_STATUS_STORE'; // { [id]: {state, driver, t} }

  function setSyncBadge(state) {
    const badge = $('#sync_badge');
    if (!badge) return;
    const dot = badge.querySelector('.dot') || badge;
    dot.classList.remove('dot-ok','dot-err','dot-warn','dot-unknown');
    if (state === 'ok')  { dot.classList.add('dot-ok');  badge.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`; }
    if (state === 'err') { dot.classList.add('dot-err'); badge.innerHTML = `<span class="dot dot-err"></span> Synk: feil`; }
    if (state === 'warn'){ dot.classList.add('dot-warn');badge.innerHTML = `<span class="dot dot-warn"></span> Synk: lokalt`; }
    if (state === 'unknown'){ dot.classList.add('dot-unknown'); badge.innerHTML = `<span class="dot dot-unknown"></span> Synk: ukjent`; }
  }

  async function httpGetLatest() {
    if (!CONFIG.apiKey || !CONFIG.binId) throw new Error('Manglende API-nøkkel eller BIN-ID.');
    const url = `${API_BASE}/${CONFIG.binId}/latest`;
    const res = await fetch(url, { headers: { 'X-Master-Key': CONFIG.apiKey }});
    if (!res.ok) throw new Error(`GET feilet: ${res.status}`);
    const json = await res.json();
    return json.record; // forventer { addresses: [...], status: {...} } eller bare [...]
  }

  async function httpPatch(record) {
    if (!CONFIG.apiKey || !CONFIG.binId) throw new Error('Manglende API-nøkkel eller BIN-ID.');
    const url = `${API_BASE}/${CONFIG.binId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': CONFIG.apiKey
      },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error(`PUT feilet: ${res.status}`);
    return res.json();
  }

  function normRecord(rec){
    // Støtt både plain array og {addresses, status}
    if (Array.isArray(rec)) return { addresses: rec, status: readJSON(K_STORE, {}) };
    const addresses = rec.addresses || [];
    const status    = rec.status || readJSON(K_STORE, {});
    return { addresses, status };
  }

  async function loadAddresses({force=false} = {}){
    try{
      if (!force){
        const cached = readJSON(K_ADDR, null);
        if (cached?.length) { setSyncBadge('warn'); return cached; }
      }
      const rec = normRecord(await httpGetLatest());
      writeJSON(K_ADDR, rec.addresses);
      writeJSON(K_STORE, rec.status);
      setSyncBadge('ok');
      return rec.addresses;
    }catch(e){
      setSyncBadge('err');
      console.error(e);
      throw e;
    }
  }

  function statusStore(){
    return readJSON(K_STORE, {});
  }
  function saveStatusStore(obj){
    writeJSON(K_STORE, obj);
  }

  async function setStatus(id, payload){
    // Oppdater lokalt
    const bag = statusStore();
    bag[id] = { ...(bag[id]||{}), ...payload, t: Date.now() };
    saveStatusStore(bag);

    // Oppdater sky (PUT hele record)
    try{
      const rec = normRecord(await httpGetLatest()); // hent fersk
      rec.status[id] = bag[id];
      await httpPatch(rec);
      setSyncBadge('ok');
    }catch(e){
      console.warn('Skyoppdatering feilet, behold lokalt:', e);
      setSyncBadge('warn');
    }
  }

  /** Batch reset: filterFn(id, st) => true for de som skal nullstilles */
  async function resetWhere(filterFn){
    const bag = statusStore();
    for (const id of Object.keys(bag)){
      const st = bag[id];
      if (!filterFn || filterFn(id, st)) delete bag[id];
    }
    saveStatusStore(bag);
    try{
      const rec = normRecord(await httpGetLatest());
      // Fjern samme i rec.status
      for (const id of Object.keys(rec.status||{})){
        const st = rec.status[id];
        if (!filterFn || filterFn(id, st)) delete rec.status[id];
      }
      await httpPatch(rec);
      setSyncBadge('ok');
    }catch(e){
      console.warn('Sky-reset feilet, lokalt ok:', e);
      setSyncBadge('warn');
    }
  }

  function setConfig(cfg){
    CONFIG = { ...CONFIG, ...cfg };
    if (cfg.apiKey) localStorage.setItem('BRYT_API_KEY', cfg.apiKey);
    if (cfg.binId)  localStorage.setItem('BRYT_BIN_ID',  cfg.binId);
  }

  // Eksporter til appen
  window.Sync = {
    setConfig,
    loadAddresses,
    statusStore,
    setStatus,
    resetMine: (driver) => resetWhere((_, st)=> st?.driver === driver),
    resetAll:  () => resetWhere(()=>true)
  };

  // Prøv å markere wake-lock-dot ved oppstart (om aktiv fra før iOS-hack)
  const wlDot = document.getElementById('wl_dot') || document.getElementById('qk_wl_dot');
  if (wlDot && navigator.wakeLock?.type === 'screen') {
    wlDot.classList.remove('dot-off'); wlDot.classList.add('dot-on');
  }
  // Start som ukjent, blir grønn ved første vellykkede synk
  setSyncBadge('unknown');

})();