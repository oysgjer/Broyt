/* js/sync.js
   JSONBin-klient + cache + normalisering + status/lagring
   Forventer struktur i BIN:
   {
     "settings": {...},
     "snapshot": { "addresses": [ { id,name,flags|tasks, pins, lat, lon } ] },
     "statusSnow": { [addrId]: {snow:{state,by,rounds[]},grit:{...}} }   // eller "status"
     "statusGrit": { ... }   // valgfritt; vi samler i 'status'
   }
*/
(() => {
  'use strict';

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_CFG   = 'BRYT_SYNC_CFG';    // {binId, apiKey}
  const K_CACHE = 'BRYT_SYNC_CACHE';  // {addresses,status,_fetchedAt, raw}

  const listeners = { change:[], error:[] };
  function emit(type, payload){ (listeners[type]||[]).forEach(fn=>{ try{ fn(payload); }catch{} }); }

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

  function _normalizeAddresses(list){
    if (!Array.isArray(list)) return [];
    return list.map((a,ix)=>{
      const id    = String(a.id ?? a.name ?? ix);
      const name  = String(a.name ?? '').trim();
      const flags = a.flags || {};
      const tasks = a.tasks || {};
      // robust: default snø=true, grus=false
      const snow = (typeof tasks.snow==='boolean') ? tasks.snow :
                   (typeof flags.snow==='boolean') ? flags.snow : true;
      const grit = (typeof tasks.grit==='boolean') ? tasks.grit :
                   (typeof flags.grit==='boolean') ? flags.grit : false;
      const lat  = (a.lat!=null) ? Number(a.lat) : (a.coords && String(a.coords).includes(',') ? Number(String(a.coords).split(',')[0]) : null);
      const lon  = (a.lon!=null) ? Number(a.lon) : (a.coords && String(a.coords).includes(',') ? Number(String(a.coords).split(',')[1]) : null);
      const pins = a.pins ?? a.stakes ?? '';

      return {
        id, name,
        tasks: { snow: !!snow, grit: !!grit },
        flags: { snow: !!snow, grit: !!grit }, // hold begge for kompatibilitet
        pins, lat: isNaN(lat)?null:lat, lon: isNaN(lon)?null:lon
      };
    });
  }

  function _normalizeStatus(rec){
    // Samle status i én pose: status[addrId] = { snow:{...}, grit:{...} }
    const stSnow = rec.statusSnow || rec.status || {};
    const stGrit = rec.statusGrit || {};
    const out = {};
    function ensure(id){ if(!out[id]) out[id]={snow:{state:'venter',by:null,rounds:[]},grit:{state:'venter',by:null,rounds:[]}}; }
    // primært fra snow/status
    for(const id in stSnow){
      ensure(id);
      if (stSnow[id].snow) out[id].snow = {...{state:'venter',by:null,rounds:[]}, ...stSnow[id].snow};
      if (stSnow[id].grit) out[id].grit = {...{state:'venter',by:null,rounds:[]}, ...stSnow[id].grit};
      if (!stSnow[id].snow && stSnow[id].state) out[id].snow.state = stSnow[id].state; // gammel modell
    }
    // så evt. grit
    for(const id in stGrit){
      ensure(id);
      if (stGrit[id].grit) out[id].grit = {...{state:'venter',by:null,rounds:[]}, ...stGrit[id].grit};
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
    _cache._fetchedAt= Date.now();
    WJ(K_CACHE, _cache);
    emit('change', getCache());
    return getCache();
  }

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
    // patch: { status: { [addrId]: { snow:{...}, grit:{...} } } }
    // Slå sammen i _cache og skriv tilbake i raw.statusSnow som primær
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
    WJ(K_CACHE, _cache);

    // Skriv tilbake i raw: pakk status til statusSnow/statusGrit
    const raw = _cache.raw || {};
    raw.statusSnow = raw.statusSnow || {};
    raw.statusGrit = raw.statusGrit || {};
    for(const id in st){
      raw.statusSnow[id] = { snow: st[id].snow };   // legg i snow-pose
      raw.statusGrit[id] = { grit: st[id].grit };   // legg i grit-pose
    }

    await _putRecord(raw);
    emit('change', getCache());
    return true;
  }

  async function saveAddresses(prepared){
    // prepared: [{id,name,tasks:{snow,grit},pins,lat,lon,...}]
    // Oppdater cache + raw.snapshot.addresses
    const list = (prepared||[]).map(a=>{
      const snow = !!(a.tasks?.snow ?? a.flags?.snow ?? true);
      const grit = !!(a.tasks?.grit ?? a.flags?.grit ?? false);
      return {
        id: String(a.id ?? a.name),
        name: a.name || '',
        flags: { snow, grit },
        tasks: { snow, grit },
        pins: a.pins ?? '',
        lat:  a.lat ?? null,
        lon:  a.lon ?? null
      };
    });

    _cache.addresses = _normalizeAddresses(list); // re-normalize for safety
    WJ(K_CACHE, _cache);

    const raw = _cache.raw || {};
    raw.snapshot = raw.snapshot || {};
    raw.snapshot.addresses = list; // skriv med både flags og tasks
    await _putRecord(raw);

    emit('change', getCache());
    return _cache.addresses;
  }

  function computeProgress(driver){
    const addrs = _cache.addresses || [];
    const st = _cache.status || {};
    let total=0, mine=0, other=0, done=0;
    // total = antall adresser i AKTIV lane bestemmes i Work.js,
    // men her oppgir vi total for hele lista. Work.js regner relativt.
    total = addrs.length;
    for(const a of addrs){
      const s = st[a.id] || {};
      // “ferdig” på en lane teller som done (summarisk)
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

  // Eksponér
  window.Sync = {
    setConfig, getConfig,
    loadAddresses, saveAddresses,
    setStatusPatch,
    getCache,
    computeProgress,
    on
  };
})();