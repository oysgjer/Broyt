// docs/js/sync.js – resilient dual-bin JSONBin sync (drift + reports)
(function(root){
  'use strict';
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const LS_CFG          = 'BRYT_CFG';          // {binId, apiKey}
  const LS_SETTINGS     = 'BRYT_SETTINGS';     // {reportBin, ...}
  const LS_CACHE_LOCAL  = 'BRYT_CACHE_LOCAL';  // full cache mirror
  const LS_STATUS_LOCAL = 'BRYT_STATUS_LOCAL'; // fallback status
  const LS_ADDR_LOCAL   = 'BRYT_ADDR_LOCAL';   // fallback addresses

  // ---- Internal state ----
  let cache = RJ(LS_CACHE_LOCAL, { addresses: RJ(LS_ADDR_LOCAL, []), status: RJ(LS_STATUS_LOCAL, {}) });
  const listeners = { change: [] };

  function cfg(){ return RJ(LS_CFG, { binId:'', apiKey:'' }); }
  function settings(){ return RJ(LS_SETTINGS, {}); }

  function headers(){
    const h = { 'Content-Type': 'application/json' };
    const k = (cfg().apiKey || '').trim();
    if (k) h['X-Master-Key'] = k;
    return h;
  }

  const JB = {
    driftId(){ return (cfg().binId || '').trim(); },
    reportId(){ return (settings().reportBin || '').trim(); },
    base: 'https://api.jsonbin.io/v3/b/'
  };

  async function jFetch(url, opts){
    try{
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }catch(e){
      console.warn('Sync fetch fail:', url, e);
      return null;
    }
  }

  // ---- Public API ----
  function getCache(){ return cache; }
  function emitChange(){ listeners.change.forEach(fn=>{ try{ fn(cache); }catch(e){ console.warn('Sync change listener error', e); } }); }
  function on(evt, fn){ if (!listeners[evt]) listeners[evt]=[]; listeners[evt].push(fn); }

  async function reload(){
    const id = JB.driftId();
    if (!id){ console.warn('Sync.reload: no drift bin id configured'); return cache; }
    const url = `${JB.base}${encodeURIComponent(id)}/latest`;
    const data = await jFetch(url, { method:'GET', headers: headers() });
    if (data && data.record){
      // Expecting a payload with snapshot and status (your original shape)
      const rec = data.record;
      const next = {
        addresses: (rec?.snapshot?.addresses ?? cache.addresses ?? []),
        status:    (rec?.status        ?? cache.status    ?? {}),
        snapshot:  (rec?.snapshot      ?? cache.snapshot  ?? {}),
      };
      cache = next;
      WJ(LS_CACHE_LOCAL, cache);
      // keep mirrors
      if (Array.isArray(cache.addresses)) WJ(LS_ADDR_LOCAL, cache.addresses);
      if (cache.status && typeof cache.status==='object') WJ(LS_STATUS_LOCAL, cache.status);
      emitChange();
    }
    return cache;
  }

  function deepMergeStatus(base, patch){
    const out = JSON.parse(JSON.stringify(base||{}));
    if (patch && patch.status){
      out.status = out.status || {};
      for (const id of Object.keys(patch.status)){
        out.status[id] = out.status[id] || {};
        for (const lane of Object.keys(patch.status[id])){
          out.status[id][lane] = patch.status[id][lane];
        }
      }
    }
    if (patch && patch.snapshot){
      out.snapshot = out.snapshot || {};
      if (Array.isArray(patch.snapshot.addresses)){
        out.snapshot.addresses = patch.snapshot.addresses;
      }
    }
    // derive top-level mirrors
    out.addresses = out.snapshot?.addresses || out.addresses || [];
    return out;
  }

  async function setStatusPatch(patch){
    // Local first
    cache = deepMergeStatus(cache, patch);
    WJ(LS_CACHE_LOCAL, cache);
    if (cache.status) WJ(LS_STATUS_LOCAL, cache.status);
    if (Array.isArray(cache.addresses)) WJ(LS_ADDR_LOCAL, cache.addresses);
    emitChange();

    // Remote best-effort
    const id = JB.driftId();
    if (!id){ console.warn('Sync.setStatusPatch: no drift bin id'); return; }
    const url = `${JB.base}${encodeURIComponent(id)}`;
    const body = JSON.stringify(cache);
    const res = await jFetch(url, { method:'PUT', headers: headers(), body });
    if (!res){ console.warn('Sync remote PUT failed (kept local)'); }
  }

  async function setAddresses(list){
    const patch = { snapshot:{ addresses: Array.isArray(list) ? list : [] } };
    await setStatusPatch(patch);
  }

  function getConfig(){ return cfg(); }
  function setConfig(obj){
    const next = { ...cfg(), ...(obj||{}) };
    WJ(LS_CFG, next);
    return next;
  }

  async function saveReport(reportObj){
    // Append-only to report bin; fallback to local
    const id = JB.reportId();
    const now = new Date().toISOString();
    const rec = { ...(reportObj||{}), createdAt: reportObj?.createdAt || now };
    if (!id){
      console.warn('Sync.saveReport: no report bin id – saving locally to BRYT_REPORTS');
      const local = RJ('BRYT_REPORTS', []);
      local.push(rec);
      WJ('BRYT_REPORTS', local);
      return { ok:true, local:true };
    }
    // Try load current list
    const urlLatest = `${JB.base}${encodeURIComponent(id)}/latest`;
    const data = await jFetch(urlLatest, { method:'GET', headers: headers() });
    let list = [];
    if (data && data.record && Array.isArray(data.record)){
      list = data.record;
    }else if (data && data.record && Array.isArray(data.record.items)){
      list = data.record.items;
    }
    list.push(rec);
    const urlPut = `${JB.base}${encodeURIComponent(id)}`;
    const res = await jFetch(urlPut, { method:'PUT', headers: headers(), body: JSON.stringify(list) });
    if (!res){
      console.warn('Sync.saveReport PUT failed – keeping local backup');
      const local = RJ('BRYT_REPORTS', []);
      local.push(rec);
      WJ('BRYT_REPORTS', local);
      return { ok:false, local:true };
    }
    return { ok:true, local:false };
  }

  // Expose API
  root.Sync = { getCache, setStatusPatch, setAddresses, reload, getConfig, setConfig, on, saveReport };

  // Try eager reload, but do not block UI
  Promise.resolve().then(()=>{ reload().catch(()=>{}); });
})(window);
