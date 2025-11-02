// js/home_dashboard.js
// Dashboard til Hjem-siden: Funfacts, brøytetid, siste oppdrag og vær.
// Vær leses fra WX_LATEST som Work speiler (identisk visning på begge sider).

(function(){
  // ——— KONFIG JSONBIN ———
  const BIN_IDS = JSON.parse(localStorage.getItem('JSONBIN_BIN_IDS') || '[]');
  const DEFAULT_BINS = ["68e89e3443b1c97be9611c48"]; // hendelser
  const BINS = BIN_IDS.length ? BIN_IDS : DEFAULT_BINS;

  function getKeyForBin(binId){
    try {
      const map = JSON.parse(localStorage.getItem('JSONBIN_KEYS')||'{}');
      if (map && typeof map[binId]==='string' && map[binId].length>10) return map[binId];
    }catch{}
    return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
  }

  // ——— HJELPERE ———
  const $ = sel => document.querySelector(sel);
  const pad = n => n<10 ? ('0'+n) : n;
  const asDate = v => v ? new Date(v) : null;
  const sameDay  = (d1,d2) => d1 && d2 && d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();
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
  const fmtShortDate = d => `${d.getDate()}. ${['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'][d.getMonth()]}`;

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
    "Is tåler 12 tonn pr. kvadratmeter hvis den er 20 cm tykk.",
    "Brøytestikker ble først laget av bambus før plast tok over.",
    "Snø reflekterer opptil 90 % av sollyset – derfor blir man brun på nesa.",
    "En traktor på 5 tonn med kjetting gir over 25 000 N grep i bakken.",
    "Snøfnugg kan være 0,01 mm til over 10 mm store.",
    "En vanlig brøyterute på 10 km kan inneholde 200 tonn snø etter ett snøfall.",
    "Kald diesel kan miste opptil 30 % effekt ved –20 °C.",
    "Snø smelter raskest når den er våt, ikke når det er varmest ute.",
    "Godt lys på traktoren øker reaksjonstiden med 25 % i mørke forhold.",
    "Hydraulikkolje skal helst være over 30 °C før full belastning.",
    "Når du kjører 8 km/t, bruker du omtrent 30 sekunder per 70 meter vei.",
    "Et godt vedlikeholdt skjær kan redusere drivstoff-forbruket med 10 %.",
    "En brøyterute på 40 min betyr ofte over 500 girendringer!",
    "Når du hører knirk under føttene, er det kaldere enn –7 °C.",
    "Et snøfnugg kan veie under 0,01 milligram.",
    "Snø brøytes mest effektivt når farten ligger mellom 8 og 15 km/t.",
    "Den første traktorfresen ble patentert i 1927 i Canada.",
    "Et 2 cm lag med våt snø kan veie mer enn 5 cm tørrsnø."
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

  // ——— 3) PAR start/ferdig → intervaller ———
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
    // nyeste først
    rows.sort((a,b)=> (b.end?.getTime()||0) - (a.end?.getTime()||0));
    return rows;
  }

  // ——— 4) BRØYTETID ———
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;
    const now = new Date();

    const done = rows.filter(r => r.start && r.end);
    const mins = (from, to) =>
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
      Forrige måned: <b>${fmtHhMm(mins(pm0, pm1))}</b><br>
      Denne måneden: <b>${fmtHhMm(mins(m0, m1))}</b><br>
      Denne uken: <b>${fmtHhMm(mins(w0, w1))}</b><br>
      I dag: <b>${fmtHhMm(mins(d0, d1))}</b>
    `;
  }

  // ——— 5) VÆR fra Work-snapshot ———
  function fmtHour(iso){
    if (!iso) return '';
    const d = new Date(iso);
    return `${pad(d.getHours())}:00`;
  }
  function renderWeatherFromSnapshot(){
    const box = $('#weather'); if (!box) return;

    const raw = localStorage.getItem('WX_LATEST');
    if (!raw){
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>Henter…`;
      return;
    }
    let snap; try { snap = JSON.parse(raw); } catch { snap = null; }
    if (!snap || !snap.now){
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>Henter…`;
      return;
    }

    const nowLine = `${snap.now.temp ?? ''} ${snap.now.desc ?? ''}`.trim();
    let hourlyHtml = '';
    if (Array.isArray(snap.hourly) && snap.hourly.length){
      const rows = snap.hourly.slice(0,3).map(h => `${fmtHour(h.t)} ${h.temp}° ${h.desc}`);
      hourlyHtml = `
        <div style="margin-top:8px; font-weight:600">Neste 3 timer</div>
        <div class="muted-strong">${rows.join('<br>')}</div>
      `;
    }

    box.innerHTML = `
      <strong>🌦️ Vær nå:</strong><br>
      ${nowLine || 'Henter…'}
      ${hourlyHtml}
    `;
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
      const when = r.end ? `${fmtShortDate(r.end)} ${fmtClock(r.end)}` : '–';
      const mins = Math.max(0, (r.end - r.start)/60000);
      const took = fmtHhMm(mins);
      return `<li><b>${when}</b> — ${r.address} <span class="muted">(${r.task || 'Snø'}, ${took})</span></li>`;
    }).join('');
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul>${li}</ul>`;
  }

  // ——— MAIN ———
  async function init(){
    renderFunfact();
    renderWeatherFromSnapshot();

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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

  // Oppdater vær live når Work legger snapshot
  window.addEventListener('wx:update', renderWeatherFromSnapshot);
})();
