// js/home_dashboard.js — Samlet brøytetid med normalisering av "reports"
(() => {
  'use strict';

  const BIN_HENDELSER = "68e89e3443b1c97be9611c48";
  const API = "https://api.jsonbin.io/v3/b";

  const getMK = () =>
    (localStorage.getItem('X-Master-Key') ||
     localStorage.getItem('x-master-key') ||
     localStorage.getItem('jsonbin_master_key') || '').trim();
  const getAK = () =>
    (localStorage.getItem('X-Access-Key') ||
     localStorage.getItem('x-access-key') ||
     localStorage.getItem('jsonbin_access_key') || '').trim();

  function headers(){
    const h = {};
    const mk = getMK(), ak = getAK();
    if (mk) h['X-Master-Key'] = mk;
    if (ak) h['X-Access-Key'] = ak;
    return h;
  }

  const elStats = () => document.getElementById('stats');
  function renderCard(inner){ const el=elStats(); if(!el) return; el.innerHTML =
    `<div class="card" style="padding:12px">
       <div class="muted-strong" style="margin-bottom:6px">📊 Samlet brøytetid</div>
       ${inner}
     </div>`; }

  function renderZerosWithHint(){
    renderCard(`
      <div class="muted" style="margin-bottom:6px">
        Trenger JSONBin-nøkler. Åpne <a href="./index.html#admin">Admin</a> og lagre X-Master-Key.
      </div>
      <div>Totalt: <b>0m</b></div>
      <div>Forrige måned: <b>0m</b></div>
      <div>Denne måneden: <b>0m</b></div>
      <div>Denne uken: <b>0m</b></div>
      <div>I dag: <b>0m</b></div>
    `);
  }
  function renderMinutes(m){
    renderCard(`
      <div>Totalt: <b>${m.total}m</b></div>
      <div>Forrige måned: <b>${m.prevMonth}m</b></div>
      <div>Denne måneden: <b>${m.month}m</b></div>
      <div>Denne uken: <b>${m.week}m</b></div>
      <div>I dag: <b>${m.today}m</b></div>
    `);
  }

  function normalizeOne(e){
    // Kildefelter: {type/ action}, {at/ ts}, {by/ driver}, {addressId/ address/ addressName}
    const action = (e.type || e.action || '').toLowerCase();
    const type =
      action === 'ferdig'      ? 'done' :
      action === 'ikke_mulig'  ? 'skip' :
      action === 'neste'       ? 'next' :
      action; // 'start' | 'done' | 'skip' | 'next' | …

    const at = e.at || e.ts || null;
    const by = e.by || e.driver || '';
    const addressId = e.addressId || e.addressName || e.address || '';
    const addressName = e.addressName || e.address || e.addressId || '';
    const reason = e.reason || e.notes || '';

    return { type, at, by, addressId, addressName, reason };
  }

  async function fetchNormalized(){
    try{
      const r = await fetch(`${API}/${BIN_HENDELSER}/latest`, { headers: headers() });
      if (r.status === 401 || r.status === 403){ renderZerosWithHint(); return []; }
      if (!r.ok) throw new Error('JSONBin status ' + r.status);

      const js = await r.json();
      const rec = js.record;

      // Støtt tre varianter: ren array | {items:[]} | {reports:[]}
      let raw = [];
      if (Array.isArray(rec)) raw = rec;
      else if (Array.isArray(rec?.items)) raw = rec.items;
      else if (Array.isArray(rec?.reports)) raw = rec.reports;

      // Normaliser og filtrer bort tomme/ukjente
      const norm = raw.map(normalizeOne)
        .filter(x => x.at && x.type && ['start','done','skip'].includes(x.type));

      // Fjerne åpenbare duplikater (vi så dublerte i bin’en)
      const seen = new Set();
      const uniq = [];
      for (const ev of norm){
        const key = `${ev.type}|${ev.by}|${ev.addressId || ev.addressName}|${ev.at}`;
        if (!seen.has(key)){ seen.add(key); uniq.push(ev); }
      }
      return uniq;
    }catch(e){
      console.warn('[home_dashboard] henting feilet:', e);
      renderCard(`<div class="muted">Kunne ikke hente data.</div>
                  <div style="margin-top:6px">Totalt: <b>0m</b> • Forrige måned: <b>0m</b> • Denne måneden: <b>0m</b> • Denne uken: <b>0m</b> • I dag: <b>0m</b></div>`);
      return [];
    }
  }

  // Datohjelpere
  const sod = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const eod = d => { const x=new Date(d); x.setHours(23,59,59,999); return x; };
  const sow = d => { const x=sod(d); const day=x.getDay(); x.setDate(x.getDate() + (day===0?-6:1-day)); return x; };
  const som = d => { const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; };
  const eom = d => { const x=new Date(d); x.setMonth(x.getMonth()+1,0); x.setHours(23,59,59,999); return x; };
  const prevMonth = d => { const a=som(d); const to=new Date(a); to.setDate(0); to.setHours(23,59,59,999); const from=new Date(to); from.setDate(1); from.setHours(0,0,0,0); return [from,to]; };

  // Summer minutter ved å pare start->done per (adresse, sjåfør)
  function sumMinutes(events, from=null, to=null){
    const ev = events
      .filter(e => {
        const t = new Date(e.at).getTime();
        return (!from || t >= from.getTime()) && (!to || t <= to.getTime());
      })
      .sort((a,b) => new Date(a.at) - new Date(b.at));

    const key = e => `${e.addressId || e.addressName || ''}|${e.by || ''}`;
    const stacks = new Map(); let ms = 0;

    for (const e of ev){
      const k = key(e);
      if (!stacks.has(k)) stacks.set(k, []);
      const st = stacks.get(k);

      if (e.type === 'start'){
        st.push(new Date(e.at).getTime());
      } else if (e.type === 'done' && st.length){
        const t0 = st.pop(), t1 = new Date(e.at).getTime();
        if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) ms += (t1 - t0);
      }
    }
    return Math.round(ms/60000);
  }

  async function run(){
    const all = await fetchNormalized();
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

  // Oppdater når nøkler endres i Admin
  window.addEventListener('storage', (e) => {
    const k = (e?.key || '').toLowerCase();
    if (['x-master-key','x-access-key','jsonbin_master_key','jsonbin_access_key'].includes(k)) run();
  });

  document.addEventListener('DOMContentLoaded', run);
})();
