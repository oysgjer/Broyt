// Del-A (Hjem) – lagrer fører, retning, utstyr, oppdrag og preferanser (tema + auto-navigasjon)
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
    // tema
    try { window.applyTheme?.(prefs.theme); } catch {}
    return prefs;
  }

  // bindings
  els.theme.addEventListener('change', () => savePrefs());
  els.autoNav.addEventListener('change', () => savePrefs());

  // start runde
  els.start.addEventListener('click', () => {
    const prefs = savePrefs();
    const round = window.BroytState?.startRound?.({
      job: prefs.lastJob,
      driver: prefs.driver
    });
    els.hint.textContent = `Runde ${round?.number ?? ''} startet (${prefs.lastJob}, ${prefs.driver.direction}).`;
    // gå til under arbeid
    if (typeof window.APP?.go === 'function') window.APP.go('work'); else location.hash = '#work';
  });
})();