// js/Work.js
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_RUN = 'BRYT_RUN';         // {driver, equipment:{plow,fres,sand}, dir, idx}
  function run(){ return RJ(K_RUN, {driver:'', equipment:{}, dir:'Normal', idx:0}); }
  function saveRun(v){ WJ(K_RUN, v); }

  let ADDR = [];                     // lastes fra Sync
  let TYPE = 'SNØ';                  // SNØ | GRUS

  function activeType(){
    const r = run();
    TYPE = (r.equipment?.sand && !r.equipment?.plow && !r.equipment?.fres) ? 'GRUS' : 'SNØ';
    return TYPE;
  }

  function isDone(a){
    return TYPE==='SNØ' ? !!a.snowEnd : !!a.gritEnd;
  }
  function isStarted(a){
    return TYPE==='SNØ' ? !!a.snowStart : !!a.gritStart;
  }

  function nextIndex(from=0){
    const dir = run().dir==='Motsatt' ? -1 : 1;
    let i = Math.max(0, Math.min(ADDR.length-1, from));
    for (;;){
      const a = ADDR[i];
      if (a && !isDone(a)) return i;
      i += dir;
      if (i<0 || i>=ADDR.length) return -1;
    }
  }

  function getNowNext(){
    const r = run();
    const nowIdx = nextIndex(r.idx);
    const nextIdx = (nowIdx>=0) ? nextIndex(nowIdx + (r.dir==='Motsatt'?-1:+1)) : -1;
    return { nowIdx, nextIdx, now: ADDR[nowIdx] || null, next: ADDR[nextIdx] || null };
  }

  function describeTask(){
    return activeType()==='SNØ' ? 'Fjerne snø' : 'Strø grus';
  }

  function progress(){
    const me = run().driver?.trim();
    let mineDone=0, otherDone=0, total=ADDR.length;
    ADDR.forEach(a=>{
      const done = (a.snowEnd && TYPE==='SNØ') || (a.gritEnd && TYPE==='GRUS');
      if (done){
        if (a.driver && me && a.driver===me) mineDone++; else otherDone++;
      }
    });
    // bar
    const mePct = total? Math.round(100*mineDone/total):0;
    const otPct = total? Math.round(100*otherDone/total):0;
    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = (mePct+otPct) + '%';
    $('#b_prog_me_count')  && ($('#b_prog_me_count').textContent = `${mineDone}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${otherDone}/${total}`);
    $('#b_prog_summary')   && ($('#b_prog_summary').textContent = `${mineDone+otherDone} av ${total} adresser fullført`);
  }

  function render(){
    if (!$('#work') || $('#work').hasAttribute('hidden')) return;
    const {now, next} = getNowNext();
    $('#b_now')  && ($('#b_now').textContent  = now ? now.name : '—');
    $('#b_next') && ($('#b_next').textContent = next ? next.name : '—');
    $('#b_task') && ($('#b_task').textContent = describeTask());
    $('#b_status') && ($('#b_status').textContent = now ? (isDone(now) ? 'Ferdig' : (isStarted(now)? 'Pågår':'Venter')) : '—');
    progress();
  }

  async function setState(action){
    const r = run();
    const { nowIdx, now } = getNowNext();
    if (nowIdx<0 || !now) return;

    const ts = new Date().toISOString();
    const me = r.driver || '';
    let patch = {};

    if (TYPE==='SNØ'){
      if (action==='start' && !now.snowStart) patch.snowStart = ts;
      if (action==='done')                     patch.snowEnd   = ts;
    } else {
      if (action==='start' && !now.gritStart) patch.gritStart = ts;
      if (action==='done')                    patch.gritEnd   = ts;
    }
    if (action==='skip')   patch.skipped = true;
    if (action==='block')  patch.blocked = true;
    patch.driver = me;

    if (Object.keys(patch).length){
      await window.Sync.setStatus(now.id, patch);
      // oppdater lokalt speil
      ADDR = RJ('BRYT_ADDR_CACHE',{data:[]}).data || ADDR;
    }

    // flytt indeksen ved done/skip/block/next
    if (['done','skip','block','next'].includes(action)){
      const r2 = run();
      const step = (r2.dir==='Motsatt') ? -1 : +1;
      r2.idx = (action==='next') ? r2.idx+step : nowIdx+step;
      saveRun(r2);
    }
    render();

    // slutt på alt? tilby videre steg
    const { nowIdx: n2 } = getNowNext();
    if (n2 === -1){
      // Her kan vi åpne modalen for ny runde / grus / service
      // For nå: bare hint i UI
      alert('Runden er ferdig ✅\n(vi legger inn dialog for ny runde / grus / service).');
    }
  }

  function navTo(lat, lon, text){
    if (lat==null || lon==null){
      alert('Ingen koordinater på denne adressen.');
      return;
    }
    const label = encodeURIComponent(text || 'Mål');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${label}`;
    window.open(url, '_blank');
  }

  async function onClick(e){
    const id = e.currentTarget?.id;
    if (!id) return;
    try{
      if (id==='act_start') return await setState('start');
      if (id==='act_done')  return await setState('done');
      if (id==='act_skip')  return await setState('skip');
      if (id==='act_block') return await setState('block');
      if (id==='act_next')  return await setState('next');
      if (id==='act_nav'){
        const { now } = getNowNext();
        if (now) navTo(now.lat, now.lon, now.name);
      }
    }catch(err){ console.error(err); alert('Kunne ikke oppdatere status: ' + err.message); }
  }

  async function init(){
    if (!window.Sync){ console.warn('Sync mangler'); return; }
    try{
      ADDR = await window.Sync.loadAddresses({ force:false });
    }catch(e){ console.error(e); ADDR = []; }
    activeType();
    render();
  }

  function wire(){
    ['act_start','act_done','act_skip','act_next','act_nav','act_block']
    .forEach(id => { const el = $('#'+id); el && el.addEventListener('click', onClick); });

    window.addEventListener('hashchange', ()=>{
      if (location.hash==='#work') init();
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ wire(); if (location.hash==='#work') init(); });
})();