// docs/js/autonav_settings.js — nøytral
// Hvis du tidligere lagret en preferanse for auto-navigasjon, lar vi den være i storage,
// men vi trigget ikke automatisk noen web-URL lenger. Work.js åpner kun Google Maps-APP.
(function(){
  'use strict';
  const KEY_START_KART = 'start_kart_on_start';
  // Bevar bare kryss av/lagring hvis du bruker "Start Brøytekart" – den åpner eget kart.html i ny fane.
  window.addEventListener('DOMContentLoaded', () => {
    const chk = document.getElementById('a_startKart');
    if (!chk) return;
    const saved = localStorage.getItem(KEY_START_KART);
    chk.checked = saved === 'true';
    chk.addEventListener('change', () => {
      localStorage.setItem(KEY_START_KART, String(chk.checked));
    });
  });
})();