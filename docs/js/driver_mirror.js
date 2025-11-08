/*! driver_mirror.js — kanonisk håndtering av sjåførnavn
 * - Leser fra #a_driver på Hjem
 * - Lagrer i localStorage: BRYT_DRIVER (kanonisk) + kompatibilitetsnøkler
 * - Oppdaterer BRYT_SETTINGS.driver og BRYT_RUN.driver
 * - Speiler til #work_driver_mirror med data-driver
 * - Eksponerer window.getDriverName()
 */
(() => {
  'use strict';

  const KEY_CANON = 'BRYT_DRIVER';
  const LS_SETTINGS = 'BRYT_SETTINGS';
  const LS_RUN = 'BRYT_RUN';

  // ---------- Utils ----------
  function getInput() {
    return document.getElementById('a_driver');
  }

  function ensureMirrorEl() {
    let el = document.getElementById('work_driver_mirror');
    if (!el) {
      el = document.createElement('span');
      el.id = 'work_driver_mirror';
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    return el;
  }

  function trim(v) { return String(v || '').trim(); }

  // ---------- Kanonisk get/set ----------
  function setCanonical(nameRaw) {
    const name = trim(nameRaw);
    // 1) Kanonisk + kompatibilitet
    localStorage.setItem(KEY_CANON, name);
    localStorage.setItem('driverName', name);
    localStorage.setItem('sjaforNavn', name);

    // 2) Settings
    try {
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
      s.driver = name;
      localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    } catch {}

    // 3) Pågående runde
    try {
      const r = JSON.parse(localStorage.getItem(LS_RUN) || '{}');
      r.driver = name;
      localStorage.setItem(LS_RUN, JSON.stringify(r));
    } catch {}

    // 4) Speil til skjult element
    const mir = ensureMirrorEl();
    if (name) mir.setAttribute('data-driver', name);
    else mir.removeAttribute('data-driver');
  }

  function getCanonical() {
    const inputVal = trim(getInput()?.value);
    const stored =
      trim(localStorage.getItem(KEY_CANON)) ||
      trim(localStorage.getItem('driverName')) ||
      trim(localStorage.getItem('sjaforNavn'));
    return inputVal || stored || '';
  }

  // Gjør tilgjengelig for andre skript (logger etc.)
  window.getDriverName = () => getCanonical();

  // ---------- Init & wiring ----------
  function syncFromInput() {
    const v = trim(getInput()?.value);
    if (v) setCanonical(v);
  }

  function prefillInputFromStorage() {
    const inp = getInput();
    if (!inp) return;
    const existing = trim(inp.value);
    if (existing) { setCanonical(existing); return; }
    const fromStore = getCanonical();
    if (fromStore) {
      inp.value = fromStore;
      setCanonical(fromStore);
    }
  }

  function wire() {
    const inp = getInput();
    if (inp) {
      const onChange = () => setCanonical(inp.value);
      inp.addEventListener('input', onChange);
      inp.addEventListener('change', onChange);
      inp.addEventListener('blur', onChange);
    }

    // Oppdater når vi bytter seksjon eller når andre faner endrer navnet
    window.addEventListener('hashchange', syncFromInput);
    window.addEventListener('storage', (e) => {
      const k = (e.key || '').toLowerCase();
      if (['bryt_driver', 'drivername', 'sjafornavn'].includes(k)) {
        prefillInputFromStorage();
      }
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { prefillInputFromStorage(); wire(); }, { once:true });
  } else {
    prefillInputFromStorage();
    wire();
  }
})();

// --- Debugvisning i konsoll (frivillig) ---
(function(){
  function showMirror(){
    const el = document.getElementById('work_driver_mirror');
    const name = el?.getAttribute('data-driver') || '(ingen speilet driver)';
    console.log('👤 Speilet driver nå:', name);
  }

  // Kjør ved lasting, input og seksjonsbytte
  document.addEventListener('DOMContentLoaded', showMirror);
  window.addEventListener('hashchange', showMirror);
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'a_driver') showMirror();
  });
})();
