// js/work_weather_live.js
// Henter vær når Work vises, hvert 15. min, og speiler til window.__WX + localStorage.WX_LATEST.
// Sender alltid window.dispatchEvent(new Event('wx:update')) når noe nytt er klart.

(function(){
  const ROW_ID = 'wx_row';              // container på Work (øverst)
  const REFRESH_MS = 15 * 60 * 1000;    // 15 min
  let timer = null;

  // ------------- Hjelpere -------------
  const pad = n => n < 10 ? ('0'+n) : (''+n);
  const fmt = new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit' });

  function renderRowSnap(snap){
    const row = document.getElementById(ROW_ID);
    if (!row || !snap || !snap.now) return;

    // Kun fremtidige tre timer
    const nowMs = Date.now() + 60*1000;
    const upcoming = Array.isArray(snap.hourly) ? snap.hourly
      .map(h => ({ t:new Date(h.t).getTime(), temp: Math.round(h.temp), desc: h.desc||'' }))
      .filter(h => h.t >= nowMs)
      .sort((a,b)=>a.t-b.t)
      .slice(0,3) : [];

    const trail = upcoming.map(h => `${fmt.format(h.t)} ${h.temp}°`).join(' • ');
    row.textContent = `${snap.now.temp ?? ''} ${snap.now.desc ?? ''}${trail ? '   ' + trail : ''}`;
  }

  function publish(snap){
    try {
      // Legg på timestamp for staleness-vurdering
      const withTs = Object.assign({ ts: Date.now() }, snap || {});
      window.__WX = withTs;
      localStorage.setItem('WX_LATEST', JSON.stringify(withTs));
      renderRowSnap(withTs);
      window.dispatchEvent(new Event('wx:update'));
    } catch(e) {
      console.warn('WX publish feilet:', e);
    }
  }

  // ------------- Kilde: din eksisterende værhenter -------------
  // Denne funksjonen _må_ returnere et objekt på formen:
  // { now: { temp: "2°", desc: "Lett snø" }, hourly: [{t: ISO, temp: number, desc: string}, ...] }
  async function fetchWeatherSnapshot(){
    // Bruk din eksisterende loader hvis den finnes:
    if (typeof window.loadWeather === 'function') {
      try {
        const j = await window.loadWeather(); // hvis din retur gir akkurat "snap"
        if (j && j.now && Array.isArray(j.hourly)) return j;
      } catch(e) {
        console.warn('loadWeather() feilet:', e);
      }
    }

    // Fallback: prøv inline <script id="wx_hourly_json">
    try {
      const el = document.getElementById('wx_hourly_json');
      if (el && el.textContent.trim()){
        const j = JSON.parse(el.textContent);
        if (j && j.now && Array.isArray(j.hourly)) return j;
      }
    } catch(e){}

    // Ingenting tilgjengelig
    return null;
  }

  async function refreshNow(){
    const snap = await fetchWeatherSnapshot();
    if (snap) publish(snap);
  }

  function start(){
    // Kjør umiddelbart når Work er synlig
    refreshNow();

    // Restart intervallet
    if (timer) clearInterval(timer);
    timer = setInterval(refreshNow, REFRESH_MS);
  }

  // Start når Work vises
  function isWorkVisible(){
    const sec = document.getElementById('work');
    return sec && !sec.hasAttribute('hidden');
  }

  function maybeStart(){
    if (isWorkVisible()) start();
  }

  window.addEventListener('hashchange', maybeStart);
  document.addEventListener('visibilitychange', ()=> { if (!document.hidden) maybeStart(); });

  // Hvis Work allerede er aktiv når skriptet lastes:
  if (isWorkVisible()) start();
})();