/*! driver_mirror.js
 * Speiler sjåførnavn fra Hjem til Under arbeid uten å vise det i UI.
 * - Leser/lagrer LAST_DRIVER i localStorage
 * - Oppretter (om nødvendig) et skjult speil-element på Under arbeid: #work_driver_mirror[data-driver]
 * - Lytter på input-endringer i sjåførfeltet (Hjem) og oppdaterer speilet
 * Lastes trygt på alle sider (gjør ingenting om felt/områder ikke finnes).
 */
(function(){
  'use strict';

  function ensureMirror(){
    var mirror = document.getElementById('work_driver_mirror');
    if (!mirror) {
      var host = document.querySelector('#work') || document.body;
      mirror = document.createElement('span');
      mirror.id = 'work_driver_mirror';
      mirror.hidden = true;
      mirror.setAttribute('data-driver', '');
      host.prepend(mirror);
    }
    return mirror;
  }

  function setDriverEverywhere(val){
    var v = (val || '').trim();
    try { localStorage.setItem('LAST_DRIVER', v); } catch {}
    var mirror = ensureMirror();
    mirror.setAttribute('data-driver', v);
  }

  function init(){
    // 1) sett speilet fra localStorage ved oppstart
    var cached = '';
    try { cached = localStorage.getItem('LAST_DRIVER') || ''; } catch {}
    setDriverEverywhere(cached);

    // 2) hvis Hjem har sjåførfelt – synkroniser løpende
    var drvInput = document.querySelector('#home input[type="text"], input[name="driver"], #driver, #sjafor, #sjåfør');
    if (drvInput) {
      if (!drvInput.value && cached) drvInput.value = cached;
      setDriverEverywhere(drvInput.value);

      ['input','change','blur'].forEach(function(evt){
        drvInput.addEventListener(evt, function(){ setDriverEverywhere(drvInput.value); }, {passive:true});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
