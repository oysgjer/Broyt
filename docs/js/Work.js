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

  function settings(){ return RJ(LS_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false }); }
  function getRun(){ return RJ(LS_RUN, { lane:null, idx:0, dir:'Normal', driver:'' }); }
  function setRun(p){ const cur=getRun(); const next={...cur,...p}; WJ(LS_RUN,next); return next; }

  function currentLane(){
    // lane bestemmes av utstyr (sand = grus) hvis ikke eksplisitt satt
    const run = getRun();
    if (run.lane) return run.lane;
    const st = settings();
    return st?.equipment?.sand ? 'grit' : 'snow';
  }
  function laneLabel(l){ return l==='grit' ? 'Strøing av grus' : 'Fjerne snø'; }

  // Robust sjekk om adressen skal være med i valgt lane
  function addrHasTask(a, lane){
    // støtt både tasks.{snow,grit} og flags.{snow,grit}, og default: snow=true, grit=false
    const t = a?.tasks || {};
    const f = a?.flags || {};
    const snow = (typeof t.snow==='boolean') ? t.snow : (typeof f.snow==='boolean' ? f.snow : true);
    const grit = (typeof t.grit==='boolean') ? t.grit : (typeof f.grit==='boolean' ? f.grit : false);
    return lane==='grit' ? !!grit : !!snow;
  }

  function filteredAddresses(){
    const lane = currentLane();
    const all  = (window.Sync.getCache().addresses||[]);
    return all.filter(a => addrHasTask(a, lane));
  }

  function nextIndex(idx, dir){ return (dir==='Motsatt') ? (idx-1) : (idx+1); }

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

  function updateProgress(){
    const driver = settings().driver || '';
    const pr = window.Sync.computeProgress(driver);
    const total = pr.total || 0;
    const mePct = total ? Math.round(100 * (pr.mine||0)  / total) : 0;
    const otPct = total ? Math.round(100 * (pr.other||0) / total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct+'%';
    if (bo) bo.style.width = otPct+'%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${pr.mine||0}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${pr.other||0}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min((pr.done||0), total)} av ${total} adresser fullført`);
  }

  function uiUpdate(){
    const run  = getRun();
    const lane = currentLane();
    const list = filteredAddresses();

    // hold idx innenfor grense
    const idx  = Math.min(Math.max(run.idx ?? 0, 0), Math.max(list.length-1, 0));
    if (idx !== run.idx) setRun({ idx });

    const now  = list[idx] || null;
    const nxt  = (list.length>0) ? list[nextIndex(idx, (run.dir||'Normal'))] : null;

    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next')  && ($('#b_next').textContent = nxt ? (nxt.name||'—') : '—');

    const stNow = now ? getStatusFor(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[stNow.state] || '—');

    updateProgress();

    const hasAny = list.length>0;
    ['act_start','act_done','act_skip','act_next','act_nav','act_block'].forEach(id=>{
      const el = $('#'+id); if (el) el.toggleAttribute('disabled', !hasAny);
    });
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

    const ni = nextIndex(run.idx, run.dir||'Normal');
    if (ni>=0 && ni<list.length) {
      setRun({ idx: ni });
      uiUpdate();
    } else {
      checkAllDoneDialog();
    }
  }

  function allDoneForLane(){
    const lane = currentLane();
    const list = filteredAddresses();
    if (!list.length) return false;
    const st = window.Sync.getCache().status || {};
    return list.every(a => (st[a.id]?.[lane]?.state==='ferdig'));
  }

  async function checkAllDoneDialog(){
    if (!allDoneForLane()) return;
    const res = prompt([
      'Alt på denne runden er markert som ferdig. Hva vil du gjøre nå?',
      '',
      '1) Ny runde snø',
      '2) Ny runde grus',
      '3) Ferdig → Service',
      '',
      'Skriv nummer:'
    ].join('\n'),'');
    if (!res) return;
    if (res==='1'){ setRun({ lane:'snow', idx:0 }); location.hash='#work'; uiUpdate(); }
    else if (res==='2'){ setRun({ lane:'grit', idx:0 }); location.hash='#work'; uiUpdate(); }
    else if (res==='3'){ location.hash='#service'; }
  }

  async function actStart(){
    const lane = currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run  = getRun();
    const cur  = list[run.idx];
    const driver = settings().driver || '';

    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = {
      state: 'pågår',
      by: driver,
      rounds: s.rounds?.length ? s.rounds : [{ start: nowISO, by: driver }]
    };
    await window.Sync.setStatusPatch(patch);
    uiUpdate();
  }

  async function actDone(){
    const lane = currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run  = getRun();
    const cur  = list[run.idx];
    const driver = settings().driver || '';
    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    let lr = lastRoundForDriver(s, driver);

    if (!lr) rounds.push({ start: nowISO, done: nowISO, by: driver });
    else lr.done = nowISO;

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'ferdig', by:driver, rounds };
    await window.Sync.setStatusPatch(patch);

    uiUpdate();
    gotoNext();
    checkAllDoneDialog();
  }

  async function actSkip(){
    const lane = currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run  = getRun();
    const cur  = list[run.idx];
    const driver = settings().driver || '';

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by:driver };
    await window.Sync.setStatusPatch(patch);
    uiUpdate(); gotoNext();
  }

  async function actBlock(){
    const lane = currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run  = getRun();
    const cur  = list[run.idx];
    const driver = settings().driver || '';

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'blokkert', by:driver };
    await window.Sync.setStatusPatch(patch);
    uiUpdate(); gotoNext();
  }

  function actNext(){ gotoNext(); }
  function actNav(){
    const list = filteredAddresses(); if(!list.length) return;
    const run  = getRun();
    const idx  = Math.min(Math.max(run.idx ?? 0, 0), Math.max(list.length-1, 0));
    const nxt  = list[nextIndex(idx, run.dir||'Normal')] || list[idx];
    window.open(mapsUrl(nxt), '_blank');
  }

  function wire(){
    if (!$('#work')) return;

    const st = settings();
    if (!getRun().driver) setRun({ driver: st.driver||'' });
    if (!getRun().dir)    setRun({ dir: st.dir||'Normal' });

    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    uiUpdate();

    // Oppdater når Sync blir klar eller endrer seg
    window.Sync?.on?.('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();