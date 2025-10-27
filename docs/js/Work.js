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
    return RJ(LS_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false, reportBin:'68e89e3443b1c97be9611c48', reportKey:'', reportEmail:'' });
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
    return !!(a?.tasks?.[lane]);
  }
  function filteredAddresses(lane){
    return allAddresses().filter(a => laneFilter(a, lane));
  }

  function getStatus(addrId, lane){
    const st = window.Sync.getCache().status || {};
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

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';   // venstre (grønn)
    if (bo) bo.style.width = otPct + '%';   // høyre  (lilla)

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

    const save = confirm('Alt i denne runden er markert som ferdig.\nVil du lagre rapport for utført arbeid?');
    if (save) await maybeSaveRoundReport(lane);

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
      const txt = [title, '', ...options.map((o,i)=>`${i+1}) ${o.label}`), '', 'Skriv nummer:'].join('\n');
      const ans = prompt(txt,'');
      const n   = parseInt(ans||'',10);
      if (!n || n<1 || n>options.length) return resolve(null);
      resolve(options[n-1].id);
    });
  }


  // === Rapport: JSONBin helpers & queue ===
  async function jsonbinGet(binId, key){
    const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, { headers: key ? { 'X-Master-Key': key } : {} });
    if(!r.ok) throw new Error('JSONBin GET feilet');
    return (await r.json()).record;
  }
  async function jsonbinPut(binId, key, record){
    const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method:'PUT', headers:{ 'Content-Type':'application/json', ...(key ? {'X-Master-Key': key} : {}) }, body: JSON.stringify(record)
    });
    if(!r.ok) throw new Error('JSONBin PUT feilet');
    return r.json();
  }
  const LS_REPORTS='BRYT_REPORTS'; const LS_REPORT_QUEUE='BRYT_REPORT_QUEUE';
  function saveLocalReport(rep){ try{ const all=RJ(LS_REPORTS,[]); all.push(rep); WJ(LS_REPORTS,all);}catch{} }
  function enqueueReport(rep){ try{ const q=RJ(LS_REPORT_QUEUE,[]); q.push(rep); WJ(LS_REPORT_QUEUE,q);}catch{} }
  async function pushReportToJsonbin(rep){
    const st=settings(); if(!st.reportBin||!st.reportKey) throw new Error('Mangler reportBin/reportKey');
    let remote={}; try{ remote=await jsonbinGet(st.reportBin, st.reportKey);}catch{ remote={}; }
    const list=Array.isArray(remote.reports)?remote.reports.slice():[]; list.push(rep);
    const record={...(remote||{}), reports:list, meta:{...(remote.meta||{}), updatedAt:new Date().toISOString()}};
    await jsonbinPut(st.reportBin, st.reportKey, record);
  }
  async function tryFlushReportQueue(){
    const q=RJ(LS_REPORT_QUEUE,[]); if(!q.length) return;
    const left=[]; for(const rep of q){ try{ await pushReportToJsonbin(rep);}catch(e){ left.push(rep);} } WJ(LS_REPORT_QUEUE,left);
  }
  window.addEventListener('online', tryFlushReportQueue);


  function lastDoneBy(laneObj){
    if (!laneObj?.rounds?.length) return null;
    for (let i=laneObj.rounds.length-1;i>=0;i--){ const r=laneObj.rounds[i]; if (r.done) return r.by||null; }
    return null;
  }
  function firstStart(laneObj){
    if (!laneObj?.rounds?.length) return null;
    for (let i=0;i<laneObj.rounds.length;i++){ if (laneObj.rounds[i].start) return laneObj.rounds[i].start; }
    return null;
  }
  function firstDone(laneObj){
    if (!laneObj?.rounds?.length) return null;
    for (let i=0;i<laneObj.rounds.length;i++){ if (laneObj.rounds[i].done) return laneObj.rounds[i].done; }
    return null;
  }
  function buildRoundReport(lane){
    const my=settings().driver||''; const list=filteredAddresses(lane); const st=window.Sync.getCache().status||{};
    const items=[]; for(const a of list){ const laneObj=st[a.id]?.[lane]; if(!laneObj) continue;
      if(laneObj.state==='ferdig' && lastDoneBy(laneObj)===my){ items.push({ id:a.id, name:a.name||a.id, start:firstStart(laneObj), done:firstDone(laneObj) }); } }
    const starts=items.map(x=>x.start).filter(Boolean).sort();
    const dones=items.map(x=>x.done).filter(Boolean).sort();
    const startedAt=starts[0]||new Date().toISOString(); const finishedAt=dones[dones.length-1]||startedAt;
    return { id:'round-'+Date.now(), type:'round', lane, driver:my, startedAt, finishedAt, count:items.length, items };
  }
  async function maybeSaveRoundReport(lane){
    try{ const rep=buildRoundReport(lane); saveLocalReport(rep); enqueueReport(rep); try{ await pushReportToJsonbin(rep); await tryFlushReportQueue(); }catch{}; alert('Rapport for runden er lagret.'); }
    catch{ alert('Kunne ikke lagre rapport nå.'); }
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

    // 👇 POPUP med merknad (fra Admin) hvis satt på adressen
    const note = (cur.note || '').trim();
    if (note) {
      alert(`Merknad:\n\n${note}`);
    }

    const s = getStatus(cur.id, lane);
    const nowISO = new Date().toISOString();

    let rounds = Array.isArray(s.rounds) ? [...s.rounds] : [];
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
    const patch = { status:{} };
    patch.status[cur.id] = {};
    patch.status[cur.id][lane] = { state:'hoppet', by: my, rounds: (getStatus(cur.id,lane).rounds||[]) };
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
    patch.status[cur.id][lane] = { state:'blokkert', by: my, rounds: (getStatus(cur.id,lane).rounds||[]) };
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
    window.open(mapsUrl(cur), '_blank', 'noopener,noreferrer'); // naviger til AKTUELL (ikke hopp) – safer return
  }

  // --- liten hjelpefunksjon for klikkanimasjon/haptics ---
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

    // init lane/dir/driver
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
    $('#act_incident')?.addEventListener('click', ()=> openIncidentModal());

    // 🔔 visuell/haptisk tilbakemelding på Start/Ferdig
    wireClickFeedback(['act_start','act_done']);

    // initial UI
    uiUpdate();

    // --- Brøytekart-knapp (full bredde, under de 6 knappene) ---
    if (!document.getElementById('btnBroytKart')) {
      const ids = ['act_start','act_done','act_skip','act_next','act_nav','act_block'];
      const btns = ids.map(id => document.getElementById(id)).filter(Boolean);

      // Finn containeren til de 6 knappene
      // Først prøver vi parent til første knapp; fallback = #work
      let container = btns[0]?.parentElement || document.querySelector('#work') || document.body;

      // Lag wrapper for spacing på tvers av layout
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:12px;';

      // Selve knappen (full bredde)
      const btn = document.createElement('button');
      btn.id = 'btnBroytKart';
      btn.textContent = 'Brøytekart';
      btn.style.cssText = [
        'display:block',
        'width:100%',
        'padding:14px 16px',
        'font-size:16px',
        'border-radius:10px',
        'border:1px solid #d1d5db',
        'background:#111827',
        'color:#fff',
        'touch-action:manipulation',
        '-webkit-tap-highlight-color:transparent'
      ].join(';');

      // Klikk -> åpne kartet i ny fane (samme bin for adresser og ruter)
      btn.addEventListener('click', () => {
        const url = 'https://broyt.pages.dev/tools/kart.html'
          + '#addrBin=68ed425cae596e708f11d25f'
          + '&routeBin=68ed425cae596e708f11d25f'
          + '&field=geojsonRoutes';
        window.open(url, '_blank');
      });

      wrap.appendChild(btn);

      // Plasser under de seks action-knappene:
      // Hvis knappene står i samme container, bare append wrapper til container.
      // (Hvis du heller vil ha en hårfin strek over, legg til: wrap.style.borderTop = '1px solid #eee';)
      container.appendChild(wrap);
    }

    
    // live oppdatering når status endres (andre sjåfører / admin / deg selv)
    window.Sync.on('change', () => uiUpdate());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();

function openIncidentModal(){ /* injected as above but minimal */ alert('Kan ikke åpne Uhell-modal nå. Oppdater Work.js.'); }
