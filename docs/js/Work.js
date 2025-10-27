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
    return (window.Sync?.getCache?.().addresses || RJ('BRYT_ADDR_LOCAL', []));
  }
  function laneFilter(a, lane){
    return !!(a?.tasks?.[lane]);
  }
  function filteredAddresses(lane){
    return allAddresses().filter(a => laneFilter(a, lane));
  }

  function getStatus(addrId, lane){
    const st = (window.Sync?.getCache?.().status || RJ('BRYT_STATUS_LOCAL', {}));
    return st[addrId]?.[lane] || { state:'venter', by:null, rounds:[] };
  }

  // Skip-regler: ferdig, eller pågår av annen sjåfør
  function isSkip(addr, lane, myDriver){
    const s = getStatus(addr.id, lane);
    if (s.state === 'ferdig') return true;
    if (s.state === 'pågår' && s.by && s.by !== myDriver) return true;
    return false;
  }

  function initialIndex(list, dir, lane, myDriver){
    if (!list.length) return null;
    if (dir === 'Motsatt'){
      for (let i=list.length-1; i>=0; i--){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    } else {
      for (let i=0; i<list.length; i++){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    }
  }

  function findNextIndex(list, curIdx, dir, lane, myDriver){
    if (!list.length || curIdx == null) return null;
    if (dir === 'Motsatt'){
      for (let i=curIdx-1; i>=0; i--){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    } else {
      for (let i=curIdx+1; i<list.length; i++){
        if (!isSkip(list[i], lane, myDriver)) return i;
      }
      return null;
    }
  }

  // ===== Progress (mine/andre ut fra siste "done"-runde) =====
  function lastDoneBy(laneObj){
    if (!laneObj?.rounds?.length) return null;
    for (let i=laneObj.rounds.length-1;i>=0;i--){
      const r = laneObj.rounds[i];
      if (r.done) return r.by || null;
    }
    return null;
  }

  function computeProgressUI(lane){
    const my = settings().driver || '';
    const list = filteredAddresses(lane);
    const st = (window.Sync?.getCache?.().status || RJ('BRYT_STATUS_LOCAL', {}));
    const total = list.length;
    let mine = 0, other = 0, done = 0;

    for (const a of list){
      const laneObj = st[a.id]?.[lane];
      if (laneObj?.state === 'ferdig'){
        done++;
        const who = lastDoneBy(laneObj);
        if (who === my) mine++;
        else if (who) other++;
        else other++; // ukjent krediteres "andre"
      }
    }
    return { total, mine, other, done };
  }

  function updateProgressBars(lane){
    const pr = computeProgressUI(lane);
    const total = Math.max(pr.total, 1);

    // Prosent
    let mePct = Math.round(100 * pr.mine  / total);
    let otPct = Math.round(100 * pr.other / total);

    // ✅ Ikke overlapp
    if (mePct + otPct > 100) otPct = Math.max(0, 100 - mePct);

    mePct = Math.max(0, Math.min(100, mePct));
    otPct = Math.max(0, Math.min(100, otPct));

    $('#b_prog_me') && ($('#b_prog_me').style.width = mePct + '%');   // venstre (grønn)
    $('#b_prog_other') && ($('#b_prog_other').style.width = otPct + '%');   // høyre  (lilla)

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${pr.mine}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${pr.other}`);
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

    // init idx hvis mangler/ugyldig/skip
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

    // Puls på riktig knapp
    $('#act_done')  ?.classList.toggle('pulse', stNow.state === 'pågår');
    $('#act_start') ?.classList.toggle('pulse', stNow.state !== 'pågår');

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
    return list.every(a => getStatus(a.id,lane).state==='ferdig' || isSkip(a,lane,my));
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
      setRun({ lane:'snow', idx:null });
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
      const txt = [title, '', ...options.map((o,i)=>`${i+1}) ${o.label}`), '', 'Skriv nummer:'].join('\\n');
      const ans = prompt(txt,'');
      const n   = parseInt(ans||'',10);
      if (!n || n<1 || n>options.length) return resolve(null);
      resolve(options[n-1].id);
    });
  }

  // ===== Actions =====
  async function actStart(){
    // NOTE: this demo keeps local only when window.Sync is missing
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;
    if (idx==null || !list[idx]) return;
    const cur = list[idx];

    const note = (cur.note || '').trim();
    if (note) alert(`Merknad:\\n\\n${note}`);

    const s = getStatus(cur.id, lane);
    const nowISO = new Date().toISOString();

    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    if (!rounds.length || rounds[rounds.length-1].done){
      rounds.push({ start: nowISO, by: my });
    }
    const patchLane = { state:'pågår', by: my, rounds };
    const stAll = RJ('BRYT_STATUS_LOCAL', {});
    stAll[cur.id] = stAll[cur.id] || {};
    stAll[cur.id][lane] = patchLane;
    localStorage.setItem('BRYT_STATUS_LOCAL', JSON.stringify(stAll));
    window.Sync?.setStatusPatch?.({ status:{ [cur.id]:{ [lane]:patchLane }}});
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
    if (rounds.length && !rounds[rounds.length-1].done && rounds[rounds.length-1].by===my){
      rounds[rounds.length-1].done = nowISO;
    } else {
      rounds.push({ start: nowISO, done: nowISO, by: my });
    }

    const patchLane = { state:'ferdig', by: my, rounds };
    const stAll = RJ('BRYT_STATUS_LOCAL', {});
    stAll[cur.id] = stAll[cur.id] || {};
    stAll[cur.id][lane] = patchLane;
    localStorage.setItem('BRYT_STATUS_LOCAL', JSON.stringify(stAll));
    window.Sync?.setStatusPatch?.({ status:{ [cur.id]:{ [lane]:patchLane }}});

    const nextIdx = findNextIndex(list, idx, run.dir || 'Normal', lane, my);
    setRun({ idx: nextIdx });
    uiUpdate();
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
    const patchLane = { state:'hoppet', by: my, rounds: (getStatus(cur.id,lane).rounds||[]) };
    const stAll = RJ('BRYT_STATUS_LOCAL', {});
    stAll[cur.id] = stAll[cur.id] || {};
    stAll[cur.id][lane] = patchLane;
    localStorage.setItem('BRYT_STATUS_LOCAL', JSON.stringify(stAll));
    window.Sync?.setStatusPatch?.({ status:{ [cur.id]:{ [lane]:patchLane }}});

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
    const patchLane = { state:'blokkert', by: my, rounds: (getStatus(cur.id,lane).rounds||[]) };
    const stAll = RJ('BRYT_STATUS_LOCAL', {});
    stAll[cur.id] = stAll[cur.id] || {};
    stAll[cur.id][lane] = patchLane;
    localStorage.setItem('BRYT_STATUS_LOCAL', JSON.stringify(stAll));
    window.Sync?.setStatusPatch?.({ status:{ [cur.id]:{ [lane]:patchLane }}});

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
    location.href = mapsUrl(cur);
  }

  function wireClickFeedback(ids){
    ids.forEach(id=>{
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', ()=>{
        btn.classList.add('clicked');
        if (navigator.vibrate) navigator.vibrate(30);
        setTimeout(()=>btn.classList.remove('clicked'), 600);
      });
    });
  }

  function wire(){
    if (!$('#work')) return;
    const st  = settings();
    const run = getRun();
    if (!run.driver) setRun({ driver: st.driver||'' });
    if (!run.dir)    setRun({ dir: st.dir||'Normal' });
    if (!run.lane)   setRun({ lane: laneFromSettings() });

    $('#act_start')?.addEventListener('click', actStart);
    $('#act_done') ?.addEventListener('click', actDone);
    $('#act_skip') ?.addEventListener('click', actSkip);
    $('#act_next') ?.addEventListener('click', actNext);
    $('#act_nav')  ?.addEventListener('click', actNav);
    $('#act_block')?.addEventListener('click', actBlock);

    wireClickFeedback(['act_start','act_done']);

    uiUpdate();
    window.Sync?.on?.('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
