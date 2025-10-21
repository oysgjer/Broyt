// js/Work.js
(() => {
  'use strict';

  /* ---------- Små hjelpere ---------- */
  const $ = (sel, root = document) => root.querySelector ? root.querySelector(sel) : null;
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  /* ---------- Nøkler i localStorage ---------- */
  const K_ADDR = 'BRYT_ADDR';   // adresser (demo lokalt, senere JSONBin)
  const K_RUN  = 'BRYT_RUN';    // aktiv runde (sjåfør, utstyr, indeks, osv.)

  /* ---------- Frødata (enkelt demosett) ---------- */
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

  /* ---------- Lese/lagre runde ---------- */
  function loadRun() {
    const d = {
      driver: readJSON('BRYT_SETTINGS', {}).driver || '',
      equipment: { plow: false, fres: false, sand: false },
      dir: 'Normal',
      idx: 0 // peker på "nå"
    };
    const s = readJSON(K_RUN, null);
    return s ? s : d;
  }
  function saveRun(s){ writeJSON(K_RUN, s); }

  /* ---------- Beregne nå/neste ---------- */
  function getNowNext() {
    const s = loadRun();
    const list = readJSON(K_ADDR, []);
    const total = list.length;

    let idx = Math.max(0, Math.min(s.idx || 0, Math.max(0, total - 1)));
    // hopp fremover til første som ikke er "done" hvis peker står på ferdig element
    while (idx < total && list[idx] && list[idx].status === 'done') idx++;

    const now  = list[idx] || null;
    // finn neste ikke-ferdige etter "now"
    let j = idx + 1, next = null;
    while (j < total) {
      if (list[j].status !== 'done') { next = list[j]; break; }
      j++;
    }
    return { s, list, idx, now, next, total };
  }

  /* ---------- Oppgave-tekst basert på utstyr ---------- */
  function describeTask(s) {
    const eq = (s && s.equipment) || {};
    const hasPlow = !!(eq.plow || eq.fres);
    const hasSand = !!eq.sand;

    if (hasPlow && hasSand) return 'Brøyting og strøing';
    if (hasPlow)            return 'Brøyting (fjerne snø)';
    if (hasSand)            return 'Strøing av grus';
    return 'Uspesifisert oppgave';
  }

  /* ---------- Progressbar og telling ---------- */
  function updateProgressBars() {
    const { s, list, total } = getNowNext();
    let me = 0, other = 0;

    // I denne demoen har vi ikke flere sjåfører i samme datasett,
    // så alt "done" regnes som mine.
    for (const a of list) {
      if (a.status === 'done') me++;
    }

    const mePct = total ? Math.round(100 * me / total) : 0;
    const otPct = total ? Math.round(100 * other / total) : 0;

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = otPct + '%';

    const cMe = $('#b_prog_me_count');
    const cOt = $('#b_prog_other_count');
    const sum = $('#b_prog_summary');
    if (cMe) cMe.textContent = `${me}/${total}`;
    if (cOt) cOt.textContent = `${other}/${total}`;
    if (sum) sum.textContent = `${Math.min(me + other, total)} av ${total} adresser fullført`;
  }

  /* ---------- Render “Under arbeid” ---------- */
  function renderWork() {
    // Ikke gjør noe hvis siden ikke er aktiv
    if (!$('#work') || $('#work').hasAttribute('hidden')) return;

    const { s, now, next } = getNowNext();

    $('#b_now')  && ($('#b_now').textContent  = now  ? now.name  : '—');
    $('#b_next') && ($('#b_next').textContent = next ? next.name : '—');

    // Oppgave-tekst under knappene
    $('#b_task')   && ($('#b_task').textContent   = describeTask(s));
    $('#b_status') && ($('#b_status').textContent = now ? (now.status || '—') : '—');

    // Aktiver/deaktiver knapper basert på status
    const st = now ? now.status || 'todo' : 'none';
    const dis = (sel, v) => { const el = $(sel); if (!el) return; el.disabled = !!v; el.classList.toggle('btn-disabled', !!v); };

    if (!now) {
      // Ingen adresser å jobbe med
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

  /* ---------- Handlinger ---------- */
  function setStatusForIdx(idx, status) {
    const addr = readJSON(K_ADDR, []);
    if (!addr[idx]) return;
    addr[idx].status = status; // 'todo' | 'doing' | 'done' | 'skipped' | 'blocked'
    writeJSON(K_ADDR, addr);
  }

  function advanceToNextNotDone(idxStart) {
    const addr = readJSON(K_ADDR, []);
    let i = Math.max(0, idxStart + 1);
    while (i < addr.length && addr[i].status === 'done') i++;
    const s = loadRun();
    s.idx = Math.min(i, Math.max(0, addr.length - 1));
    saveRun(s);
  }

  function handleStart() {
    const { idx, now } = getNowNext();
    if (!now) return;
    if (now.status !== 'doing' && now.status !== 'done') {
      setStatusForIdx(idx, 'doing');
    }
    renderWork();
  }

  function handleDone() {
    const { idx, now } = getNowNext();
    if (!now) return;
    setStatusForIdx(idx, 'done');

    // Når alt er ferdig: vis enkel dialog (runde komplett)
    const left = readJSON(K_ADDR, []).some(a => a.status !== 'done');
    if (!left) {
      // Hele runden ferdig – bare en enkel bekreftelse her (logikk for ny runde kommer senere)
      alert('Runden er fullført ✅');
    } else {
      advanceToNextNotDone(idx);
    }
    renderWork();
  }

  function handleSkip() {
    const { idx, now } = getNowNext();
    if (!now) return;
    setStatusForIdx(idx, 'skipped');
    advanceToNextNotDone(idx);
    renderWork();
  }

  function handleNext() {
    const { idx } = getNowNext();
    advanceToNextNotDone(idx);
    renderWork();
  }

  function handleBlock() {
    const { idx, now } = getNowNext();
    if (!now) return;
    setStatusForIdx(idx, 'blocked');
    advanceToNextNotDone(idx);
    renderWork();
  }

  function handleNav() {
    const { now } = getNowNext();
    if (!now) return;
    // Demo: bruk navn som destinasjon i Google Maps
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(now.name)}`;
    window.open(url, '_blank');
  }

  /* ---------- Wiring ---------- */
  function wire() {
    // sørg for at vi har data
    seedIfEmpty();

    // knapper
    $('#act_start') && $('#act_start').addEventListener('click', handleStart);
    $('#act_done')  && $('#act_done').addEventListener('click', handleDone);
    $('#act_skip')  && $('#act_skip').addEventListener('click', handleSkip);
    $('#act_next')  && $('#act_next').addEventListener('click', handleNext);
    $('#act_block') && $('#act_block').addEventListener('click', handleBlock);
    $('#act_nav')   && $('#act_nav').addEventListener('click', handleNav);

    // Re-render når vi kommer til siden
    window.addEventListener('hashchange', renderWork);
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    try { wire(); } catch (e) { console.error(e); }
    renderWork();
  });

  // (valgfritt) eksponer for andre moduler hvis de finnes
  window.updateProgressBars = updateProgressBars;
})();