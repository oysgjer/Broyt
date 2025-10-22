// js/Work.js
(() => {
  'use strict';

  // ---------- små helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_RUN      = 'BRYT_RUN';

  const STATE_LABEL = {
    venter:   'Venter',
    'pågår':  'Pågår',
    ferdig:   'Ferdig',
    hoppet:   'Hoppet over',
    blokkert: 'Ikke mulig'
  };

  // ---------- state helpers ----------
  function settings(){
    // forventer: { driver, equipment:{plow,fres,sand}, dir:'Normal'|'Motsatt', autoNav }
    return RJ(K_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false });
  }
  function getRun(){ return RJ(K_RUN, { lane:null, idx:0, dir:'Normal', driver:'' }); }
  function setRun(patch){
    const cur = getRun();
    const next = { ...cur, ...patch };
    WJ(K_RUN, next);
    return next;
  }

  // lane = 'snow' | 'grit'
  function initialLane(){
    const st = settings();
    return st?.equipment?.sand ? 'grit' : 'snow';
  }
  function laneLabel(l){ return l==='grit' ? 'Strø grus' : 'Fjerne snø'; }

  // ---------- adresser & filter ----------
  function hasTask(addr, lane){
    // støtt både addr.tasks.{snow,grit} og flate bools {snow,grit}
    if (!addr) return false;
    if (addr.tasks && typeof addr.tasks === 'object') return !!addr.tasks[lane];
    return !!addr[lane]; // f.eks. lagret via Admin.js
  }

  function allAddresses(){
    return (window.Sync?.getCache?.().addresses) || [];
  }

  function filteredAddresses(){
    const lane = getActiveLane();
    return allAddresses().filter(a => hasTask(a, lane));
  }

  // ---------- status ----------
  function cacheStatus(){ return (window.Sync?.getCache?.().status) || {}; }
  function statusFor(addrId, lane){
    const s = cacheStatus()[addrId]?.[lane];
    return s || { state:'venter', by:null, rounds:[] };
  }

  // finn en «neste» som ikke er ferdig eller pågår
  function findNextIndex(fromIdx){
    const lane = getActiveLane();
    const list = filteredAddresses();
    if (!list.length) return -1;

    const dir = getRun().dir || 'Normal';
    const step = dir === 'Motsatt' ? -1 : 1;
    const len = list.length;

    let i = fromIdx + step;
    while (i >= 0 && i < len){
      const a = list[i];
      const s = statusFor(a.id, lane).state;
      if (s !== 'ferdig' && s !== 'pågår') return i; // hopp over ferdig/pågår
      i += step;
    }
    return -1;
  }

  function getActiveLane(){
    const r = getRun();
    return r.lane || initialLane();
  }

  // ---------- UI rendering ----------
  function updateProgress(){
    if (!window.Sync?.computeProgress) return;

    const driver = settings().driver || '';
    const pr = window.Sync.computeProgress(driver);
    const total = pr.total || 0;
    const mePct = total ? Math.round(100 * (pr.mine||0)  / total) : 0;
    const otPct = total ? Math.round(100 * (pr.other||0) / total) : 0;

    $('#b_prog_me')     && ($('#b_prog_me').style.width = mePct + '%');
    $('#b_prog_other')  && ($('#b_prog_other').style.width = otPct + '%');
    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${pr.mine||0}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${pr.other||0}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(pr.done||0, total)} av ${total} adresser fullført`);
  }

  function mapsUrl(addr){
    if (!addr) return 'https://www.google.com/maps';
    if (addr.lat!=null && addr.lon!=null){
      const q = `${addr.lat},${addr.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    const q = (addr.name||'') + ', Norge';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  function render(){
    const lane = getActiveLane();
    const list = filteredAddresses();
    const run  = getRun();

    // justér idx innenfor rekkevidde
    let idx = Math.min(Math.max(run.idx ?? 0, 0), Math.max(list.length-1, 0));
    if (idx !== run.idx) setRun({ idx });

    const now  = list[idx] || null;
    const next = (idx>=0 && list.length) ? list[(getRun().dir==='Motsatt') ? Math.max(idx-1, 0) : Math.min(idx+1, list.length-1)] : null;

    // topp: oppgave + nå/neste
    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now  ? now.name  : '—');
    $('#b_next')  && ($('#b_next').textContent = next ? next.name : '—');

    // nederst: statuslinje for nå
    const st = now ? statusFor(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[st.state] || '—');

    // knappe-enable
    const enabled = list.length>0;
    ['act_start','act_done','act_skip','act_next','act_nav','act_block'].forEach(id=>{
      const el = $('#'+id);
      if (!el) return;
      el.toggleAttribute('disabled', !enabled);
    });

    // fremdrift
    updateProgress();
  }

  // ---------- actions ----------
  function lastOpenRoundByMe(s, me){
    if (!s?.rounds?.length) return null;
    for (let i=s.rounds.length-1; i>=0; i--){
      const r = s.rounds[i];
      if (r.by===me && r.start && !r.done) return r;
    }
    return null;
  }

  async function actStart(){
    const lane = getActiveLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run = getRun();
    const cur = list[run.idx];
    const me  = settings().driver || '';
    const nowISO = new Date().toISOString();

    const curSt = statusFor(cur.id, lane);
    let rounds = Array.isArray(curSt.rounds) ? [...curSt.rounds] : [];
    let lr = lastOpenRoundByMe(curSt, me);

    if (!lr){
      rounds.push({ start: nowISO, by: me });
    }
    const payload = { status:{} };
    payload.status[cur.id] = {};
    payload.status[cur.id][lane] = { state:'pågår', by:me, rounds };

    await window.Sync.setStatusPatch(payload);
    render();
  }

  async function actDone(){
    const lane = getActiveLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run = getRun();
    const cur = list[run.idx];
    const me  = settings().driver || '';
    const nowISO = new Date().toISOString();

    const curSt = statusFor(cur.id, lane);
    let rounds = Array.isArray(curSt.rounds) ? [...curSt.rounds] : [];
    let lr = lastOpenRoundByMe(curSt, me);

    if (!lr){
      rounds.push({ start: nowISO, done: nowISO, by: me });
    } else {
      lr.done = nowISO;
    }

    const payload = { status:{} };
    payload.status[cur.id] = {};
    payload.status[cur.id][lane] = { state:'ferdig', by:me, rounds };

    await window.Sync.setStatusPatch(payload);

    // gå videre til første egnete «neste»
    const ni = findNextIndex(run.idx);
    if (ni !== -1) {
      setRun({ idx: ni });
    }
    render();

    // auto-navigate til ny «nå» hvis slått på
    if (settings().autoNav){
      const newList = filteredAddresses();
      const nowIdx  = getRun().idx;
      const dest    = newList[nowIdx];
      if (dest) window.open(mapsUrl(dest), '_blank');
    }
  }

  async function actSkip(){
    const lane = getActiveLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run = getRun();
    const cur = list[run.idx];
    const me  = settings().driver || '';

    const payload = { status:{} };
    payload.status[cur.id] = {};
    payload.status[cur.id][lane] = { state:'hoppet', by:me, rounds:[] };

    await window.Sync.setStatusPatch(payload);

    const ni = findNextIndex(run.idx);
    if (ni !== -1) setRun({ idx: ni });
    render();
  }

  async function actBlock(){
    const lane = getActiveLane();
    const list = filteredAddresses();
    if (!list.length) return;

    const run = getRun();
    const cur = list[run.idx];
    const me  = settings().driver || '';

    const payload = { status:{} };
    payload.status[cur.id] = {};
    payload.status[cur.id][lane] = { state:'blokkert', by:me, rounds:[] };

    await window.Sync.setStatusPatch(payload);

    const ni = findNextIndex(run.idx);
    if (ni !== -1) setRun({ idx: ni });
    render();
  }

  function actNext(){
    const list = filteredAddresses();
    if (!list.length) return;
    const ni = findNextIndex(getRun().idx);
    if (ni !== -1) setRun({ idx: ni });
    render();
  }

  function actNav(){
    const list = filteredAddresses();
    if (!list.length) return;
    const cur = list[getRun().idx];
    if (cur) window.open(mapsUrl(cur), '_blank'); // NB: naviger flytter ikke indeks
  }

  // ---------- wiring ----------
  function ensureRunDefaults(){
    const st = settings();
    if (!getRun().driver) setRun({ driver: st.driver||'' });
    if (!getRun().dir)    setRun({ dir: st.dir||'Normal' });
    if (!getRun().lane)   setRun({ lane: initialLane() });
  }

  function wire(){
    if (!$('#work')) return;

    ensureRunDefaults();

    // knapper
    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    // første render
    render();

    // hold siden «live» mot sky
    if (window.Sync?.on){
      window.Sync.on('change', render);
      window.Sync.on('error',  render);
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();