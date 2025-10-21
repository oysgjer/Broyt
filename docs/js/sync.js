// js/sync.js
(() => {
  'use strict';

  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';      // fører + utstyr + autoNav + dir
  const K_ADDRS    = 'BRYT_ADDRS';         // cache av adresser fra JSONBin
  const K_STATUS   = 'BRYT_STATUS_V2';     // status per addr × mode × round
  const K_ROUNDS   = 'BRYT_ROUNDS';        // { snow:{n:1}, grit:{n:1}, lastDate:"YYYY-MM-DD" }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  // ---------- Konfig ----------
  const Sync = {
    _cfg: null,       // { binId, apiKey }
    _cache: { addrs: null },
    setConfig({ binId, apiKey }) { this._cfg = { binId, apiKey }; }
  };

  // ---------- JSONBin: hent adresser ----------
  Sync.loadAddresses = async function({ force=false } = {}) {
    // cache hvis finnes og ikke force
    if (!force) {
      const cached = readJSON(K_ADDRS, null);
      if (cached && Array.isArray(cached)) {
        this._cache.addrs = cached;
        return cached;
      }
    }
    if (!this._cfg) throw new Error('Sync ikke konfigurert (binId/apiKey).');

    const { binId, apiKey } = this._cfg;
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers: { 'X-Master-Key': apiKey } });
    if (!res.ok) throw new Error(`Henting av adresser feilet (${res.status})`);

    const js = await res.json();
    // Forvent at js.record.snapshot.addresses er en liste
    const list = Array.isArray(js?.record?.snapshot?.addresses) ? js.record.snapshot.addresses : [];
    writeJSON(K_ADDRS, list);
    this._cache.addrs = list;
    return list;
  };

  // ---------- Runder ----------
  function loadRounds() {
    const r = readJSON(K_ROUNDS, { snow:{n:1}, grit:{n:1}, lastDate: todayStr() });
    // Nullstill telleverk ved nytt døgn (enkel policy)
    const td = todayStr();
    if (r.lastDate !== td) {
      r.lastDate = td;
      // beholder rundenummer hvis dere ønsker — ellers sett til 1
      // r.snow.n = 1; r.grit.n = 1;
    }
    return r;
  }
  function saveRounds(r) { writeJSON(K_ROUNDS, r); }

  Sync.currentRound = function(mode) {
    const r = loadRounds();
    return (mode === 'grit') ? (r.grit?.n || 1) : (r.snow?.n || 1);
  };
  Sync.incrementRound = function(mode) {
    const r = loadRounds();
    if (mode === 'grit') r.grit = { n: (r.grit?.n || 1) + 1 };
    else r.snow = { n: (r.snow?.n || 1) + 1 };
    saveRounds(r);
  };
  Sync.setRound = function(mode, n) {
    const r = loadRounds();
    if (mode === 'grit') r.grit = { n: Number(n)||1 };
    else r.snow = { n: Number(n)||1 };
    saveRounds(r);
  };
  Sync.readRounds = function(){ return loadRounds(); };

  // ---------- Status V2: per addr × mode × round ----------
  // Struktur:
  // {
  //   "Adresse 1": {
  //      snow: { "1": {state, driver, startedAt, finishedAt}, "2": {...} },
  //      grit: { "1": {...} }
  //   },
  //   ...
  // }
  function loadStatus() { return readJSON(K_STATUS, {}); }
  function saveStatus(s) { writeJSON(K_STATUS, s); }

  Sync.getStatus = function(){ return loadStatus(); };

  Sync.getAddressStatus = function(addrName, mode, round) {
    const s = loadStatus();
    const a = s[addrName] || {};
    const bucket = (mode === 'grit') ? (a.grit || {}) : (a.snow || {});
    const rec = bucket[String(round)] || null;
    return rec;
  };

  Sync.setAddressStatus = function(addrName, mode, round, patch) {
    const s = loadStatus();
    if (!s[addrName]) s[addrName] = {};
    if (mode === 'grit') {
      if (!s[addrName].grit) s[addrName].grit = {};
      s[addrName].grit[String(round)] = { ...(s[addrName].grit[String(round)] || {}), ...patch };
    } else {
      if (!s[addrName].snow) s[addrName].snow = {};
      s[addrName].snow[String(round)] = { ...(s[addrName].snow[String(round)] || {}), ...patch };
    }
    saveStatus(s);
  };

  // Nullstill
  Sync.resetMine = function(mode, round, driverName) {
    const s = loadStatus();
    const key = (mode === 'grit') ? 'grit' : 'snow';
    for (const [addr, val] of Object.entries(s)) {
      const bucket = val[key] || {};
      const rec = bucket[String(round)];
      if (rec && rec.driver === driverName) {
        bucket[String(round)] = { state: 'not_started' };
      }
    }
    saveStatus(s);
  };
  Sync.resetAll = function(mode, round) {
    const s = loadStatus();
    const key = (mode === 'grit') ? 'grit' : 'snow';
    for (const [addr, val] of Object.entries(s)) {
      if (!val[key]) continue;
      if (val[key][String(round)]) val[key][String(round)] = { state: 'not_started' };
    }
    saveStatus(s);
  };

  // ---------- Admin (konfig) ----------
  Sync.saveAdminConfig = async function (data) {
    if (!this._cfg) throw new Error('Sync ikke initialisert');
    const { binId, apiKey } = this._cfg;
    const url = `https://api.jsonbin.io/v3/b/${binId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Feil ved lagring (' + res.status + ')');
    return await res.json();
  };
  Sync.loadAdminConfig = async function () {
    if (!this._cfg) throw new Error('Sync ikke initialisert');
    const { binId, apiKey } = this._cfg;
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers: { 'X-Master-Key': apiKey } });
    if (!res.ok) throw new Error('Feil ved lasting (' + res.status + ')');
    const js = await res.json();
    return js.record;
  };

  // ---------- Eksponer ----------
  window.Sync = Sync;
})();