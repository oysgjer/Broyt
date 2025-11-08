// docs/js/Work.js — robust adresser + native navigasjon (ingen hvit side)
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
  function otherLane(l){ return l === 'grit' ? 'snow' : 'grit'; }

  function allAddresses(){
    const raw = (window.Sync.getCache().addresses || []);
    return Array.isArray(raw) ? raw : Object.values(raw);
  }
  function laneFilter(a, lane){
    return !!(a?.tasks?.[lane]);
  }
  function filteredAddresses(lane){
    return allAddresses().filter(a => laneFilter(a, lane));
  }

  function getStatus(addrId, lane){
    const st = window.Sync.getCache().status || {};
    return st[addrId]?.[lane] || { state:'venter', by:null, rounds:[] };
  }

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
    const st = window.Sync.getCache().status || {};
    const total = list.length;
    let mine = 0, other = 0, done = 0;

    for (const a of list){
      const laneObj = st[a.id]?.[lane];
      if (laneObj?.state === 'ferdig'){
        done++;
        const who = lastDoneBy(laneObj);
        if (who === my) mine++;
        else if (who) other++;
        else other++;
      }
    }
    return { total, mine, other, done };
  }

  function updateProgressBars(lane){
    const pr = computeProgressUI(lane);
    const total = Math.max(pr.total, 1);
    let mePct = Math.round(100 * pr.mine  / total);
    let otPct = Math.round(100 * pr.other / total);
    if (mePct + otPct > 100) otPct = Math.max(0, 100 - mePct);
    mePct = Math.max(0, Math.min(100, mePct));
    otPct = Math.max(0, Math.min(100, otPct));

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = otPct + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${pr.mine}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${pr.other}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(pr.done, pr.total)} av ${pr.total} adresser fullført`);
  }

  // ===== NAVIGASJON: App (Google→Apple) med web-fallback. Ingen hvit side. =====
  function openNavNative(addr){
    const name  = (addr?.name || '').trim();
    const hasLL = (addr?.lat != null && addr?.lon != null);
    const destLL = hasLL ? `${addr.lat},${addr.lon}` : null;
    const destQ  = hasLL ? null : (name ? `${name}, Norge` : '');

    // Dype lenker
    const gmApp = destLL
      ? `comgooglemaps://?daddr=${encodeURIComponent(destLL)}&directionsmode=driving`
      : `comgooglemaps://?q=${encodeURIComponent(destQ)}&directionsmode=driving`;

    const amApp = destLL
      ? `maps://?daddr=${encodeURIComponent(destLL)}&dirflg=d`
      : `maps://?q=${encodeURIComponent(destQ)}&dirflg=d`;

    // Web (siste utvei – samme fane)
    const web = destLL
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destLL)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQ)}`;

    // Avbryt fallback hvis vi forlater siden (app tok fokus)
    let step = 0;
    let t1 = null, t2 = null;
    const cancel = () => { clearTimeout(t1); clearTimeout(t2); };
    const onHidden = () => { if (document.visibilityState === 'hidden') cancel(); };
    document.addEventListener('visibilitychange', onHidden, { once: true });

    // 1) Google Maps app
    step = 1;
    window.location.href = gmApp;

    // 2) Etter 700ms, hvis fortsatt synlig → Apple Maps
    t1 = setTimeout(() => {
      if (document.visibilityState === 'visible' && step === 1) {
        step = 2;
        window.location.href = amApp;

        // 3) Etter 700ms til, hvis fortsatt synlig → Web
        t2 = setTimeout(() => {
          if (document.visibilityState === 'visible' && step === 2) {
            window.location.href = web;
          }
        }, 700);
      }
    }, 700);
  }

  function uiUpdate(){
    let run  = getRun();
    let lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';

    // Hent for valgt lane
    let list = filteredAddresses(lane);

    // Fallback: ingen adresser i lane → bruk den andre lane’n
    if (!list.length) {
      const alt = otherLane(lane);
      const altList = filteredAddresses(alt);
      if (altList.length) {
        lane = alt;
        setRun({ lane: alt, idx: null });
        list = altList;
      }
    }

    // Sikre indeks
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

    $('#act_done')  ?.classList.toggle('pulse', stNow.state === 'pågår');
    $('#act_start') ?.classList.toggle('pulse', stNow.state !== 'pågår');

    updateProgressBars(lane);

    const hasAny = list.length>0 && idx!=null;
    $('#act_start')?.toggleAttribute('disabled', !hasAny);
    $('#act_done') ?.toggleAttribute('disabled', !hasAny);
    $('#act_skip') ?.toggleAttribute('disabled', !hasAny);
    $('#act_next') ?.toggleAttribute('disabled', !hasAny);
    $('#act_nav')  ?.toggleAttribute('disabled', !hasAny);
    $('#act_block')?.toggleAttribute('disabled', !hasAny);
  }

  async function actStart(){
    const run  = getRun();
    const lane = run.lane || laneFromSettings();
    const my   = run.driver || settings().driver || '';
    const list = filteredAddresses(lane);
    const idx  = run.idx;
    if (idx==null || !list[idx]) return;
    const cur = list[idx];

    const note = (cur.note || '').trim();
    if (note) alert(`Merknad:\n\n${note}`);

    const s = getStatus(cur.id, lane);
    const nowISO = new Date().toISOString();
    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
    if (!rounds.length || rounds[rounds.length-1].done){
      rounds.push({ start: nowISO, by: my });
    }
    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'pågår', by: my, rounds };
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
    if (rounds.length && !rounds[rounds.length-1].done && rounds[rounds.length-1].by===my){
      rounds[rounds.length-1].done = nowISO;
    } else {
      rounds.push({ start: nowISO, done: nowISO, by: my });
    }
    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'ferdig', by: my, rounds };
    await window.Sync.setStatusPatch(patch);

    const nextIdx = findNextIndex(list, idx, getRun().dir || 'Normal', lane, my);
    setRun({ idx: nextIdx });
    uiUpdate();
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
    patch.status[cur.id][lane] = { state:'hoppet', by: my, rounds:(getStatus(cur.id,lane).rounds||[]) };
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
    patch.status[cur.id][lane] = { state:'blokkert', by: my, rounds:(getStatus(cur.id,lane).rounds||[]) };
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
    const cur  = (idx != null) ? list[idx] : null;
    if (!cur) return;
    openNavNative(cur);
  }

  // --- Uhell-knapp ---
  function ensureUhellButton(){
    const grid = document.querySelector('#work .btn-grid');
    if (!grid) return false;

    let u = document.getElementById('act_incident');
    if (!u) {
      u = document.createElement('button');
      u.id = 'act_incident';
      u.className = 'btn';
      u.addEventListener('click', () => {
        try { sessionStorage.setItem('SERVICE_PRESELECT', JSON.stringify({ type: 'incident' })); } catch(_){}
        location.hash = '#service';
      });
      const wrap = document.createElement('div');
      wrap.appendChild(u);
      grid.insertBefore(wrap, grid.lastElementChild || null);
    }
    u.innerHTML = '⚠️ Uhell';
    u.style.removeProperty('display');
    u.style.width = '100%';
    return true;
  }

  // --- Brøytekart-knapp ---
  function ensureBroytKart(){
    const grid = document.querySelector('#work .btn-grid');
    if (!grid) return false;

    document.getElementById('act_map')?.remove();

    let bk = document.querySelector('#btnBroytKart, #btnMap');
    if (!bk){
      bk = document.createElement('button');
      bk.id = 'btnBroytKart';
      bk.className = 'btn';
      bk.addEventListener('click', () => {
        const url = 'tools/kart.html'
          + '#addrBin=68ed425cae596e708f11d25f'
          + '&routeBin=68ed425cae596e708f11d25f'
          + '&field=geojsonRoutes';
        window.open(url, '_blank');
      });
      const wrap = document.createElement('div');
      wrap.appendChild(bk);
      grid.appendChild(wrap);
    }
    bk.innerHTML = '🚜 Brøytekart';
    bk.style.width = '100%';
    return true;
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

    // initial UI (kan være tom hvis Sync ikke er klar enda)
    uiUpdate();

    // spesialknapper
    let ok1 = ensureUhellButton();
    let ok2 = ensureBroytKart();
    if (!ok1 || !ok2){
      let tries = 0;
      const tick = setInterval(() => {
        ok1 = ok1 || ensureUhellButton();
        ok2 = ok2 || ensureBroytKart();
        if ((ok1 && ok2) || (++tries > 30)) clearInterval(tick);
      }, 100);
    }

    wireClickFeedback(['act_start','act_done']);

    // oppdater ved synk
    window.Sync.on('change', () => uiUpdate());
    window.Sync.on('ready',  () => uiUpdate());

    // vent-loop første lasting til adresser finnes
    (function waitForAddresses(){
      const addrs = (window.Sync.getCache().addresses || []);
      if (addrs.length > 0) { uiUpdate(); return; }
      setTimeout(waitForAddresses, 300);
    })();

    // trygghet ved navigasjon internt
    window.addEventListener('hashchange', () => {
      if (location.hash === '#work') {
        ensureUhellButton();
        ensureBroytKart();
        uiUpdate();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', wire);
})();