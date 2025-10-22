// js/Work.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);

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
  function getRun(){ return RJ(LS_RUN, { lane:'snow', idx:null, dir:'Normal', driver:'' }); }
  function setRun(patch){ const cur=getRun(); const next={...cur,...patch}; WJ(LS_RUN,next); return next; }

  function laneFromSettings(){
    const st = settings();
    return st?.equipment?.sand ? 'grit' : 'snow';
  }
  function laneLabel(l){ return l==='grit' ? 'Grus' : 'Snø'; }

  function allAddresses(){
    return (window.Sync.getCache().addresses || []);
  }
  function laneFilter(a, lane){
    // kun adresser som har oppgaven (snow/grit)
    return !!(a?.tasks?.[lane]);
  }
  function filteredAddresses(lane){
    return allAddresses().filter(a => laneFilter(a, lane));
  }

  function getStatus(addrId, lane){
    const st = window.Sync.getCache().status || {};
    return st[addrId]?.[lane] || { state:'venter', by:null, rounds:[] };
  }

  // Skal vi hoppe over et punkt? (ferdig, eller pågår av en annen sjåfør)
  function isSkip(addr, lane, myDriver){
    const s = getStatus(addr.id, lane);
    if (s.state === 'ferdig') return true;
    if (s.state === 'pågår' && s.by && s.by !== myDriver) return true;
    return false;
  }

  // Finn første gyldige indeks gitt retning og lane
  function initialIndex(list, dir, lane, myDriver){
    if (!list.length) return null;
    if (dir === 'Motsatt'){
      for (let i = list.length - 1; i >= 0; i--){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    } else {
      for (let i = 0; i < list.length; i++){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    }
  }

  // Finn neste gyldige indeks fra nåværende posisjon (inkl. hopp over)
  function findNextIndex(list, curIdx, dir, lane, myDriver){
    if (!list.length || curIdx == null) return null;
    if (dir === 'Motsatt'){
      for (let i = curIdx - 1; i >= 0; i--){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    } else {
      for (let i = curIdx + 1; i < list.length; i++){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    }
  }

  function computeProgressUI(lane){
    const my = settings().driver || '';
    const list = filteredAddresses(lane);
    const st = window.Sync.getCache().status || {};
    let total = list.length;
    let mine = 0, other = 0, done = 0;

    for (const a of list){
      const s = st[a.id]?.[lane];
      if (s?.state === 'ferdig'){
        done++;
        if (s.by === my) mine++; else if (s.by) other++;
      }
    }
    return { total, mine, other, done };
  }

  function updateProgressBars(lane){
    const pr = computeProgressUI(lane);
    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = (pr.total ? Math.round(100*pr.mine/pr.total) : 0)+'%';
    if (bo) bo.style.width = (pr.total ? Math.round(100*pr.other/pr.total) : 0)+'%';
    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${pr.mine}/${pr.total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${pr.other}/${pr.total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(pr.done, pr.total)} av ${pr.total} adresser fullført`);
  }

  function mapsUrl(addr){
    if (!addr) return 'https://www.google.com/maps';
    if (addr.lat!=null && addr.lon!=null){
      const q = `${addr.lat},${addr.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr.name||'')+', Norge')}`;
  }

  function uiUpdate(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);

    // init idx hvis mangler eller peker på tom/skip
    let idx = run.idx;
    if (idx == null || idx < 0 || idx >= list.length || (list[idx] && isSkip(list[idx], lane, my))){
      idx = initialIndex(list, run.dir || 'Normal', lane, my);
      setRun({ idx });
    }

    const now = (idx != null && idx >= 0) ? list[idx] : null;
    const nxtIdx = (idx != null) ? findNextIndex(list, idx, run.dir || 'Normal', lane, my) : null;
    const nxt = (nxtIdx != null) ? list[nxtIdx] : null;

    $('#b_task')  && ($('#b_task').textContent = laneLabel(lane));
    $('#b_now')   && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next')  && ($('#b_next').textContent = nxt ? (nxt.name||'—') : '—');

    const stNow = now ? getStatus(now.id, lane) : {state:'venter'};
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[stNow.state] || '—');

    // progress
    updateProgressBars(lane);

    const hasAny = list.length>0 && idx!=null;
    $('#act_start')?.toggleAttribute('disabled', !hasAny);
    $('#act_done') ?.toggleAttribute('disabled', !hasAny);
    $('#act_skip') ?.toggleAttribute('disabled', !hasAny);
    $('#act_next') ?.toggleAttribute('disabled', !hasAny);
    $('#act_nav')  ?.toggleAttribute('disabled', !hasAny);
    $('#act_block')?.toggleAttribute('disabled', !hasAny);
  }

  function allDoneForLane(lane, my){
    const list = filteredAddresses(lane);
    if (!list.length) return false;
    return list.every(a => isSkip(a, lane, my) || getStatus(a.id,lane).state==='ferdig');
  }

  async function checkAllDoneDialog(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    if (!allDoneForLane(lane, my)) return;

    const res = await askChoice([
      {id:'repeat_snow',  label:'Ny runde snø'},
      {id:'switch_grit',  label:'Ny runde grus'},
      {id:'finish',       label:'Ferdig → Service'}
    ], 'Alt på denne runden er markert som ferdig. Hva vil du gjøre nå?');

    if (!res) return;
    if (res==='repeat_snow'){
      setRun({ lane:'snow', idx:null }); // re-init
      location.hash = '#work';
      uiUpdate();
    } else if (res==='switch_grit'){
      setRun({ lane:'grit', idx:null });
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

  // ===== Actions =====
  async function actStart(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;

    if (idx==null || !list[idx]) return;
    const cur = list[idx];

    const s = getStatus(cur.id, lane);
    const nowISO = new Date().toISOString();

    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    // opprett runde hvis ingen åpen
    if (!rounds.length || rounds[rounds.length-1].done){
      rounds.push({ start: nowISO, by: my });
    }

    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = {
      state: 'pågår',
      by: my,
      rounds
    };
    await window.Sync.setStatusPatch(patch);
    uiUpdate();
  }

  async function actDone(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;

    if (idx==null || !list[idx]) return;
    const cur = list[idx];

    const s = getStatus(cur.id, lane);
    const nowISO = new Date().toISOString();
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    // sett done på siste åpne runde for denne sjåføren, ellers lag en ny kort runde
    if (rounds.length && !rounds[rounds.length-1].done && rounds[rounds.length-1].by===my){
      rounds[rounds.length-1].done = nowISO;
    } else {
      rounds.push({ start: nowISO, done: nowISO, by: my });
    }

    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = {
      state: 'ferdig',
      by: my,
      rounds
    };
    await window.Sync.setStatusPatch(patch);

    // gå til neste gyldige i valgt retning
    const nextIdx = findNextIndex(list, idx, run.dir || 'Normal', lane, my);
    setRun({ idx: nextIdx });
    uiUpdate();

    // sjekk om alt ferdig
    checkAllDoneDialog();
  }

  async function actSkip(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;
    if (idx==null || !list[idx]) return;

    const cur = list[idx];
    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by: my };
    await window.Sync.setStatusPatch(patch);

    const nextIdx = findNextIndex(list, idx, run.dir || 'Normal', lane, my);
    setRun({ idx: nextIdx });
    uiUpdate();
  }

  async function actBlock(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;
    if (idx==null || !list[idx]) return;

    const cur = list[idx];
    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'blokkert', by: my };
    await window.Sync.setStatusPatch(patch);

    const nextIdx = findNextIndex(list, idx, run.dir || 'Normal', lane, my);
    setRun({ idx: nextIdx });
    uiUpdate();
  }

  function actNext(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;
    if (idx==null) return;
    const nextIdx = findNextIndex(list, idx, run.dir || 'Normal', lane, my);
    setRun({ idx: nextIdx });
    uiUpdate();
  }

  function actNav(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const list = filteredAddresses(lane);
    const idx  = run.idx;
    const cur  = (idx!=null) ? list[idx] : null;
    if (!cur) return;
    window.open(mapsUrl(cur), '_blank'); // naviger til AKTUELL, ikke hopp
  }

  function wire(){
    if (!$('#work')) return;

    // init lane/dir/driver fra Home valg
    const st  = settings();
    const run = getRun();
    if (!run.driver) setRun({ driver: st.driver||'' });
    if (!run.dir)    setRun({ dir: st.dir||'Normal' });
    if (!run.lane)   setRun({ lane: laneFromSettings() });

    // knapper
    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    // initial UI
    uiUpdate();

    // refresher når Sync oppdateres (andre sjåfører)
    window.Sync.on('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();