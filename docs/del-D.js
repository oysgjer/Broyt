/* ===== del-D.js (Hybrid Sync for flere sjåfører) ===== */
(() => {
  if (!window.Core) { console.error("del-D.js: Core mangler"); return; }
  const C = window.Core;

  // ---- Hjelpere ----
  const keyOf = (s) => (s?.n || "").trim().toLowerCase();
  const seasonKey = C.seasonKey;

  function hasPinsThisSeason(s) {
    const y = String(s?.pinsLockedYear || "");
    return y && y === seasonKey();
  }

  // Flettestandard:
  // - navn/oppgave beholdes
  // - f/b: OR (hvis noen har satt true, blir true)
  // - started: minste (eldste start)
  // - finished: største (seneste slutt)
  // - p (bilder): union
  // - details: lengste tekst
  // - twoDriverRec: OR
  // - pins: låses 1 gang per sesong (første registrering vinner)
  function mergeStops(remoteArr = [], localArr = []) {
    const map = new Map();
    const clone = (o) => JSON.parse(JSON.stringify(o || {}));
    const season = seasonKey();

    const addAll = (arr) => (arr || []).forEach((s) => {
      const k = keyOf(s);
      const cur = map.get(k);
      if (!cur) {
        map.set(k, clone(s));
      } else {
        const m = cur, a = s;
        // Metadata
        m.n = m.n || a.n;
        m.t = m.t || a.t;

        // Status
        m.f = !!(m.f || a.f);
        m.b = !!(m.b || a.b);

        // Tidsstempler
        const minStart = Math.min(m.started ?? Infinity, a.started ?? Infinity);
        m.started = Number.isFinite(minStart) ? minStart : null;
        const maxFin = Math.max(m.finished || 0, a.finished || 0);
        m.finished = maxFin || null;

        // Bilder
        const pset = new Set([...(m.p || []), ...(a.p || [])]);
        m.p = Array.from(pset);

        // Details / 2 sjåfører
        if ((a.details || "").length > (m.details || "").length) m.details = a.details;
        m.twoDriverRec = !!(m.twoDriverRec || a.twoDriverRec);

        // Brøytestikker (låses 1 gang pr sesong)
        const mThis = String(m.pinsLockedYear) === season;
        const aThis = String(a.pinsLockedYear) === season;
        if (!mThis && aThis) {
          m.pinsLockedYear = a.pinsLockedYear;
          m.pinsCount = a.pinsCount || 0;
        }
        if (m.pinsCount == null) m.pinsCount = 0;
      }
    });

    addAll(remoteArr);
    addAll(localArr);
    return Array.from(map.values());
  }

  function normalizeStop(s) {
    return {
      n: s.n,
      t: s.t,
      f: !!s.f,
      b: !!s.b,
      p: Array.isArray(s.p) ? s.p : [],
      started: s.started || null,
      finished: s.finished || null,
      details: s.details || "",
      twoDriverRec: !!s.twoDriverRec,
      pinsCount: s.pinsCount || 0,
      pinsLockedYear: s.pinsLockedYear || null
    };
  }

  // ---- Pull (hent fra sky) ----
  async function syncPull() {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.MASTER}/latest`, {
        headers: C.headers()
      });
      const js = await r.json();
      const arr = (js?.record?.stops || []).map(normalizeStop);

      if (arr.length) {
        // Flett sky (remote) med lokalt (for sikkerhet)
        const merged = mergeStops(arr, C.state.stops || []);
        C.state.stops = merged;
        C.state.lastSyncAt = Date.now();
        C.state.lastSyncBy = C.displayName();
        C.save();
        console.log("syncPull OK", merged.length);
      } else {
        console.log("syncPull: tomt");
      }
      return true;
    } catch (e) {
      console.warn("syncPull FEIL", e);
      return false;
    }
  }

  // ---- Push (lagre til sky) ----
  async function syncPush() {
    try {
      // Hent siste versjon først
      const latest = await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.MASTER}/latest`, {
        headers: C.headers()
      }).then(r => r.json()).catch(() => null);
      const remoteStops = (latest?.record?.stops || []).map(normalizeStop);

      // Flett remote + local
      const merged = mergeStops(remoteStops, C.state.stops || []);

      // Skyv opp
      const payload = {
        version: C.cfg.VERSION,
        updated: Date.now(),
        lastSyncAt: Date.now(),
        lastSyncBy: C.displayName(),
        stops: merged,
        meta: { role: C.state.role, direction: C.state.direction }
      };
      const r = await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.MASTER}`, {
        method: "PUT",
        headers: C.headers(),
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw 0;

      // Overtar flettet lokalt
      C.state.stops = merged;
      C.state.lastSyncAt = payload.lastSyncAt;
      C.state.lastSyncBy = payload.lastSyncBy;
      C.save();
      console.log("syncPush OK", merged.length);
      return true;
    } catch (e) {
      console.warn("syncPush FEIL", e);
      return false;
    }
  }

  // ---- Heartbeat (valgfritt): skyv periodisk for “nesten sanntid” ----
  let hb = null;
  function startHeartbeat() {
    if (hb) return;
    hb = setInterval(() => { syncPush().catch(()=>{}); }, 30000); // hver 30s
  }
  function stopHeartbeat() {
    if (hb) { clearInterval(hb); hb = null; }
  }

  // ---- Knappekroker som andre moduler kan kalle ----
  // Bruk disse fra “Under arbeid”-modulen:
  function markStarted(idx) {
    const s = C.state.stops?.[idx]; if (!s) return;
    s.started = s.started || Date.now();
    C.save();
    syncPush();
  }
  function markDone(idx) {
    const s = C.state.stops?.[idx]; if (!s) return;
    // spør kun om pinner hvis oppgaven inneholder brøytestikker og ikke låst denne sesongen
    const needsPins = /brøytestikker/i.test(s.t);
    const already = s.pinsLockedYear && String(s.pinsLockedYear) === seasonKey();
    if (needsPins && !already) {
      const v = prompt("Antall brøytestikker brukt (låses for sesongen):", "");
      if (v !== null) {
        const n = parseInt((v || "").trim() || "0", 10) || 0;
        s.pinsCount = n;
        s.pinsLockedYear = seasonKey();
      }
    }
    s.f = true;
    s.b = false;
    s.finished = Date.now();
    C.save();
    syncPush();
  }
  function markBlocked(idx) {
    const s = C.state.stops?.[idx]; if (!s) return;
    const note = prompt("Hvorfor ikke mulig?", "") || "";
    s.details = note;
    s.b = true;
    s.f = false;
    s.finished = Date.now();
    C.save();
    syncPush();
  }
  function clearAllLocal() {
    (C.state.stops || []).forEach(s => { s.f = false; s.b = false; s.started = null; s.finished = null; });
    C.state.ui = C.state.ui || {};
    C.state.ui.cursor = 0;
    C.save();
  }

  // ---- Eksporter API ----
  window.SYNC = {
    syncPull,
    syncPush,
    startHeartbeat,
    stopHeartbeat,
    // knappekroker
    markStarted, markDone, markBlocked, clearAllLocal,
    // for testing
    _mergeStops: mergeStops
  };

  console.log("del-D.js (Hybrid Sync) klar");
})();