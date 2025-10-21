// js/Work.js
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_ADDR     = 'BRYT_ADDR';
  const K_RUN      = 'BRYT_RUN';
  const K_SETTINGS = 'BRYT_SETTINGS';

  // --- Fallback hvis ingen adresser (kun for demo) ---
  function seedIfEmpty() {
    let addr = readJSON(K_ADDR, null);
    if (!addr || !Array.isArray(addr) || addr.length === 0) {
      addr = [
        { id: 1, name: 'Tunlandvegen',   status: 'todo' },
        { id: 2, name: 'Sessvollvegen 9',status: 'todo' },
        { id: 3, name: 'Skolevegen',     status: 'todo' },
        { id: 4, name: 'Åsvegen',        status: 'todo' }
      ];
      writeJSON(K_ADDR, addr);
    }
  }

  // --- Lese/lagre run + settings ---
  function loadRun() {
    const d = { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', idx:0 };
    return readJSON(K_RUN, d);
  }
  function saveRun(s){ writeJSON(K_RUN, s); }

  function loadSettings(){
    return readJSON(K_SETTINGS, {
      driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', autoNav:false
    });
  }
  function saveSettings(s){ writeJSON(K_SETTINGS, s); }

  // --- Hente nå/neste ---
  function getNowNext() {
    const s = loadRun();
    const list = readJSON(K_ADDR, []);
    const total = list.length;

    let idx = Math.max(0, Math.min(s.idx || 0, Math.max(0, total - 1)));
    while (idx < total && list[idx] && list[idx].status === 'done') idx++;

    const now  = list[idx] || null;
    let j = idx + 1, next = null;
    while (j < total) { if (list[j].status !== 'done') { next = list[j]; break; } j++; }

    return { s, list, idx, now, next, total };
  }

  // --- Norsk status-tekst ---
  function statusLabel(code){
    switch((code||'').toLowerCase()){
      case 'todo':    return 'Venter';
      case 'doing':   return 'Pågår';
      case 'done':    return 'Ferdig';
      case 'skipped': return 'Hoppet over';
      case 'blocked': return 'Ikke mulig';
      default:        return '—';
    }
  }

  // --- Oppgave-tekst (basert på utstyr) ---
  function describeTask(s) {
    const eq = (s && s.equipment) || {};
    const hasPlow = !!(eq.plow || eq.fres);
    const hasSand = !!eq.sand;

    if (hasPlow && hasSand) return 'Brøyting og strøing';
    if (hasPlow)            return 'Brøyting (fjerne snø)';
    if (hasSand)            return 'Strøing av grus';
    return 'Uspesifisert oppgave';
  }

  // --- Progress ---
  function updateProgressBars() {
    const { list, total } = getNowNext();
    let me = 0, other = 0; // "other" kommer når vi kobler ordentlig sky-synk

    for (const a of list) if (a.status === 'done') me++;

    const mePct = total ? Math.round(100 * me / total) : 0;
    const otPct = total ? Math.round(100 * other / total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = otPct + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  // --- Render-kortet ---
  function renderWork() {
    if (!$('#work') || $('#work').hasAttribute('hidden')) return;

    const { s, now, next } = getNowNext();

    $('#b_now')    && ($('#b_now').textContent    = now  ? now.name         : '—');
    $('#b_next')   && ($('#b_next').textContent   = next ? next.name        : '—');
    $('#b_task')   && ($('#b_task').textContent   = describeTask(s));
    $('#b_status') && ($('#b_status').textContent = now ? statusLabel(now.status || 'todo') : '—');

    const st = now ? now.status || 'todo' : 'none';
    const dis = (sel, v) => { const el = $(sel); if (!el) return; el.disabled = !!v; el.classList.toggle('btn-disabled', !!v); };

    if (!now) {
      ['#act_start','#act_done','#act_skip','#act_next','#act_nav','#act_block'].forEach(sel => dis(sel, true));
    } else {
      dis('#act_start', st === 'doing' || st === 'done');
      dis('#act_done',  st === 'done');
      dis('#act_skip',  st === 'done');
      dis('#act_next',  false);
      dis('#act_nav',   false);
      dis('#act_block', st === 'done');
    }

    updateProgressBars();
  }

  // --- Statusoperasjoner ---
  function setStatusForIdx(idx, status) {
    const addr = readJSON(K_ADDR, []);
    if (!addr[idx]) return;
    addr[idx].status = status;
    writeJSON(K_ADDR, addr);
  }

  function advanceToNextNotDone(idxStart) {
    const addr = readJSON(K_ADDR, []);
    let i = Math.max(0, idxStart + 1);
    while (i < addr.length && addr[i].status === 'done') i++;
    const s = loadRun(); s.idx = Math.min(i, Math.max(0, addr.length - 1)); saveRun(s);
  }

  // --- Fullført-runde: håndter valg ---
  function resetAllToTodo() {
    const list = readJSON(K_ADDR, []);
    for (const a of list) a.status = 'todo';
    writeJSON(K_ADDR, list);
    const run = loadRun(); run.idx = 0; saveRun(run);
  }

  function switchToSandEquipment() {
    const st = loadSettings();
    st.equipment = { plow:false, fres:false, sand:true };
    saveSettings(st);
    const run = loadRun();
    run.equipment = { ...st.equipment };
    run.idx = 0;
    saveRun(run);
  }

  function onRoundComplete() {
    // Enkelt valg via prompt (1/2/3) for å slippe egen modal nå
    const msg = [
      'Runden er fullført ✅',
      '',
      'Hva vil du gjøre nå?',
      '1 = Start ny brøyterunde',
      '2 = Start ny runde med grus',
      '3 = Ferdig (gå til Service)',
      '',
      'Skriv 1, 2 eller 3:'
    ].join('\n');

    const val = (window.prompt(msg, '3') || '').trim();

    if (val === '1') {
      resetAllToTodo();
      alert('Ny brøyterunde starter.');
      renderWork();
      return;
    }
    if (val === '2') {
      switchToSandEquipment();
      resetAllToTodo();
      alert('Ny runde med grus starter.');
      renderWork();
      return;
    }
    // 3 eller annet -> Service
    location.hash = '#service';
  }

  // --- Handlers ---
  function handleStart(){ 
    const { idx, now } = getNowNext(); 
    if (!now) return; 
    if (now.status !== 'doing' && now.status !== 'done') setStatusForIdx(idx,'doing'); 
    renderWork(); 
  }

  function handleDone (){
    const { idx, now, list } = getNowNext(); 
    if (!now) return;
    setStatusForIdx(idx,'done');

    const left = list.some(a => a.status !== 'done');
    if (!left) {
      updateProgressBars();
      onRoundComplete();
      return;
    }
    advanceToNextNotDone(idx);
    renderWork();
  }

  function handleSkip (){ const { idx, now } = getNowNext(); if (!now) return; setStatusForIdx(idx,'skipped'); advanceToNextNotDone(idx); renderWork(); }
  function handleNext (){ const { idx } = getNowNext(); advanceToNextNotDone(idx); renderWork(); }
  function handleBlock(){ const { idx, now } = getNowNext(); if (!now) return; setStatusForIdx(idx,'blocked'); advanceToNextNotDone(idx); renderWork(); }
  function handleNav  (){
    const { now } = getNowNext(); if (!now) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(now.name)}`;
    window.open(url,'_blank');
  }

  // --- Sørg for adresser (JSONbin hvis tilgjengelig, ellers seed) ---
  async function ensureAddresses() {
    let addr = readJSON(K_ADDR, []);
    if ((!addr || addr.length === 0) && window.Sync) {
      try { addr = await window.Sync.loadAddresses({ force: false }); }
      catch (e) { console.warn('Klarte ikke hente fra JSONbin nå:', e.message); }
    }
    if (!addr || addr.length === 0) seedIfEmpty();
  }

  function wire() {
    $('#act_start')?.addEventListener('click', handleStart);
    $('#act_done') ?.addEventListener('click', handleDone);
    $('#act_skip') ?.addEventListener('click', handleSkip);
    $('#act_next') ?.addEventListener('click', handleNext);
    $('#act_block')?.addEventListener('click', handleBlock);
    $('#act_nav')  ?.addEventListener('click', handleNav);
    window.addEventListener('hashchange', renderWork);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureAddresses();
    wire();
    renderWork();
  });

  // tilgjengelig for andre filer
  window.updateProgressBars = updateProgressBars;
})();