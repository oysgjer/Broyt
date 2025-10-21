// js/sync.js
// Minimal JSONbin-klient + caching til localStorage
(() => {
  'use strict';

  const LS_ADDR = 'BRYT_ADDR';        // hvor vi cache’r adresser
  const LS_SYNC_AT = 'BRYT_ADDR_AT';  // tidspunkt for sist vellykket sync (ms)

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // 1) KONFIG – SETT DISSE TO!
  //    BIN-ID og API-nøkkel kan endres her, eller via Sync.setConfig(...)
  let BIN_ID   = '68e7b4d2ae596e708f0bde7d';
  let API_KEY  = '$2a$10$luKLel7elCpJM4.REcwKOOsWlBK5Xv5lY2oN1BDYgbZbXA6ubT0W.';
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

  const BASE = 'https://api.jsonbin.io/v3/b';

  // Hjelpere
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  function ensureKey() {
    if (!API_KEY || API_KEY.startsWith('SETT_')) {
      throw new Error('JSONbin API-nøkkel mangler i js/sync.js (API_KEY).');
    }
    if (!BIN_ID) {
      throw new Error('JSONbin BIN_ID mangler i js/sync.js.');
    }
  }

  // Prøv å tolke retur fra JSONbin smidig:
  //  - Noen lagrer “{addresses:[...] }”, andre lagrer direkte “[ ... ]”
  function extractAddresses(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.record) {
      const r = payload.record;
      if (Array.isArray(r)) return r;
      if (Array.isArray(r.addresses)) return r.addresses;
      // siste utvei: prøv alle verdier og finn første array
      for (const k of Object.keys(r)) {
        if (Array.isArray(r[k])) return r[k];
      }
    }
    if (payload.addresses && Array.isArray(payload.addresses)) return payload.addresses;
    return [];
  }

  async function loadAddressesFromCloud({ force = false } = {}) {
    // Respekter cache om vi nylig har lastet (f.eks. < 2 min)
    const last = Number(localStorage.getItem(LS_SYNC_AT) || 0);
    if (!force && Date.now() - last < 2 * 60 * 1000) {
      return readJSON(LS_ADDR, []);
    }

    ensureKey();

    const url = `${BASE}/${encodeURIComponent(BIN_ID)}/latest`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`JSONbin GET feilet: ${res.status} ${res.statusText}`);
    }

    const payload = await res.json();
    const addresses = extractAddresses(payload);

    if (!Array.isArray(addresses)) {
      throw new Error('Uventet format på JSONbin-data. Forventer en liste med adresser.');
    }

    writeJSON(LS_ADDR, addresses);
    localStorage.setItem(LS_SYNC_AT, String(Date.now()));

    return addresses;
  }

  // Eksporter et lite API globalt
  window.Sync = {
    setConfig({ binId, apiKey } = {}) {
      if (binId) BIN_ID = binId;
      if (apiKey) API_KEY = apiKey;
    },
    async loadAddresses(options) {
      return loadAddressesFromCloud(options);
    },
    getCachedAddresses() {
      return readJSON(LS_ADDR, []);
    }
  };
})();
