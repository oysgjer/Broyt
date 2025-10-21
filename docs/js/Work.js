// ======================================================
// Work.js – Under arbeid
// v10.6 – stabil
// ======================================================
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_RUN  = 'BRYT_RUN';
  const K_ADDR = 'BRYT_ADDR';

  const STATE_LABEL = {
    waiting: 'Venter',
    in_progress: 'Pågår',
    done: 'Ferdig',
    skipped: 'Hoppet over',
    blocked: 'Ikke mulig'
  };

  let S = {
    idx: 0,
    addresses: [],
    driver: '',
    mode: 'snow',  // 'snow' eller 'grit'
    dir: 'Normal'
  };

  // ---------- Hjelpefunksjoner ----------
  function loadRun() { return readJSON(K_RUN, {}); }
  function saveRun(r) { writeJSON(K_RUN, r); }

  function updateProgressBars(){
    const total = S.addresses.length || 1;
    let me = 0, other = 0;

    const bag = readJSON('BRYT_STATUS', {});
    for (const name in bag){
      const st = bag[name];
      if (st && st.state === 'done'){
        if (st.driver === S.driver) me++;
        else other++;
      }
    }
    const mePct = Math.round(100 * me / total);
    const otPct = Math.round(100 * other / total);

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = otPct + '%';

    $('#b_prog_me_count').textContent = `${me}/${total}`;
    $('#b_prog_other_count').textContent = `${other}/${total}`;
    $('#b_prog_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`;
  }

  function uiSetWork(){
    const now  = S.addresses[S.idx] || null;
    const next = S.addresses[S.idx + 1] || null;

    $('#b_now').textContent  = now ? now.name : '—';
    $('#b_next').textContent = next ? next.name : '—';
    $('#b_task').textContent = (S.mode === 'snow') ? 'Fjerne snø' : 'Strø grus';

    const bag = readJSON('BRYT_STATUS', {});
    const st = (now && bag[now.name]) ? bag[now.name].state : 'waiting';
    $('#b_status').textContent = STATE_LABEL[st] || '—';

    updateProgressBars();
  }

  function saveStatus(name, patch){
    const bag = readJSON('BRYT_STATUS', {});
    const cur = bag[name] || {};
    bag[name] = { ...cur, ...patch };
    writeJSON('BRYT_STATUS', bag);
  }

  function nextIndex(){
    if (S.dir === 'Motsatt') return S.idx - 1;
    return S.idx + 1;
  }

  async function stepState(patch, nextAfter = true){
    const cur = S.addresses[S.idx];
    if (!cur) return;

    saveStatus(cur.name, { ...patch, driver: S.driver });
    uiSetWork();

    // sjekk om alle ferdige
    const bag = readJSON('BRYT_STATUS', {});
    const allDone = S.addresses.every(a => bag[a.name]?.state === 'done');
    if (allDone){
      const opt = confirm('Alt er utført for denne runden.\n\nOK = Fortsett til Service\nAvbryt = Bli her');
      if (opt) {
        location.hash = '#service';
        return;
      }
    }

    if (nextAfter){
      const ni = nextIndex();
      if (ni >= 0 && ni < S.addresses.length){
        S.idx = ni;
        uiSetWork();
      } else {
        // ferdig med runde
        const choice = confirm('Runde fullført!\n\nOK = Ny brøyterunde\nAvbryt = Ny grusrunde');
        if (choice) {
          // restart brøyting
          S.mode = 'snow';
          S.idx = 0;
          const bag2 = {};
          S.addresses.forEach(a => bag2[a.name] = {state:'waiting'});
          writeJSON('BRYT_STATUS', bag2);
          uiSetWork();
        } else {
          const c2 = confirm('Start grusrunde? OK = Grus, Avbryt = Ferdig (til Service)');
          if (c2){
            S.mode = 'grit';
            S.idx = 0;
            const bag3 = {};
            S.addresses.forEach(a => bag3[a.name] = {state:'waiting'});
            writeJSON('BRYT_STATUS', bag3);
            uiSetWork();
          } else {
            location.hash = '#service';
          }
        }
      }
    }
  }

  // ---------- Navigasjon ----------
  function mapsUrlFromAddr(addr){
    if (!addr) return 'https://www.google.com/maps';
    if (addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
      const q = addr.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr.name+', Norge');
  }

  function navigateToNext(){
    const next = S.addresses[nextIndex()];
    const target = next || S.addresses[S.idx] || null;
    if(!target) return;
    const url = mapsUrlFromAddr(target);
    window.open(url, '_blank');
  }

  // ---------- Init ----------
  async function init(){
    const run = loadRun();
    S.driver = run.driver || 'ukjent';
    S.dir = run.dir || 'Normal';
    S.mode = (run.equipment?.sand) ? 'grit' : 'snow';
    S.idx = run.idx || 0;

    // hent adresser fra localStorage (lagret av Sync)
    const arr = readJSON(K_ADDR, []);
    S.addresses = arr.filter(a => a.active !== false);

    uiSetWork();

    $('#act_start')?.addEventListener('click', ()=>stepState({state:'in_progress',startedAt:Date.now()},false));
    $('#act_done') ?.addEventListener('click', ()=>stepState({state:'done',finishedAt:Date.now()}));
    $('#act_skip') ?.addEventListener('click', ()=>stepState({state:'skipped',finishedAt:Date.now()}));
    $('#act_block')?.addEventListener('click', ()=>stepState({state:'blocked',finishedAt:Date.now()}));
    $('#act_nav')  ?.addEventListener('click', navigateToNext);
    $('#act_next') ?.addEventListener('click', ()=>{
      const ni = nextIndex();
      if (ni >= 0 && ni < S.addresses.length){ S.idx = ni; uiSetWork(); }
    });

    updateProgressBars();
  }

  document.addEventListener('DOMContentLoaded', init);
})();