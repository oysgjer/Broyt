// Del-B – Under arbeid
// Henter runde/valg fra BroytState, synker adresser, filtrerer etter oppdragstype,
// håndterer Naviger, Ferdig, Grus utført og Brøytestikker + Avslutt dialog.

(function () {
  const q = (sel) => document.querySelector(sel);
  const els = {
    round: q('#b_round'),
    job: q('#b_job'),
    dir: q('#b_dir'),
    season: q('#b_season'),
    syncLbl: q('#b_sync'),
    count: q('#b_count'),
    hint: q('#b_hint'),
    list: q('#b_list'),
    prog: q('#b_prog_done'),
    syncBtn: q('#b_sync_btn'),
    saveBtn: q('#b_save_btn'),
    finishBtn: q('#b_finish_btn'),
    modal: q('#b_finish_modal'),
    finishSame: q('#b_finish_same'),
    finishSwitch: q('#b_finish_switch'),
    finishClose: q('#b_finish_close'),
    finishCancel: q('#b_finish_cancel'),
  };

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const state = {
    season: window.BroytState?.getSeason?.() || '',
    round: window.BroytState?.getRound?.() || null,
    prefs: window.BroytState?.getPrefs?.() || null,
    addresses: [],
    filtered: [],
  };

  // ---- Sky-IO (direkte via Worker – samme som før)
  async function fetchLatest() {
    const url = `${API}b/${BIN}/latest`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }

  async function putPayload(payload) {
    const url = `${API}b/${BIN}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }

  // ---- Rendering
  function setMeta(syncMsg = '') {
    els.round.textContent  = state.round?.number ?? '–';
    els.job.textContent    = state.round?.job ?? '–';
    els.dir.textContent    = state.round?.driver?.direction ?? '–';
    els.season.textContent = state.season || '–';
    els.syncLbl.textContent = syncMsg || 'OK';
  }

  function filterByJob(list) {
    const job = state.round?.job || 'SNØ';
    if (job === 'GRUS') {
      return list.filter(a => Array.isArray(a.equipment) && a.equipment.includes('stro'));
    }
    return list; // SNØ → alle aktive
  }

  function mapIncomingAddress(a) {
    // Standardiser felter
    const st = a.stikkerSeason && a.stikkerSeason.season === state.season
      ? a.stikkerSeason
      : { season: state.season, done:false, doneAt:null };
    return {
      name: a.name || 'Uten navn',
      group: a.group || '',
      equipment: Array.isArray(a.equipment) ? a.equipment : [],
      active: a.active !== false,
      done: !!a.done,
      grusDone: !!a.grusDone,
      stikkerSeason: st
    };
  }

  function render() {
    const list = state.filtered;
    els.count.textContent = `${list.length} adresser`;
    els.hint.textContent = (state.round?.job === 'GRUS')
      ? 'Viser kun adresser som skal ha grus.'
      : 'Viser alle aktive adresser.';

    els.list.innerHTML = '';
    list.forEach((a, idx) => {
      const card = document.createElement('div');
      card.className = 'b-card';
      card.dataset.i = String(idx);

      const eqStr = a.equipment?.length ? ` | Utstyr: ${a.equipment.join(', ')}` : '';
      const stikkerInfo = a.stikkerSeason?.doneAt
        ? ` | Stikker satt: ${new Date(a.stikkerSeason.doneAt).toLocaleDateString()}`
        : '';

      card.innerHTML = `
        <header>
          <div class="grow">
            <div><strong>${a.name}</strong></div>
            <div class="muted">Gruppe: ${a.group || '-'}${eqStr}${stikkerInfo}</div>
          </div>
          <div class="right">
            <label class="muted"><input type="checkbox" data-k="done" ${a.done?'checked':''}> Ferdig</label>
          </div>
        </header>

        <div class="row" style="margin-top:8px;">
          <button data-k="nav">🧭 Naviger</button>
          ${state.round?.job === 'GRUS' ? `
            <label class="muted"><input type="checkbox" data-k="grus" ${a.grusDone?'checked':''}> Grus utført</label>
          ` : ''}
          <label class="muted"><input type="checkbox" data-k="stikker" ${a.stikkerSeason?.done?'checked':''}>
            Brøytestikker satt (${state.season})
          </label>
        </div>
      `;
      els.list.appendChild(card);
    });

    // enkel progresjon: andel ferdig i filtrert liste
    const doneCount = list.filter(a=>a.done).length;
    const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;
    els.prog.style.width = `${pct}%`;
  }

  // ---- List events
  els.list.addEventListener('click', (e) => {
    const card = e.target.closest('.b-card'); if(!card) return;
    const i = +card.dataset.i;
    const addr = state.filtered[i];
    const key = e.target.dataset.k;

    if (key === 'nav') {
      const query = [addr.name, addr.group].filter(Boolean).join(', ');
      const url = `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
      window.open(url, '_blank');
    }
  });

  els.list.addEventListener('change', (e) => {
    const card = e.target.closest('.b-card'); if(!card) return;
    const i = +card.dataset.i;
    const addr = state.filtered[i];
    const key = e.target.dataset.k;

    if (key === 'done') {
      addr.done = !!e.target.checked;
    }
    if (key === 'grus') {
      addr.grusDone = !!e.target.checked;
    }
    if (key === 'stikker') {
      addr.stikkerSeason = addr.stikkerSeason || { season: state.season, done:false, doneAt:null };
      addr.stikkerSeason.season = state.season;
      addr.stikkerSeason.done = !!e.target.checked;
      addr.stikkerSeason.doneAt = e.target.checked ? Date.now() : null;
    }
    render(); // oppdater progresjon
  });

  // ---- Synk / Lagre
  async function doSync() {
    try {
      els.syncLbl.textContent = 'Henter...';
      const cloud = await fetchLatest();

      // Hent adresser uansett format (array / {addresses} / {snapshot:{addresses}})
      const arr = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];

      state.addresses = arr.filter(a => a.active !== false).map(mapIncomingAddress);
      applyFilter();
      setMeta('OK');
      render();
    } catch (e) {
      console.error(e);
      els.syncLbl.textContent = 'Feil';
      alert('Synk feilet: ' + e.message);
    }
  }

  async function doSave() {
    try {
      els.syncLbl.textContent = 'Lagrer...';
      const payload = {
        version: window.APP_CFG?.APP_VER || '9.x',
        round: state.round?.number || 1,
        updated: Date.now(),
        by: state.round?.driver?.name || 'driver',
        driver: state.round?.driver || {},
        season: state.season,
        addresses: state.addresses
      };
      await putPayload(payload);
      setMeta('Lagret');
    } catch (e) {
      console.error(e);
      els.syncLbl.textContent = 'Feil';
      alert('Lagring feilet: ' + e.message);
    }
  }

  // ---- Avslutt dialog
  function openFinishModal()  { els.modal.classList.remove('hidden'); }
  function closeFinishModal() { els.modal.classList.add('hidden'); }
  els.finishBtn.addEventListener('click', openFinishModal);
  els.finishCancel.addEventListener('click', closeFinishModal);

  // 1) Ny runde – samme oppdrag
  els.finishSame.addEventListener('click', () => {
    // nullstill runde-felt i alle
    state.addresses.forEach(a => { a.done=false; a.grusDone=false; });
    // ny runde i state
    const next = window.BroytState?.startRound?.({
      job: state.round?.job, driver: state.round?.driver
    });
    state.round = next || state.round;
    applyFilter(); render(); setMeta('Ny runde');
    closeFinishModal();
  });

  // 2) Bytt oppdragstype
  els.finishSwitch.addEventListener('click', () => {
    const nextJob = state.round?.job === 'GRUS' ? 'SNØ' : 'GRUS';
    state.addresses.forEach(a => { a.done=false; a.grusDone=false; });
    const next = window.BroytState?.startRound?.({
      job: nextJob, driver: state.round?.driver
    });
    state.round = next || state.round;
    applyFilter(); render(); setMeta('Ny runde (byttet)');
    closeFinishModal();
  });

  // 3) Avslutt (til Hjem)
  els.finishClose.addEventListener('click', () => {
    window.BroytState?.endRound?.();
    closeFinishModal();
    // naviger hjem (hash eller app.go)
    location.hash = '#home';
    if (typeof window.APP?.go === 'function') window.APP.go('home');
  });

  // ---- Filter og init
  function applyFilter() {
    state.filtered = filterByJob(state.addresses);
  }

  function boot() {
    state.season = window.BroytState?.getSeason?.() || state.season;
    state.round  = window.BroytState?.getRound?.() || state.round;
    state.prefs  = window.BroytState?.getPrefs?.() || state.prefs;

    // meta
    setMeta('–');

    // første hint
    if (state.round?.job === 'GRUS') {
      els.hint.textContent = 'Viser kun adresser som skal ha grus.';
    } else {
      els.hint.textContent = 'Viser alle aktive adresser.';
    }

    // hent startdata fra sky
    doSync();

    // knapper
    els.syncBtn.addEventListener('click', doSync);
    els.saveBtn.addEventListener('click', doSave);
  }

  boot();
})();