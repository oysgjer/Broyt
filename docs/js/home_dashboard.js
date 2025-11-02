// js/home_dashboard.js
// Dashboard for Hjem: Funfacts, brøytetid, siste oppdrag og vær (synk med Work).

(function(){
  // ——— JSONBin oppsett ———
  const BIN_IDS = safeJSON(localStorage.getItem('JSONBIN_BIN_IDS')) || [];
  const DEFAULT_BINS = ["68e89e3443b1c97be9611c48"]; // hendelser
  const BINS = BIN_IDS.length ? BIN_IDS : DEFAULT_BINS;

  function getKeyForBin(binId){
    try{
      const m = safeJSON(localStorage.getItem('JSONBIN_KEYS')) || {};
      if (m && typeof m[binId] === 'string' && m[binId].length > 10) return m[binId];
    }catch{}
    return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
  }

  // ——— Hjelpere ———
  const $ = sel => document.querySelector(sel);
  function safeJSON(s){ try{ return JSON.parse(s); }catch{ return null; } }
  const pad = n => (n<10 ? '0'+n : ''+n);
  const asDate = v => v ? new Date(v) : null;
  const sameDay = (a,b)=> a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeekMon = d => { const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const dow=(x.getDay()+6)%7; x.setDate(x.getDate()-dow); x.setHours(0,0,0,0); return x; };
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfPrevMonth = d => new Date(d.getFullYear(), d.getMonth()-1, 1);
  const endOfPrevMonth = d => new Date(d.getFullYear(), d.getMonth(), 0, 23,59,59,999);

  const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtHhMm = mins => { const m = Math.max(0, Math.round(mins)); const h = Math.floor(m/60), r = m%60; return h ? `${h}t ${r}m` : `${r}m`; };
  const monthNames = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  const fmtShortDate = d => `${d.getDate()}. ${monthNames[d.getMonth()]}`;
  const fmtHour = new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit' });

  // ——— Funfacts ———
  const FUNFACTS = [
    "En plog på 3 meter i 10 km/t flytter nær 30 tonn snø i minuttet.",
    "Snøkrystaller kan være sekskantede og hule – derfor pakker de seg rart.",
    "Litt silikon på skjæret gjør at snøen slipper lettere.",
    "Våt 5 cm snø tilsvarer over 50 liter vann per kvadratmeter.",
    "Hydraulikk liker det varmt – gi den et minutt før første løft.",
    "En Ariens 28” kan flytte over 75 tonn snø i timen.",
    "Smør fresen før du smører deg selv 😉",
    "Et tonn snø tar omtrent 2,5 kubikkmeter plass.",
    "En traktor på tomgang bruker 2–3 liter diesel i timen.",
    "Første snøplog i Norge ble tatt i bruk i 1922.",
    "Salt virker dårlig under –6 °C, men sand funker alltid.",
    "Vind gjør mer for snøfokk enn selve snømengden.",
    "Is tåler ~12 tonn/m² hvis den er 20 cm tykk.",
    "Brøytestikker var ofte bambus før plast tok over.",
    "Snø reflekterer opptil 90 % av sollyset – solbriller hjelper!",
    "Et godt skjerpet skjær reduserer forbruket med ~10 %. ",
    "Snøfnugg kan være fra 0,01 mm til over 10 mm.",
    "Når du hører «knirk», er det ofte kaldere enn –7 °C.",
    "En brøyterute på 40 min kan være 500+ girskift.",
    "Snø brøytes mest effektivt ved 8–15 km/t."
  ];
  function renderFunfact(){
    const i = (new Date().getDate()) % FUNFACTS.length;
    const box = $('#funfact');
    if (!box) return;
    box.innerHTML = `<strong>💡 Funfacts:</strong><br>${FUNFACTS[i]}`;
  }

  // ——— Hent hendelser fra JSONBin ———
  async function fetchLatestForBin(binId){
    const key = getKeyForBin(binId);
    if (!key) return [];
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const r = await fetch(url, { headers:{'X-Master-Key': key} });
    if (!r.ok) return [];
    const j = await r.json();
    const rec = j && j.record;
    // støtt både {reports:[]} og []
    return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
  }
  async function getAllEvents(){
    const lists = await Promise.all(BINS.map(fetchLatestForBin));
    const all = lists.flat().filter(Boolean);
    all.sort((a,b)=> new Date(a.ts||a.t||0) - new Date(b.ts||b.t||0));
    return all;
  }

  // ——— Par "start/ferdig" → intervaller ———
  function pairIntervals(events){
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
        const a = (e.action||e.a||'').toLowerCase();
        if (a === 'start' && !open) open = e;
        else if (a === 'ferdig' && open){
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
    }
    // Nyeste først (for "Siste oppdrag")
    rows.sort((a,b)=> (b.end?.getTime()||0) - (a.end?.getTime()||0));
    return rows;
  }

  // ——— Brøytetid ———
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;
    const now = new Date();
    const done = rows.filter(r => r.start && r.end);

    const sumMinutes = (list) => list.reduce((s,r)=> s + Math.max(0, (r.end - r.start)/60000), 0);

    const total = sumMinutes(done);

    const d0 = startOfDay(now), d1 = new Date(d0); d1.setDate(d1.getDate()+1);
    const w0 = startOfWeekMon(now), w1 = new Date(w0); w1.setDate(w1.getDate()+7);
    const m0 = startOfMonth(now),   m1 = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const pm0 = startOfPrevMonth(now), pm1 = endOfPrevMonth(now);

    const inRange = (a,b) => done.filter(r => r.start >= a && r.end <= b);
    const minsToday  = sumMinutes(inRange(d0,d1));
    const minsWeek   = sumMinutes(inRange(w0,w1));
    const minsMonth  = sumMinutes(inRange(m0,m1));
    const minsPrevMo = sumMinutes(inRange(pm0,pm1));

    box.innerHTML = `
      <strong>📊 Samlet brøytetid</strong><br>
      Totalt: <b>${fmtHhMm(total)}</b><br>
      Forrige måned: <b>${fmtHhMm(minsPrevMo)}</b><br>
      Denne måneden: <b>${fmtHhMm(minsMonth)}</b><br>
      Denne uken: <b>${fmtHhMm(minsWeek)}</b><br>
      I dag: <b>${fmtHhMm(minsToday)}</b>
    `;
  }

  // ——— Vær (leser snapshot fra Work / localStorage) ———
  function readWeatherSnapshot(){
    // 1) Direkte fra Work i samme fane
    if (window.__WX && window.__WX.now && Array.isArray(window.__WX.hourly)) return window.__WX;

    // 2) Inline JSON (fallback)
    try{
      const el = document.getElementById('wx_hourly_json');
      if (el && el.textContent.trim()){
        const j = JSON.parse(el.textContent);
        if (j && j.now && Array.isArray(j.hourly)) return j;
      }
    }catch{}

    // 3) localStorage
    try{
      const raw = localStorage.getItem('WX_LATEST');
      if (raw){
        const j = JSON.parse(raw);
        if (j && j.now && Array.isArray(j.hourly)) return j;
      }
    }catch{}

    return null;
  }

  function next3Hours(hourly){
    const now = Date.now() + 60*1000; // 1 min grace
    return (hourly||[])
      .map(h => ({ t: new Date(h.t).getTime(), temp: Math.round(h.temp), desc: h.desc || '' }))
      .filter(h => h.t >= now)
      .sort((a,b)=> a.t - b.t)
      .slice(0,3);
  }

  function renderWeather(){
    const box = $('#weather'); if (!box) return;

    const snap = readWeatherSnapshot();
    if (!snap){
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>Henter…`;
      return;
    }

    const ts = typeof snap.ts === 'number' ? snap.ts : Date.now();
    const ageMin = Math.round((Date.now() - ts)/60000);
    const stale = ageMin > 60;

    const nowLine = `${snap.now.temp ?? ''} ${snap.now.desc ?? ''}`.trim() || '—';
    const hours = next3Hours(snap.hourly);
    const trail = hours.length
      ? `<div style="margin-top:6px"><strong>Neste 3 timer</strong><br>${
          hours.map(h => `${fmtHour.format(h.t)} ${h.temp}° ${h.desc}`).join('<br>')
        }</div>`
      : `<div style="margin-top:6px" class="muted">Ingen ferske timesdata</div>`;

    const staleNote = stale ? `<div class="muted" style="margin-top:4px">Oppdatert for ${ageMin} min siden</div>` : '';

    box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>${nowLine}${trail}${staleNote}`;

    // Prøv forsiktig å trigge ny henting hvis gammelt
    if (stale && typeof window.loadWeather === 'function'){
      try{ window.loadWeather(); }catch{}
    }
  }

  // ——— Siste oppdrag ———
  function renderRecent(rows){
    const box = $('#recent'); if (!box) return;

    const done = rows.filter(r => r.start && r.end);
    const latest = done.slice(0,5);
    if (!latest.length){
      box.innerHTML = `<strong>🧭 Siste oppdrag</strong><br><em>Ingen fullførte oppdrag enda.</em>`;
      return;
    }
    const li = latest.map(r => {
      const when = r.end ? `${fmtShortDate(r.end)} ${fmtClock(r.end)}` : '–';
      const mins = Math.max(0, (r.end - r.start)/60000);
      const took = fmtHhMm(mins);
      const task = r.task || 'Snø';
      const addr = r.address || '';
      return `<li><b>${when}</b> — ${addr} <span class="muted">(${task}, ${took})</span></li>`;
    }).join('');
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul>${li}</ul>`;
  }

  // ——— MAIN ———
  async function init(){
    renderFunfact();
    renderWeather();

    try{
      const all = await getAllEvents();
      const rows = pairIntervals(all);
      renderStats(rows);
      renderRecent(rows);
    }catch(e){
      console.warn('Dashboard feilet:', e);
      if ($('#stats'))  $('#stats').textContent  = 'Kunne ikke hente data.';
      if ($('#recent')) $('#recent').textContent = 'Kunne ikke hente data.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  // Oppdater vær når Work publiserer, når lagring endres i andre faner, eller når fanen blir aktiv
  window.addEventListener('wx:update', renderWeather);
  window.addEventListener('storage', e => { if (e.key === 'WX_LATEST') renderWeather(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderWeather(); });

})();