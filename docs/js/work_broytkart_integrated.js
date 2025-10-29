// work_broytkart_integrated.js
// Integrert fix: fjerner 'Kart'-knappen, flytter/styler 'Brøytekart', og sikrer riktig ikon og rekkefølge.
// Koden er selvstendig og kan lastes etter Work.js uten å endre Work.js direkte.

(function(){
  'use strict';

  function runFix(){
    try {
      // 1) Fjern (nye) Kart-knappen helt hvis den finnes
      const newMapBtn = document.getElementById('act_map');
      if (newMapBtn && newMapBtn.parentElement) {
        newMapBtn.parentElement.remove();
      }
    } catch(_) {}

    try {
      // 2) Finn Brøytekart-knappen (#btnBroytKart eller #btnMap)
      const broyt = document.querySelector('#btnBroytKart, #btnMap');
      const grid  = document.querySelector('#work .btn-grid');
      if (broyt && grid) {
        // Sett riktig tekst/ikon
        broyt.innerHTML = '🚜 Brøytekart';

        // Bruk samme base-klasse som øvrige knapper (for font/spacing)
        if (!broyt.classList.contains('btn')) broyt.classList.add('btn');

        // Hvis knappen ligger alene i en wrapper-div, flytt wrapperen
        const nodeToMove = (broyt.parentElement && broyt.parentElement.childElementCount === 1)
          ? broyt.parentElement : broyt;

        // Rydd eventuelle styles som kan gi overlapp
        broyt.style.removeProperty('position');
        broyt.style.width = '100%';
        broyt.style.setProperty('display','block','important');

        // Legg helt nederst i grid (slik at Uhell kommer over)
        if (nodeToMove.parentElement !== grid) grid.appendChild(nodeToMove);
        else grid.appendChild(nodeToMove); // tving sist
      }
    } catch(e){
      console.warn('Brøytekart fix:', e);
    }

    try {
      // 3) Sørg for at Uhell har riktig ikon/tekst (⚠️) – farge styres i CSS
      const inc = document.getElementById('act_incident');
      if (inc) inc.innerHTML = '⚠️ Uhell';
    } catch(_) {}
  }

  // Kjør når #work finnes og DOM er klar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runFix);
  } else {
    runFix();
  }

  // Kjør igjen når siden bytter seksjon (hvis appen bruker hash-nav)
  window.addEventListener('hashchange', () => {
    if (location.hash === '#work') setTimeout(runFix, 0);
  });
})();
