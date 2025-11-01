// home_dashboard.js — fyller #funfact, #stats, #weather, #recent på Hjem

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
  const sameDay = (d1,d2) => d1 && d2 && d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();
  const fmtHhMm = mins => {
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return h ? `${h}t ${m}m` : `${m}m`;
  };
  const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
  const r = await fetch(url, { headers: {'X-Master-Key': key} }).catch(()=>null);
  if (!r || !r.ok) return [];
  const j = await r.json().catch(()=>({}));
  const rec = j && j.record;
  return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
}

async function getAllEvents(){
  // 1) Prøv å hente fra sky (alle BINS du har konfigurert)
  let remote = [];
  try {
    const lists = await Promise.all(BINS.map(fetchLatestForBin));
    remote = lists.flat().filter(Boolean);
  } catch {}

  // 2) Fallback/merge: lokal kø fra auto_logger (om noe ikke er lastet opp ennå)
  let local = [];
  try {
    const q = JSON.parse(localStorage.getItem('AUTOLOG_QUEUE') || '[]');
    if (Array.isArray(q)) local = q;
  } catch {}

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
      // uparret "start" kan ignoreres i stats (mangler slutt)
    }
    // sortér synkende på sluttid (for "Siste oppdrag")
    rows.sort((a,b)=> (b.end?.getTime()||0) - (a.end?.getTime()||0));
    return rows;
  }

  // ——— 4) STATISTIKK ———
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;
    const today = new Date();

    const done = rows.filter(r => r.start && r.end);
    const minsTotal = done.reduce((s,r)=> s + Math.max(0, (r.end - r.start)/60000), 0);
    const minsToday = done
      .filter(r => sameDay(r.start, today) || sameDay(r.end, today))
      .reduce((s,r)=> s + Math.max(0, (r.end - r.start)/60000), 0);

    const jobsTotal = done.length;
    const uniqueAddresses = new Set(done.map(r=>r.address).filter(Boolean)).size;

    box.innerHTML = `
      <strong>📊 Samlet innsats</strong><br>
      Totalt brøytetid: <b>${fmtHhMm(minsTotal)}</b><br>
      I dag: <b>${fmtHhMm(minsToday)}</b><br>
      Fullførte oppdrag: <b>${jobsTotal}</b><br>
      Adresser ryddet: <b>${uniqueAddresses}</b>
    `;
  }

  // ——— 5) VÆR ———
  function renderWeather(){
    // Gjenbruker det du allerede har i headeren (ikon/temperatur/beskrivelse)
    const temp = document.getElementById('wx_temp')?.textContent || '';
    const desc = document.getElementById('wx_desc')?.textContent || '';
    // Alternativt: kall din loadWeather() hvis du har den globalt
    const box = $('#weather'); if (!box) return;
    if (temp || desc){
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>${temp} ${desc}`.trim();
    } else {
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>Henter…`;
      try{ if (typeof window.loadWeather === 'function') window.loadWeather(); }catch{}
    }
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
      const mins  = Math.max(0, (r.end - r.start)/60000);
      const took  = fmtHhMm(mins);
      const task  = r.task || 'Snø';
      const addr  = r.address || '';
      return `<li><b>${when}</b> — ${addr} <span class="muted">(${task}, ${took})</span></li>`;
    }).join('');
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul>${li}</ul>`;
  }

 // ——— MAIN ———
function homeVisible(){
  const el = document.getElementById('home');
  return el && !el.hasAttribute('hidden');
}

async function boot(){
  if (!homeVisible()) return;         // kjør bare når Hjem vises
  renderFunfact();
  renderWeather();
  try{
    const all = await getAllEvents();
    const rows = pairIntervals(all);
    renderStats(rows);
    renderRecent(rows);               // viser 3 siste (øk til 5 under hvis ønskelig)
  }catch(e){
    console.warn('Dashboard feilet:', e);
    $('#stats')  && ($('#stats').textContent  = 'Kunne ikke hente data.');
    $('#recent') && ($('#recent').textContent = 'Kunne ikke hente data.');
  }
}

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('hashchange', boot);
// Reager når seksjoner vises/skjules i SPA
new MutationObserver(()=> homeVisible() && boot())
  .observe(document.body, { attributes:true, subtree:true, attributeFilter:['hidden'] });
