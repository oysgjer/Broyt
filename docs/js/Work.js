// js/Work.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const $$= (s,r=document)=>Array.from(r.querySelectorAll(s));

  const LS_SETTINGS = 'BRYT_SETTINGS';
  const LS_RUN      = 'BRYT_RUN';

  const STATE_LABEL = {
    not_started: 'Venter',
    in_progress: 'Pågår',
    done:        'Ferdig',
    skipped:     'Hoppet over',
    blocked:     'Ikke mulig',
    accident:    'Uhell',
  };

  function readJSON(k,d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
  function writeJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  function getModeFromEquip(eq){ return eq?.sand ? 'grit' : 'snow'; }

  function currentRun(){
    const st  = readJSON(LS_SETTINGS, {driver:'driver',equipment:{sand:false},dir:'Normal'});
    const run = readJSON(LS_RUN, { driver: st.driver, equipment: st.equipment, dir: st.dir, idx: 0 });
    run.driver = st.driver || run.driver || 'driver';
    run.mode   = getModeFromEquip(st.equipment);
    return run;
  }

  // ---- UI helpers ----
  function updateTopProgress(addresses, bag, meName){
    const { total, me, other } = window.Sync.summarize(addresses, bag, meName);
    const mePct = total ? Math.round(100*me/total) : 0;
    const otPct = total ? Math.round(100*other/total) : 0;

    const bm=$('#b_prog_me'), bo=$('#b_prog_other');
    if(bm) bm.style.width = mePct+'%';
    if(bo) bo.style.width = otPct+'%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  function renderNowNext(addresses, idx){
    const now  = addresses[idx] || null;
    const next = addresses[(idx + 1 < addresses.length) ? idx+1 : idx] || null;

    $('#b_now')  && ($('#b_now').textContent  = now?.name  || '—');
    $('#b_next') && ($('#b_next').textContent = next?.name || '—');
  }

  function renderStatus(nowName, bag){
    const st = (nowName && bag[nowName]?.state) || 'not_started';
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[st] || '—');
  }

  function renderTask(mode){
    $('#b_task') && ($('#b_task').textContent = mode==='grit' ? 'Strøing' : 'Snø');
  }

  // ---- NAV ----
  function mapsUrlFromAddr(a){
    if(!a) return 'https://www.google.com/maps';
    if(a.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(a.coords)){
      const q=a.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((a.name||'')+', Norge');
  }

  // ---- Kontrollflyt Work ----
  async function refreshWork(){
    const run = currentRun();
    const all = await window.Sync.loadAddresses();               // alle adresser
    const list = all
      .filter(a=>a.active!==false)
      .filter(a=> run.mode==='snow' ? (a.flags?.snow!==false) : !!a.flags?.grit);

    // startindeks
    let idx = readJSON(LS_RUN, {}).idx ?? 0;
    if(run.dir==='Motsatt'){ idx = Math.min(idx, list.length-1); }

    // statusbag
    const bag = await window.Sync.getStatusBag(run.mode);

    // UI
    renderTask(run.mode);
    renderNowNext(list, idx);
    renderStatus(list[idx]?.name, bag);
    updateTopProgress(list, bag, run.driver);

    // persist indeks i LS
    const saved = readJSON(LS_RUN, {});
    saved.idx = idx; writeJSON(LS_RUN, saved);

    return { run, list, bag, idx };
  }

  async function stepAndMaybeAutoNav(nextIdx, list){
    const st = readJSON(LS_SETTINGS, {});
    const auto = !!st.autoNav;
    if(nextIdx>=0 && nextIdx<list.length){
      const run = readJSON(LS_RUN,{});
      run.idx = nextIdx; writeJSON(LS_RUN, run);
      renderNowNext(list, nextIdx);
      if(auto){
        const t = list[nextIdx];
        window.open(mapsUrlFromAddr(t),'_blank');
      }
    }
  }

  async function checkAllDone(list, bag, mode){
    const allDone = list.length>0 && list.every(a=> bag[a.name]?.state==='done');
    if(!allDone) return;

    // Ferdig dialog
    const modeTxt = (mode==='grit') ? 'grusrunden' : 'snørunden';
    const pick = confirm(`Alt er utført for ${modeTxt} 🎉\n\nOK = Gå til Service\nAvbryt = bli på siden`);
    if(pick){
      location.hash = '#service';
    }
  }

  // ---- Actions ----
  async function onStart(){
    const { run, list } = await refreshWork();
    const cur = list[readJSON(LS_RUN,{}).idx];
    if(!cur) return;
    await window.Sync.setStatus(cur.name, { state:'in_progress', startedAt:Date.now() }, { mode: run.mode, driver: run.driver });
    await refreshWork();
  }

  async function onDone(){
    const { run, list } = await refreshWork();
    const idx = readJSON(LS_RUN,{}).idx;
    const cur = list[idx];
    if(!cur) return;
    await window.Sync.setStatus(cur.name, { state:'done', finishedAt:Date.now() }, { mode: run.mode, driver: run.driver });
    await refreshWork();
    await stepAndMaybeAutoNav(Math.min(idx+1, list.length-1), list);
    const bag = await window.Sync.getStatusBag(run.mode);
    await checkAllDone(list, bag, run.mode);
  }

  async function onSkip(){
    const { run, list } = await refreshWork();
    const idx = readJSON(LS_RUN,{}).idx;
    const cur = list[idx];
    if(!cur) return;
    await window.Sync.setStatus(cur.name, { state:'skipped', finishedAt:Date.now() }, { mode: run.mode, driver: run.driver });
    await refreshWork();
    await stepAndMaybeAutoNav(Math.min(idx+1, list.length-1), list);
  }

  async function onNext(){
    const { list } = await refreshWork();
    const idx = readJSON(LS_RUN,{}).idx;
    await stepAndMaybeAutoNav(Math.min(idx+1, list.length-1), list);
    await refreshWork();
  }

  async function onBlock(){
    const why = prompt('Hvorfor ikke mulig? (valgfritt)','') || '';
    const { run, list } = await refreshWork();
    const idx = readJSON(LS_RUN,{}).idx;
    const cur = list[idx];
    if(!cur) return;
    await window.Sync.setStatus(cur.name, { state:'blocked', finishedAt:Date.now(), note: why }, { mode: run.mode, driver: run.driver });
    await refreshWork();
    await stepAndMaybeAutoNav(Math.min(idx+1, list.length-1), list);
  }

  function wire(){
    // knapper
    $('#act_start')?.addEventListener('click', onStart);
    $('#act_done') ?.addEventListener('click', onDone);
    $('#act_skip') ?.addEventListener('click', onSkip);
    $('#act_next') ?.addEventListener('click', onNext);
    $('#act_block')?.addEventListener('click', onBlock);

    // oppdater når siden vises
    window.addEventListener('hashchange', ()=>{
      const id=(location.hash||'#home').replace('#','');
      if(id==='work'){ refreshWork().catch(console.error); }
    });

    // første last hvis vi allerede er på work
    const cur=(location.hash||'#home').replace('#','');
    if(cur==='work'){ refreshWork().catch(console.error); }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();