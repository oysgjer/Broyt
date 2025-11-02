// docs/js/wx_bridge_autodetect.js — samler vær fra globals, DOM eller skjult JSON, og pusher wx:update
(function(){
  const CACHE_KEY = 'WX_CACHE';

  function toCacheShape(src){
    if (!src) return null;
    const out = { current:{ temp:'', desc:'' }, hourly:[] };

    // nå
    const nowTemp = src.now?.temp ?? src.current?.temp ?? src.temp ?? null;
    const nowDesc = src.now?.desc ?? src.current?.desc ?? src.description ?? src.desc ?? '';
    if (nowTemp != null) out.current.temp = String(nowTemp).includes('°') ? String(nowTemp) : `${nowTemp}°`;
    if (nowDesc) out.current.desc = String(nowDesc);

    // timeserie
    const hourly = src.hourly || src.next || src.hours || [];
    if (Array.isArray(hourly)){
      out.hourly = hourly.map(h=>({
        t:    h.t ?? h.time ?? h.dt ?? h.ts ?? null,
        temp: Math.round(h.temp ?? h.temperature ?? 0),
        desc: h.desc ?? h.description ?? ''
      }));
    }
    return out;
  }

  function readJsonBlock(){
    try{
      const el = document.getElementById('wx_hourly_json');
      if (!el) return null;
      const txt = el.textContent?.trim(); if (!txt) return null;
      const obj = JSON.parse(txt);
      return toCacheShape(obj);
    }catch{ return null; }
  }

  function fromDomFallback(){
    const temp = document.getElementById('wx_temp')?.textContent || '';
    const desc = document.getElementById('wx_desc')?.textContent || '';
    if (!temp && !desc) return null;
    return { current:{ temp:temp.trim(), desc:desc.trim() }, hourly:[] };
  }

  function publish(cache){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch{}
    window.__WX__ = cache;
    window.dispatchEvent(new CustomEvent('wx:update', { detail: cache }));
  }

  function tryBuildAndPublish(){
    for (const g of [window.wx, window.WX, window.__WX__]){
      const c = toCacheShape(g);
      if (c && (c.current.temp || c.current.desc || (c.hourly && c.hourly.length))) { publish(c); return true; }
    }
    const jb = readJsonBlock();
    if (jb && (jb.current.temp || jb.current.desc || (jb.hourly && jb.hourly.length))) { publish(jb); return true; }
    const dom = fromDomFallback();
    if (dom && (dom.current.temp || dom.current.desc)) { publish(dom); return true; }
    return false;
  }

  if (!tryBuildAndPublish()){
    let tries=0;
    const iv=setInterval(()=>{
      tries++;
      if (tryBuildAndPublish() || tries>20) clearInterval(iv); // ~10s
    }, 500);
  }
})();
