// js/weather_unified.js
(function () {
  const LS_KEY = 'WX_CACHE_V1';
  const REFRESH_MS = 15 * 60 * 1000;

  // Tilpass disse til kilden du bruker i dag (eller behold hvis du viderefører work_weather_addon):
  async function fetchWeather() {
    // 1) Prøv lokal override (for testing / offline)
    const embedded = document.getElementById('wx_hourly_json');
    if (embedded?.textContent?.trim()) {
      return JSON.parse(embedded.textContent);
    }

    // 2) Prøv API’et du bruker i dag (erstatt med din fetch)
    // Her antar vi at work-scriptet ditt allerede kan hente vær:
    if (typeof window.loadWeather === 'function') {
      try {
        const data = await window.loadWeather({ returnOnly: true }); // gjør loadWeather til å støtte returnOnly
        if (data) return data;
      } catch {}
    }

    // 3) Siste utvei: cache i localStorage
    const cached = safeRead(LS_KEY);
    if (cached) return cached;

    // “Tom” struktur hvis alt feiler
    return { now: { temp: '', desc: '' }, hourly: [] };
  }

  function safeWrite(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
  }
  function safeRead(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function formatTemp(t) {
    if (t === null || t === undefined || t === '') return '';
    // Støtt både "5°" og 5 (C)
    const n = typeof t === 'number' ? Math.round(t) : parseInt(String(t).replace(/[^\-0-9]/g,''),10);
    if (Number.isNaN(n)) return String(t);
    return `${n}°`;
  }

  function paintHeader(now) {
    // Hvis du har disse i toppbaren / Under arbeid:
    const tempEl = document.getElementById('wx_temp'); // f.eks. “7°”
    const descEl = document.getElementById('wx_desc'); // f.eks. “Overskyet”
    if (tempEl) tempEl.textContent = formatTemp(now.temp || '');
    if (descEl) descEl.textContent = now.desc || '';
  }

  function paintHome(now, hourly) {
    const box = document.querySelector('#weather'); // seksjonen på Hjem
    if (!box) return;
    const next3 = (hourly || []).slice(0, 3).map(h => {
      const dt = new Date(h.t || h.time || Date.now());
      const hh = String(dt.getHours()).padStart(2,'0');
      const mm = String(dt.getMinutes()).padStart(2,'0');
      return `${hh}:${mm} ${formatTemp(h.temp)} ${h.desc || ''}`.trim();
    });
    box.innerHTML = `
      <strong>🌦️ Vær nå:</strong><br>${formatTemp(now.temp)} ${now.desc || ''}
      ${next3.length ? `<div class="muted" style="margin-top:4px"><em>Neste timer:</em> ${next3.join(' • ')}</div>` : ''}
    `.trim();
  }

  async function refresh() {
    const data = await fetchWeather();
    safeWrite(LS_KEY, data);

    const now = data?.now || {};
    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];

    paintHeader(now);
    paintHome(now, hourly);

    // Én sannhet: informer alle lyttere
    const evt = new CustomEvent('wx:update', { detail: { now, hourly, raw: data } });
    window.dispatchEvent(evt);
  }

  // Init + polling
  if (!window.WX) window.WX = {};
  window.WX.refreshWeather = refresh;
  window.addEventListener('DOMContentLoaded', refresh, { once: true });
  setInterval(refresh, REFRESH_MS);
})();