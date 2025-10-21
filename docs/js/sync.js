// docs/js/sync.js
(() => {
  "use strict";

  const CFG_KEY = "BRYT_SETTINGS";

  const qs = (s, r = document) => r.querySelector(s);

  const STATE = {
    online: "unknown",           // "ok" | "err" | "unknown"
    addresses: [],               // Array<{ id,name,lat,lon,... }>
    status: {},                  // { [addrId]: { state, driver, ts } }
    pollHandle: null,
    listeners: new Set()
  };

  function readCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); }
    catch { return {}; }
  }
  function writeCfg(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  // -------- badge (synk) ----------
  function setSyncBadge(state) {
    const el = qs("#sync_badge");
    if (!el) return;
    if (state === "ok") {
      el.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`;
    } else if (state === "err") {
      el.innerHTML = `<span class="dot dot-err"></span> Synk: feil`;
    } else {
      el.innerHTML = `<span class="dot dot-unknown"></span> Synk: ukjent`;
    }
  }

  // -------- helpers ----------
  function jsonbinHeaders(apiKey) {
    const h = {
      "Content-Type": "application/json",
      "X-Bin-Meta": "false"
    };
    if (apiKey) h["X-Master-Key"] = apiKey;
    return h;
  }

  async function binGetLatest(binId, apiKey) {
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers: jsonbinHeaders(apiKey) });
    if (!res.ok) throw new Error(`GET latest ${binId} ${res.status}`);
    return res.json();
  }

  async function binPut(binId, apiKey, record) {
    const url = `https://api.jsonbin.io/v3/b/${binId}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: jsonbinHeaders(apiKey),
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error(`PUT ${binId} ${res.status}`);
    return res.json();
  }

  // -------- public-ish core ----------
  async function loadAddresses() {
    const cfg = readCfg();
    if (!cfg.binAddresses) throw new Error("Mangler Bin ID for adresser (Admin).");
    const data = await binGetLatest(cfg.binAddresses, cfg.apiKey);
    // JSONBin v3: {record: ...}
    const rec = data?.record ?? data ?? [];
    // Flex: enten {addresses:[...]} eller [...]
    STATE.addresses = Array.isArray(rec) ? rec : (rec.addresses || []);
    return STATE.addresses;
  }

  async function loadStatus() {
    const cfg = readCfg();
    if (!cfg.binStatus) {
      // ingen status-bin: start som tom
      STATE.status = {};
      return STATE.status;
    }
    const data = await binGetLatest(cfg.binStatus, cfg.apiKey);
    const rec = data?.record ?? data ?? {};
    STATE.status = rec || {};
    return STATE.status;
  }

  async function saveStatusMap(newMap) {
    const cfg = readCfg();
    if (!cfg.binStatus) throw new Error("Mangler Bin ID for status (Admin).");
    await binPut(cfg.binStatus, cfg.apiKey, newMap);
    STATE.status = newMap;
    notify();
  }

  function getAddresses() { return STATE.addresses; }
  function getStatusMap() { return STATE.status; }

  function ensureStatusShape() {
    // sørg for at alle adresser har en node (minst "venter")
    const map = { ...(STATE.status || {}) };
    for (const a of STATE.addresses) {
      const id = (a.id ?? a.ID ?? a.Id ?? a.name ?? String(a.index));
      if (!map[id]) {
        map[id] = { state: "venter", driver: "", ts: Date.now() };
      }
    }
    return map;
  }

  async function setStatus(addrId, updates) {
    const map = ensureStatusShape();
    const prev = map[addrId] || { state: "venter", driver: "", ts: Date.now() };
    map[addrId] = { ...prev, ...updates, ts: Date.now() };
    await saveStatusMap(map);
  }

  function notify() {
    for (const fn of STATE.listeners) {
      try { fn({ addresses: STATE.addresses, status: STATE.status }); } catch {}
    }
  }

  function on(cb)  { STATE.listeners.add(cb); }
  function off(cb) { STATE.listeners.delete(cb); }

  async function fullReload() {
    try {
      await loadAddresses();
      await loadStatus();
      STATE.online = "ok";
      setSyncBadge("ok");
      notify();
    } catch (e) {
      console.error("Synk feil:", e);
      STATE.online = "err";
      setSyncBadge("err");
    }
  }

  function startPolling() {
    if (STATE.pollHandle) clearInterval(STATE.pollHandle);
    STATE.pollHandle = setInterval(async () => {
      try {
        await loadStatus(); // lett polling – status er det som endrer seg
        STATE.online = "ok";
        setSyncBadge("ok");
        notify();
      } catch (e) {
        console.warn("Polling-feil:", e);
        STATE.online = "err";
        setSyncBadge("err");
      }
    }, 15000);
  }

  async function init() {
    setSyncBadge("unknown");
    await fullReload();
    startPolling();
  }

  // eksponer for resten av appen
  window.Sync = {
    init,
    reload: fullReload,
    on, off,
    getAddresses,
    getStatusMap,
    setStatus,
    readCfg,
    writeCfg
  };

  // auto-init når DOM er klar
  document.addEventListener("DOMContentLoaded", () => {
    // init bare hvis Admin har satt minst addresses-bin
    const cfg = readCfg();
    if (cfg?.binAddresses) init();
  });
})();