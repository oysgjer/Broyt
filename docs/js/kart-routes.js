// docs/js/kart-routes.js — Cloud sync for drawn routes (now supports `geojsonRoutes` FeatureCollection)
(function(root){
  'use strict';
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const LS_ROUTES     = 'KART_ROUTES';        // can store either array or GeoJSON FeatureCollection
  const LS_ROUTES_SIG = 'KART_ROUTES_SIG';
  const LS_SETTINGS   = 'BRYT_SETTINGS';      // { routesBin }
  const LS_CFG        = 'BRYT_CFG';           // { apiKey }

  function getSettings(){ return RJ(LS_SETTINGS, {}); }
  function getCfg(){ return RJ(LS_CFG, {}); }

  function sha1(str){
    try{ return crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)).then(b=>{
      const a = Array.from(new Uint8Array(b)); return a.map(x=>x.toString(16).padStart(2,'0')).join('');
    }); }catch(e){ return Promise.resolve(String(str.length)+'.fallback'); }
  }

  function getLocalRoutes(){ return RJ(LS_ROUTES, []); }
  function setLocalRoutes(obj){ WJ(LS_ROUTES, obj); return obj; }

  function headers(){
    const h = { 'Content-Type': 'application/json' };
    const key = (getCfg().apiKey || '').trim();
    if (key) h['X-Master-Key'] = key;
    return h;
  }

  async function jget(url){
    try{
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(e){
      console.warn('kart-routes GET fail:', url, e);
      return null;
    }
  }
  async function jput(url, body){
    try{
      const res = await fetch(url, { method:'PUT', headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(e){
      console.warn('kart-routes PUT fail:', url, e);
      return null;
    }
  }

  const JB = {
    base: 'https://api.jsonbin.io/v3/b/',
    routesId(){ return (getSettings().routesBin || '').trim(); },
    latestUrl(){ const id=JB.routesId(); return id ? JB.base+encodeURIComponent(id)+'/latest' : null; },
    putUrl(){ const id=JB.routesId(); return id ? JB.base+encodeURIComponent(id) : null; }
  };

  // ----- Cloud I/O -----
  function isFeatureCollection(x){
    return x && typeof x==='object' && x.type==='FeatureCollection' && Array.isArray(x.features);
  }
  async function pullFromCloud(){
    const url = JB.latestUrl();
    if (!url) return null;
    const js = await jget(url);
    if (!js || !js.record) return null;
    const rec = js.record;
    // Preferred: { geojsonRoutes: FeatureCollection }
    if (isFeatureCollection(rec.geojsonRoutes)) return { kind:'geojson', data: rec.geojsonRoutes };
    // Fallback legacy: { routes: [...] } or bare array [...]
    if (Array.isArray(rec.routes)) return { kind:'array', data: rec.routes };
    if (Array.isArray(rec))        return { kind:'array', data: rec };
    // Also accept nested { kart:{ routes:[...] } }
    if (rec.kart && Array.isArray(rec.kart.routes)) return { kind:'array', data: rec.kart.routes };
    return null;
  }

  async function pushToCloud(localObj){
    const url = JB.putUrl();
    if (!url) return false;
    // Preserve format: if local is FeatureCollection, write { geojsonRoutes: <FC> }
    // else write { routes: [...] }
    let body;
    if (isFeatureCollection(localObj)){
      body = { geojsonRoutes: localObj };
    } else if (Array.isArray(localObj)) {
      body = { routes: localObj };
    } else if (localObj && isFeatureCollection(localObj.geojsonRoutes)) {
      body = { geojsonRoutes: localObj.geojsonRoutes };
    } else if (localObj && Array.isArray(localObj.routes)) {
      body = { routes: localObj.routes };
    } else {
      // Unknown shape: keep it as-is under geojsonRoutes if possible
      body = { routes: [] };
    }
    const ok = await jput(url, body);
    return !!ok;
  }

  let pushing = false;
  async function maybePush(){
    if (pushing) return;
    const id = JB.routesId();
    if (!id) return; // no cloud configured
    const routesObj = getLocalRoutes();
    const payload = JSON.stringify(routesObj);
    const sigPrev = localStorage.getItem(LS_ROUTES_SIG) || '';
    const sigNow = await sha1(payload);
    if (sigNow === sigPrev) return; // no change
    pushing = true;
    const ok = await pushToCloud(routesObj);
    if (ok) localStorage.setItem(LS_ROUTES_SIG, sigNow);
    pushing = false;
  }

  async function init(){
    // If local is empty or lacks data, try import from cloud once
    const local = getLocalRoutes();
    const hasLocal =
      (Array.isArray(local) && local.length>0) ||
      (isFeatureCollection(local) && local.features.length>0) ||
      (local && isFeatureCollection(local.geojsonRoutes) && local.geojsonRoutes.features.length>0) ||
      (local && Array.isArray(local.routes) && local.routes.length>0);
    if (!hasLocal){
      const cloud = await pullFromCloud();
      if (cloud && cloud.data){
        // store exactly what we got so the map renderer can use it
        setLocalRoutes(cloud.data);
        console.info('Kart-routes: importerte ruter fra sky ✔️ (', cloud.kind, ')');
      }
    }
    setInterval(maybePush, 30000);
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') maybePush();
    });
  }

  root.KartRoutes = {
    getLocal: getLocalRoutes,
    setLocal: setLocalRoutes,
    syncNow: maybePush,
    pullNow: async ()=>{
      const cloud = await pullFromCloud();
      if (cloud && cloud.data){ setLocalRoutes(cloud.data); return true; }
      return false;
    }
  };

  // Only run on the Kart page
  const p = (location.pathname||'').toLowerCase();
  const h = (location.hash||'').toLowerCase();
  const isKart = /(^|\/)tools\/kart\.html$/.test(p) || h.includes('kart');
  if (isKart) init();
})(window);
