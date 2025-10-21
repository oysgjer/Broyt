/* ---------------------------------------------------------
   sync.js — Datasjikt (lokal + JSONBin når konfigurert)
--------------------------------------------------------- */
(function () {
  const KEY_STATE = 'BRYT_STATE';
  const KEY_BAG   = 'BRYT_STATUS';
  const KEY_CFG   = 'BRYT_SETTINGS'; // her ligger også destinasjoner og ev. JSONBin

  // (1) JSONBin-oppsett: fyll inn via Admin senere (lagres i localStorage)
  //  Vi støtter to måter:
  //  a) I localStorage under BRYT_SETTINGS: { jsonbin: { binId, apiKey } }
  //  b) Hardkoding her (la stå tomt om du ikke vil)
  const HARDCODED_JSONBIN = {
    binId: '',           // f.eks. '66f0...'
    apiKey: ''           // '...'
  };

  // (2) Lokal seed — fallback
  const SEED_ADDRESSES = [
    { id: 1, name: 'Tunlandvegen',   task: 'Sand/Grus' },
    { id: 2, name: 'Sessvollvegen 9', task: 'Skjær' },
    { id: 3, name: 'Granlivegen 12',  task: 'Fres' },
    { id: 4, name: 'Enebakkveien 87', task: 'Skjær' },
  ];

  // ---------- Local storage ----------
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
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(KEY_CFG) || '{}'); }
    catch { return {}; }
  }
  function saveSettings(st) {
    localStorage.setItem(KEY_CFG, JSON.stringify(st || {}));
  }

  // ---------- JSONBin helpers ----------
  function getJsonBinCfg() {
    const st = loadSettings();
    const cfg = (st.jsonbin || {});
    const binId = cfg.binId || HARDCODED_JSONBIN.binId;
    const apiKey = cfg.apiKey || HARDCODED_JSONBIN.apiKey;
    if (binId && apiKey) {
      return { binId, apiKey };
    }
    return null;
  }

  async function fetchAddressesFromJsonBin() {
    const c = getJsonBinCfg();
    if (!c) return null;
    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(c.binId)}/latest`;
    const res = await fetch(url, { headers: { 'X-Master-Key': c.apiKey } });
    if (!res.ok) throw new Error('JSONBin GET feilet: ' + res.status);
    const data = await res.json();
    // vi forventer at data.record er en array av adresser
    const rec = data && data.record;
    if (!Array.isArray(rec)) return null;
    // normaliser
    return rec.map((x, i) => ({
      id: Number(x.id ?? i + 1),
      name: String(x.name ?? x.adresse ?? 'Ukjent'),
      task: String(x.task ?? x.oppgave ?? 'Skjær')
    }));
  }

  // ---------- Seeding ----------
  async function ensureAddressesSeeded() {
    let s = loadState();
    if (Array.isArray(s.addresses) && s.addresses.length > 0) {
      return (window.S = s);
    }
    // prøv JSONBin
    try {
      const remote = await fetchAddressesFromJsonBin();
      if (remote && remote.length) {
        s.addresses = remote;
      } else {
        s.addresses = SEED_ADDRESSES.slice();
      }
    } catch {
      s.addresses = SEED_ADDRESSES.slice();
    }
    s.idx = 0;
    s.started = false;
    saveState(s);
    return (window.S = s);
  }

  function getNowNext() {
    const s = loadState();
    const total = Array.isArray(s.addresses) ? s.addresses.length : 0;
    const i = Math.min(Math.max(Number(s.idx || 0), 0), Math.max(total - 1, 0));
    const now  = total ? s.addresses[i] : null;
    const next = total && i + 1 < total ? s.addresses[i + 1] : null;
    return { s, now, next, total, idx: i };
  }

  // ---------- Cloud sync (mock) ----------
  async function refreshCloud() { return true; }

  // ---------- Exports ----------
  window.ensureAddressesSeeded = ensureAddressesSeeded;
  window.loadState   = loadState;
  window.saveState   = saveState;
  window.statusStore = loadBag;
  window.saveStatus  = saveBag;
  window.getNowNext  = getNowNext;
  window.refreshCloud= refreshCloud;
  window.loadSettings= loadSettings;
  window.saveSettings= saveSettings;

  // Pre-init
  ensureAddressesSeeded().catch(()=>{ /* offline fallback */ });
})();