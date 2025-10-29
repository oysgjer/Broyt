// js/boot.js
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Kunne ikke laste: ' + src));
      document.head.appendChild(el);
    });
  }

  async function ensureSyncLoaded() {
    // Hvis Sync allerede er der – fint.
    if (window.Sync && typeof window.Sync.loadAddresses === 'function') return true;

    // Forsøk å laste fra standard sti, med cache-buster.
    const candidates = [
      'js/sync.js?v=20251021a',
      'js/sync.js'
    ];

    for (const src of candidates) {
      try {
        await loadScript(src);
        if (window.Sync && typeof window.Sync.loadAddresses === 'function') {
          return true;
        }
      } catch (_) {/* prøv neste */}
    }
    return false;
  }

  function wireDrawer() {
    const drawer = $('#drawer');
    const scrim  = $('#scrim');
    const btn    = $('#btnMenu');
    const btnX   = $('#btnCloseDrawer');

    if (!drawer || !scrim) return;

    const open = () => {
      drawer.classList.add('open');
      scrim.classList.add('show');
    };
    const close = () => {
      drawer.classList.remove('open');
      scrim.classList.remove('show');
    };

    btn   && btn.addEventListener('click', open);
    btnX  && btnX.addEventListener('click', close);
    scrim && scrim.addEventListener('click', close);

    // Navigasjon via lenker i menyen
    document.querySelectorAll('.drawer-link').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.dataset.go;
        if (id) location.hash = '#' + id;
        close();
      });
    });

    // iOS: sørg for riktig z-index
    drawer.style.zIndex = '10002';
    scrim.style.zIndex  = '10001';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // 1) Koble meny uansett
    wireDrawer();

    // 2) Last Sync på en robust måte (motvirker cache/lasterekkefølge)
    const ok = await ensureSyncLoaded();
    window.__syncReady = ok; // enkel flagg om du vil sjekke i andre filer
  });
})();