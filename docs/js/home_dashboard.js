// home_dashboard.js — Hjem: funfact, brøytetid (totalt / forrige mnd / denne mnd / uke / dag),
// vær (nå + neste 3t), og siste oppdrag.

(function(){
  // ——— KONFIG ———
  const DEFAULT_BINS = ["68e89e3443b1c97be9611c48"]; // fallback hvis ingenting er satt

  function getBinIds(){
    try{
      const raw = localStorage.getItem('JSONBIN_BIN_IDS');
      const a = raw ? JSON.parse(raw) : null;
      if (Array.isArray(a) && a.length) return a;
    }catch{}
    return DEFAULT_BINS.slice();
  }
  function getKeyForBin(binId){
    try{
      const map = JSON.parse(localStorage.getItem('JSONBIN_KEYS')||'{}');
      if (map && typeof map[binId]==='string' && map[binId].length>10) return map[binId];
    }catch{}
    return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
  }

  // ——— HJELPERE ———
  const $ = s => document.querySelector(s);
  const pad = n => (n<10 ? '0'+n : ''+n);
  const asDate = v => (v ? new Date(v) : null);
  const startOfDay = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const startOfWeekISO = d => { const x=new Date(d); x.setHours(0,0,0,0); const day=x.getDay()||7; if(day>1)x.setDate(x.getDate()-(day-1)); return x; };
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfPrevMonth = d => new Date(d.getFullYear(), d.getMonth()-1, 1);
  const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const minsBetween = (a,b) => Math.max(0, (b-a)/60000);
  const fmtHhMm = mins => { const h=Math.floor(mins/60), m=Math.round(mins%60); return h?`${h}t ${m}m`:`${m}m`; };
  const fmtClock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const monthNO = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  const fmtDateShort = d => `${d.getDate()}. ${monthNO[d.getMonth()]}`;

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
    try{
      const r = await fetch(url, { headers: { 'X-Master-Key': key } });
      if (!r.ok) return [];
      const j = await r.json();
      const rec = j && j.record;
      return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
    }catch{ return []; }
  }
  async function getAllEvents(){
    const bins = getBinIds();
    const lists = await Promise.all(bins.map(fetchLatestForBin));
    const all = lists.flat().filter(Boolean);
    all.sort((a,b)=> new Date(a.ts||a.t||0) - new Date(b.ts||b.t||0));
    return all;
  }

  // ——— 3) PAR START/FERDIG ———
  function pairIntervals(events){
    const keyOf = e => [ (e.address||e.addr||'').trim(), (e.driver||'').trim(), (e.task||e.oppgave||'').trim() ].join('｜');
    const groups = new Map();
    for (const e of events){
      const k=keyOf(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    const rows=[];
    for (const [, arr] of groups){
      arr.sort((a,b)=> new Date(a.ts||a.t)-new Date(b.ts||b.t));
      let open=null;
      for (const e of arr){
        const action=(e.action||e.a||'').toLowerCase();
        if (action==='start' && !open) open=e;
        else if (action==='ferdig' && open){
          rows.push({
            address:(e.address||open.address||'').trim(),
            driver:(e.driver||open.driver||'').trim(),
            task:(e.task||open.task||e.oppgave||open.oppgave||'').trim()||'Snø',
            start:asDate(open.ts||open.t),
            end:asDate(e.ts||e.t)
          });
          open=null;
        }
      }
    }
    rows.sort((a,b)=> (b.end?.getTime()||0)-(a.end?.getTime()||0));
    return rows;
  }

  // ——— 4) STATISTIKK ———
  function renderStats(rows){
    const box = $('#stats'); if (!box) return;

    const done = rows.filter(r=> r.start && r.end);
    const now = new Date();
    const sod = startOfDay(now);
    const sow = startOfWeekISO(now);
    const som = startOfMonth(now);
    const spm = startOfPrevMonth(now);

    let total=0, prevMonth=0, month=0, week=0, today=0;

    for (const r of done){
      const m = minsBetween(r.start, r.end);
      total += m;
      const ref = r.end || r.start;
      if (ref >= som) month += m;
      else if (ref >= spm && ref < som) prevMonth += m;
      if (ref >= sow) week += m;
      if (ref >= sod || sameDay(ref, now)) today += m;
    }

    box.innerHTML = `
      <strong>📊 Samlet brøytetid</strong><br>
      Totalt: <b>${fmtHhMm(total)}</b><br>
      Forrige måned: <b>${fmtHhMm(prevMonth)}</b><br>
      Denne måneden: <b>${fmtHhMm(month)}</b><br>
      Denne uken: <b>${fmtHhMm(week)}</b><br>
      I dag: <b>${fmtHhMm(today)}</b>
    `;
  }

  // ——— 5) VÆR ———
  function tryReadWxCache(){
    try{
      if (window.__WX__) return window.__WX__;
      const raw = localStorage.getItem('WX_CACHE');
      if (raw) return JSON.parse(raw);
    }catch{}
    return null;
  }
  function renderWeather(){
    const box = $('#weather'); if (!box) return;

    const cache = tryReadWxCache();
    const nowTemp = document.getElementById('wx_temp')?.textContent || '';
    const nowDesc = document.getElementById('wx_desc')?.textContent || '';
    const nowLine = cache?.current
      ? `${cache.current.temp ?? ''} ${cache.current.desc ?? ''}`.trim()
      : `${nowTemp} ${nowDesc}`.trim();

    let html = `<strong>🌦️ Vær nå:</strong><br>${nowLine || 'Henter…'}`;

    if (Array.isArray(cache?.hourly) && cache.hourly.length){
      const now = Date.now();
      const next3 = cache.hourly
        .filter(h => new Date(h.t ?? h.time ?? h.dt).getTime() > now)
        .slice(0,3)
        .map(h => {
          const tt = new Date(h.t ?? h.time ?? h.dt);
          const temp = (h.temp ?? h.temperature ?? '').toString().replace(/\.0$/,'');
          const desc = h.desc ?? h.description ?? '';
          const hh = pad(tt.getHours()), mm = pad(tt.getMinutes());
          return `<li><b>${hh}:${mm}</b> ${temp?`${temp}°`:''} ${desc}</li>`;
        });
      if (next3.length){
        html += `<div class="muted" style="margin-top:6px"><b>Neste 3 t:</b><ul style="margin:4px 0 0 18px">${next3.join('')}</ul></div>`;
      }
    } else {
      // forsøk å trigge innlasting hvis ingenting
      if (!nowLine && typeof window.loadWeather === 'function') { try{ window.loadWeather(); }catch{} }
    }

    box.innerHTML = html;
  }

  // ——— 6) SISTE OPPDRAG ———
  function renderRecent(rows){
    const box = $('#recent'); if (!box) return;
    const done = rows.filter(r=> r.start && r.end).slice(0,4);
    if (!done.length){
      box.innerHTML = `<strong>🧭 Siste oppdrag</strong><br><em>Ingen fullførte oppdrag enda.</em>`;
      return;
    }
    const li = done.map(r=>{
      const when = r.end ? `${fmtDateShort(r.end)} ${fmtClock(r.end)}` : '–';
      const took = fmtHhMm(minsBetween(r.start, r.end));
      const task = r.task || 'Snø';
      const addr = r.address || '';
      return `<li><b>${when}</b> — ${addr} <span class="muted">(${task}, ${took})</span></li>`;
    }).join('');
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul style="margin:6px 0 0 18px">${li}</ul>`;
  }

  // ——— MAIN ———
  async function init(){
    try{ renderFunfact(); }catch{}
    try{ renderWeather(); }catch{}

    // oppdater vær når bro-skript pusher data
    window.addEventListener('wx:update', ()=> { try{ renderWeather(); }catch{} });

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

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();