// wx_bridge_autodetect.js — gjør værdata tilgjengelig for home_dashboard.js
(function(){
  const CACHE_KEY = "WX_CACHE";

  function toCacheShape(src) {
    if (!src) return null;
    const out = { current: { temp: "", desc: "" }, hourly: [] };

    // "Nå"
    // Prøv ulike navngivninger
    const nowTemp = src.now?.temp ?? src.current?.temp ?? src.temp ?? null;
    const nowDesc = src.now?.desc ?? src.current?.desc ?? src.description ?? src.desc ?? "";

    if (nowTemp != null) out.current.temp = String(nowTemp).includes("°") ? String(nowTemp) : `${nowTemp}°`;
    if (nowDesc) out.current.desc = String(nowDesc);

    // Timesvarsel (valgfritt)
    const hourly = src.hourly || src.next || src.hours || [];
    if (Array.isArray(hourly)) {
      out.hourly = hourly.map(h => ({
        t:    h.t ?? h.time ?? h.dt ?? h.ts ?? null,
        temp: Math.round(h.temp ?? h.temperature ?? 0),
        desc: h.desc ?? h.description ?? ""
      }));
    }
    return out;
  }

  function fromDomFallback(){
    const temp = document.getElementById("wx_temp")?.textContent || "";
    const desc = document.getElementById("wx_desc")?.textContent || "";
    if (!temp && !desc) return null;
    return {
      current: { temp: temp.trim(), desc: desc.trim() },
      hourly: [] // ukjent via DOM
    };
  }

  function publish(cache){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
    window.__WX__ = cache;
    window.dispatchEvent(new CustomEvent("wx:update", { detail: cache }));
  }

  function tryBuildAndPublish(){
    // 1) Global(e) kilder som et annet værskript kan ha laget
    const globals = [window.wx, window.WX, window.__WX__];
    for (const g of globals){
      const c = toCacheShape(g);
      if (c && (c.current.temp || c.current.desc || (c.hourly && c.hourly.length))) { publish(c); return true; }
    }
    // 2) Fallback fra DOM
    const dom = fromDomFallback();
    if (dom && (dom.current.temp || dom.current.desc)) { publish(dom); return true; }
    return false;
  }

  // Først forsøk umiddelbart…
  if (!tryBuildAndPublish()){
    // …så poll kortvarig (inntil værscriptet ditt rekker å fylle globals/DOM)
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (tryBuildAndPublish() || tries > 20) clearInterval(iv); // ~10s
    }, 500);
  }

  // Hvis værskriptet ditt senere selv kaller window.dispatchEvent(new CustomEvent('wx:update',...))
  // så fanges det av home_dashboard.js og re-rendres automatisk.
})();
