/*! auto_logger.js – DEAKTIVERT
 *  Denne filen er nå slått av for å unngå dobbelt-logging.
 *  All logging håndteres av work_log_start_done.js og Status/Logg-koden.
 *  Vi beholder en minimal IIFE for å ikke få feil på skriptreferanser.
 */
(function () {
  'use strict';

  // Nøkkel som den gamle loggeren brukte til å buffre hendelser lokalt
  var QKEY = 'AUTOLOG_QUEUE';

  // Rydd opp i eventuell gammel kø slik at den ikke dyttes til JSONbin senere
  try {
    localStorage.removeItem(QKEY);
  } catch (e) {
    // Ignorer
  }

  // Ingen flere event-listeners, ingen oppkobling mot JSONbin.
  // Filen er kun her for kompatibilitet.
})();