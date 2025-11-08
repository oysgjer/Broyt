// js/home_dashboard.js – teller KUN lukkede start→stopp-par fra JSONBin + viser timer/minutter
(() => {
  'use strict';

  // === Konfig ===
  const BIN_HENDELSER = "68e89e3443b1c97be9611c48"; // hendelser
  const API = "https://api.jsonbin.io/v3/b";

  // Hent nøkler fra localStorage (settes via Admin)
  const getMK = () =>
    (localStorage.getItem('X-Master-Key') ||
     localStorage.getItem('x-master-key') ||
     localStorage.getItem('jsonbin_master_key') || '').trim();
  const getAK = () =>
    (localStorage.getItem('X-Access-Key') ||
     localStorage.getItem('x-access-key') ||
     localStorage.getItem('jsonbin_access_key') || '').trim();

  function headers(json=false){
    const h={};
    if (json) h['Content-Type']='application/json';
    const mk = getMK(); const ak = getAK();
    if (mk) h['X-Master-Key']=mk;
    if (ak) h['X-Access-Key']=ak;
    return h;
  }

  // Henter og normaliserer hendelser
  async function fetchHendelser(){
    try{
      const r = await fetch(`${API}/${BIN_HENDELSER}/latest`, { headers: headers(false) });
      if (!r.ok) throw new Error('JSONBin status ' + r.status);
      const js = await r.json();

      const raw = js?.record?.reports || js?.record?.items || js?.record || [];
      const arr = Array.isArray(raw) ? raw : [];

      // Normaliser: kun start/ferdig → start/done
      const norm = [];
      for (const e of arr){
        const at = e.at || e.ts;
        if (!at) continue;
        const action = (e.action || e.type || '').toLowerCase();
        let type = null;
        if (action === 'start') type = 'start';
        else if (action === 'ferdig' || action === 'done') type = 'done';
        else continue;

        norm.push({
          type,
          at,
          addressId: e.addressId || null,
          address:   e.address   || e.addressName || e.addressId || null,
          by:        e.by        || e.driver      || '',
        });
      }

      // Dedup
      const seen = new Set();
      const out = [];
      for (const e of norm){
        const key = [e.type, e.at, e.address||'', e.by||''].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
      }
      return out;
    }catch(e){
      console.warn('[home_dashboard] klarte ikke å hente hendelser:', e);
      return [];
    }
  }

  // Tidshjelpere
  function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
  function startOfWeek(d){
    const x = startOfDay(d);
    const day = x.getDay();
    const mondayOffset = (day === 0 ? -6 : 1 - day);
    x.setDate(x.getDate() + mondayOffset);
    return x;
  }
  function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
  function endOfMonth(d){ const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(23,59,59,999); return x; }
  function prevMonthRange(d){
    const curFirst = startOfMonth(d);
    const prevLast = new Date(curFirst); prevLast.setDate(0); prevLast.setHours(23,59,59,999);
    const prevFirst = new Date(prevLast); prevFirst.setDate(1); prevFirst.setHours(0,0,0,0);
    return [prevFirst, prevLast];
  }

  // Summerer minutter av KUN lukkede par
  function sumMinutesClosed(events, from=null, to=null){
    const fromMs = from ? from.getTime() : -Infinity;
    const toMs   = to   ? to.getTime()   :  Infinity;

    const ev = [...events].sort((a,b)=> new Date(a.at)-new Date(b.at));
    const keyFor = (e)=> `${e.address || e.addressId || ''}|${e.by || ''}`;
    const stacks = new Map();
    let totalMs = 0;

    for (const e of ev){
      const t = new Date(e.at).getTime();
      if (isNaN(t)) continue;
      const k = keyFor(e);
      if (!stacks.has(k)) stacks.set(k, []);
      const st = stacks.get(k);

      if (e.type === 'start'){
        st.push(t);
      } else if (e.type === 'done'){
        if (!st.length) continue;
        const t0 = st.pop();
        const t1 = t;
        if (t0 >= fromMs && t1 <= toMs && t1 >= t0){
          totalMs += (t1 - t0);
        }
      }
    }
    return Math.round(totalMs/60000);
  }

  // Formaterer minutter → "X t Y min" eller "Y min"
  function fmtTime(mins){
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins/60);
    const m = Math.round(mins%60);
    if (m === 0) return `${h} t`;
    return `${h} t ${m} min`;
  }

  function renderStats(minutes){
    const el = document.getElementById('stats');
    if (!el) return;
    el.innerHTML = `
      <div class="card" style="padding:12px">
        <div class="muted-strong" style="margin-bottom:6px">📊 Samlet brøytetid</div>
        <div>Totalt: <b>${fmtTime(minutes.total)}</b></div>
        <div>Forrige måned: <b>${fmtTime(minutes.prevMonth)}</b></div>
        <div>Denne måneden: <b>${fmtTime(minutes.month)}</b></div>
        <div>Denne uken: <b>${fmtTime(minutes.week)}</b></div>
        <div>I dag: <b>${fmtTime(minutes.today)}</b></div>
      </div>
    `;
  }

  async function run(){
    const all = await fetchHendelser();
    const now = new Date();

    const todayFrom = startOfDay(now);
    const todayTo   = endOfDay(now);

    const weekFrom = startOfWeek(now);
    const weekTo   = endOfDay(now);

    const monthFrom = startOfMonth(now);
    const monthTo   = endOfMonth(now);

    const [pmFrom, pmTo] = prevMonthRange(now);

    const minutes = {
      total:     sumMinutesClosed(all, new Date(0), new Date(8640000000000000)),
      prevMonth: sumMinutesClosed(all, pmFrom, pmTo),
      month:     sumMinutesClosed(all, monthFrom, monthTo),
      week:      sumMinutesClosed(all, weekFrom, weekTo),
      today:     sumMinutesClosed(all, todayFrom, todayTo),
    };

    renderStats(minutes);
  }

  document.addEventListener('DOMContentLoaded', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
  setInterval(run, 60 * 60 * 1000);
})();