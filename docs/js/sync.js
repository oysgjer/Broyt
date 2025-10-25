/* js/sync.js
   JSONBin-klient + cache + normalisering + status/lagring
   Støtter feltet "note" på adresser (merknad).
*/
(() => {
  'use strict';

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_CFG   = 'BRYT_SYNC_CFG';    // {binId, apiKey}
  const K_CACHE = 'BRYT_SYNC_CACHE';  // {addresses,status,_fetchedAt, raw}
  const K_DEV   = 'BRYT_DEVICE_ID';

  // enkel event-bus
  const listeners = { change:[], error:[] };
  const emit = (type, payload)=> (listeners[type]||[]).forEach(fn=>{ try{ fn(payload); }catch{} });

  // device-id (kan brukes om ønsket)
  let DEVICE_ID = RJ(K_DEV, null);
  if (!DEVICE_ID) { DEVICE_ID = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); WJ(K_DEV, DEVICE_ID); }

  // polling
  let _pollTimer = null;
  function startPolling(ms=15000){ stopPolling(); _pollTimer=setInterval(()=>{ _fetchLatest().catch(()=>{}); }, ms); }
  function stopPolling(){ if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; } }

  let cfg = RJ(K_CFG, { binId:'', apiKey:'' });
  function setConfig({binId, apiKey}={}){ if (typeof binId==='string') cfg.binId=binId.trim(); if (typeof apiKey==='string') cfg.apiKey=apiKey.trim(); WJ(K_CFG,cfg); return cfg; }
  function getConfig(){ return {...cfg}; }

  function _headers(){ const h={'Content-Type':'application/json'}; if (cfg.apiKey) h['X-Master-Key']=cfg.apiKey; return h; }

  const _cache = RJ(K_CACHE, { addresses:[], status:{}, _fetchedAt:null, raw:null });
  const getCache = ()=> ({..._cache});

  // ------- normalisering -------
  function _normalizeAddresses(list){
    if (!Array.isArray(list)) return [];
    return list.map((a,ix)=>{
      const id    = String(a.id ?? a.name ?? ix);
      const name  = String(a.name ?? '').trim();
      const flags = a.flags || {};
      const tasks = a.tasks || {};
      const snow = (typeof tasks.snow==='boolean') ? tasks.snow :
                   (typeof flags.snow==='boolean') ? flags.snow : true;
      const grit = (typeof tasks.grit==='boolean') ? tasks.grit :
                   (typeof flags.grit==='boolean') ? flags.grit : false;

      const lat  = (a.lat!=null) ? Number(a.lat) : null;
      const lon  = (a.lon!=null) ? Number(a.lon) : null;
      const pins = a.pins ?? a.stakes ?? '';
      const ord  = Number(a.ord ?? ix);
      const note = typeof a.note === 'string' ? a.note : '';

      return {
        id, name,
        tasks: { snow: !!snow, grit: !!grit },
        flags: { snow: !!snow, grit: !!grit }, // bevar for kompatibilitet
        pins,
        lat: isNaN(lat)?null:lat,
        lon: isNaN(lon)?null:lon,
        ord,
        note
      };
    }).sort((a,b)=>(a.ord??0)-(b.ord??0));
  }

  function _normalizeStatus(rec){
    const stSnow = rec.statusSnow || rec.status || {};
    const stGrit = rec.statusGrit || {};
    const emptyLane = {state:'venter',by:null,rounds:[]};
    const out = {};
    const ensure = id => { if(!out[id]) out[id]={ snow:{...emptyLane}, grit:{...emptyLane} }; };

    for(const id in stSnow){
      ensure(id);
      if (stSnow[id].snow) out[id].snow = {...emptyLane, ...stSnow[id].snow};
      if (stSnow[id].grit) out[id].grit = {...emptyLane, ...stSnow[id].grit};
      if (!stSnow[id].snow && stSnow[id].state) out[id].snow.state = stSnow[id].state;
    }
    for(const id in stGrit){
      ensure(id);
      if (stGrit[id].grit) out[id].grit = {...emptyLane, ...stGrit[id].grit};
      if (!stGrit[id].grit && stGrit[id].state) out[id].grit.state = stGrit[id].state;
    }
    return out;
  }

  // ------- fetch / put -------
  async function _fetchLatest(){
    if (!cfg.binId) throw new Error('Mangler JSONBin ID.');
    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(cfg.binId)}/latest`;
    const res = await fetch(url, { headers:_headers() });
    if (!res.ok) throw new Error('JSONBin GET feilet: '+res.status);
    const j = await res.json();
    const rec = j.record || j;

    _cache.addresses = _normalizeAddresses(rec.snapshot?.addresses || rec.addresses || []);
    _cache.status    = _normalizeStatus(rec);
    _cache.raw       = rec;
    _cache._fetchedAt= Date.now();
    WJ(K_CACHE, _cache);
    emit('change', getCache());
    return getCache();
  }
  const reloadLatest = ()=>_fetchLatest();

  async function _putRecord(rec){
    if (!cfg.binId) throw new Error('Mangler JSONBin ID.');
    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(cfg.binId)}`;
    const res = await fetch(url, { method:'PUT', headers:_headers(), body: JSON.stringify(rec) });
    if (!res.ok) throw new Error('JSONBin PUT feilet: '+res.status);
    return true;
  }

  async function loadAddresses({force=false}={}){
    if (!force && Array.isArray(_cache.addresses) && _cache.addresses.length){ return _cache.addresses; }
    await _fetchLatest();
    return _cache.addresses;
  }

  async function setStatusPatch(patch){
    const st = _cache.status || {};
    for(const id in (patch.status||{})){
      const cur = st[id] || { snow:{state:'venter',by:null,rounds:[]}, grit:{state:'venter',by:null,rounds:[]}};
      const p   = patch.status[id];
      st[id] = { snow: {...cur.snow, ...(p.snow||{})}, grit: {...cur.grit, ...(p.grit||{})} };
    }
    _cache.status = st;

    const raw = _cache.raw || {};
    raw.statusSnow = raw.statusSnow || {};
    raw.statusGrit = raw.statusGrit || {};
    for(const id in st){
      raw.statusSnow[id] = { snow: st[id].snow };
      raw.statusGrit[id] = { grit: st[id].grit };
    }

    await _putRecord(raw);

    _cache.raw        = raw;
    _cache._fetchedAt = Date.now();
    WJ(K_CACHE, _cache);
    emit('change', getCache());
    return true;
  }

  async function saveAddresses(prepared){
    // skriver også "note"
    const list = (prepared||[]).map((a,ix)=>{
      const snow = !!(a.tasks?.snow ?? a.flags?.snow ?? true);
      const grit = !!(a.tasks?.grit ?? a.flags?.grit ?? false);
      return {
        id: String(a.id ?? a.name ?? ix),
        name: a.name || '',
        flags: { snow, grit },
        tasks: { snow, grit },
        pins: a.pins ?? '',
        lat:  a.lat ?? null,
        lon:  a.lon ?? null,
        ord:  (a.ord==null ? ix : Number(a.ord)),
        note: typeof a.note==='string' ? a.note : ''
      };
    }).sort((a,b)=>(a.ord??0)-(b.ord??0));

    _cache.addresses = _normalizeAddresses(list);
    WJ(K_CACHE, _cache);

    const raw = _cache.raw || {};
    raw.snapshot = raw.snapshot || {};
    raw.snapshot.addresses = list;
    await _putRecord(raw);

    _cache.raw        = raw;
    _cache._fetchedAt = Date.now();
    WJ(K_CACHE, _cache);
    emit('change', getCache());
    return _cache.addresses;
  }

  function computeProgress(driver){
    const addrs = _cache.addresses || [];
    const st = _cache.status || {};
    let total=addrs.length, mine=0, other=0, done=0;
    for(const a of addrs){
      const s = st[a.id] || {};
      if (s.snow?.state==='ferdig' || s.grit?.state==='ferdig') done++;
      if (s.snow?.state==='ferdig' && s.snow?.by===driver) mine++;
      if (s.grit?.state==='ferdig' && s.grit?.by===driver) mine++;
      if (s.snow?.state==='ferdig' && s.snow?.by && s.snow?.by!==driver) other++;
      if (s.grit?.state==='ferdig' && s.grit?.by && s.grit?.by!==driver) other++;
    }
    return { total, mine, other, done };
  }

  function on(type, fn){ if (!listeners[type]) listeners[type]=[]; listeners[type].push(fn); return ()=>{ listeners[type]=listeners[type].filter(f=>f!==fn); }; }

  // Eksponér
  window.Sync = {
    setConfig, getConfig,
    loadAddresses, reloadLatest,
    saveAddresses, setStatusPatch,
    getCache, computeProgress,
    on,
    startPolling, stopPolling,
    getDeviceId(){ return DEVICE_ID; }
  };
})();