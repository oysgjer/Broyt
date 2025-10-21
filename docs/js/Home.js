// js/Home.js
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_RUN      = 'BRYT_RUN';

  function loadSettings() {
    return readJSON(K_SETTINGS, {
      driver: '',
      equipment: { plow:false, fres:false, sand:false },
      dir: 'Normal',
      autoNav: false
    });
  }
  function saveSettings(s) { writeJSON(K_SETTINGS, s); }

  function uiToSettings() {
    return {
      ...loadSettings(),
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

  function startRunLocal() {
    const st = uiToSettings();
    saveSettings(st);
    const run = { driver: st.driver, equipment: st.equipment, dir: st.dir, idx: 0 };
    writeJSON(K_RUN, run);
  }

  async function onStartClick() {
    try {
      startRunLocal();

      // Sørg for at Sync finnes (boot.js prøver å laste den)
      if (!(window.Sync && typeof window.Sync.loadAddresses === 'function')) {
        throw new Error('Sync-modulen er ikke tilgjengelig (mangler js/sync.js eller ble blokkert av cache).');
      }

      const addrs = await window.Sync.loadAddresses({ force: true });
      if (!addrs || addrs.length === 0) {
        alert('Fant ingen adresser i JSONbin. Sjekk BIN og dataformat.');
      }

      location.hash = '#work';
    } catch (e) {
      console.error(e);
      alert('Kunne ikke starte runde: ' + e.message);
    }
  }

  function wire() {
    settingsToUI();
    $('#a_start') && $('#a_start').addEventListener('click', onStartClick);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();