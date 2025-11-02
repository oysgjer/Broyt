// work_weather_addon.js — single source of truth for weather
// Makes a fresh snapshot on the Work page and notifies the rest of the app.

(function(){
  // ------- helpers -------
  const $ = sel => document.querySelector(sel);
  const pad = n => (n < 10 ? "0"+n : ""+n);
  const dfHour = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  const toLocalDate = iso => new Date(iso);

  // pick next 3 future hours (no past), formatted
  function pickNext3(hourly){
    const now = Date.now() + 60 * 1000; // 1 min grace so :00 just passed doesn’t show
    const future = hourly
      .map(h => ({ t: toLocalDate(h.t).getTime(), temp: h.temp, desc: h.desc }))
      .filter(h => h.t >= now)
      .sort((a,b) => a.t - b.t)
      .slice(0,3);

    return future.map(h => ({
      label: dfHour.format(h.t),
      temp: Math.round(h.temp),
      desc: h.desc || ""
    }));
  }

  function writeSnapshot(snap){
    // Keep a JSON script tag updated for consumers (Home, etc.)
    let el = $("#wx_hourly_json");
    const txt = JSON.stringify(snap);
    if (!el) {
      el = document.createElement("script");
      el.id = "wx_hourly_json";
      el.type = "application/json";
      el.hidden = true;
      document.body.appendChild(el);
    }
    el.textContent = txt;

    // also expose on window (very small)
    window.__WX = snap;
    // tell listeners that fresh data exists
    window.dispatchEvent(new Event("wx:update"));
  }

  function renderWorkRow(snap){
    // Header row on Work: "2° Lett snø" + "14:00 • 2° • 15:00 • 1° • 16:00 • 0°"
    const host = $("#wx_row");
    if (!host) return;

    const nowLine = `${snap.now.temp} ${snap.now.desc}`.trim();
    const h3 = pickNext3(snap.hourly);
    const trail = h3.length
      ? h3.map(h => `${h.label} \u00A0•\u00A0 ${h.temp}°`).join(" \u00A0\u00A0 ")
      : "";

    host.innerHTML = `
      <div class="wx-now">${nowLine}</div>
      ${trail ? `<div class="wx-3h">${trail}</div>` : ""}
    `;
  }

  // ------- MAIN fetch/bridge -------
  async function buildFromBridge(){
    // If you already have a bridge (e.g. MET/yr fetch elsewhere), read it here.
    // Expecting window.loadWeatherBridge?.() to return { now: {temp, desc}, hourly:[{t,temp,desc}...] }
    try{
      if (typeof window.loadWeatherBridge === "function"){
        const data = await window.loadWeatherBridge();
        if (data && data.now && Array.isArray(data.hourly)){
          writeSnapshot(data);
          renderWorkRow(data);
          return true;
        }
      }
    }catch(e){ console.warn("Weather bridge failed:", e); }
    return false;
  }

  // Fallback: try to read any existing JSON snapshot (keeps UI showing something)
  function useExistingIfAny(){
    try{
      const el = document.getElementById("wx_hourly_json");
      if (el && el.textContent.trim()){
        const data = JSON.parse(el.textContent);
        if (data && data.now && Array.isArray(data.hourly)){
          writeSnapshot(data); // re-emit to normalise format
          renderWorkRow(data);
          return true;
        }
      }
    }catch{}
    return false;
  }

  async function init(){
    // Always try bridge first (fresh), then fallback to any existing JSON
    const ok = await buildFromBridge();
    if (!ok) useExistingIfAny();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})();