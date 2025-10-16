/* ===================================================================
   Broyt – felles state (ingen nettverkskall her)
   =================================================================== */
(function (global) {
  const LS_KEYS = {
    PREFS:  'broyt:prefs',
    ROUND:  'broyt:currentRound',
    SEASON: 'broyt:season'
  };
  function defaultSeason() {
    const now = new Date();
    const startYear = (now.getMonth() >= 7) ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${String(startYear + 1).slice(2)}`;
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
  function getPrefs() {
    try {
      const raw = localStorage.getItem(LS_KEYS.PREFS);
      if (!raw) return {
        driver: { name:'', direction:'Normal', equipment:{ plow:false, fres:false, sand:false } },
        lastJob: 'SNØ'
      };
      const p = JSON.parse(raw);
      p.driver = p.driver || {};
      p.driver.direction = p.driver.direction || 'Normal';
      p.driver.equipment = Object.assign({ plow:false, fres:false, sand:false }, p.driver.equipment || {});
      p.lastJob = (p.lastJob === 'GRUS') ? 'GRUS' : 'SNØ';
      return p;
    } catch {
      return { driver:{ name:'', direction:'Normal', equipment:{ plow:false, fres:false, sand:false } }, lastJob:'SNØ' };
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
  function getRound() {
    try {
      const raw = localStorage.getItem(LS_KEYS.ROUND);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function startRound(opts) {
    const prefs = getPrefs();
    const prev = getRound();
    const number = (prev?.number || 0) + 1;
    const round = {
      number,
      startedAt: Date.now(),
      job: (opts?.job || prefs.lastJob || 'SNØ'),
      driver: {
        name: opts?.driver?.name ?? prefs.driver.name ?? '',
        direction: opts?.driver?.direction ?? prefs.driver.direction ?? 'Normal',
        equipment: Object.assign({ plow:false, fres:false, sand:false }, prefs.driver.equipment, opts?.driver?.equipment || {})
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
    (listeners[event] || []).forEach(h => { try { h(payload); } catch {} });
    try { window.dispatchEvent(new CustomEvent(event, { detail: payload })); } catch {}
  }
  global.BroytState = {
    getSeason, setSeason, startNewSeason,
    getPrefs, setPrefs,
    getRound, startRound, endRound,
    on, off
  };
  getSeason();
})(window);
