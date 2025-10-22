// js/Work.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS_SETTINGS = 'BRYT_SETTINGS';
  const LS_RUN      = 'BRYT_RUN';

  const RJ = (k,d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const WJ = (k,v) => localStorage.setItem(k, JSON.stringify(v));

  const STATE_LABEL = {
    venter:   'Venter',
    'pågår':  'Pågår',
    ferdig:   'Ferdig',
    hoppet:   'Hoppet over',
    blokkert: 'Ikke mulig'
  };

  function settings(){
    return RJ(LS_SETTINGS, {
      driver:'',
      equipment:{plow:false,fres:false,sand:false},
      dir:'Normal',
      autoNav:false
    });
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

  function currentLane(){ return settings()?.equipment?.sand ? 'grit' : 'snow'; }
  function laneLabel(l){ return l==='grit' ? 'Strøing av grus' : 'Fjerne snø'; }

  function filteredAddresses(){
    const lane = getRun().lane || currentLane();
    const all  = window.Sync.getCache().addresses || [];
    // behold kun adresser som har valgt oppgave
    return all.filter(a => !!(a?.tasks?.[lane]));
  }

  function clampIdx(idx, len){
    if (!len) return 0;
    return Math.min(Math.max(idx,0), len-1);
  }
  function nextIndex(idx, dir, len){
    return (dir==='Motsatt') ? (idx-1) : (idx+1);
  }

  function statusFor(addrId, lane){
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

  function mapsUrl(addr){
    if (!addr) return 'https://www.google.com/maps';
    if (addr.lat!=null && addr.lon!=null){
      const q = `${addr.lat},${addr.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr.name||'')+', Norge')}`;
  }

  function updateProgress(){
    const driver = settings().driver || '';
    const lane   = getRun().lane || currentLane();
    const total  = filteredAddresses().length; // kun relevante adresser for valgt oppgave
    const pr     = window.Sync.computeProgress(driver, lane); // forventer å ta hensyn til lane

    const mine  = pr.mine   ?? 0;
    const other = pr.other  ?? 0;
    const done  = pr.done   ?? (mine+other);

    const mePct = total ? Math.round(100 * mine  / total) : 0;
    const otPct = total ? Math.round(100 * other / total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct+'%';
    if (bo) bo.style.width = otPct+'%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${mine}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(done, total)} av ${total} adresser fullført`);
  }

  function uiUpdate(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();

    // Juster idx innenfor liste
    const idx  = clampIdx(run.idx ?? 0, list.length);
    if (idx !== run.idx) setRun({ idx });

    const now  = list[idx] || null;
    const nxt  = (list.length>0) ? list[nextIndex(idx, run.dir, list.length)] : null;

    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next')  && ($('#b_next').textContent = nxt ? (nxt.name||'—') : '—');

    const stNow = now ? statusFor(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[stNow.state] || '—');

    updateProgress();

    // knapp-tilgjengelighet
    const hasAny = list.length>0;
    $('#act_start')?.toggleAttribute('disabled', !hasAny);
    $('#act_done') ?.toggleAttribute('disabled', !hasAny);
    $('#act_skip') ?.toggleAttribute('disabled', !hasAny);
    $('#act_next') ?.toggleAttribute('disabled', !hasAny);
    $('#act_nav')  ?.toggleAttribute('disabled', !hasAny);
    $('#act_block')?.toggleAttribute('disabled', !hasAny);
  }

  function autoNavigateToCurrent(){
    if (!settings().autoNav) return;
    const run  = getRun();
    const list = filteredAddresses();
    if (!list.length) return;
    const idx = clampIdx(run.idx ?? 0, list.length);
    const cur = list[idx];
    if (cur) window.open(mapsUrl(cur), '_blank');
  }

  function allDoneForLane(){
    const lane = getRun().lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return false;
    const st = window.Sync.getCache().status || {};
    return list.every(a => (st[a.id]?.[lane]?.state==='ferdig'));
  }

  async function afterWriteSync(){
    // kall etter setStatusPatch for å gi bruker rask “synk oppdatert”-feedback
    try{
      await window.Sync.refresh?.(); // hvis Sync har en refresh; hvis ikke, on('change') vil likevel trigges
    }catch{}
    try{ window.App?.refreshSyncBadge?.(); }catch{}
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
      setRun({ lane:'snow', idx: (settings().dir==='Motsatt' ? Math.max(filteredAddresses().length-1,0) : 0) });
      location.hash = '#work';
      uiUpdate();
      autoNavigateToCurrent();
    } else if (res==='switch_grit'){
      setRun({ lane:'grit', idx: (settings().dir==='Motsatt' ? Math.max(filteredAddresses().length-1,0) : 0) });
      location.hash = '#work';
      uiUpdate();
      autoNavigateToCurrent();
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

  // ---- Actions ----
  async function actStart(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = clampIdx(run.idx ?? 0, list.length);
    const cur = list[idx];
    const driver = settings().driver || '';
    const s = statusFor(cur.id, lane);
    const nowISO = new Date().toISOString();

    const rounds = Array.isArray(s.rounds) && s.rounds.length ? s.rounds : [{ start: nowISO, by: driver }];
    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'pågår', by:driver, rounds };

    await window.Sync.setStatusPatch(patch);
    await afterWriteSync();
    uiUpdate();

    // Åpne kart til NÅVÆRENDE adresse (ikke neste)
    autoNavigateToCurrent();
  }

  async function actDone(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = clampIdx(run.idx ?? 0, list.length);
    const cur = list[idx];
    const driver = settings().driver || '';
    const s = statusFor(cur.id, lane);
    const nowISO = new Date().toISOString();

    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    let lr = lastRoundForDriver(s, driver);

    if (!lr) rounds.push({ start: nowISO, done: nowISO, by: driver });
    else lr.done = nowISO;

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'ferdig', by:driver, rounds };

    await window.Sync.setStatusPatch(patch);
    await afterWriteSync();
    uiUpdate();

    // Gå videre i lista
    gotoNext(true);
    // Dersom alt ferdig, foreslå neste steg
    checkAllDoneDialog();
  }

  async function actSkip(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = clampIdx(run.idx ?? 0, list.length);
    const cur = list[idx];
    const driver = settings().driver || '';

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by:driver };

    await window.Sync.setStatusPatch(patch);
    await afterWriteSync();
    uiUpdate();
    gotoNext(false); // ikke auto-nav ved hopp
  }

  async function actBlock(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = clampIdx(run.idx ?? 0, list.length);
    const cur = list[idx];
    const driver = settings().driver || '';

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'blokkert', by:driver };

    await window.Sync.setStatusPatch(patch);
    await afterWriteSync();
    uiUpdate();
    gotoNext(false); // ikke auto-nav ved blokkert
  }

  function actNext(){
    gotoNext(true);
  }

  function actNav(){
    // ⚠️ Viktig endring: naviger ALLTID til NÅVÆRENDE adresse
    const run  = getRun();
    const list = filteredAddresses();
    if (!list.length) return;

    const idx = clampIdx(run.idx ?? 0, list.length);
    const target = list[idx];
    if (!target) return;

    window.open(mapsUrl(target), '_blank');
  }

  function gotoNext(doAutoNav){
    const run  = getRun();
    const list = filteredAddresses();
    if (!list.length) return;

    const curIdx = clampIdx(run.idx ?? 0, list.length);
    const ni = nextIndex(curIdx, run.dir, list.length);
    if (ni>=0 && ni<list.length) {
      setRun({ idx: ni });
      uiUpdate();
      if (doAutoNav && settings().autoNav) autoNavigateToCurrent();
    } else {
      // Slutt på lista – la allDoneDialog avgjøre veien videre
      checkAllDoneDialog();
    }
  }

  // ---- Wire / Boot ----
  function wire(){
    if (!$('#work')) return;

    // init lane + driver + dir + startindex
    const st = settings();
    const lane = st?.equipment?.sand ? 'grit' : 'snow';
    const list = filteredAddresses();

    if (!getRun().driver) setRun({ driver: st.driver||'' });
    if (!getRun().dir)    setRun({ dir: st.dir||'Normal' });
    if (!getRun().lane)   setRun({ lane });

    // startpos: Normal = 0, Motsatt = siste
    const wantDir = st.dir || 'Normal';
    const startIdx = (wantDir==='Motsatt') ? Math.max(list.length-1,0) : 0;
    setRun({ idx: startIdx });

    // knapper
    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    // første UI
    uiUpdate();

    // oppdater ved sky-endringer
    window.Sync.on('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();