// js/Work.js
(() => {
  'use strict';

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS'; // { driver, equipment:{sand}, dir, autoNav }
  const K_RUN      = 'BRYT_RUN';      // { idx, mode }
  const K_ADDRS    = 'BRYT_ADDRS';    // [] fra Sync

  function stateLabel(code){
    const L = {
      not_started: 'Venter',
      in_progress: 'Pågår',
      done:        'Ferdig',
      skipped:     'Hoppet over',
      blocked:     'Ikke mulig',
      accident:    'Uhell'
    };
    return L[code] || '—';
  }

  function getMode() {
    // sand/ grus = "grit", ellers "snow"
    const st = readJSON(K_SETTINGS, { equipment:{ sand:false }});
    return st?.equipment?.sand ? 'grit' : 'snow';
  }
  function getDriver(){ return (readJSON(K_SETTINGS,{driver:''}).driver||'').trim(); }
  function getDir(){ return readJSON(K_SETTINGS,{dir:'Normal'}).dir || 'Normal'; }
  function setRunIdx(i){ const r=readJSON(K_RUN,{idx:0}); r.idx=i; writeJSON(K_RUN,r); }
  function getRun(){
    const mode = getMode();
    const r = readJSON(K_RUN, { idx:0, mode });
    if (r.mode !== mode) { r.mode = mode; r.idx = 0; writeJSON(K_RUN, r); }
    return r;
  }

  function filteredAddresses(mode){
    const list = readJSON(K_ADDRS, []);
    return list
      .filter(a => a.active !== false)
      .filter(a => mode==='snow' ? (a.flags?.snow !== false) : !!a.flags?.grit);
  }

  function nextIndex(idx, dir){ return (dir === 'Motsatt') ? idx - 1 : idx + 1; }

  // ---------- Progress ----------
  function updateProgressBars(){
    const mode = getMode();
    const round= window.Sync.currentRound(mode);
    const addrs = filteredAddresses(mode);
    const total = addrs.length || 1;

    let me = 0, other = 0;
    const meName = getDriver();

    for (const a of addrs){
      const rec = window.Sync.getAddressStatus(a.name, mode, round);
      if (!rec || rec.state !== 'done') continue;
      if (rec.driver === meName) me++; else other++;
    }
    const mePct = Math.round(100 * me / total);
    const otPct = Math.round(100 * other / total);

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm && bm.style) bm.style.width = mePct + '%';
    if (bo && bo.style) bo.style.width = otPct + '%';

    $('#b_prog_me_count') && ($('#b_prog_me_count').textContent = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary') && ($('#b_prog_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  function uiSetWork(){
    const mode  = getMode();
    const round = window.Sync.currentRound(mode);
    const dir   = getDir();
    const run   = getRun();
    const addrs = filteredAddresses(mode);

    const now = addrs[run.idx] || null;
    const nxt = addrs[nextIndex(run.idx, dir)] || null;

    if ($('#b_now'))  $('#b_now').textContent  = now ? (now.name || '—') : '—';
    if ($('#b_next')) $('#b_next').textContent = nxt ? (nxt.name || '—') : '—';
    if ($('#b_task')) $('#b_task').textContent = (mode==='snow') ? 'Fjerne snø' : 'Strø grus';

    const st = now ? window.Sync.getAddressStatus(now.name, mode, round) : null;
    if ($('#b_status')) $('#b_status').textContent = stateLabel(st?.state || 'not_started');

    updateProgressBars();
  }

  function mapsUrlFromAddr(addr){
    if(!addr) return 'https://www.google.com/maps';
    if (addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
      const q=addr.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
  }

  // ---------- All done? ----------
  function isAllDone(){
    const mode  = getMode();
    const round = window.Sync.currentRound(mode);
    const addrs = filteredAddresses(mode);
    if (!addrs.length) return false;
    return addrs.every(a => (window.Sync.getAddressStatus(a.name, mode, round)?.state === 'done'));
  }

  function afterAllDoneFlow(){
    const mode  = getMode();
    const txtMode = (mode==='snow') ? 'Snø' : 'Grus';
    const choice = prompt(
      `Alt er utført for ${txtMode}-runden 🎉\n\n` +
      `Skriv ett av valgene:\n` +
      `1 = Ny runde (${txtMode})\n` +
      `2 = Start ny runde (Grus)\n` +
      `3 = Ferdig (gå til Service)`
    , '3');

    if (choice === '1'){ // ny runde samme modus
      window.Sync.incrementRound(mode);
      const run = readJSON(K_RUN,{idx:0,mode}); run.idx=0; writeJSON(K_RUN,run);
      location.hash = '#work';
      uiSetWork();
      return;
    }
    if (choice === '2'){ // bytt til grus og ny runde
      const st = readJSON(K_SETTINGS, { equipment:{sand:false}, dir:'Normal' });
      st.equipment.sand = true;  // grus
      writeJSON(K_SETTINGS, st);
      window.Sync.incrementRound('grit');
      const run = { idx:0, mode:'grit' }; writeJSON(K_RUN, run);
      location.hash = '#work';
      uiSetWork();
      return;
    }
    // Ferdig -> Service
    location.hash = '#service';
  }

  // ---------- Handling ----------
  function setStatusForCurrent(patch, advance = false){
    const mode  = getMode();
    const round = window.Sync.currentRound(mode);
    const addrs = filteredAddresses(mode);
    const run   = getRun();
    const cur   = addrs[run.idx]; if (!cur) return;

    window.Sync.setAddressStatus(cur.name, mode, round, { ...patch, driver: getDriver() });

    if (advance){
      const dir = getDir();
      const ni = nextIndex(run.idx, dir);
      if (ni >=0 && ni < addrs.length) {
        setRunIdx(ni);
      }
    }
    uiSetWork();

    if (isAllDone()) afterAllDoneFlow();
  }

  function onStart(){ setStatusForCurrent({ state:'in_progress', startedAt: new Date().toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}) }, false); }
  function onDone(){
    setStatusForCurrent({ state:'done', finishedAt: new Date().toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}) }, true);
  }
  function onSkip(){ setStatusForCurrent({ state:'skipped', finishedAt: new Date().toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}) }, true); }
  function onBlock(){ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; setStatusForCurrent({ state:'blocked', note:reason, finishedAt: new Date().toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}) }, true); }
  function onNext(){
    const dir=getDir();
    const run=getRun();
    const addrs=filteredAddresses(getMode());
    const ni=nextIndex(run.idx, dir);
    if (ni>=0 && ni<addrs.length) { setRunIdx(ni); uiSetWork(); }
  }
  function onNav(){
    const run=getRun(), mode=getMode(), dir=getDir();
    const addrs=filteredAddresses(mode);
    const target = addrs[nextIndex(run.idx,dir)] || addrs[run.idx];
    if (!target) return;
    window.open(mapsUrlFromAddr(target),'_blank');
  }

  function wire(){
    if (location.hash !== '#work') return;
    $('#act_start')?.addEventListener('click', onStart);
    $('#act_done') ?.addEventListener('click', onDone);
    $('#act_skip') ?.addEventListener('click', onSkip);
    $('#act_block')?.addEventListener('click', onBlock);
    $('#act_next') ?.addEventListener('click', onNext);
    $('#act_nav')  ?.addEventListener('click', onNav);

    uiSetWork();
  }

  window.addEventListener('hashchange', wire);
  document.addEventListener('DOMContentLoaded', wire);
})();