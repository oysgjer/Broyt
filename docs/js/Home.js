// js/Home.js
(() => {
  'use strict';

  /* ========= små hjelpere ========= */
  const $ = (s, r = document) => r.querySelector(s);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_RUN      = 'BRYT_RUN';

  /* ========= settings (UI <-> storage) ========= */
  function loadSettings() {
    return readJSON(K_SETTINGS, {
      driver: '',
      equipment: { plow:false, fres:false, sand:false },
      dir: 'Normal',
      autoNav: false,
      grus: '', diesel: '', base: '' // ev. snarvei-koordinater
    });
  }
  function saveSettings(s) { writeJSON(K_SETTINGS, s); }

  function uiToSettings() {
    const cur = loadSettings();
    return {
      ...cur,
      driver: $('#a_driver')?.value.trim() || '',
      equipment: {
        plow: !!$('#a_eq_plow')?.checked,
        fres: !!$('#a_eq_fres')?.checked,
        sand: !!$('#a_eq_sand')?.checked
      },
      dir: $('#a_dir')?.value || 'Normal',
      autoNav: !!$('#a_autoNav')?.checked
    };
  }

  function settingsToUI() {
    const st = loadSettings();
    if ($('#a_driver'))  $('#a_driver').value = st.driver || '';
    if ($('#a_eq_plow')) $('#a_eq_plow').checked = !!st.equipment.plow;
    if ($('#a_eq_fres')) $('#a_eq_fres').checked = !!st.equipment.fres;
    if ($('#a_eq_sand')) $('#a_eq_sand').checked = !!st.equipment.sand;
    if ($('#a_dir'))     $('#a_dir').value = st.dir || 'Normal';
    if ($('#a_autoNav')) $('#a_autoNav').checked = !!st.autoNav;
  }

  /* ========= start runde (lokalt) ========= */
  function startRunLocal() {
    const st = uiToSettings();
    saveSettings(st);

    const run = {
      driver: st.driver,
      equipment: { ...st.equipment },
      dir: st.dir,
      autoNav: !!st.autoNav,
      idx: 0
    };
    writeJSON(K_RUN, run);
    return run;
  }

  /* ========= klikk: Start runde ========= */
  async function onStartClick() {
    try {
      // 1) lagre innstillinger & klargjør lokal "run"
      const run = startRunLocal();

      // 2) sørg for at Sync er lastet
      if (!window.Sync?.init) {
        throw new Error('Sync-modulen er ikke tilgjengelig (mangler js/sync.js eller laster ikke).');
      }

      // 3) start synk (henter adresser og status, starter evt. polling)
      //    init() kan trygt kalles flere ganger – den re-bruker eksisterende tilstand.
      await window.Sync.init();

      // 4) alt klart – gå til "Under arbeid"
      location.hash = '#work';
    } catch (err) {
      console.error(err);
      alert('Kunne ikke starte runde: ' + (err?.message || err));
    }
  }

  /* ========= wiring ========= */
  function wire() {
    settingsToUI();
    $('#a_start')?.addEventListener('click', onStartClick);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();