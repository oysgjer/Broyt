/* js/sync.js
   JSONBin-klient + cache + normalisering + status/lagring
   Oppdatert: setter _fetchedAt også etter PUT (status/lagring) slik at synk-tid vises riktig.
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
  function emit(type, payload){ (listeners[type]||[]).forEach(fn=>{ try{ fn(payload); }catch{} }); }

  // device-id for kollisjonsmerking
  let DEVICE_ID = RJ(K_DEV, null);
  if (!DEVICE_ID) { DEVICE_ID = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); WJ(K_DEV, DEVICE_ID); }

  // polling
  let _pollTimer = null;
  function startPolling(ms=15000){ stopPolling(); _pollTimer=setInterval(()=>{ _fetchLatest().catch(()=>{}); }, ms); }
  function stopPolling(){ if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; } }

  let cfg = RJ(K_CFG, { binId:'', apiKey:'' });

  function setConfig({binId, apiKey}={}){
    if (typeof binId === 'string') cfg.binId = binId.trim();
    if (typeof apiKey === 'string') cfg.apiKey = apiKey.trim();
    WJ(K_CFG, cfg);
    return cfg;
  }
  function getConfig(){ return {...cfg}; }

  function _headers(){
    const h={'Content-Type':'application/json'};
    if (cfg.apiKey) h['X-Master-Key']=cfg.apiKey;
    return h;
  }

  const _cache = RJ(K_CACHE, { addresses:[], status:{}, _fetchedAt:null, raw:null });
  function getCache(){ return {..._cache}; }

  // --- hjelpe: bool fra alt mulig
  const asBool = v => (v===true || v===1 || v==='1' || (typeof v==='string' && v.toLowerCase()==='true'));

  function _normalizeAddresses(list){
    if (!Array.isArray(list)) return [];
    return list.map((a,ix)=>{
      const id    = String(a.id ?? a.name ?? ix);
      const name  = String(a.name ?? '').trim();

      const flags = a.flags || {};
      const tasks = a.tasks || {};

      // default: SNØ = true om ingenting er eksplisitt satt
      const snowRaw = (tasks.snow ?? flags.snow);
      const gritRaw = (tasks.grit ?? flags.grit);
      const snow = (snowRaw === undefined) ? true  : asBool(snowRaw);
      const grit = (gritRaw === undefined) ? false : asBool(gritRaw);

      // coords kan være "60.1, 11.2" eller "(60.1, 11.2)"
      let lat = (a.lat!=null) ? Number(a.lat) : null;
      let lon = (a.lon!=null) ? Number(a.lon) : null;
      if ((lat==null || isNaN(lat) || lon==null || isNaN(lon)) && a.coords){
        const m = String(a.coords).replace(/[()]/g,'').split(',');
        if (m.length===2){
          const la = Number(m[0]); const lo = Number(m[1]);
          if(!isNaN(la) && !isNaN(lo)){ lat=la; lon=lo; }
        }
      }

      const pins = (a.pins ?? a.stakes ?? '');

      return {
        id, name,
        tasks: { snow, grit },
        flags: { snow, grit },
        pins,
        lat: (lat!=null && !isNaN(lat)) ? lat : null,
        lon: (lon!=null && !isNaN(lon)) ? lon : null
      };
    });
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

  async function _fetchLatest(){
    if (!cfg.binId) throw new Error('Mangler JSONBin ID.');
    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(cfg.binId)}/latest`;
    const res = await fetch(url, { headers:_headers() });
    if (!res.ok) throw new Error('JSONBin GET feilet: '+res.status);
    const j = await res.json();
    const rec = j.record || j;

    const addresses = _normalizeAddresses(rec.snapshot?.addresses || rec.addresses || []);
    const status    = _normalizeStatus(rec);

    _cache.addresses = addresses;
    _cache.status    = status;
    _cache.raw       = rec;
    _cache._fetchedAt= Date.now();         // <- OPPDATERT VED GET
    WJ(K_CACHE, _cache);
    emit('change', getCache());
    return getCache();
  }
  async function reloadLatest(){ return _fetchLatest(); }

  async function loadAddresses({force=false}={}){
    if (!force && Array.isArray(_cache.addresses) && _cache.addresses.length){ return _cache.addresses; }
    await _fetchLatest();
    return _cache.addresses;
  }

  async function _putRecord(rec){
    if (!cfg.binId) throw new Error('Mangler JSONBin ID.');
    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(cfg.binId)}`;
    const res = await fetch(url, { method:'PUT', headers:_headers(), body: JSON.stringify(rec) });
    if (!res.ok) throw new Error('JSONBin PUT feilet: '+res.status);
    return true;
  }

  async function setStatusPatch(patch){
    const st = _cache.status || {};
    for(const id in (patch.status||{})){
      const cur = st[id] || { snow:{state:'venter',by:null,rounds:[]}, grit:{state:'venter',by:null,rounds:[]}};
      const p   = patch.status[id];
      st[id] = {
        snow: {...cur.snow, ...(p.snow||{})},
        grit: {...cur.grit, ...(p.grit||{})},
      };
    }
    _cache.status = st;

    // Skriv tilbake i raw: pakk status til statusSnow/statusGrit
    const raw = _cache.raw || {};
    raw.statusSnow = raw.statusSnow || {};
    raw.statusGrit = raw.statusGrit || {};
    for(const id in st){
      raw.statusSnow[id] = { snow: st[id].snow };
      raw.statusGrit[id] = { grit: st[id].grit };
    }

    await _putRecord(raw);

    // <- NYTT: oppdater synk-tid OGSÅ ETTER PUT
    _cache.raw        = raw;
    _cache._fetchedAt = Date.now();
    WJ(K_CACHE, _cache);

    emit('change', getCache());
    return true;
  }

  async function saveAddresses(prepared){
    const list = (prepared||[]).map(a=>{
      const snow = (a.tasks?.snow ?? a.flags?.snow);
      const grit = (a.tasks?.grit ?? a.flags?.grit);
      return {
        id: String(a.id ?? a.name),
        name: a.name || '',
        flags: { snow: asBool(snow===undefined?true:snow), grit: asBool(grit===undefined?false:grit) },
        tasks: { snow: asBool(snow===undefined?true:snow), grit: asBool(grit===undefined?false:grit) },
        pins: a.pins ?? '',
        lat:  a.lat ?? null,
        lon:  a.lon ?? null
      };
    });

    _cache.addresses = _normalizeAddresses(list);

    const raw = _cache.raw || {};
    raw.snapshot = raw.snapshot || {};
    raw.snapshot.addresses = list;

    await _putRecord(raw);

    // <- NYTT: oppdater synk-tid ETTER PUT av adresser
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

  function on(type, fn){
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
    return () => { listeners[type] = listeners[type].filter(f=>f!==fn); };
  }

  // Eksponer
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