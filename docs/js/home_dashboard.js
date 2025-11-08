// js/home_dashboard.js – Samlet brøytetid beregnet fra JSONBin-hendelser
(() => {
  'use strict';

  // === Konfig ===
  const BIN_HENDELSER = "68e89e3443b1c97be9611c48"; // privat hendelser
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

  async function fetchHendelser(){
    try{
      const r = await fetch(`${API}/${BIN_HENDELSER}/latest`, { headers: headers(false) });
      if (!r.ok) throw new Error('JSONBin status ' + r.status);
      const js = await r.json();
      const arr = Array.isArray(js.record) ? js.record : (js.record?.items || []);
      // bare de vi bryr oss om
      return arr.filter(e => e && e.at && (e.type==='start' || e.type==='done'));
    }catch(e){
      console.warn('[home_dashboard] klarte ikke å hente hendelser:', e);
      return []; // vis 0m i verste fall
    }
  }

  function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
  function startOfWeek(d){
    const x = startOfDay(d);
    const day = x.getDay(); // 0=Sun…6=Sat
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

  // sommer brøytetid (minutter) ved å pare start->done pr adresse + sjåfør
  function sumMinutes(events, from=null, to=null){
    const ev = events
      .filter(e => {
        if (!e?.at) return false;
        const t = new Date(e.at).getTime();
        if (from && t < from.getTime()) return false;
        if (to && t > to.getTime()) return false;
        return true;
      })
      .sort((a,b)=> new Date(a.at)-new Date(b.at));

    const keyFor = (e)=> `${e.addressId || e.addressName || ''}|${e.by || ''}`;
    const stacks = new Map(); // key -> [start ms]
    let totalMs = 0;

    for (const e of ev){
      const k = keyFor(e);
      if (!stacks.has(k)) stacks.set(k, []);
      const st = stacks.get(k);
      if (e.type === 'start'){
        st.push(new Date(e.at).getTime());
      } else if (e.type === 'done' && st.length){
        const t0 = st.pop();
        const t1 = new Date(e.at).getTime();
        if (!isNaN(t0) && !isNaN(t1) && t1>=t0) totalMs += (t1 - t0);
      }
    }
    return Math.round(totalMs/60000);
  }

  function renderStats(minutes){
    const el = document.getElementById('stats');
    if (!el) return;
    const html = `
      <div class="card" style="padding:12px">
        <div class="muted-strong" style="margin-bottom:6px">📊 Samlet brøytetid</div>
        <div>Totalt: <b>${minutes.total}m</b></div>
        <div>Forrige måned: <b>${minutes.prevMonth}m</b></div>
        <div>Denne måneden: <b>${minutes.month}m</b></div>
        <div>Denne uken: <b>${minutes.week}m</b></div>
        <div>I dag: <b>${minutes.today}m</b></div>
      </div>
    `;
    el.innerHTML = html;
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
      total:     sumMinutes(all),
      prevMonth: sumMinutes(all, pmFrom, pmTo),
      month:     sumMinutes(all, monthFrom, monthTo),
      week:      sumMinutes(all, weekFrom, weekTo),
      today:     sumMinutes(all, todayFrom, todayTo),
    };

    renderStats(minutes);
  }

  document.addEventListener('DOMContentLoaded', run);
})();
