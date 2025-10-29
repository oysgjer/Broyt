/* quicklinks.js — åpner hurtigmål fra lagrede verdier eller spør */
(function () {
  function openUrl(u) {
    if (!u) return;
    try { window.open(u, '_blank'); } catch (_) { location.href = u; }
  }

  // Leser konfig fra localStorage (kan settes i Admin senere)
  function readCfg() {
    // Støtter enten full URL (Google Maps/Apple Maps) eller rene koordinater "lat,lon"
    return {
      grus:   localStorage.getItem('QK_GRUS')   || '',
      diesel: localStorage.getItem('QK_DIESEL') || '',
      base:   localStorage.getItem('QK_BASE')   || ''
    };
  }

  function toMapsUrl(v) {
    if (!v) return '';
    const s = v.trim();
    // Hvis dette allerede ser ut som en URL – bruk den direkte
    if (/^https?:\/\//i.test(s)) return s;
    // Hvis det ser ut som "lat,lon" – bygg Google Maps URL
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s)) {
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s);
    }
    // Som fallback: gjør et søk på teksten
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s);
  }

  function bind(btnId, keyName) {
    const btn = document.getElementById(btnId);
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      const cfg = readCfg();
      const raw = cfg[keyName];
      if (!raw) {
        alert('Mangler mål for "' + btn.textContent.trim() + '".\n' +
              'Legg inn i localStorage under nøkkel ' + '"QK_' + keyName.toUpperCase() + '"\n' +
              'Eksempel verdi: "60.3251, 11.2623" eller en Google Maps-lenke.');
        return;
      }
      openUrl(toMapsUrl(raw));
    });
  }

  function init() {
    bind('qk_grus',   'grus');
    bind('qk_diesel', 'diesel');
    bind('qk_base',   'base');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
