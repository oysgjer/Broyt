/*! driver_mirror.js (safe)
 * Speiler sjåførnavn fra Hjem til Under arbeid – helt usynlig.
 * - Lagrer LAST_DRIVER i localStorage
 * - Oppretter #work_driver_mirror med data-driver, men INGEN synlig tekst
 * - Elementet er både hidden & aria-hidden, og skjules også via CSS
 */
(function(){
  'use strict';

  function readDriverFromHome(){
    try{
      // Tekstinput eller felter som har driver/sjåfør
      const el = document.querySelector('#home input[type="text"], input[name="driver"], #driver, #sjåfør, #sjafor');
      const v = (el && (el.value || el.textContent || '') || '').trim();
      return v || null;
    }catch{ return null; }
  }

  function ensureMirror(){
    let holder = document.querySelector('#work') || document.body;
    let el = document.getElementById('work_driver_mirror');
    if (!el){
      el = document.createElement('span');
      el.id = 'work_driver_mirror';
      el.setAttribute('data-driver-mirror','');
      el.hidden = true;
      el.setAttribute('aria-hidden','true');
      // viktig: IKKE tekst, kun data-attributt
      el.textContent = '';
      holder.appendChild(el);
    }
    return el;
  }

  function setDriverCache(name){
    try{ if (name && name.length) localStorage.setItem('LAST_DRIVER', name); }catch{}
  }
  function getDriverCache(){
    try{ return localStorage.getItem('LAST_DRIVER') || ''; }catch{ return ''; }
  }

  function update(){
    const name = readDriverFromHome() || getDriverCache() || '';
    const mir = ensureMirror();
    if (name) mir.setAttribute('data-driver', name);
    // aldri vis tekst
    mir.textContent = '';
  }

  document.addEventListener('input', function(e){
    // Oppdater cache når man skriver i fører-felt
    if (e.target && (e.target.id==='driver' || e.target.name==='driver' || e.target.closest('#home'))) {
      const v = (e.target.value || '').trim();
      if (v) setDriverCache(v);
      update();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update, {once:true});
  } else {
    update();
  }

  // Oppdater når vi bytter seksjon mellom home/work
  window.addEventListener('hashchange', update);
})();
// --- Patch: fanger opp fører fra hjem og speiler til work ---
(function(){
  function saveDriver(){
    const el = document.querySelector(
      '#home input[type="text"], #home [name="driver"], #home [placeholder*="fører" i]'
    );
    if (!el) return;
    const val = (el.value || el.textContent || '').trim();
    if (val.length > 0) {
      localStorage.setItem('LAST_DRIVER', val);
      console.log('💾 Lagret driver:', val);
      mirrorDriver(val);
    }
  }

  function mirrorDriver(name){
    let el = document.querySelector('#work_driver_mirror');
    if (!el) {
      el = document.createElement('span');
      el.id = 'work_driver_mirror';
      el.hidden = true;
      el.setAttribute('aria-hidden','true');
      document.body.appendChild(el);
    }
    el.setAttribute('data-driver', name);
    console.log('🔁 Speilet driver:', name);
  }

  // Oppdater hver gang du skriver
  document.addEventListener('input', e => {
    if (e.target.closest('#home')) saveDriver();
  });

  // Oppdater ved lasting/bytte
  document.addEventListener('DOMContentLoaded', () => {
    const cached = localStorage.getItem('LAST_DRIVER') || '';
    if (cached) mirrorDriver(cached);
  });
  window.addEventListener('hashchange', () => {
    const cached = localStorage.getItem('LAST_DRIVER') || '';
    if (cached) mirrorDriver(cached);
  });
})();
