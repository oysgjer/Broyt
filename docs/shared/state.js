/* ===================================================================
   Broyt – felles state (ingen nettverkskall her)
   Brukes av del-A (Hjem), del-B (Under arbeid), del-… osv.
   =================================================================== */

(function (global) {
  const LS_KEYS = {
    PREFS:  'broyt:prefs',         // { driver:{name,direction,equipment}, lastJob }
    ROUND:  'broyt:currentRound',  // { number, startedAt, endedAt?, job, driver }
    SEASON: 'broyt:season'         // "YYYY-YY" (starter i august)
  };

  // ---------- Sesong ----------
  function defaultSeason() {
    const now = new Date();
    const startYear = (now.getMonth() >= 7) ? now.getFullYear() : now.getFullYear() - 1; // aug-start
    return `${startYear}-${String(startYear + 1).slice(2)}`; // f.eks. 2025-26
  }
  function getSeason() {
    return localStorage.getItem(LS_KEYS.SEASON) || setSeason(defaultSeason());
  }
  function setSeason(seasonStr) {
    localStorage.setItem(LS_KEYS.SEASON, seasonStr);
    emit('season:changed', seasonStr);
    return seasonStr;
  }
  function startNewSeason() {
    const cur = getSeason();
    const [y] = cur.split('-');
    const nextStart = parseInt(y, 10) + 1;
    return setSeason(`${nextStart}-${String(nextStart + 1).slice(2)}`);
  }

  // ---------- Prefs (fører, retning, utstyr, sist valgt oppdragstype) ----------
  function getPrefs() {
    try {
      const raw = localStorage.getItem(LS_KEYS.PREFS);
      if (!raw) return {
        driver: {
          name: '',
          direction: 'Normal',
          equipment: { plow:false, fres:false, sand:false }
        },
        lastJob: 'SNØ' // 'SNØ' | 'GRUS'
      };
      const p = JSON.parse(raw);
      // sane defaults
      p.driver = p.driver || {};
      p.driver.direction = p.driver.direction || 'Normal';
      p.driver.equipment = Object.assign({ plow:false, fres:false, sand:false }, p.driver.equipment || {});
      p.lastJob = (p.lastJob === 'GRUS') ? 'GRUS' : 'SNØ';
      return p;
    } catch {
      return {
        driver: {
          name: '',
          direction: 'Normal',
          equipment: { plow:false, fres:false, sand:false }
        },
        lastJob: 'SNØ'
      };
    }
  }

  function setPrefs(next) {
    const cur = getPrefs();
    const merged = {
      driver: {
        name: (next.driver?.name ?? cur.driver.name).trim(),
        direction: next.driver?.direction || cur.driver.direction || 'Normal',
        equipment: Object.assign({}, cur.driver.equipment, next.driver?.equipment || {})
      },
      lastJob: next.lastJob || cur.lastJob || 'SNØ'
    };
    localStorage.setItem(LS_KEYS.PREFS, JSON.stringify(merged));
    emit('prefs:changed', merged);
    return merged;
  }

  // ---------- Runde ----------
  function getRound() {
    try {
      const raw = localStorage.getItem(LS_KEYS.ROUND);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function startRound(opts) {
    // opts: { driver?, job? } – alt valgfritt; fyller fra prefs
    const prefs = getPrefs();
    const prev = getRound();
    const number = (prev?.number || 0) + 1;

    const round = {
      number,
      startedAt: Date.now(),
      job: (opts?.job || prefs.lastJob || 'SNØ'), // 'SNØ' | 'GRUS'
      driver: {
        name: opts?.driver?.name ?? prefs.driver.name ?? '',
        direction: opts?.driver?.direction ?? prefs.driver.direction ?? 'Normal',
        equipment: Object.assign(
          { plow:false, fres:false, sand:false },
          prefs.driver.equipment,
          opts?.driver?.equipment || {}
        )
      }
    };

    localStorage.setItem(LS_KEYS.ROUND, JSON.stringify(round));
    emit('round:started', round);
    return round;
  }

  function endRound(extra = {}) {
    const cur = getRound();
    if (!cur) return null;
    const ended = Object.assign({}, cur, { endedAt: Date.now() }, extra || {});
    localStorage.setItem(LS_KEYS.ROUND, JSON.stringify(ended));
    emit('round:ended', ended);
    return ended;
  }

  // ---------- Event-bus (lett) ----------
  const listeners = {};
  function on(event, handler) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(handler);
    return () => off(event, handler);
  }
  function off(event, handler) {
    listeners[event] = (listeners[event] || []).filter(h => h !== handler);
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach(h => {
      try { h(payload); } catch {}
    });
    // i tillegg publiserer vi som DOM CustomEvent for enkel integrasjon
    try { window.dispatchEvent(new CustomEvent(event, { detail: payload })); } catch {}
  }

  // ---------- Eksponer API ----------
  const api = {
    // sesong
    getSeason, setSeason, startNewSeason,
    // prefs
    getPrefs, setPrefs,
    // runde
    getRound, startRound, endRound,
    // events
    on, off
  };

  // global: window.BroytState
  global.BroytState = api;

  // init: sørg for at sesong er satt
  getSeason();

})(window);