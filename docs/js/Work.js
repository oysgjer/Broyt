/* js/Work.js */
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

  // hvor lenge "pågår" regnes som gyldig reservasjon av andre (min)
  const OCCUPY_MAX_MIN = 90;

  function settings(){ return RJ(LS_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false }); }
  function getRun(){   return RJ(LS_RUN,      { lane:null, idx:0, dir:'Normal', driver:'' }); }
  function setRun(p){  const cur=getRun(); const nxt={...cur, ...p}; WJ(LS_RUN,nxt); return nxt; }

  function currentLane(){ return (settings()?.equipment?.sand) ? 'grit' : 'snow'; }
  function laneLabel(l){ return l==='grit' ? 'Strø grus' : 'Fjerne snø'; }

  function asBool(v){ return (v===true || v===1 || v==='1' || (typeof v==='string' && v.toLowerCase()==='true')); }

  function addrHasTask(a, lane){
    // aksepter både tasks og flags — default SNØ=true når ingenting finnes
    if (!a) return false;
    const t = a.tasks || {};
    const f = a.flags || {};
    const val = (t[lane] ?? f[lane]);
    if (val === undefined) return lane==='snow'; // default
    return asBool(val);
  }

  function getStatusFor(addrId, lane){
    const st = window.Sync.getCache().status || {};
    const s  = st[addrId]?.[lane] || { state:'venter', by:null, rounds:[] };
    return { ...s };
  }

  function isTakenByOther(addrId, lane, me){
    const s = getStatusFor(addrId, lane);
    if (s.state !== 'pågår') return false;
    if (s.by === me) return false;
    const lastStart = (s.rounds||[]).map(r=>r.start).filter(Boolean).pop();
    if (!lastStart) return false;
    const ageMin = (Date.now() - new Date(lastStart).getTime())/60000;
    return ageMin < OCCUPY_MAX_MIN;
  }

  function filteredList(lane){
    const cache = window.Sync.getCache();
    const all   = cache.addresses || [];
    const me    = settings().driver || '';

    let out = all.filter(a => addrHasTask(a, lane));
    // Ikke fjern pga. "pågår hos andre" på første load – kun når vi faktisk starter arbeid
    // MEN: vi ønsker å unngå kollisjon: skjul elementer som er tydelig opptatt nå
    out = out.filter(a => !isTakenByOther(a.id, lane, me));

    // Fallback: hvis filtrering ble tom pga. rare data, vis alt med lane (default snow)
    if (!out.length && all.length){
      out = all.filter(a => lane==='snow' ? true : addrHasTask(a, 'grit'));
    }
    return out;
  }

  function nextIndexSmart(fromIdx, list, dir){
    if (!list.length) return -1;
    const step = (dir==='Motsatt') ? -1 : 1;
    let i = (fromIdx==null ? (dir==='Motsatt'? list.length-1 : 0) : fromIdx+step);

    const lane   = getRun().lane || currentLane();
    const me     = settings().driver || '';
    const status = window.Sync.getCache().status || {};

    while (i>=0 && i<list.length){
      const a  = list[i];
      const st = status[a.id]?.[lane] || {state:'venter'};
      const done   = st.state==='ferdig';
      const taken  = isTakenByOther(a.id, lane, me);
      if (!done && !taken) return i;
      i += step;
    }
    return -1;
  }

  function updateProgressBar(lane){
    const me    = settings().driver || '';
    const cache = window.Sync.getCache();
    const status= cache.status || {};
    const all   = cache.addresses || [];
    const total = all.filter(a => addrHasTask(a, lane)).length;

    let mine=0, other=0, done=0;
    for(const a of all){
      if (!addrHasTask(a, lane)) continue;
      const st = status[a.id]?.[lane] || {state:'venter'};
      if (st.state==='ferdig'){
        done++;
        if (st.by===me) mine++; else if (st.by) other++;
      }
    }

    const mePct = total ? Math.round(100*mine/total) : 0;
    const otPct = total ? Math.round(100*other/total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct+'%';
    if (bo) bo.style.width = otPct+'%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${mine}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(done,total)} av ${total} adresser fullført`);
  }

  function uiUpdate(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredList(lane);

    // Sett korrekt startpos
    let idx = run.idx ?? ((run.dir==='Motsatt') ? (list.length-1) : 0);
    if (idx<0 || idx>=list.length) idx = (run.dir==='Motsatt') ? (list.length-1) : 0;
    if (idx !== run.idx) setRun({ idx });

    const now  = list[idx] || null;
    const nxt  = (list.length>0) ? (list[nextIndexSmart(idx, list, run.dir)] || null) : null;

    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next')  && ($('#b_next').textContent = nxt ? (nxt.name||'—') : '—');

    const stNow = now ? getStatusFor(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[stNow.state] || '—');

    updateProgressBar(lane);

    const hasAny = list.length>0;
    for (const id of ['act_start','act_done','act_skip','act_next','act_nav','act_block']){
      $( '#'+id)?.toggleAttribute('disabled', !hasAny);
    }
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
    const lane = run.lane || currentLane();
    const list = filteredList(lane);
    if (!list.length) return;

    const ni = nextIndexSmart(run.idx, list, run.dir);
    if (ni>=0){ setRun({ idx: ni }); uiUpdate(); }
    else { checkAllDoneDialog(); }
  }

  function allDoneForLane(){
    const lane = getRun().lane || currentLane();
    const list = filteredList(lane);
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
    if (res==='repeat_snow'){ setRun({ lane:'snow', idx:0 }); location.hash='#work'; uiUpdate(); }
    else if (res==='switch_grit'){ setRun({ lane:'grit', idx:0 }); location.hash='#work'; uiUpdate(); }
    else if (res==='finish'){ location.hash='#service'; }
  }

  function askChoice(options, title='Velg'){
    return new Promise(resolve=>{
      const txt = [title, '', ...options.map((o,i)=>`${i+1}) ${o.label}`), '', 'Skriv nummer:'].join('\n');
      const ans = prompt(txt,''); const n = parseInt(ans||'',10);
      if (!n || n<1 || n>options.length) return resolve(null);
      resolve(options[n-1].id);
    });
  }

  async function actStart(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredList(lane);
    if (!list.length) return;

    const cur    = list[run.idx];
    const driver = settings().driver || '';

    await window.Sync.reloadLatest?.();
    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();

    const rounds = Array.isArray(s.rounds) && s.rounds.length ? s.rounds : [{ start: nowISO, by: driver }];

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'pågår', by:driver, deviceId: window.Sync.getDeviceId?.(), rounds };
    await window.Sync.setStatusPatch(patch);

    uiUpdate();
  }

  async function actDone(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredList(lane);
    if (!list.length) return;

    const cur    = list[run.idx];
    const driver = settings().driver || '';

    await window.Sync.reloadLatest?.();
    const s = getStatusFor(cur.id, lane);
    const nowISO = new Date().toISOString();
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    let lrIdx=-1; for(let i=rounds.length-1;i>=0;i--){ if (rounds[i].by===driver && rounds[i].start && !rounds[i].done){ lrIdx=i; break; } }
    if (lrIdx<0) rounds.push({ start: nowISO, done: nowISO, by: driver });
    else         rounds[lrIdx] = { ...rounds[lrIdx], done: nowISO };

    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'ferdig', by:driver, deviceId: window.Sync.getDeviceId?.(), rounds };
    await window.Sync.setStatusPatch(patch);

    uiUpdate();
    gotoNext();
    checkAllDoneDialog();
  }

  async function actSkip(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredList(lane);
    if (!list.length) return;

    const cur    = list[run.idx];
    const driver = settings().driver || '';

    await window.Sync.reloadLatest?.();
    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by:driver, deviceId: window.Sync.getDeviceId?.() };
    await window.Sync.setStatusPatch(patch);

    uiUpdate();
    gotoNext();
  }

  async function actBlock(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredList(lane);
    if (!list.length) return;

    const cur    = list[run.idx];
    const driver = settings().driver || '';

    await window.Sync.reloadLatest?.();
    const patch = { status:{} }; patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'blokkert', by:driver, deviceId: window.Sync.getDeviceId?.() };
    await window.Sync.setStatusPatch(patch);

    uiUpdate();
    gotoNext();
  }

  function actNext(){ gotoNext(); }

  function actNav(){
    const run  = getRun();
    const lane = run.lane || currentLane();
    const list = filteredList(lane);
    if(!list.length) return;
    const idx = Math.max(0, Math.min(run.idx ?? 0, Math.max(list.length-1,0)));
    const target = list[idx];
    window.open(mapsUrl(target), '_blank');
  }

  function wire(){
    if (!$('#work')) return;

    const st = settings();
    const lane = st?.equipment?.sand ? 'grit' : 'snow';
    const run = getRun();
    if (!run.driver) setRun({ driver: st.driver||'' });
    if (!run.dir)    setRun({ dir: st.dir||'Normal' });
    if (!run.lane)   setRun({ lane });

    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    uiUpdate();

    window.Sync.on('change', uiUpdate);
    window.Sync.startPolling?.(5000);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();