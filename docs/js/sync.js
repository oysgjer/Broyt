/* ---------------------------------------------------------
   sync.js
   Lokal «sky»-modell med eksporterte hjelpere.
   Bytt senere implementasjonene til ekte JSONBin-kall.
--------------------------------------------------------- */
(function () {
  const KEY_STATE = 'BRYT_STATE';
  const KEY_BAG   = 'BRYT_STATUS';

  // En liten, fast seed-liste – bytt ut med JSONBin senere
  const SEED_ADDRESSES = [
    { id: 1, name: 'Tunlandvegen', task: 'Sand/Grus' },
    { id: 2, name: 'Sessvollvegen 9', task: 'Skjær' },
    { id: 3, name: 'Granlivegen 12', task: 'Fres' },
    { id: 4, name: 'Enebakkveien 87', task: 'Skjær' },
  ];

  // ---- Local storage helpers ----
  function loadState() {
    try { return JSON.parse(localStorage.getItem(KEY_STATE) || '{}'); }
    catch { return {}; }
  }
  function saveState(s) {
    localStorage.setItem(KEY_STATE, JSON.stringify(s || {}));
  }
  function loadBag() {
    try { return JSON.parse(localStorage.getItem(KEY_BAG) || '{}'); }
    catch { return {}; }
  }
  function saveBag(b) {
    localStorage.setItem(KEY_BAG, JSON.stringify(b || {}));
  }

  // ---- Seeding / init ----
  function ensureAddressesSeeded() {
    const s = loadState();
    if (!Array.isArray(s.addresses) || s.addresses.length === 0) {
      s.addresses = SEED_ADDRESSES.slice();
      s.idx = 0;                 // peker på "nå"-adresse
      s.started = false;
      saveState(s);
    }
    return s;
  }

  // ---- Avlesning av nå/neste ----
  function getNowNext() {
    const s = ensureAddressesSeeded();
    const total = s.addresses.length || 0;
    const idx = Math.min(Math.max(Number(s.idx || 0), 0), Math.max(total - 1, 0));
    const now  = total ? s.addresses[idx] : null;
    const next = total && idx + 1 < total ? s.addresses[idx + 1] : null;
    return { s, now, next, total, idx };
  }

  // ---- Status-store (per adresse) ----
  // Struktur: bag[addressId] = { state: "todo|doing|done|skip|blocked", driver: "Øystein" }
  function statusStore() { return loadBag(); }

  // ---- «Sky»-oppdatering (lokal mock) ----
  async function refreshCloud() {
    // Her kunne vi GET/PUT mot JSONBin. Nå bare no-op for stabilitet.
    return true;
  }

  // ---- Eksporter alt på window ----
  window.ensureAddressesSeeded = ensureAddressesSeeded;
  window.statusStore           = statusStore;
  window.refreshCloud          = refreshCloud;
  window.loadState             = loadState;
  window.saveState             = saveState;
  window.getNowNext            = getNowNext;

  // Init én gang slik at S finnes for andre filer (valgfritt)
  window.S = ensureAddressesSeeded();
})();