// js/Home.js
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_RUN      = 'BRYT_RUN';

  function loadSettings(){
    return readJSON(K_SETTINGS, {
      driver: '',
      equipment: { plow:false, fres:false, sand:false },
      dir: 'Normal',
      autoNav: false
    });
  }
  function saveSettings(s){ writeJSON(K_SETTINGS, s); }

  function uiToSettings(){
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
  function settingsToUI(){
    const st = loadSettings();
    if ($('#a_driver'))  $('#a_driver').value  = st.driver || '';
    if ($('#a_eq_plow')) $('#a_eq_plow').checked = !!st.equipment.plow;
    if ($('#a_eq_fres')) $('#a_eq_fres').checked = !!st.equipment.fres;
    if ($('#a_eq_sand')) $('#a_eq_sand').checked = !!st.equipment.sand;
    if ($('#a_dir'))     $('#a_dir').value = st.dir || 'Normal';
    if ($('#a_autoNav')) $('#a_autoNav').checked = !!st.autoNav;
  }

  function startRunLocal(){
    const st = uiToSettings();
    saveSettings(st);
    // Ny runde-ID for å støtte flere runder samme dag
    const roundId = new Date().toISOString().slice(0,19).replace(/[:T]/g,''); // f.eks. 20251021_184700
    writeJSON(K_RUN, { driver: st.driver, equipment: st.equipment, dir: st.dir, idx: 0, roundId });
  }

  async function onStartClick(){
    try{
      startRunLocal();
      const Sync = await (window.getSync ? window.getSync() : Promise.reject(new Error('getSync mangler')));
      const addrs = await Sync.loadAddresses({ force:true });
      if (!addrs || addrs.length === 0){
        alert('Fant ingen adresser i JSONbin. Sjekk BIN og dataformat.');
      }
      location.hash = '#work';
    }catch(e){
      console.error(e);
      alert('Kunne ikke starte runde: ' + (e?.message || e));
    }
  }

  function wire(){
    settingsToUI();
    $('#a_start')?.addEventListener('click', onStartClick);
  }
  document.addEventListener('DOMContentLoaded', wire);
})();