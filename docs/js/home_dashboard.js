// js/home_dashboard.js
// Dashboard på Hjem: Funfacts, brøytetid (tot/forrige mnd/denne mnd/uke/dag), siste oppdrag og vær.
// Vær hentes fra ett felles snapshot laget av Work (samme visning begge steder).

(function(){
  // ——— JSONBIN (lese historikk) ———
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
  const pad = n => (n<10?('0'+n):''+n);
  const asDate = v => v ? new Date(v) : null;
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeekMon = d => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay()+6)%7; // 0=Mon
    x.setDate(x.getDate() - day);
    x.setHours(0,0,0,0);
    return x;
  };
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfPrevMonth = d => new Date(d.getFullYear(), d.getMonth()-1, 1);
  const endOfPrevMonth = d => new Date(d.getFullYear(), d.getMonth(), 0, 23,59,59,999);

  const fmtHhMm = mins => {
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return h ? `${h}t ${m}m` : `${m}m`;
  };
  const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const NO_MON = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  const fmtShortDate = d => `${d.getDate()}. ${NO_MON[d.getMonth()]}`;

  // ——— 1) FUNFACTS ———
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
    "Is tåler 12 tonn pr. m² hvis den er 20 cm tykk.",
    "Brøytestikker ble først laget av bambus før plast tok over.",
    "Snø reflekterer opptil 90 % av sollyset.",
    "En traktor på 5 tonn med kjetting gir over 25 000 N grep i bakken.",
    "Snøfnugg kan være 0,01 mm til over 10 mm.",
    "En vanlig brøyterute på 10 km kan inneholde 200 tonn snø etter ett snøfall.",
    "Kald diesel kan miste opptil 30 % effekt ved –20 °C.",
    "Snø brøytes mest effektivt ved 8–15 km/t.",
    "Godt lys på traktoren hjelper mer enn kaffe etter midnatt ☕️",
    "Hydraulikkolje bør være over 30 °C før full belastning.",
    "Når du hører knirk, er det kaldere enn –7 °C.",
    "Et 2 cm lag våt snø kan veie mer enn 5 cm tørrsnø."
  ];
  function renderFunfact(){
    const i = (new Date().getDate()) % FUNFACTS.length;
    const box = $('#funfact');
    if (box) box.innerHTML = `<strong>💡 Funfacts:</strong><br>${FUNFACTS[i]}`;
  }

  // ——— 2) HENT HENDELSER ———
  async function fetchLatestForBin(binId){
    const key = getKeyForBin(binId); if (!key) return [];
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const r = await fetch(url, { headers: {'X-Master-Key': key} });
    if (!r.ok) return [];
    const j = await r.json();
    const rec = j && j.record;
    return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
  }
  async function getAllEvents(){
    const lists = await Promise.all(BINS.map(fetchLatestForBin));
    const all = lists.flat().filter(Boolean);
    all.sort((a,b)=> new Date(a.ts||a.t||0) - new Date(b.ts||b.t||0));
    return all;
  }

  // ——— 3) PAR start/ferdig -> intervaller ———
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
    }
    rows.sort((a,b)=> (b.end?.getTime()||0) - (a.end?.getTime()||0));
    return rows;
  }

  // ——— 4) BRØYTETID ———
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;
    const now = new Date();

    const done = rows.filter(r => r.start && r.end);
    const minsBetween = (from, to) =>
      done.filter(r => r.start >= from && r.end <= to)
          .reduce((s,r)=> s + Math.max(0,(r.end - r.start)/60000), 0);

    const total = done.reduce((s,r)=> s + Math.max(0,(r.end - r.start)/60000), 0);

    const d0 = startOfDay(now), d1 = new Date(d0); d1.setDate(d1.getDate()+1);
    const w0 = startOfWeekMon(now), w1 = new Date(w0); w1.setDate(w1.getDate()+7);
    const m0 = startOfMonth(now),   m1 = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const pm0 = startOfPrevMonth(now), pm1 = endOfPrevMonth(now);

    box.innerHTML = `
      <strong>📊 Samlet brøytetid</strong><br>
      Totalt: <b>${fmtHhMm(total)}</b><br>
      Forrige måned: <b>${fmtHhMm(minsBetween(pm0, pm1))}</b><br>
      Denne måneden: <b>${fmtHhMm(minsBetween(m0, m1))}</b><br>
      Denne uken: <b>${fmtHhMm(minsBetween(w0, w1))}</b><br>
      I dag: <b>${fmtHhMm(minsBetween(d0, d1))}</b>
    `;
  }

  // ——— 5) VÆR ———
  const fmtHour = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

  // Les snapshot i prioritert rekkefølge (samme som Work skriver)
  function readWeatherSnapshot(){
    if (window.__WX && window.__WX.now && Array.isArray(window.__WX.hourly)) return window.__WX;

    try{
      const el = document.getElementById("wx_hourly_json");
      if (el && el.textContent.trim()){
        const j = JSON.parse(el.textContent);
        if (j && j.now && Array.isArray(j.hourly)) return j;
      }
    }catch{}

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
    return hourly
      .map(h => ({ t:new Date(h.t).getTime(), temp: Math.round(h.temp), desc: h.desc || "" }))
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

    const nowLine = `${snap.now.temp ?? ''} ${snap.now.desc ?? ''}`.trim() || '—';
    const hours = next3Hours(snap.hourly);
    const trail = hours.length
      ? `<div style="margin-top:6px"><strong>Neste 3 timer</strong><br>${
          hours.map(h => `${fmtHour.format(h.t)} ${h.temp}° ${h.desc}`).join('<br>')
        }</div>`
      : '';

    box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>${nowLine}${trail}`;
  }

  // ——— 6) Siste oppdrag ———
  function renderRecent(rows){
    const box = $('#recent'); if (!box) return;
    const done = rows.filter(r => r.start && r.end);
    const latest = done.slice(0, 4);
    if (!latest.length){
      box.innerHTML = `<strong>🧭 Siste oppdrag</strong><br><em>Ingen fullførte oppdrag enda.</em>`;
      return;
    }
    const li = latest.map(r => {
      const when  = r.end ? `${fmtShortDate(r.end)} ${fmtClock(r.end)}` : '–';
      const mins  = Math.max(0, (r.end - r.start)/60000);
      const took  = fmtHhMm(mins);
      const task  = r.task || 'Snø';
      const addr  = r.address || '';
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
      $('#stats')  && ($('#stats').textContent = 'Kunne ikke hente data.');
      $('#recent') && ($('#recent').textContent= 'Kunne ikke hente data.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  // Oppdater vær når Work legger nytt snapshot
  window.addEventListener('wx:update', renderWeather);
})();