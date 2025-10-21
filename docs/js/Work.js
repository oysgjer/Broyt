// js/Work.js
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const readJSON  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_RUN        = 'BRYT_RUN';           // {driver, equipment, dir, idx}
  const K_ADDR_CACHE = 'BRYT_ADDR_CACHE';    // {ts, data:[...]} – fylles av Sync
  const K_STATUS_LOC = 'BRYT_STATUS_LOC';    // frivillig tillegg (lokal statuslogg)

  const state = {
    addrs: [],   // liste med adresser
    run:   null, // gjeldende run
  };

  function loadRun(){
    return readJSON(K_RUN, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal', idx:0 });
  }
  function saveRun(r){ writeJSON(K_RUN, r); }

  function currentTask(){
    // sand = grus, ellers snø
    const eq = state.run?.equipment || {};
    return eq.sand ? 'grus' : 'snø';
  }

  function ensureIdxBounds(){
    if (!state.run) return;
    const n = state.addrs.length;
    if (state.run.idx < 0) state.run.idx = 0;
    if (state.run.idx >= n) state.run.idx = n - 1;
  }

  function nowNext(){
    const n = state.addrs.length;
    if (!n) return { now:null, next:null, total:n };
    ensureIdxBounds();
    const i = state.run.idx;
    const now  = state.addrs[i] ?? null;
    const next = (i + 1 < n) ? state.addrs[i+1] : null;
    return { now, next, total:n };
  }

  function pctDone(){
    // telt ferdig for valgt oppgave
    const task = currentTask(); // 'snø' | 'grus'
    let done = 0;
    for (const a of state.addrs){
      if (task === 'snø' && a.snowEnd) done++;
      if (task === 'grus' && a.gritEnd) done++;
    }
    return { done, total: state.addrs.length };
  }

  function fmtTime(ts){
    if (!ts) return '—';
    try{
      const d = new Date(ts);
      const dd = d.getDate().toString().padStart(2,'0');
      const mm = (d.getMonth()+1).toString().padStart(2,'0');
      const hh = d.getHours().toString().padStart(2,'0');
      const mi = d.getMinutes().toString().padStart(2,'0');
      return `${dd}.${mm} ${hh}:${mi}`;
    }catch{ return '—'; }
  }

  function render(){
    const { now, next } = nowNext();

    // topptekst “Nå / Neste”
    $('#b_now')  && ($('#b_now').textContent  = now  ? (now.name || now.title || now.adresse || 'Ukjent') : '—');
    $('#b_next') && ($('#b_next').textContent = next ? (next.name || next.title || next.adresse || '—') : '—');

    // Oppgave & status-tekst
    const task = currentTask(); // 'snø' | 'grus'
    $('#b_task')   && ($('#b_task').textContent = task === 'grus' ? 'Strø grus' : 'Fjerne snø');

    let statusTxt = '—';
    if (now){
      if (task === 'snø'){
        if (now.snowEnd) statusTxt = 'Ferdig';
        else if (now.snowStart) statusTxt = 'Pågår';
        else statusTxt = 'Ikke påbegynt';
      } else {
        if (now.gritEnd) statusTxt = 'Ferdig';
        else if (now.gritStart) statusTxt = 'Pågår';
        else statusTxt = 'Ikke påbegynt';
      }
    }
    $('#b_status') && ($('#b_status').textContent = statusTxt);

    // Fremdriftsbar
    const { done, total } = pctDone();
    const meBar    = $('#b_prog_me');
    const otherBar = $('#b_prog_other'); // ikke i bruk enda, men lar stå
    if (meBar){
      const pct = total ? Math.round(100 * done / total) : 0;
      meBar.style.width = pct + '%';
    }
    if (otherBar){ otherBar.style.width = '0%'; }

    $('#b_prog_summary')    && ($('#b_prog_summary').textContent = `${done} av ${total} adresser fullført`);
    $('#b_prog_me_count')   && ($('#b_prog_me_count').textContent = `${done}/${total}`);
    $('#b_prog_other_count')&& ($('#b_prog_other_count').textContent = `0/${total}`);
  }

  function goNext(){
    if (!state.run) return;
    if (state.run.idx < state.addrs.length - 1){
      state.run.idx++;
      saveRun(state.run);
    }
    render();
  }

  async function setStatusFor(addr, patch){
    // Bruk Sync.setStatus (lokal stub i dag). Oppdater også lokal liste.
    try{
      await window.Sync.setStatus(addr.id || addr.name, patch);
      // Merge lokalt
      Object.assign(addr, patch);
      // logg lokalt om ønskelig
      const lg = readJSON(K_STATUS_LOC, []);
      lg.push({ id: addr.id || addr.name, at: Date.now(), ...patch, driver: state.run.driver });
      writeJSON(K_STATUS_LOC, lg);
    }catch(e){
      alert('Klarte ikke lagre status: ' + e.message);
    }
  }

  // === Handlers ===
  async function onStart(){
    const { now } = nowNext();
    if (!now) return;
    const task = currentTask();
    const patch = {
      driver: state.run.driver || '',
    };
    if (task === 'snø'){
      if (!now.snowStart) patch.snowStart = Date.now();
    } else {
      if (!now.gritStart) patch.gritStart = Date.now();
    }
    await setStatusFor(now, patch);
    render();
  }

  async function onDone(){
    const { now } = nowNext();
    if (!now) return;
    const task = currentTask();
    const patch = {
      driver: state.run.driver || '',
    };
    if (task === 'snø'){
      if (!now.snowStart) patch.snowStart = Date.now();
      patch.snowEnd = Date.now();
    } else {
      if (!now.gritStart) patch.gritStart = Date.now();
      patch.gritEnd = Date.now();
    }
    await setStatusFor(now, patch);
    goNext();
  }

  async function onSkip(){
    const { now } = nowNext();
    if (!now) return;
    const patch = { skipped: true, driver: state.run.driver || '' };
    await setStatusFor(now, patch);
    goNext();
  }

  async function onBlock(){
    const { now } = nowNext();
    if (!now) return;
    const patch = { blocked: true, driver: state.run.driver || '' };
    await setStatusFor(now, patch);
    goNext();
  }

  function onNext(){
    goNext();
  }

  function onNav(){
    const { now } = nowNext();
    if (!now) return;
    // støtt både lat/lon eller tekst-adresse
    if (now.lat && now.lon){
      const url = `https://www.google.com/maps/dir/?api=1&destination=${now.lat},${now.lon}`;
      window.open(url, '_blank');
      return;
    }
    const q = encodeURIComponent(now.name || now.title || now.adresse || '');
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    window.open(url, '_blank');
  }

  async function init(){
    if (location.hash !== '#work') return;

    // last run + adresser
    state.run = loadRun();

    // Hent fra Sync (bruk cache – force:false) for kjapp last
    let addrs = [];
    try{
      addrs = await window.Sync.loadAddresses({ force:false });
    }catch(e){
      // som fallback: les cache direkte
      const cache = readJSON(K_ADDR_CACHE, {data:[]});
      addrs = cache.data || [];
    }

    // Normaliser litt, og behold rekkefølge (evt motsatt)
    state.addrs = (addrs || []).map((a, i) => ({
      id: a.id ?? a.ID ?? a.idr ?? (a.name || String(i)),
      name: a.name || a.title || a.adresse || `Adresse #${i+1}`,
      lat: a.lat ?? a.latitude,
      lon: a.lon ?? a.longitude,
      // eksisterende status-felter beholdes
      snowStart: a.snowStart, snowEnd: a.snowEnd,
      gritStart: a.gritStart, gritEnd: a.gritEnd,
      driver: a.driver,
      skipped: a.skipped,
      blocked: a.blocked
    }));

    if ((state.run?.dir || 'Normal') === 'Motsatt'){
      state.addrs.reverse();
      // juster idx slik at den fortsatt peker på korrekt element i reversert liste
      state.run.idx = Math.max(0, state.addrs.length - 1 - (state.run.idx || 0));
      saveRun(state.run);
    }

    // Wire knapper
    $('#act_start') && ($('#act_start').onclick = onStart);
    $('#act_done')  && ($('#act_done').onclick  = onDone);
    $('#act_skip')  && ($('#act_skip').onclick  = onSkip);
    $('#act_next')  && ($('#act_next').onclick  = onNext);
    $('#act_block') && ($('#act_block').onclick = onBlock);
    $('#act_nav')   && ($('#act_nav').onclick   = onNav);

    render();
  }

  window.addEventListener('hashchange', init);
  document.addEventListener('DOMContentLoaded', init);
})();