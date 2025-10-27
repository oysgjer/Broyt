// docs/js/kart-routes.js — Cloud sync for drawn routes (Maplayers JSONBin)
(function(root){
  'use strict';
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const LS_ROUTES     = 'KART_ROUTES';        // local store for routes array
  const LS_ROUTES_SIG = 'KART_ROUTES_SIG';    // hash of last pushed
  const LS_SETTINGS   = 'BRYT_SETTINGS';      // { routesBin }
  const LS_CFG        = 'BRYT_CFG';           // { apiKey }

  function getSettings(){ return RJ(LS_SETTINGS, {}); }
  function getCfg(){ return RJ(LS_CFG, {}); }

  function sha1(str){
    try{ return crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)).then(b=>{
      const a = Array.from(new Uint8Array(b)); return a.map(x=>x.toString(16).padStart(2,'0')).join('');
    }); }catch(e){ return Promise.resolve(String(str.length)+'.fallback'); }
  }

  function getLocalRoutes(){
    const r = RJ(LS_ROUTES, []);
    return Array.isArray(r) ? r : [];
  }
  function setLocalRoutes(arr){
    const list = Array.isArray(arr) ? arr : [];
    WJ(LS_ROUTES, list);
    return list;
  }

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

  async function pullFromCloud(){
    const url = JB.latestUrl();
    if (!url) return null;
    const js = await jget(url);
    if (!js || !js.record) return null;
    // Accept either {routes: [...]} or bare array [...]
    const rec = js.record;
    if (Array.isArray(rec)) return rec;
    if (Array.isArray(rec.routes)) return rec.routes;
    if (rec.kart && Array.isArray(rec.kart.routes)) return rec.kart.routes;
    return null;
  }

  async function pushToCloud(routes){
    const url = JB.putUrl();
    if (!url) return false;
    const body = { routes: Array.isArray(routes) ? routes : [] };
    const ok = await jput(url, body);
    return !!ok;
  }

  let pushing = false;
  async function maybePush(){
    if (pushing) return;
    const id = JB.routesId();
    if (!id) return; // no cloud configured
    const routes = getLocalRoutes();
    const payload = JSON.stringify({ routes });
    const sigPrev = localStorage.getItem(LS_ROUTES_SIG) || '';
    const sigNow = await sha1(payload);
    if (sigNow === sigPrev) return; // no change
    pushing = true;
    const ok = await pushToCloud(routes);
    if (ok) localStorage.setItem(LS_ROUTES_SIG, sigNow);
    pushing = false;
  }

  async function init(){
    // If local is empty, try import from cloud once
    if (getLocalRoutes().length === 0){
      const cloud = await pullFromCloud();
      if (Array.isArray(cloud) && cloud.length){
        setLocalRoutes(cloud);
        console.info('Kart-routes: importerte ruter fra sky ✔️');
      }
    }
    // Background push every 30s (throttled), and on page hide
    setInterval(maybePush, 30000);
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') maybePush();
    });
  }

  // Expose a tiny API for manual control
  root.KartRoutes = {
    getLocal: getLocalRoutes,
    setLocal: setLocalRoutes,
    syncNow: maybePush,
    pullNow: async ()=>{
      const cloud = await pullFromCloud();
      if (Array.isArray(cloud)){ setLocalRoutes(cloud); return true; }
      return false;
    }
  };

  // Only run on the Kart page (tools/kart.html or hash includes 'kart')
  const p = (location.pathname||'').toLowerCase();
  const h = (location.hash||'').toLowerCase();
  const isKart = /(^|\/)tools\/kart\.html$/.test(p) || h.includes('kart');
  if (isKart) init();
})(window);
