// home_dashboard.js — Hjem: funfact, brøytetid (inkl. forrige måned), vær (neste 3 t), siste oppdrag

(function(){
  // ——— KONFIG ———
  const BIN_IDS = JSON.parse(localStorage.getItem('JSONBIN_BIN_IDS') || '[]');
  const DEFAULT_BINS = ["68e89e3443b1c97be9611c48"]; // hendelser
  const BINS = BIN_IDS.length ? BIN_IDS : DEFAULT_BINS;

  function getKeyForBin(binId){
    try{
      const map = JSON.parse(localStorage.getItem('JSONBIN_KEYS')||'{}');
      if (map && typeof map[binId]==='string' && map[binId].length>10) return map[binId];
    }catch{}
    return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
  }

  // ——— HJELPERE ———
  const $ = sel => document.querySelector(sel);
  const pad = n => n<10 ? ('0'+n) : n;
  const asDate = v => v ? new Date(v) : null;
  const startOfDay = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfPrevMonth = d => new Date(d.getFullYear(), d.getMonth()-1, 1);
  const startOfISOWeek = d => {
    const x = new Date(d); x.setHours(0,0,0,0);
    const day = x.getDay() || 7; // 1..7 (man=1)
    if (day > 1) x.setDate(x.getDate() - (day - 1));
    return x;
  };
  const sameDay = (d1,d2) => d1 && d2 && d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();
  const minutesBetween = (a,b) => Math.max(0, (b - a) / 60000);
  const fmtHhMm = mins => {
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return h ? `${h}t ${m}m` : `${m}m`;
  };
  const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtDayMonth = d => `${d.getDate()}. ${['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'][d.getMonth()]}`;

  // ——— 1) FUNFACT ———
  const FUNFACTS = [
    "En plog på 3 meter i 10 km/t flytter nær 30 tonn snø i minuttet.",
    "Snøkrystaller kan være sekskantede og hule – derfor pakker de seg rart.",
    "Litt silikon på skjæret gjør at snøen slipper lettere.",
    "Våt 5 cm snø ≈ over 50 liter vann pr. m².",
    "Hydraulikk liker det varmt – gi den et minutt før første løft.",
    "En Ariens 28” kan flytte over 75 tonn snø i timen.",
    "Smør fresen før du smører deg selv 😉"
  ];
  function renderFunfact(){
    const i = (new Date().getDate()) % FUNFACTS.length;
    const box = $('#funfact');
    if (box) box.innerHTML = `<strong>❄️ Dagens brøytefakta:</strong><br>${FUNFACTS[i]}`;
  }

  // ——— 2) HENT HENDELSER ———
  async function fetchLatestForBin(binId){
    const key = getKeyForBin(binId); if (!key) return [];
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const r = await fetch(url, { headers: {'X-Master-Key': key} });
    if (!r.ok) return [];
    const j = await r.json();
    const rec = j && j.record;
    // støtt både {reports:[]} og []
    return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
  }
  async function getAllEvents(){
    const lists = await Promise.all(BINS.map(fetchLatestForBin));
    const all = lists.flat().filter(Boolean);
    // sortér stigende på tid
    all.sort((a,b)=> new Date(a.ts||a.t||0) - new Date(b.ts||b.t||0));
    return all;
  }

  // ——— 3) PAR “start/ferdig” til intervaller ———
  function pairIntervals(events){
    // grupper på address + driver + task
    const keyOf = e => [
      (e.address||e.addr||'').trim(),
      (e.driver||'').trim(),
      (e.task||e.oppgave||'').trim()
    ].join('｜');

    const groups = new Map();
    for (const e of events){
      const k = keyOf(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }

    const rows = [];
    for (const [, arr] of groups){
      arr.sort((a,b)=> new Date(a.ts||a.t) - new Date(b.ts||b.t));
      let open = null;
      for (const e of arr){
        const action = (e.action||e.a||'').toLowerCase();
        if (action==='start' && !open) open = e;
        else if (action==='ferdig' && open){
          rows.push({
            address: (e.address||open.address||'').trim(),
            driver:  (e.driver||open.driver||'').trim(),
            task:    (e.task||open.task||e.oppgave||open.oppgave||'').trim() || 'Snø',
            start:   asDate(open.ts||open.t),
            end:     asDate(e.ts||e.t)
          });
          open = null;
        }
      }
      // uparret "start" ignoreres i stats
    }
    // sortér synkende på sluttid (for "Siste oppdrag")
    rows.sort((a,b)=> (b.end?.getTime()||0) - (a.end?.getTime()||0));
    return rows;
  }

  // ——— 4) STATISTIKK ———
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;

    const done = rows.filter(r => r.start && r.end);
    const now        = new Date();
    const monthStart = startOfMonth(now);
    const prevMStart = startOfPrevMonth(now);
    const weekStart  = startOfISOWeek(now);
    const today      = startOfDay(now);

    let totalMin = 0,
        prevMonthMin = 0,
        monthMin = 0,
        weekMin = 0,
        todayMin = 0;

    for (const r of done){
      const m   = minutesBetween(r.start, r.end);
      const ref = r.end || r.start;

      totalMin += m;
      if (ref >= monthStart) {
        monthMin += m;
      } else if (ref >= prevMStart && ref < monthStart) {
        prevMonthMin += m; // NY: forrige måned
      }
      if (ref >= weekStart)      weekMin += m;
      if (sameDay(ref, today))   todayMin += m;
    }

    box.innerHTML = `
      <strong>📊 Samlet brøytetid</strong><br>
      Totalt: <b>${fmtHhMm(totalMin)}</b><br>
      Forrige måned: <b>${fmtHhMm(prevMonthMin)}</b><br>
      Denne måneden: <b>${fmtHhMm(monthMin)}</b><br>
      Denne uken: <b>${fmtHhMm(weekMin)}</b><br>
      I dag: <b>${fmtHhMm(todayMin)}</b>
    `;
  }

  // ——— 5) VÆR (nå + neste 3 timer hvis tilgjengelig) ———
  function tryReadWxCache(){
    try {
      const obj = window.__WX__;
      if (obj && (obj.current || obj.hourly)) return obj;
      const raw = localStorage.getItem('WX_CACHE');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function renderWeather(){
    const box = $('#weather'); if (!box) return;

    // Les “nå”-verdier fra eksisterende header-elementer (fallback)
    const nowTemp = document.getElementById('wx_temp')?.textContent || '';
    const nowDesc = document.getElementById('wx_desc')?.textContent || '';

    const cache = tryReadWxCache();
    let currentLine = '';
    if (cache?.current) {
      const t = cache.current.temp ?? cache.current.temperature ?? nowTemp;
      const d = cache.current.desc ?? cache.current.description ?? nowDesc;
      currentLine = `${t ?? ''} ${d ?? ''}`.trim();
    } else {
      currentLine = `${nowTemp} ${nowDesc}`.trim();
    }

    // Finn timesvarsel (tar de 3 neste)
    let next3 = [];
    if (Array.isArray(cache?.hourly) && cache.hourly.length){
      const now = Date.now();
      next3 = cache.hourly
        .filter(h => new Date(h.time||h.t||h.dt).getTime() > now)
        .slice(0, 3)
        .map(h => {
          const tt = new Date(h.time||h.t||h.dt);
          const temp = (h.temp ?? h.temperature ?? '').toString().replace(/\.0$/, '');
          const desc = h.desc ?? h.description ?? '';
          return `<li><b>${fmtClock(tt)}</b> ${temp ? `${temp}°` : ''} ${desc}</li>`;
        });
    }

    // Bygg HTML
    let html = `<strong>🌦️ Vær nå:</strong><br>${currentLine || 'Henter…'}`;
    if (next3.length){
      html += `<div class="muted" style="margin-top:6px"><b>Neste 3 t:</b><ul style="margin:4px 0 0 18px; padding:0; list-style:disc">${next3.join('')}</ul></div>`;
    } else {
      // forsøk å trigge henting hvis vi ikke har noe
      if (!currentLine && typeof window.loadWeather === 'function') {
        try { window.loadWeather(); } catch {}
      }
    }

    box.innerHTML = html;
  }

  // ——— 6) SISTE OPPDRAG ———
  function renderRecent(rows){
    const box = $('#recent'); if (!box) return;
    const done = rows.filter(r => r.start && r.end);
    const latest = done.slice(0, 5);
    if (!latest.length){
      box.innerHTML = `<strong>🧭 Siste oppdrag</strong><br><em>Ingen fullførte oppdrag enda.</em>`;
      return;
    }
    const li = latest.map(r => {
      const when  = r.end ? fmtClock(r.end) : '–';
      const date  = r.end ? fmtDayMonth(r.end) : '';
      const mins  = Math.max(0, (r.end - r.start)/60000);
      const took  = fmtHhMm(mins);
      const task  = r.task || 'Snø';
      const addr  = r.address || '';
      return `<li><b>${date} ${when}</b> — ${addr} <span class="muted">(${task}, ${took})</span></li>`;
    }).join('');
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul style="margin:6px 0 0 18px; padding:0; list-style:disc">${li}</ul>`;
  }

  // ——— MAIN ———
  async function init(){
    try {
      renderFunfact();
      renderWeather();

      const all = await getAllEvents();
      const rows = pairIntervals(all);
      renderStats(rows);
      renderRecent(rows);
    } catch(e){
      console.warn('Dashboard feilet:', e);
      $('#stats')  && ($('#stats').textContent  = 'Kunne ikke hente data.');
      $('#recent') && ($('#recent').textContent = 'Kunne ikke hente data.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

})();