// js/Work.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS_SETTINGS = 'BRYT_SETTINGS';
  const LS_RUN      = 'BRYT_RUN';

  const readJSON = (k,d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON= (k,v) => localStorage.setItem(k, JSON.stringify(v));

  const STATE_LABEL = {
    venter:   'Venter',
    'pågår':  'Pågår',
    ferdig:   'Ferdig',
    hoppet:   'Hoppet over',
    blokkert: 'Ikke mulig'
  };

  function settings(){
    return readJSON(LS_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false });
  }
  function setRun(patch){
    const cur = readJSON(LS_RUN, { lane:'snow', idx:0, dir:'Normal', driver:'' });
    const next = {...cur, ...patch};
    writeJSON(LS_RUN, next);
    return next;
  }
  function getRun(){
    return readJSON(LS_RUN, { lane:'snow', idx:0, dir:'Normal', driver:'' });
  }

  function currentLane(){ return settings()?.equipment?.sand ? 'grit' : 'snow'; }
  function laneLabel(l){ return l==='grit' ? 'Grus' : 'Snø'; }

  function filteredAddresses(){
    const lane = getRun().lane || currentLane();
    const all  = window.Sync.getCache().addresses || [];
    // Filtrer på den oppgaven vi faktisk skal gjøre
    return all.filter(a => !!(a?.tasks?.[lane]));
  }

  function nextIndex(idx, dir){
    return (dir==='Motsatt') ? (idx-1) : (idx+1);
  }

  function getStatusFor(addrId, lane){
    const st = window.Sync.getCache().status || {};
    return st[addrId]?.[lane] || { state:'venter', by:null, rounds:[] };
  }

  function lastRoundForDriver(s, driver){
    if(!s?.rounds?.length) return null;
    for(let i=s.rounds.length-1;i>=0;i--){
      const r = s.rounds[i];
      if(r.by===driver && r.start && !r.done) return r;
    }
    return null;
  }

  function uiUpdate(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();

    const safeIdx  = Math.min(Math.max(run.idx ?? 0, 0), Math.max(list.length-1, 0));
    if (safeIdx !== run.idx) setRun({ idx: safeIdx });

    const now  = list[safeIdx] || null;
    const nxt  = (list.length>0) ? list[nextIndex(safeIdx, run.dir)] : null;

    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next')  && ($('#b_next').textContent = nxt ? (nxt.name||'—') : '—');

    const stNow = now ? getStatusFor(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[stNow.state] || '—');

    // progress – nå basert KUN på adresser i aktiv oppgave (lane)
    updateProgressLane();

    // knappetilstand
    const hasAny = list.length>0;
    $('#act_start')?.toggleAttribute('disabled', !hasAny);
    $('#act_done') ?.toggleAttribute('disabled', !hasAny);
    $('#act_skip') ?.toggleAttribute('disabled', !hasAny);
    $('#act_next') ?.toggleAttribute('disabled', !hasAny);
    $('#act_nav')  ?.toggleAttribute('disabled', !hasAny);
    $('#act_block')?.toggleAttribute('disabled', !hasAny);
  }

  function updateProgressLane(){
    const run   = getRun();
    const lane  = run.lane || currentLane();
    const list  = filteredAddresses();           // bare adresser med oppgaven vi gjør
    const stBag = window.Sync.getCache().status || {};
    const me    = settings().driver || '';

    const total = list.length;
    let mine=0, other=0, done=0;

    for(const a of list){
      const s = stBag[a.id]?.[lane];
      if (!s) continue;
      if (s.state==='ferdig'){
        done++;
        if (s.by && s.by===me) mine++;
        else if (s.by) other++;
      }
    }

    const mePct = total ? Math.round(100 * mine  / total) : 0;
    const otPct = total ? Math.round(100 * other / total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct+'%';
    if (bo) bo.style.width = otPct+'%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${mine}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${done} av ${total} adresser fullført`);
  }

  function mapsUrl(addr){
    if (!addr) return 'https://www.google.com/maps';
    if (addr.lat!=null && addr.lon!=null){
      const q = `${addr.lat},${addr.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr.name||'')+', Norge')}`;
  }

  function gotoNext(){
    const run  = getRun();
    const list = filteredAddresses();
    if (!list.length) return;

    const ni = nextIndex(run.idx, run.dir);
    if (ni>=0 && ni<list.length) {
      setRun({ idx: ni });
      uiUpdate();
    } else {
      // Slutt på listen – sjekk om alt er ferdig for denne lane
      checkAllDoneDialog();
    }
  }

  function allDoneForLane(){
    const lane = getRun().lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return false;
    const st = window.Sync.getCache().status || {};
    return list.every(a => (st[a.id]?.[lane]?.state==='ferdig'));
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
      setRun({ lane:'snow', idx:0 });
      location.hash = '#work';
      uiUpdate();
    } else if (res==='switch_grit'){
      setRun({ lane:'grit', idx:0 });
      location.hash = '#work';
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
    const list = filteredAddresses();
    if (!list.length) return;

    const cur = list[run.idx];
    const driver = settings().driver || '';

    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();

    const rounds = s.rounds?.length ? s.rounds.slice() : [{ start: nowISO, by: driver }];
    if (!s.rounds?.length) {
      // hvis ingen runder, opprettet over
    } else {
      // hvis det finnes runder men ingen pågår for denne sjåføren, legg til ny
      const hasOpenMine = s.rounds.some(r => r.by===driver && r.start && !r.done);
      if (!hasOpenMine) rounds.push({ start: nowISO, by: driver });
    }

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state: 'pågår', by: driver, rounds };
    await window.Sync.setStatusPatch(patch);
    uiUpdate();
  }

  async function actDone(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const cur = list[run.idx];
    const driver = settings().driver || '';

    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    let lr = lastRoundForDriver(s, driver);

    if (!lr) {
      rounds.push({ start: nowISO, done: nowISO, by: driver });
    } else {
      lr.done = nowISO;
    }

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state: 'ferdig', by: driver, rounds };
    await window.Sync.setStatusPatch(patch);

    uiUpdate();
    gotoNext();
    checkAllDoneDialog();
  }

  async function actSkip(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;
    const cur = list[run.idx];
    const driver = settings().driver || '';

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by:driver };
    await window.Sync.setStatusPatch(patch);
    uiUpdate();
    gotoNext();
  }

  async function actBlock(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;
    const cur = list[run.idx];
    const driver = settings().driver || '';

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'blokkert', by:driver };
    await window.Sync.setStatusPatch(patch);
    uiUpdate();
    gotoNext();
  }

  function actNext(){ gotoNext(); }

  function actNav(){
    const run  = getRun();
    const list = filteredAddresses();
    if(!list.length) return;

    const idx  = Math.min(Math.max(run.idx ?? 0, 0), Math.max(list.length-1, 0));
    const nxt  = list[nextIndex(idx, run.dir)] || list[idx];
    window.open(mapsUrl(nxt), '_blank');
  }

  function wire(){
    if (!$('#work')) return;

    // lane + idx init
    const st   = settings();
    const lane = st?.equipment?.sand ? 'grit' : 'snow';
    const run  = getRun();
    if (!run.driver) setRun({ driver: st.driver||'' });
    if (!run.dir)    setRun({ dir: st.dir||'Normal' });
    if (!run.lane)   setRun({ lane });

    // knapper
    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    // initial UI
    uiUpdate();

    // live oppdater ved synk
    window.Sync.on('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();