// Hjem – lagre valg, last adresser (via Sync) og start runde
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_RUN      = 'BRYT_RUN';

  function loadSettings(){
    return readJSON(K_SETTINGS, {
      driver:'',
      equipment:{ plow:false, fres:false, sand:false },
      dir:'Normal',
      autoNav:false
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
        sand: !!$('#a_eq_sand')?.checked,
      },
      dir: $('#a_dir')?.value || 'Normal',
      autoNav: !!$('#a_autoNav')?.checked,
    };
  }

  function settingsToUI(){
    const st = loadSettings();
    if ($('#a_driver'))  $('#a_driver').value  = st.driver;
    if ($('#a_eq_plow')) $('#a_eq_plow').checked = !!st.equipment.plow;
    if ($('#a_eq_fres')) $('#a_eq_fres').checked = !!st.equipment.fres;
    if ($('#a_eq_sand')) $('#a_eq_sand').checked = !!st.equipment.sand;
    if ($('#a_dir'))     $('#a_dir').value = st.dir;
    if ($('#a_autoNav')) $('#a_autoNav').checked = !!st.autoNav;
  }

  function primeRunRecord(st){
    const run = { driver: st.driver, equipment: st.equipment, dir: st.dir, idx: 0, startedAt: Date.now() };
    writeJSON(K_RUN, run);
  }

  async function onStart(){
    // 1) lagre/prime
    const st = uiToSettings();
    saveSettings(st);
    primeRunRecord(st);

    // 2) prøv å hente adresser via Sync hvis den finnes og er konfigurert
    try{
      if (window.Sync?.isConfigured?.()) {
        const list = await window.Sync.loadAddresses({ force:true });
        if (!Array.isArray(list) || list.length === 0){
          alert('Fant ingen adresser i skyen. Sjekk JSONBin.');
        }
        // oppdater synk-badge om tilgjengelig
        window.Sync?.setBadge?.({ ok:true });
      }
    }catch(err){
      console.warn('Kunne ikke hente adresser fra Sync:', err);
      alert('Kunne ikke hente adresser (bruker lokale data hvis finnes).');
    }

    // 3) til “Under arbeid”
    location.hash = '#work';
  }

  function wire(){
    // gjør “Utstyr” vertikal og tydelig (hvis markupen din har .checkbox-row fra før, bytt til col)
    const row = document.querySelector('#home .checkbox-row');
    if (row) { row.classList.remove('checkbox-row'); row.classList.add('checkbox-col'); }

    $('#a_start')?.addEventListener('click', onStart);
    settingsToUI();
  }

  document.addEventListener('DOMContentLoaded', wire);
})();