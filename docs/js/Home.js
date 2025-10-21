/* ---------------------------------------------------------
   Home.js
   Leser inputs, lagrer state og starter runde.
--------------------------------------------------------- */
(function () {
  const $  = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  function readHomeForm() {
    return {
      driver: $('#a_driver')?.value?.trim() || '',
      equipment: {
        plow:  $('#a_eq_plow')?.checked || false,
        fres:  $('#a_eq_fres')?.checked || false,
        sand:  $('#a_eq_sand')?.checked || false,
      },
      order:   $('#a_dir')?.value || 'Normal',
      autoNav: $('#a_autoNav')?.checked || false,
    };
  }

  function startRound() {
    try {
      // Sikre seed + last eksisterende state
      const s  = window.ensureAddressesSeeded ? ensureAddressesSeeded() : (window.S || {});
      const fm = readHomeForm();

      // Oppdater state
      s.driver    = fm.driver;
      s.equipment = fm.equipment;
      s.order     = fm.order;
      s.autoNav   = fm.autoNav;
      s.idx       = 0;          // start på første adresse
      s.started   = true;

      window.saveState && saveState(s);
      window.S = s;

      // Klargjør data og gå til “work”
      window.refreshCloud && refreshCloud().catch(()=>{ /* ignorer offline */ });
      if (window.showPage) showPage('work');
      else location.hash = '#work';
    } catch (e) {
      alert('Kunne ikke starte runde: ' + e.message);
      console.error(e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Fyll inn eventuelle tidligere verdier
    const s = window.loadState ? loadState() : {};
    if (s.driver) $('#a_driver') && ($('#a_driver').value = s.driver);
    if (s.equipment) {
      $('#a_eq_plow') && ($('#a_eq_plow').checked = !!s.equipment.plow);
      $('#a_eq_fres') && ($('#a_eq_fres').checked = !!s.equipment.fres);
      $('#a_eq_sand') && ($('#a_eq_sand').checked = !!s.equipment.sand);
    }
    if (s.order)   $('#a_dir') && ($('#a_dir').value = s.order);
    if (s.autoNav) $('#a_autoNav') && ($('#a_autoNav').checked = !!s.autoNav);

    $('#a_start')?.addEventListener('click', startRound);
  });
})();