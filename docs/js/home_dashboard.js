// js/home_dashboard.js — brøytetid (oppstart + hver hele time)
(() => {
  'use strict';

  const BIN = "68e89e3443b1c97be9611c48";
  const API = "https://api.jsonbin.io/v3/b";

  // Nøkler (settes i Admin)
  const getMK = () =>
    (localStorage.getItem('X-Master-Key') ||
     localStorage.getItem('x-master-key') ||
     localStorage.getItem('jsonbin_master_key') || '').trim();
  const getAK = () =>
    (localStorage.getItem('X-Access-Key') ||
     localStorage.getItem('x-access-key') ||
     localStorage.getItem('jsonbin_access_key') || '').trim();

  function headers(){
    const h={};
    const mk=getMK(), ak=getAK();
    if (mk) h['X-Master-Key']=mk;
    if (ak) h['X-Access-Key']=ak;
    return h;
  }

  // --- UI helpers ---
  const host = () => document.getElementById('stats');
  const card = (inner) => `<div class="card" style="padding:12px">
    <div class="muted-strong" style="margin-bottom:6px">📊 Samlet brøytetid</div>
    ${inner}
  </div>`;

  function renderMinutes(m) {
    const el = host(); if (!el) return;
    el.innerHTML = card(`
      <div>Totalt: <b>${m.total}m</b></div>
      <div>Forrige måned: <b>${m.prevMonth}m</b></div>
      <div>Denne måneden: <b>${m.month}m</b></div>
      <div>Denne uken: <b>${m.week}m</b></div>
      <div>I dag: <b>${m.today}m</b></div>
    `);
  }

  function renderZeros(){
    renderMinutes({ total:0, prevMonth:0, month:0, week:0, today:0 });
  }

  // --- Normalisering ---
  function normalizeOne(e){
    const action = (e.type || e.action || '').toLowerCase();
    const type =
      action === 'ferdig'     ? 'done' :
      action === 'ikke_mulig' ? 'skip' :
      action === 'neste'      ? 'next' : action; // start/done/skip/next
    const at = e.at || e.ts || null;
    const address = e.addressId || e.addressName || e.address || '';
    return { type, at, address: String(address||'').trim() };
  }

  async function fetchNormalized(){
    try{
      // cache-buster for å unngå gammel mobil-cache
      const r = await fetch(`${API}/${BIN}/latest?cb=${Date.now()}`, { headers: headers() });
      if (!r.ok) return [];
      const js = await r.json();

      let raw = [];
      if (Array.isArray(js.record)) raw = js.record;
      else if (Array.isArray(js.record?.items)) raw = js.record.items;
      else if (Array.isArray(js.record?.reports)) raw = js.record.reports;

      const norm = raw.map(normalizeOne)
        .filter(x => x.at && x.address && (x.type==='start' || x.type==='done'))
        .sort((a,b) => new Date(a.at) - new Date(b.at));

      // fjern helt identiske dubletter
      const seen = new Set(); const out=[];
      for (const e of norm){
        const k = `${e.type}|${e.address}|${e.at}`;
        if (!seen.has(k)){ seen.add(k); out.push(e); }
      }
      return out;
    }catch{
      return [];
    }
  }

  // --- Datointervaller ---
  const sod = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const eod = d => { const x=new Date(d); x.setHours(23,59,59,999); return x; };
  const sow = d => { const x=sod(d); const day=x.getDay(); x.setDate(x.getDate() + (day===0?-6:1-day)); return x; };
  const som = d => { const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; };
  const eom = d => { const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(23,59,59,999); return x; };
  const prevMonth = d => { const a=som(d); const to=new Date(a); to.setDate(0); to.setHours(23,59,59,999); const from=new Date(to); from.setDate(1); from.setHours(0,0,0,0); return [from,to]; };

  // --- Summer tid per adresse (uavhengig av sjåfør) ---
  function sumMinutes(events, from=null, to=null){
    const ev = events.filter(e => {
      const t = new Date(e.at).getTime();
      return (!from || t >= from.getTime()) && (!to || t <= to.getTime());
    });

    const stacks = new Map(); // addr -> [startMs, ...]
    let ms = 0;

    for (const e of ev){
      const addr = e.address || '(ukjent)';
      if (!stacks.has(addr)) stacks.set(addr, []);
      const st = stacks.get(addr);

      if (e.type === 'start'){
        st.push(new Date(e.at).getTime());
      } else if (e.type === 'done' && st.length){
        const t0 = st.pop();
        const t1 = new Date(e.at).getTime();
        if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
          ms += (t1 - t0);
        }
      }
    }
    return Math.round(ms/60000);
  }

  // --- Hovedjobb: hent og vis ---
  async function run(){
    const all = await fetchNormalized();
    if (!all.length){ renderZeros(); return; }

    const now = new Date();
    const minutes = {
      total:     sumMinutes(all),
      prevMonth: sumMinutes(all, ...prevMonth(now)),
      month:     sumMinutes(all, som(now), eom(now)),
      week:      sumMinutes(all, sow(now), eod(now)),
      today:     sumMinutes(all, sod(now), eod(now))
    };
    renderMinutes(minutes);
  }

  // Eksponer for ev. manuell bruk
  window.updateStats = run;

  // --- Automatisk oppdatering: ved oppstart + hver hele time ---
  function setupHourlyRefresh(){
    // 1) Kjør nå (ved oppstart / når sida lastes)
    run();

    // 2) Finn ms til neste hele time
    const now = new Date();
    const msToNextHour =
      ((59 - now.getMinutes()) * 60 + (60 - now.getSeconds())) * 1000
      - now.getMilliseconds();

    // 3) Oppdater ved neste hele time, og deretter hver time
    setTimeout(() => {
      run();
      setInterval(run, 60 * 60 * 1000);
    }, Math.max(0, msToNextHour));
  }

  document.addEventListener('DOMContentLoaded', setupHourlyRefresh);
})();