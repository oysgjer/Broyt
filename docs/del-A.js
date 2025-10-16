// Del-A (Hjem) – uten state-tillegg. Jobber kun med LocalStorage + routing-signaler.

(function () {
  const el = {
    driver: document.getElementById('a_driver'),
    dirRadios: Array.from(document.querySelectorAll('input[name="a_dir"]')),
    eq: {
      plow: document.getElementById('a_eq_plow'),
      fres: document.getElementById('a_eq_fres'),
      sand: document.getElementById('a_eq_sand'),
    },
    jobRadios: Array.from(document.querySelectorAll('input[name="a_job"]')),
    startBtn: document.getElementById('a_start'),
    hint: document.getElementById('a_hint'),
  };

  const LS_PREFS = 'broyt:prefs';
  const LS_ROUND = 'broyt:currentRound';

  // --- load prefs
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_PREFS) || '{}');
      if (p.driver?.name) el.driver.value = p.driver.name;
      if (p.driver?.direction) {
        const r = el.dirRadios.find(x => x.value === p.driver.direction);
        if (r) r.checked = true;
      }
      if (p.driver?.equipment) {
        el.eq.plow.checked = !!p.driver.equipment.plow;
        el.eq.fres.checked = !!p.driver.equipment.fres;
        el.eq.sand.checked = !!p.driver.equipment.sand;
      }
      if (p.lastJob && (p.lastJob === 'SNØ' || p.lastJob === 'GRUS')) {
        const r = el.jobRadios.find(x => x.value === p.lastJob);
        if (r) r.checked = true;
      }
      updateHint();
    } catch {}
  }

  function currentPrefs() {
    const direction = el.dirRadios.find(x => x.checked)?.value || 'Normal';
    const job = el.jobRadios.find(x => x.checked)?.value || 'SNØ';
    return {
      driver: {
        name: el.driver.value.trim(),
        direction,
        equipment: {
          plow: !!el.eq.plow.checked,
          fres: !!el.eq.fres.checked,
          sand: !!el.eq.sand.checked,
        },
      },
      lastJob: job,
    };
  }

  function savePrefs() {
    const prefs = currentPrefs();
    localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
    updateHint();
  }

  function updateHint() {
    const prefs = currentPrefs();
    const hasSnowGear = prefs.driver.equipment.plow || prefs.driver.equipment.fres;
    const hasSand = prefs.driver.equipment.sand;

    if (prefs.lastJob === 'GRUS' && !hasSand) {
      el.hint.textContent = 'Oppdragstype = Grus, men Strøkasse er ikke huket av.';
    } else if (prefs.lastJob === 'SNØ' && !hasSnowGear) {
      el.hint.textContent = 'Oppdragstype = Snø, men verken Skjær eller Fres er huket av.';
    } else {
      el.hint.textContent = '';
    }
  }

  // persist on change
  el.driver.addEventListener('input', savePrefs);
  el.dirRadios.forEach(r => r.addEventListener('change', savePrefs));
  el.jobRadios.forEach(r => r.addEventListener('change', savePrefs));
  Object.values(el.eq).forEach(cb => cb.addEventListener('change', savePrefs));

  // --- start round
  el.startBtn.addEventListener('click', () => {
    const prefs = currentPrefs();

    // Krev minst ett utstyr krysset
    const anyGear = prefs.driver.equipment.plow || prefs.driver.equipment.fres || prefs.driver.equipment.sand;
    if (!anyGear) {
      alert('Velg minst ett utstyr (Skjær, Fres eller Strøkasse) før du starter runde.');
      return;
    }

    // Lagre prefs
    localStorage.setItem(LS_PREFS, JSON.stringify(prefs));

    // Opprett/oppdater rundeinfo (kun lokalt – del-B kan lese dette)
    const prev = JSON.parse(localStorage.getItem(LS_ROUND) || '{}');
    const number = (prev.number || 0) + 1;
    const round = {
      number,
      startedAt: Date.now(),
      job: prefs.lastJob,               // 'SNØ' | 'GRUS'
      driver: prefs.driver,             // inkl. faktisk utstyr på traktoren
    };
    localStorage.setItem(LS_ROUND, JSON.stringify(round));

    // Varsle app-shell/router (hvis finnes)
    try {
      window.dispatchEvent(new CustomEvent('app:startRound', { detail: round }));
    } catch {}

    // Naviger til Under arbeid (Del-B)
    // 1) Hash-router:
    location.hash = '#work';
    // 2) Fallback: custom global
    if (typeof window.APP?.go === 'function') {
      window.APP.go('work'); // valgfri, hvis appen din har slik funksjon
    }
  });

  // init
  loadPrefs();
})();