// Del-B – Under arbeid (én adresse om gangen, store knapper)

(function () {
  const $ = (s) => document.querySelector(s);

  const els = {
    // meta
    round: $('#b_round'), job: $('#b_job'), dir: $('#b_dir'), season: $('#b_season'), sync: $('#b_sync'),
    // progress / hint
    prog: $('#b_prog_done'), hint: $('#b_hint'),
    // kort
    name: $('#b_name'), group: $('#b_group'), equip: $('#b_equipment'),
    stCount: $('#b_stikker_count'), stChk: $('#b_stikker_chk'), stLbl: $('#b_stikker_lbl'),
    // index
    idx: $('#b_index'), total: $('#b_total'),
    // knapper
    nav: $('#b_nav'),
    actStart: $('#act_start'), actSkip: $('#act_skip'), actBlock: $('#act_block'), actDone: $('#act_done'), actAcc: $('#act_acc'),
    prevBtn: $('#prev_btn'), nextBtn: $('#next_btn'),
    // synk
    syncBtn: $('#b_sync_btn'), saveBtn: $('#b_save_btn'),
    // status
    status: $('#b_status'),
    // dialog
    finishBtn: $('#b_finish_btn'), modal: $('#b_finish_modal'),
    finishSame: $('#b_finish_same'), finishSwitch: $('#b_finish_switch'), finishClose: $('#b_finish_close'), finishCancel: $('#b_finish_cancel'),
  };

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const S = {
    season: window.BroytState?.getSeason?.() || '',
    round: window.BroytState?.getRound?.() || null,
    prefs: window.BroytState?.getPrefs?.() || null,
    addresses: [],
    filtered: [],
    i: 0 // peker til aktuell adresse i filtrert liste
  };

  // --- Nett (via Worker)
  async function getLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache:'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }
  async function putPayload(payload) {
    const r = await fetch(`${API}b/${BIN}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }

  // --- Mapping
  function mapAddr(a) {
    const st = (a.stikkerSeason && a.stikkerSeason.season === S.season) ? a.stikkerSeason
      : { season:S.season, done:false, doneAt:null };

    // antall stikker (admin-låst verdi). Vi leser hvilket som helst av disse feltene:
    const stCount = Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0;

    // statusfelt (én av: idle, started, skipped, blocked, done, accident)
    const status = a.status || (a.done ? 'done' : 'idle');

    return {
      name: a.name || 'Uten navn',
      group: a.group || '',
      equipment: Array.isArray(a.equipment) ? a.equipment : [],
      active: a.active !== false,
      // runde-felt
      done: !!a.done,
      grusDone: !!a.grusDone,
      status,          // 'idle'|'started'|'skipped'|'blocked'|'done'|'accident'
      startedAt: a.startedAt || null,
      finishedAt: a.finishedAt || null,
      notes: a.notes || '',
      // sesong
      stikkerSeason: st,
      stikkerCount: stCount
    };
  }

  function filterByJob(list) {
    const job = S.round?.job || 'SNØ';
    if (job === 'GRUS') {
      return list.filter(a => Array.isArray(a.equipment) && a.equipment.includes('stro'));
    }
    return list;
  }

  // --- Render én adresse
  function renderAddress() {
    const total = S.filtered.length;
    els.total.textContent = String(total);
    if (!total) {
      els.idx.textContent = '0';
      els.name.textContent = 'Ingen adresser i visning';
      els.group.textContent = '';
      els.equip.textContent = '';
      els.stCount.textContent = '—';
      els.stChk.checked = false;
      els.status.textContent = '';
      return;
    }

    // pekeren må være innenfor [0, total-1]
    if (S.i < 0) S.i = 0;
    if (S.i > total - 1) S.i = total - 1;

    els.idx.textContent = String(S.i + 1);

    const a = S.filtered[S.i];
    els.name.textContent = a.name;
    els.group.textContent = a.group ? `Gruppe: ${a.group}` : ' ';
    els.equip.textContent = a.equipment?.length ? `Utstyr (behov): ${a.equipment.join(', ')}` : ' ';
    els.stCount.textContent = (a.stikkerCount > 0) ? `${a.stikkerCount} stk` : '—';
    els.stChk.checked = !!a.stikkerSeason?.done;
    els.stLbl.textContent = `Stikker satt (${S.season})`;

    // statuslinje
    const statusTxt = {
      idle: 'Ikke påbegynt',
      started: 'Pågår…',
      skipped: 'Hoppet over',
      blocked: 'Ikke mulig',
      done: 'Ferdig',
      accident: 'Uhell registrert'
    }[a.status] || '—';
    els.status.textContent = statusTxt;

    // navigasjonsknapp fungerer alltid
    els.nav.onclick = () => {
      const query = [a.name, a.group].filter(Boolean).join(', ');
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(query)}`, '_blank');
    };
  }

  // --- Render progresjon
  function renderProgress() {
    const list = S.filtered;
    const doneCount = list.filter(a => a.status === 'done').length;
    const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;
    els.prog.style.width = `${pct}%`;
  }

  // --- Status-endringer
  function setStatus(a, status) {
    a.status = status;
    if (status === 'started') a.startedAt = a.startedAt || Date.now();
    if (status === 'done')    a.finishedAt = Date.now();
    if (status !== 'done')    a.finishedAt = null;
    // ved ferdig: også sett done=true (runde-felt for kompatibilitet)
    a.done = (status === 'done');
  }

  // --- Knapper (aksjoner)
  els.actStart.onclick = () => {
    const a = S.filtered[S.i];
    setStatus(a, 'started');
    renderAddress();
  };
  els.actSkip.onclick = () => {
    const a = S.filtered[S.i];
    setStatus(a, 'skipped');
    next();
  };
  els.actBlock.onclick = () => {
    const a = S.filtered[S.i];
    setStatus(a, 'blocked');
    next();
  };
  els.actDone.onclick = () => {
    const a = S.filtered[S.i];
    setStatus(a, 'done');
    renderProgress();
    next();
  };
  els.actAcc.onclick = () => {
    const a = S.filtered[S.i];
    setStatus(a, 'accident');
    renderAddress();
  };

  function prev() { S.i = Math.max(0, S.i - 1); renderAddress(); }
  function next() { S.i = Math.min(S.filtered.length - 1, S.i + 1); renderAddress(); }
  els.prevBtn.onclick = prev;
  els.nextBtn.onclick = next;

  // stikker (sesong)
  els.stChk.onchange = (e) => {
    const a = S.filtered[S.i];
    a.stikkerSeason = a.stikkerSeason || { season:S.season, done:false, doneAt:null };
    a.stikkerSeason.season = S.season;
    a.stikkerSeason.done = !!e.target.checked;
    a.stikkerSeason.doneAt = e.target.checked ? Date.now() : null;
  };

  // --- Synk / lagre
  async function sync() {
    try {
      els.sync.textContent = 'Henter…';
      const cloud = await getLatest();
      const arr = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];

      S.addresses = arr.filter(a => a.active !== false).map(mapAddr);
      S.filtered = filterByJob(S.addresses);

      // startposisjon styres av Retning:
      // Normal  → start på 0
      // Motsatt → start på siste
      S.i = (S.round?.driver?.direction === 'Motsatt') ? Math.max(0, S.filtered.length - 1) : 0;

      // meta/hint
      els.hint.textContent = (S.round?.job === 'GRUS') ? 'Viser kun adresser med grus-behov.' : 'Viser alle aktive adresser.';
      setMeta('OK');
      renderAddress();
      renderProgress();
    } catch (e) {
      console.error(e);
      els.sync.textContent = 'Feil';
      alert('Synk feilet: ' + e.message);
    }
  }

  async function save() {
    try {
      els.sync.textContent = 'Lagrer…';
      const payload = {
        version: window.APP_CFG?.APP_VER || '9.x',
        round: S.round?.number || 1,
        updated: Date.now(),
        by: S.round?.driver?.name || 'driver',
        driver: S.round?.driver || {},
        season: S.season,
        addresses: S.addresses
      };
      await putPayload(payload);
      setMeta('Lagret');
    } catch (e) {
      console.error(e);
      els.sync.textContent = 'Feil';
      alert('Lagring feilet: ' + e.message);
    }
  }
  els.syncBtn.onclick = sync;
  els.saveBtn.onclick = save;

  // --- Avslutt dialog
  function openFinish()  { els.modal.classList.remove('hidden'); }
  function closeFinish() { els.modal.classList.add('hidden'); }
  els.finishBtn.onclick = openFinish;
  els.finishCancel.onclick = closeFinish;

  els.finishSame.onclick = () => {
    // nullstill runde-felt (ikke sesong)
    S.addresses.forEach(a => { a.done=false; a.status='idle'; a.grusDone=false; a.startedAt=null; a.finishedAt=null; });
    const next = window.BroytState?.startRound?.({ job: S.round?.job, driver: S.round?.driver });
    S.round = next || S.round;
    S.filtered = filterByJob(S.addresses);
    S.i = (S.round?.driver?.direction === 'Motsatt') ? Math.max(0, S.filtered.length - 1) : 0;
    renderAddress(); renderProgress(); setMeta('Ny runde'); closeFinish();
  };

  els.finishSwitch.onclick = () => {
    const nextJob = S.round?.job === 'GRUS' ? 'SNØ' : 'GRUS';
    S.addresses.forEach(a => { a.done=false; a.status='idle'; a.grusDone=false; a.startedAt=null; a.finishedAt=null; });
    const next = window.BroytState?.startRound?.({ job: nextJob, driver: S.round?.driver });
    S.round = next || S.round;
    S.filtered = filterByJob(S.addresses);
    S.i = (S.round?.driver?.direction === 'Motsatt') ? Math.max(0, S.filtered.length - 1) : 0;
    renderAddress(); renderProgress(); setMeta('Ny runde (byttet)'); closeFinish();
  };

  els.finishClose.onclick = () => {
    window.BroytState?.endRound?.();
    closeFinish();
    location.hash = '#home';
    if (typeof window.APP?.go === 'function') window.APP.go('home');
  };

  // --- Meta
  function setMeta(syncMsg='—') {
    els.round.textContent = S.round?.number ?? '–';
    els.job.textContent   = S.round?.job ?? '–';
    els.dir.textContent   = S.round?.driver?.direction ?? '–';
    els.season.textContent= S.season || '–';
    els.sync.textContent  = syncMsg;
  }

  // --- Boot
  function boot() {
    S.season = window.BroytState?.getSeason?.() || S.season;
    S.round  = window.BroytState?.getRound?.() || S.round;
    S.prefs  = window.BroytState?.getPrefs?.() || S.prefs;

    setMeta('—');
    els.hint.textContent = (S.round?.job === 'GRUS') ? 'Viser kun adresser med grus-behov.' : 'Viser alle aktive adresser.';
    sync(); // hent første gang
  }
  boot();
})();