// js/sync-waiter.js
(() => {
  'use strict';
  async function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

  // Venter på at window.Sync skal finnes – eller på window.SyncReady (dersom sync.js eksporterer en promise)
  async function getSync(maxMs = 3000){
    if (window.Sync) return window.Sync;
    if (window.SyncReady && typeof window.SyncReady.then === 'function'){
      try { const s = await window.SyncReady; if (s) return s; } catch {}
    }
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline){
      if (window.Sync) return window.Sync;
      await wait(50);
    }
    throw new Error('Sync-modulen er ikke tilgjengelig (mangler js/sync.js eller laster ikke).');
  }

  window.getSync = getSync; // gjør tilgjengelig for Home/Work/Status/Service
})();