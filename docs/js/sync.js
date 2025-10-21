// js/sync.js
(() => {
  'use strict';

  /* ========= helpers ========= */
  const $ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };

  const LSK_ADDRESSES = 'BRYT_ADDRESSES';
  const LSK_STATUS    = 'BRYT_STATUS';

  // App-state vi lar andre lese
  const S = {
    addresses: [],   // [{id,name,lat,lon,task}]
    statusMap: {},   // { id: {state:'ikke_påbegynt'|'pågår'|'ferdig'|'hoppet'|'ikke_mulig', driver?:string, ts?:number } }
    lastSync: 0
  };

  // Konfig til JSONBin
  const CFG = {
    apiKey: 'PUT_YOUR_JSONBIN_KEY_HERE',           // <— SETT NØKKEL HER
    binId : '68e7b4d2ae596e708f0bde7d',
    base  : 'https://api.jsonbin.io/v3/b'
  };

  /* ========= veldig enkel events (pub/sub) ========= */
  const listeners = {};
  function on(event, fn){ (listeners[event] ??= []).push(fn); }
  function off(event, fn){ if(!listeners[event]) return; listeners[event] = listeners[event].filter(f=>f!==fn); }
  function emit(event, data){ (listeners[event]||[]).forEach(fn => { try{ fn(data); }catch(e){ console.warn('listener err',event,e); } }); }

  // bro til DOM CustomEvent (for evt. eldre filer som brukte disse)
  document.addEventListener('sync:addresses', e => emit('addresses', e.detail));
  document.addEventListener('sync:status',    e => emit('status',    e.detail));
  document.addEventListener('sync:ready',     e => emit('ready',     e.detail));

  /* ========= normalisering av JSON ========= */
  function normalizeAddresses(raw){
    // Støtt både array og {addresses:[…]}
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.addresses) ? raw.addresses : []);
    let i = 0;
    return list.map(item => {
      // støtt ulike feltnavn
      const id   = item.id ?? item.ID ?? `addr_${i++}`;
      const name = item.name ?? item.adresse ?? item.Address ?? `Adresse ${i}`;
      const lat  = Number(item.lat ?? item.latitude  ?? item.Lat ?? item.Latitude ?? NaN);
      const lon  = Number(item.lon ?? item.lng       ?? item.Lon ?? item.Longitude ?? NaN);
      // oppgavetypen (snø / grus)
      let task   = item.task ?? item.type ?? item.oppdrag ?? 'snow';
      if (typeof task === 'string'){
        const t = task.toLowerCase();
        task = (t.includes('grus') || t.includes('sand') || t.includes('salt')) ? 'grit' : 'snow';
      } else {
        task = 'snow';
      }
      return { id, name, lat, lon, task };
    });
  }

  /* ========= cloud IO ========= */
  async function fetchLatest(){
    const url = `${CFG.base}/${CFG.binId}/latest`;
    const res = await fetch(url, {
      headers: {
        'X-Master-Key': CFG.apiKey,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });
    if(!res.ok) throw new Error(`JSONBin ${res.status}`);
    const data = await res.json();
    // JSONBin v3: {record, metadata}
    return data?.record ?? data;
  }

  async function loadAddresses(opts={}){
    const force = !!opts.force;

    if (!force){
      const cached = $ls.get(LSK_ADDRESSES, null);
      if (cached && Array.isArray(cached) && cached.length){
        S.addresses = cached;
        emit('addresses', S.addresses);
        emit('ready', true);
        return S.addresses;
      }
    }

    const raw = await fetchLatest();
    const normalized = normalizeAddresses(raw);
    S.addresses = normalized;
    S.lastSync = Date.now();
    $ls.set(LSK_ADDRESSES, normalized);

    // behold tidligere status hvis finnes
    const existingStatus = $ls.get(LSK_STATUS, {});
    S.statusMap = existingStatus;
    emit('addresses', S.addresses);
    emit('status',    S.statusMap);
    emit('ready', true);
    return S.addresses;
  }

  /* ========= status-håndtering ========= */
  function getAddresses(){ return S.addresses; }
  function getStatusMap(){ return S.statusMap; }

  function setAddressState(id, state, extra={}){
    S.statusMap[id] = { state, ...extra, ts: Date.now() };
    $ls.set(LSK_STATUS, S.statusMap);
    emit('status', S.statusMap);
  }

  function setConfig({apiKey, binId}={}){
    if(apiKey) CFG.apiKey = apiKey;
    if(binId)  CFG.binId  = binId;
  }

  async function init(){
    try{
      // last evt. cache synkront
      const cachedA = $ls.get(LSK_ADDRESSES, []);
      if (cachedA?.length){
        S.addresses = cachedA;
        emit('addresses', S.addresses);
      }
      const cachedS = $ls.get(LSK_STATUS, {});
      if (cachedS) {
        S.statusMap = cachedS;
        emit('status', S.statusMap);
      }
      emit('ready', true);
      // forsøk å hente ferskt i bakgrunnen
      loadAddresses({force:true}).catch(()=>{});
    }catch(e){
      console.warn('Sync init error', e);
      emit('ready', false);
    }
  }

  /* ========= public API ========= */
  window.Sync = {
    init,
    loadAddresses,
    getAddresses,
    getStatusMap,
    setAddressState,
    setConfig,
    on, off,
    _state: S,
    _cfg:   () => ({...CFG})
  };

  // auto-init når siden lastes
  document.addEventListener('DOMContentLoaded', init);
})();