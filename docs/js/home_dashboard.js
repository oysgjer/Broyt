// home_dashboard.js — Hjem-dashboard med brøytetid (total / måned / uke / dag),
// vær-speiling og "Siste oppdrag" m/dato. Leser JSONBin + fallback til AUTOLOG_QUEUE.

(function(){
  // ——— KONFIG ———
  const BIN_IDS = JSON.parse(localStorage.getItem('JSONBIN_BIN_IDS') || '[]');
  const DEFAULT_BINS = ["68e89e3443b1c97be9611c48"]; // fallback hvis ingen er satt
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
  const sameDay = (a,b) => a && b &&
    a.getFullYear()===b.getFullYear() &&
    a.getMonth()===b.getMonth() &&
    a.getDate()===b.getDate();

  // Start av måned
  function startOfMonth(d){
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    x.setHours(0,0,0,0);
    return x;
  }
  // ISO-uke (mandag–søndag)
  function startOfISOWeek(d){
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay() || 7; // søndag=7
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - (day - 1)); // tilbake til mandag
    return x;
  }
  function isSameISOWeek(a, b){
    if (!a || !b) return false;
    const sa = startOfISOWeek(a);
    const sb = startOfISOWeek(b);
    return sa.getFullYear()===sb.getFullYear() &&
           sa.getMonth()===sb.getMonth() &&
           sa.getDate()===sb.getDate();
  }
  const fmtHhMm = mins => {
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return h ? `${h}t ${m}m` : `${m}m`;
  };
  const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const monthNames = ['jan','feb','mars','apr','mai','juni','juli','aug','sep','okt','nov','des'];
  const fmtDayMon = d => `${d.getDate()}. ${monthNames[d.getMonth()]}`;

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
    const d = new Date();
    const i = (d.getFullYear()*100 + (d.getMonth()+1)*10 + d.getDate()) % FUNFACTS.length;
    const box = $('#funfact');
    if (box) box.innerHTML = `<strong>❄️ Dagens brøytefakta:</strong><br>${FUNFACTS[i]}`;
  }

  // ——— 2) HENT HENDELSER ———
  async function fetchLatestForBin(binId){
    const key = getKeyForBin(binId); if (!key) return [];
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    try{
      const r = await fetch(url, { headers: {'X-Master-Key': key} });
      if (!r.ok) return [];
      const j = await r.json();
      const rec = j && j.record;
      return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
    }catch{ return []; }
  }
  async function getAllEvents(){
    // 1) Forsøk sky
    let remote = [];
    try{
      const lists = await Promise.all(BINS.map(fetchLatestForBin));
      remote = lists.flat().filter(Boolean);
    }catch{}
    // 2) Merge lokal kø (ting som enda ikke er synket)
    let local = [];
    try{
      const q = JSON.parse(localStorage.getItem('AUTOLOG_QUEUE') || '[]');
      if (Array.isArray(q)) local = q;
    }catch{}
    const all = [...remote, ...local].filter(Boolean);
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
      // uparret "start" ignoreres i brøytetids-summering
    }
    // sortér synkende på sluttid (for "Siste oppdrag")
    rows.sort((a,b)=> (b.end?.getTime()||0) - (a.end?.getTime()||0));
    return rows;
  }

  // ——— 4) BRØYTETID ———
  function minutesBetween(a,b){
    if (!a || !b) return 0;
    const ms = b - a;
    return ms > 0 ? Math.round(ms/60000) : 0;
  }
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;

    const done = rows.filter(r => r.start && r.end);
    const today = new Date();
    const monthStart = startOfMonth(today);
    const weekStart  = startOfISOWeek(today);

    let totalMin = 0, monthMin = 0, weekMin = 0, todayMin = 0;

    for (const r of done){
      const m = minutesBetween(r.start, r.end);
      totalMin += m;

      // referansetid for sortering/tilhørighet
      const ref = r.end || r.start;

      // måned
      if (ref >= monthStart) monthMin += m;
      // uke
      if (ref >= weekStart) weekMin += m;
      // dag
      if (sameDay(ref, today)) todayMin += m;
    }

    box.innerHTML = `
      <strong>📊 Samlet brøytetid</strong><br>
      Totalt: <b>${fmtHhMm(totalMin)}</b><br>
      Denne måneden: <b>${fmtHhMm(monthMin)}</b><br>
      Denne uken: <b>${fmtHhMm(weekMin)}</b><br>
      I dag: <b>${fmtHhMm(todayMin)}</b>
    `;
  }

  // ——— 5) VÆR ———
  function renderWeather(){
    const box = $('#weather'); if (!box) return;
    const temp = document.getElementById('wx_temp')?.textContent || '';
    const desc = document.getElementById('wx_desc')?.textContent || '';
    if (temp || desc) {
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>${[temp, desc].filter(Boolean).join(' ')}`;
    } else {
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>Henter…`;
      try { if (typeof window.loadWeather === 'function') window.loadWeather(); } catch {}
    }
  }

  // ——— 6) SISTE OPPDRAG ———
  function renderRecent(rows){
    const box = $('#recent'); if (!box) return;
    const done = rows.filter(r => r.start && r.end);
    const latest = done.slice(0, 5); // vis 5 siste
    if (!latest.length){
      box.innerHTML = `<strong>🧭 Siste oppdrag</strong><br><em>Ingen fullførte oppdrag enda.</em>`;
      return;
    }
    const li = latest.map(r => {
      const whenDate = r.end ? fmtDayMon(r.end) : '';
      const whenTime = r.end ? fmtClock(r.end) : '–';
      const when  = `${whenDate} ${whenTime}`.trim();
      const mins  = minutesBetween(r.start, r.end);
      const took  = fmtHhMm(mins);
      const task  = r.task || 'Snø';
      const addr  = r.address || '';
      return `<li><b>${when}</b> — ${addr} <span class="muted">(${task}, ${took})</span></li>`;
    }).join('');
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul style="margin:6px 0 0 18px">${li}</ul>`;
  }

  // ——— MAIN ———
  async function init(){
    // Kjør uansett hvilken side – men vi viser bare innhold hvis #home finnes
    renderFunfact();
    renderWeather();

    // Oppdater vær når værmodulen melder seg ferdig
    window.addEventListener('wx:updated', () => {
      try { renderWeather(); } catch {}
    });
    // liten poll ved første last
    setTimeout(renderWeather, 1000);
    setTimeout(renderWeather, 4000);

    try{
      const all = await getAllEvents();
      const rows = pairIntervals(all);
      renderStats(rows);
      renderRecent(rows);
    }catch(e){
      console.warn('Dashboard feilet:', e);
      $('#stats')  && ($('#stats').textContent  = 'Kunne ikke hente data.');
      $('#recent') && ($('#recent').textContent = 'Kunne ikke hente data.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();