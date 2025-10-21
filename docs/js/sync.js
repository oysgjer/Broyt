// js/sync.js
(() => {
  'use strict';

  // --- små hjelpere
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));
  const ev = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  // --- storage keys
  const K_ADDR   = 'BRYT_ADDR';   // adresser (array)
  const K_STATE  = 'BRYT_STATE';  // status per adresse-id (obj)

  // --- KONFIG  (du kan endre apiKey her eller via window.Sync.setConfig() )
  let CFG = {
    apiBase: 'https://api.jsonbin.io/v3/b',
    binId:   '68e7b4d2ae596e708f0bde7d',
    apiKey:  '$2a$10$luKLel7elCpJM4.REcwKOOsWlBK5Xv5lY2oN1BDYgbZbXA6ubT0W.', // <-- legg inn nøkkel når du er klar
    pollMs:  0 // 0 = ingen polling foreløpig
  };

  // --- intern state
  const S = {
    addresses: readJSON(K_ADDR, []),
    status:    readJSON(K_STATE, {}), // { [addressId]: { state, driver, ts } }
    ready:     false,
    lastLoad:  0
  };

  function setAddresses(arr){
    S.addresses = Array.isArray(arr) ? arr : [];
    writeJSON(K_ADDR, S.addresses);
    ev('sync:addresses', { count: S.addresses.length });
  }

  function setStatusMap(map){
    S.status = map && typeof map === 'object' ? map : {};
    writeJSON(K_STATE, S.status);
    ev('sync:status', { size: Object.keys(S.status).length });
  }

  // --- HENT adresser fra JSONBin
  async function fetchAddressesFromBin(){
    const url = `${CFG.apiBase}/${CFG.binId}/latest`;
    const res = await fetch(url, {
      headers: { 'X-Master-Key': CFG.apiKey }
    });
    if(!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`JSONBin ${res.status}: ${t || res.statusText}`);
    }
    const data = await res.json();
    // Forventet dataformat: { record: [...] } eller direkte [...]
    const list = Array.isArray(data?.record) ? data.record :
                 Array.isArray(data) ? data : [];
    return list;
  }

  // --- offentlige funksjoner
  async function init(){
    // les fra localStorage først (gir UI noe å vise)
    S.addresses = readJSON(K_ADDR, []);
    S.status    = readJSON(K_STATE, {});

    // prøv å laste ferskt fra sky
    try{
      const list = await fetchAddressesFromBin();
      setAddresses(list);
      S.ready = true;
      S.lastLoad = Date.now();
      ev('sync:ready', { ok: true, count: list.length });
    }catch(err){
      console.warn('Sync.init: klarte ikke hente fra sky:', err);
      // beholder cache hvis den finnes
      S.ready = S.addresses.length > 0;
      ev('sync:ready', { ok: S.ready, cached: S.addresses.length });
      if(!S.ready) throw err;
    }
  }

  async function loadAddresses({ force=false } = {}){
    // bruk cache hvis nylig lastet
    if(!force && S.addresses.length) return S.addresses;
    const list = await fetchAddressesFromBin();
    setAddresses(list);
    S.ready = true;
    S.lastLoad = Date.now();
    return S.addresses;
  }

  function getAddresses(){ return S.addresses; }
  function getStatusMap(){ return S.status; }

  // Oppdater lokal status (kan senere utvides til å pushe til sky)
  function setAddressState(addressId, newState){
    const st = { ...(S.status || {}) };
    st[addressId] = {
      ...(st[addressId] || {}),
      state: newState,
      ts: Date.now()
    };
    setStatusMap(st);
  }

  // lar Home.js/andre sette inn nøkkel/binId uten å endre filen
  function setConfig(patch = {}){
    CFG = { ...CFG, ...patch };
  }

  // --- eksponer API
  window.Sync = {
    init,
    loadAddresses,
    getAddresses,
    getStatusMap,
    setAddressState,
    setConfig,
    _state: S,    // nyttig for debugging
    _cfg:   () => ({ ...CFG })
  };
})();