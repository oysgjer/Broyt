// Del-A (Hjem) – start runde m/ dato-bassert nummer og prefs
(function () {
  const $ = (s) => document.querySelector(s);

  const els = {
    driver: $('#a_driver'),
    dir:    document.querySelectorAll('input[name="a_dir"]'),
    eqPlow: $('#a_eq_plow'),
    eqFres: $('#a_eq_fres'),
    eqSand: $('#a_eq_sand'),
    job:    document.querySelectorAll('input[name="a_job"]'),
    theme:  $('#a_theme'),
    autoNav:$('#a_auto_nav'),
    start:  $('#a_start'),
    hint:   $('#a_hint'),
  };

  // last prefs
  const P = (window.BroytState?.getPrefs?.() || {});
  els.driver.value = P.driver?.name || '';
  (els.dir || []).forEach(r => { if (r.value === (P.driver?.direction || 'Normal')) r.checked = true; });
  els.eqPlow.checked = !!P.equipment?.plow;
  els.eqFres.checked = !!P.equipment?.fres;
  els.eqSand.checked = !!P.equipment?.sand;
  (els.job || []).forEach(r => { if (r.value === (P.lastJob || 'SNØ')) r.checked = true; });
  els.theme.value = P.theme || 'auto';
  els.autoNav.checked = !!P.autoNavNext;

  function savePrefs(extra={}) {
    const prefs = {
      driver: {
        name: els.driver.value.trim() || 'driver',
        direction: [...els.dir].find(r => r.checked)?.value || 'Normal',
      },
      equipment: {
        plow: !!els.eqPlow.checked,
        fres: !!els.eqFres.checked,
        sand: !!els.eqSand.checked,
      },
      lastJob: [...els.job].find(r => r.checked)?.value || 'SNØ',
      theme: els.theme.value || 'auto',
      autoNavNext: !!els.autoNav.checked,
      ...extra
    };
    window.BroytState?.setPrefs?.(prefs);
    try { window.applyTheme?.(prefs.theme); } catch {}
    return prefs;
  }

  // hjelpe: rundenr per dato
  const pad = (n) => String(n).padStart(2,'0');
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function dateLabel(ts) {
    const d = new Date(ts);
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${String(d.getFullYear()).slice(-2)}`;
  }
  function getRoundSeqForToday() {
    const key = 'broyt:roundsByDay';
    let map = {};
    try { map = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    const day = todayKey();
    const next = (map[day] || 0) + 1;
    map[day] = next;
    localStorage.setItem(key, JSON.stringify(map));
    return next; // 1,2,3...
  }

  els.theme.addEventListener('change', () => savePrefs());
  els.autoNav.addEventListener('change', () => savePrefs());

  // start runde
  els.start.addEventListener('click', () => {
    const prefs = savePrefs();
    const startedAt = Date.now();
    const number = getRoundSeqForToday();
    const roundObj = {
      number,                 // rundenr for DAGEN
      startedAt,
      dateStr: dateLabel(startedAt),
      job: prefs.lastJob,
      driver: { ...prefs.driver }
    };

    // lagre i vår state (og ev. BroytState hvis tilgjengelig)
    try { window.BroytState?.startRound?.(roundObj); } catch {}
    localStorage.setItem('broyt:round', JSON.stringify(roundObj));

    els.hint.textContent = `Startet Runde (${number}) ${roundObj.dateStr} – ${prefs.lastJob}, ${prefs.driver.direction}`;
    if (typeof window.APP?.go === 'function') window.APP.go('work'); else location.hash = '#work';
  });
})();