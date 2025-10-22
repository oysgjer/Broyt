// js/Work.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS_SETTINGS = 'BRYT_SETTINGS';
  const LS_RUN      = 'BRYT_RUN';

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const STATE_LABEL = {
    venter:   'Venter',
    'pågår':  'Pågår',
    ferdig:   'Ferdig',
    hoppet:   'Hoppet over',
    blokkert: 'Ikke mulig'
  };

  function settings(){
    return RJ(LS_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false });
  }
  function getRun(){
    return RJ(LS_RUN, { lane:'snow', idx:0, dir:'Normal', driver:'' });
  }
  function setRun(patch){
    const cur = getRun();
    const next = {...cur, ...patch};
    WJ(LS_RUN, next);
    return next;
  }

  function currentLane(){
    return settings()?.equipment?.sand ? 'grit' : 'snow';
  }
  function laneLabel(l){ return l==='grit' ? 'Grus' : 'Snø'; }

  function filteredAddresses(){
    const lane = getRun().lane || currentLane();
    const all  = (window.Sync.getCache().addresses || []);
    // ta kun de som faktisk har oppgaven aktiv
    return all.filter(a => !!(a?.tasks?.[lane]));
  }

  function getStatusFor(addrId, lane){
    const st = window.Sync.getCache().status || {};
    return st[addrId]?.[lane] || { state:'venter', by:null, rounds:[] };
  }

  function isBlockedForMe(addr, lane, me){
    const s = getStatusFor(addr.id, lane);
    // Blokker dersom ferdig, eller pågår av en annen sjåfør
    if (s.state === 'ferdig') return true;
    if (s.state === 'pågår' && s.by && s.by !== me) return true;
    return false;
  }

  function stepDirection(dir){
    return (dir === 'Motsatt') ? -1 : 1;
  }

  // Finn nærmeste gyldige indeks fra startIdx i retning dir
  function findAvailableIndex(list, startIdx, dir, lane, me){
    if (!list.length) return -1;
    const step = stepDirection(dir);
    let idx = startIdx;

    // Hold oss innenfor ±
    const inBounds = (i)=> (i>=0 && i<list.length);

    // Sjekk start først
    if (inBounds(idx) && !isBlockedForMe(list[idx], lane, me)) return idx;

    // Trå gjennom lista i valgt retning til vi finner en tilgjengelig adresse
    idx += step;
    while(inBounds(idx)){
      if (!isBlockedForMe(list[idx], lane, me)) return idx;
      idx += step;
    }
    return -1; // ingen ledig
  }

  function pickStartIndex(list, dir, lane, me){
    if (!list.length) return -1;
    const start = (dir === 'Motsatt') ? (list.length - 1) : 0;
    return findAvailableIndex(list, start, dir, lane, me);
  }

  function nextIndex(list, curIdx, dir, lane, me){
    if (!list.length) return -1;
    const step = stepDirection(dir);
    const inBounds = (i)=> (i>=0 && i<list.length);
    let i = curIdx + step;

    while(inBounds(i)){
      if (!isBlockedForMe(list[i], lane, me)) return i;
      i += step;
    }
    return -1;
  }

  function uiUpdate(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const me   = settings().driver || '';
    const list = filteredAddresses();

    let idx = run.idx ?? 0;
    // Sikre gyldig start-etablering:
    if (!list.length){
      idx = -1;
    } else if (idx < 0 || idx >= list.length || isBlockedForMe(list[idx], lane, me)) {
      // Velg nærmeste tilgjengelige fra naturlig start
      const picked = pickStartIndex(list, run.dir || 'Normal', lane, me);
      idx = picked;
      setRun({ idx: Math.max(idx, 0) }); // behold gyldig verdi i storage
    }

    const now = (idx>=0) ? list[idx] : null;
    const ni  = (idx>=0) ? nextIndex(list, idx, run.dir||'Normal', lane, me) : -1;
    const nxt = (ni>=0) ? list[ni] : null;

    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next')  && ($('#b_next').textContent = nxt ? (nxt.name||'—') : '—');

    const stNow = now ? getStatusFor(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[stNow.state] || '—');

    updateProgress();

    const hasAny = list.length>0 && idx>=0;
    $('#act_start')?.toggleAttribute('disabled', !hasAny);
    $('#act_done') ?.toggleAttribute('disabled', !hasAny);
    $('#act_skip') ?.toggleAttribute('disabled', !hasAny);
    $('#act_next') ?.toggleAttribute('disabled', list.length===0);
    $('#act_nav')  ?.toggleAttribute('disabled', !hasAny && !nxt);
    $('#act_block')?.toggleAttribute('disabled', !hasAny);
  }

  function updateProgress(){
    const driver = settings().driver || '';
    const pr = window.Sync.computeProgress(driver);
    // Vis progress basert på antall som faktisk har oppgaven i gjeldende lane
    const lane = getRun().lane || currentLane();
    const list = filteredAddresses();
    const total = list.length;

    // Fordel "done" mellom meg/andre for visualisering
    const st = window.Sync.getCache().status || {};
    let mineDone = 0, otherDone = 0;
    for (const a of list){
      const s = st[a.id]?.[lane];
      if (s?.state === 'ferdig'){
        if (s?.by === driver) mineDone++; else otherDone++;
      }
    }

    const mePct = total ? Math.round(100 * mineDone  / total) : 0;
    const otPct = total ? Math.round(100 * otherDone / total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct+'%';
    if (bo) bo.style.width = otPct+'%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${mineDone}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${otherDone}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${mineDone+otherDone} av ${total} adresser fullført`);
  }

  function mapsUrl(addr){
    if (!addr) return 'https://www.google.com/maps';
    if (addr.lat!=null && addr.lon!=null){
      const q = `${addr.lat},${addr.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr.name||'')+', Norge')}`;
  }

  async function gotoNextOrFinish(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const me   = settings().driver || '';
    const list = filteredAddresses();
    if (!list.length) { uiUpdate(); return; }

    const ni = nextIndex(list, run.idx ?? 0, run.dir||'Normal', lane, me);
    if (ni>=0){
      setRun({ idx: ni });
      uiUpdate();
    } else {
      // Ingen flere tilgjengelige – sjekk om alt ferdig for denne lane
      checkAllDoneDialog();
    }
  }

  function allDoneForLane(){
    const lane = getRun().lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return false;
    const st = window.Sync.getCache().status || {};
    return list.every(a => (st[a.id]?.[lane]?.state === 'ferdig'));
  }

  async function checkAllDoneDialog(){
    if (!allDoneForLane()) return;
    const res = await askChoice([
      {id:'repeat_snow',  label:'Ny runde snø'},
      {id:'switch_grit',  label:'Ny runde grus'},
      {id:'finish',       label:'Ferdig → Service'}
    ], 'Alt på denne runden er markert som ferdig. Hva vil du gjøre nå?');

    if (!res) return;

    if (res==='repeat_snow'){
      setRun({ lane:'snow', idx: 0 });
      uiUpdate(); // ny lane, ny start
    } else if (res==='switch_grit'){
      setRun({ lane:'grit', idx: 0 });
      uiUpdate();
    } else if (res==='finish'){
      location.hash = '#service';
    }
  }

  function askChoice(options, title='Velg'){
    return new Promise(resolve=>{
      const txt = [title, '', ...options.map((o,i)=>`${i+1}) ${o.label}`), '', 'Skriv nummer:'].join('\n');
      const ans = prompt(txt,'');
      const n   = parseInt(ans||'',10);
      if (!n || n<1 || n>options.length) return resolve(null);
      resolve(options[n-1].id);
    });
  }

  async function actStart(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const me   = settings().driver || '';
    const list = filteredAddresses();
    if (!list.length) return;

    let idx = run.idx ?? 0;
    if (idx<0 || idx>=list.length) {
      idx = pickStartIndex(list, run.dir||'Normal', lane, me);
      if (idx<0){ uiUpdate(); return; }
      setRun({ idx });
    }

    const cur = list[idx];
    // Ikke tillat start hvis blokkert (ferdig eller pågår av andre)
    if (isBlockedForMe(cur, lane, me)) {
      await gotoNextOrFinish();
      return;
    }

    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    // Opprett runde hvis ikke finnes åpen runde for meg
    if (!(s.state==='pågår' && s.by===me)){
      rounds.push({ start: nowISO, by: me });
    }

    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = {
      state: 'pågår',
      by: me,
      rounds
    };
    await window.Sync.setStatusPatch(patch);
    uiUpdate();
  }

  async function actDone(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const me   = settings().driver || '';
    const list = filteredAddresses();
    if (!list.length) return;

    let idx = run.idx ?? 0;
    if (idx<0 || idx>=list.length) { uiUpdate(); return; }

    const cur = list[idx];
    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();

    // Finn siste runde for meg uten done
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    let iLast = -1;
    for(let i=rounds.length-1;i>=0;i--){
      if (rounds[i].by===me && rounds[i].start && !rounds[i].done){ iLast=i; break; }
    }
    if (iLast>=0) rounds[iLast].done = nowISO;
    else rounds.push({ start: nowISO, done: nowISO, by: me });

    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'ferdig', by:me, rounds };
    await window.Sync.setStatusPatch(patch);

    // Neste ledige
    await gotoNextOrFinish();
  }

  async function actSkip(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const me   = settings().driver || '';
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = run.idx ?? 0;
    if (idx<0 || idx>=list.length) { uiUpdate(); return; }
    const cur = list[idx];

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by:me, rounds:[] };
    await window.Sync.setStatusPatch(patch);

    await gotoNextOrFinish();
  }

  async function actBlock(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const me   = settings().driver || '';
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = run.idx ?? 0;
    if (idx<0 || idx>=list.length) { uiUpdate(); return; }
    const cur = list[idx];

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'blokkert', by:me, rounds:[] };
    await window.Sync.setStatusPatch(patch);

    await gotoNextOrFinish();
  }

  function actNext(){
    gotoNextOrFinish();
  }

  function actNav(){
    const run  = getRun();
    const me   = settings().driver || '';
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = run.idx ?? 0;
    const ni  = nextIndex(list, idx, run.dir||'Normal', lane, me);
    const target = (ni>=0 ? list[ni] : (idx>=0 ? list[idx] : null));
    if (!target) return;

    window.open(mapsUrl(target), '_blank');
  }

  function wire(){
    if (!$('#work')) return;

    // init lane/driver/dir
    const st = settings();
    const laneFromSettings = st?.equipment?.sand ? 'grit' : 'snow';
    const run = getRun();
    if (!run.driver) setRun({ driver: st.driver||'' });
    if (!run.dir)    setRun({ dir: st.dir||'Normal' });
    if (!run.lane)   setRun({ lane: laneFromSettings });

    // **Viktig**: plukk startindeks korrekt (inkl. Motsatt + samarbeid)
    const me   = st.driver || '';
    const lane = getRun().lane || laneFromSettings;
    const list = filteredAddresses();
    if (list.length){
      const startIdx = pickStartIndex(list, getRun().dir || 'Normal', lane, me);
      setRun({ idx: Math.max(startIdx, 0) });
    }

    // knapper
    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    // initial UI
    uiUpdate();

    // hold UI i sync når data endres (andre sjåfører)
    window.Sync.on('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();