// js/driver_name_canonical.js — én kilde til sannhet for sjåførnavn 
(() => {
  'use strict';

  const KEY_CANON = 'BRYT_DRIVER';     // kanonisk
  const LS_SETTINGS = 'BRYT_SETTINGS'; // eksisterende app-innstillinger
  const LS_RUN = 'BRYT_RUN';           // pågående runde

  // Eksponer en trygg getter som andre skript kan bruke
  window.getDriverName = function(){
    const v =
      localStorage.getItem(KEY_CANON) ||
      (document.getElementById('a_driver')?.value || '') ||
      JSON.parse(localStorage.getItem(LS_SETTINGS)||'{}').driver ||
      localStorage.getItem('driverName') ||
      localStorage.getItem('sjaforNavn') || '';
    return (v || '').trim();
  };

  function saveAll(nameRaw){
    const name = String(nameRaw||'').trim();
    // 1) Kanonisk nøkkel
    localStorage.setItem(KEY_CANON, name);
    // 2) Kompatibilitetsnøkler (gamle skript)
    localStorage.setItem('driverName', name);
    localStorage.setItem('sjaforNavn', name);

    // 3) Oppdater settings
    try{
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
      s.driver = name;
      localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    }catch{}

    // 4) Oppdater pågående runde (slik at Work.js bruker riktig "by")
    try{
      const r = JSON.parse(localStorage.getItem(LS_RUN) || '{}');
      r.driver = name;
      localStorage.setItem(LS_RUN, JSON.stringify(r));
    }catch{}
  }

  function init(){
    const input = document.getElementById('a_driver');
    if (!input) return;

    // Prefyll feltet hvis tomt
    const cur = window.getDriverName();
    if (cur && !input.value) input.value = cur;

    // Speil ved input/endring/blur
    const onChange = () => saveAll(input.value);
    input.addEventListener('input', onChange);
    input.addEventListener('change', onChange);
    input.addEventListener('blur', onChange);

    // Hvis noe annet setter KEY_CANON (f.eks. Admin), speil tilbake til feltet
    window.addEventListener('storage', (e) => {
      if ((e.key||'') === 'BRYT_DRIVER') {
        const v = String(e.newValue || '').trim();
        if (v && input.value !== v) input.value = v;
        saveAll(v);
      }
    });

    // Sørg for at vi har lagret en verdi ved last (om det finnes noe)
    if (cur) saveAll(cur);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
