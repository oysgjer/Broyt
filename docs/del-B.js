// Del-B – Under arbeid (én adresse), med "Nå/Neste", stor Navigator, start-tidspunkt
// og 2-traktor-fremdrift (grønn = meg, lilla = andre). Fletter doneBy[] med skyen ved lagring.
(function () {
  const $ = (s) => document.querySelector(s);

  const els = {
    round: $('#b_round'), job: $('#b_job'), dir: $('#b_dir'), season: $('#b_season'), sync: $('#b_sync'),
    progMe: $('#b_prog_me'), progOther: $('#b_prog_other'),
    hint: $('#b_hint'),
    now: $('#b_now'), next: $('#b_next'),

    name: $('#b_name'), group: $('#b_group'), equip: $('#b_equipment'),
    stCount: $('#b_stikker_count'), stChk: $('#b_stikker_chk'), stLbl: $('#b_stikker_lbl'),
    started: $('#b_started'), finished: $('#b_finished'),

    idx: $('#b_index'), total: $('#b_total'),
    navTop: $('#b_nav_top'), nav: $('#b_nav'),
    actStart: $('#act_start'), actSkip: $('#act_skip'), actBlock: $('#act_block'), actDone: $('#act_done'), actAcc: $('#act_acc'),
    prevBtn: $('#prev_btn'), nextBtn: $('#next_btn'),

    syncBtn: $('#b_sync_btn'), saveBtn: $('#b_save_btn'),
    status: $('#b_status'),

    finishBtn: $('#b_finish_btn'), modal: $('#b_finish_modal'),
    finishSame: $('#b_finish_same'), finishSwitch: $('#b_finish_switch'), finishClose: $('#b_finish_close'), finishCancel: $('#b_finish_cancel'),
  };

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;
  const LS_SERVICE_REQ = 'broyt:serviceRequired';

  const S = {
    season: window.BroytState?.getSeason?.() || '',
    round: window.BroytState?.getRound?.() || null,
    prefs: window.BroytState?.getPrefs?.() || null,
    addresses: [],
    filtered: [],
    i: 0
  };

  // ---- Helpers ----
  const fmtTime = (t) => {
    if (!t) return '–';
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  function openMaps(query) {
    const q = encodeURIComponent(query);
    window.open(`https://www.google.com/maps?q=${q}`, '_blank');
  }

  // ---- Cloud ----
  async function getLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }
  async function putPayload(payload) {
    const r = await fetch(`${API}b/${BIN}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }

  // ---- Mapping ----
  function mapAddr(a) {
    const st = (a.stikkerSeason && a.stikkerSeason.season === S.season)
      ? a.stikkerSeason : { season: S.season, done: false, doneAt: null };

    const status = a.status || (a.done ? 'done' : 'idle');
    const doneBy = Array.isArray(a.doneBy) ? [...new Set(a.doneBy)] : (a.done ? ['ukjent'] : []);

    return {
      name: a.name || 'Uten navn',
      group: a.group || '',
      equipment: Array.isArray(a.equipment) ? a.equipment : [],
      active: a.active !== false,

      status, startedAt: a.startedAt || null, finishedAt: a.finishedAt || null,
      done: status === 'done',
      doneBy,

      stikkerSeason: st,
      stikkerCount: Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0,
      notes: a.notes || ''
    };
  }

  function filterByJob(list) {
    const job = S.round?.job || 'SNØ';
    if (job === 'GRUS') return list.filter(a => a.equipment?.includes('stro'));
    return list;
  }

  // ---- Render ----
  function renderNowNext() {
    const cur = S.filtered[S.i];
    const nxt = S.filtered[S.i + (S.round?.driver?.direction === 'Motsatt' ? -1 : 1)];
    els.now.textContent = cur ? cur.name : '–';
    els.next.textContent = nxt ? nxt.name : 'Ingen flere';
  }

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
      els.started.textContent = 'Start: –';
      els.finished.textContent = ' • Ferdig: –';
      return;
    }
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

    const statusTxt = {
      idle: 'Ikke påbegynt',
      started: `Pågår… (start ${fmtTime(a.startedAt)})`,
      skipped: 'Hoppet over',
      blocked: 'Ikke mulig',
      done: `Ferdig ${fmtTime(a.finishedAt)}`,
      accident: 'Uhell registrert'
    }[a.status] || '—';
    els.status.textContent = statusTxt;

    els.started.textContent = `Start: ${fmtTime(a.startedAt)}`;
    if (a.status === 'done' && a.finishedAt) {
      els.finished.textContent = ` • Ferdig: ${fmtTime(a.finishedAt)}`;
      els.finished.classList.remove('hide-on-idle');
    } else {
      els.finished.classList.add('hide-on-idle');
    }

    const query = [a.name, a.group].filter(Boolean).join(', ');
    els.nav.onclick = () => openMaps(query);
    els.navTop.onclick = () => openMaps(query);

    renderNowNext();
  }

  function renderProgress() {
    const list = S.filtered;
    const me = S.round?.driver?.name || '';
    let myDone = 0, otherDone = 0;

    list.forEach(a => {
      if (a.doneBy?.includes(me)) myDone++;
      // "andre" betyr noen har gjort den, men ikke meg
      if (Array.isArray(a.doneBy) && a.doneBy.length > 0 && !a.doneBy.includes(me)) otherDone++;
    });

    const n = list.length || 1;
    els.progMe.style.width = `${Math.round((myDone / n) * 100)}%`;
    els.progOther.style.width = `${Math.round((otherDone / n) * 100)}%`;
  }

  // ---- Statusendringer ----
  function setStatus(a, status) {
    const me = S.round?.driver?.name || 'driver';
    a.status = status;

    if (status === 'started') {
      a.startedAt = a.startedAt || Date.now(); // sett start-tid NÅ
    }
    if (status === 'done') {
      a.finishedAt = Date.now();
      a.done = true;
      if (!a.doneBy) a.doneBy = [];
      if (!a.doneBy.includes(me)) a.doneBy.push(me); // marker hvem som gjorde den
    } else if (status === 'idle') {
      a.done = false;
    } else {
      // andre statuser: ikke ferdig
      a.done = false;
    }
  }

  els.actStart.onclick = () => { const a = S.filtered[S.i]; setStatus(a, 'started'); renderAddress(); };
  els.actSkip.onclick  = () => { const a = S.filtered[S.i]; setStatus(a, 'skipped'); next(); };
  els.actBlock.onclick = () => { const a = S.filtered[S.i]; setStatus(a, 'blocked'); next(); };
  els.actDone.onclick  = () => { const a = S.filtered[S.i]; setStatus(a, 'done'); renderProgress(); next(); };
  els.actAcc.onclick   = () => { const a = S.filtered[S.i]; setStatus(a, 'accident'); renderAddress(); };

  function prev(){ S.i = Math.max(0, S.i - 1); renderAddress(); }
  function next(){ S.i = Math.min(S.filtered.length - 1, S.i + 1); renderAddress(); }
  els.prevBtn.onclick=prev; els.nextBtn.onclick=next;

  // stikker (sesong)
  els.stChk.onchange = (e) => {
    const a = S.filtered[S.i];
    a.stikkerSeason = a.stikkerSeason || { season: S.season, done: false, doneAt: null };
    a.stikkerSeason.season = S.season;
    a.stikkerSeason.done = !!e.target.checked;
    a.stikkerSeason.doneAt = e.target.checked ? Date.now() : null;
  };

  // ---- Synk / Lagre med MERGE (for to traktorer)
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

      S.i = (S.round?.driver?.direction === 'Motsatt')
        ? Math.max(0, S.filtered.length - 1)
        : 0;

      els.hint.textContent = (S.round?.job === 'GRUS')
        ? 'Viser kun adresser med grus-behov.'
        : 'Viser alle aktive adresser.';
      setMeta('OK');
      renderAddress();
      renderProgress();
    } catch (e) {
      console.error(e);
      els.sync.textContent = 'Feil';
      alert('Synk feilet: ' + e.message);
    }
  }

  // MERGE: henter siste versjon, flettes feltvis (doneBy union, status/tider bevares)
  function mergeAddresses(localArr, cloudArr) {
    const byName = (arr) => Object.fromEntries(arr.map(a => [a.name, a]));
    const L = byName(localArr), C = byName(cloudArr);
    const names = Array.from(new Set([...Object.keys(L), ...Object.keys(C)]));
    return names.map(n => {
      const aL = L[n], aC = C[n] || {};
      const doneBy = Array.from(new Set([...(aC.doneBy||[]), ...(aL.doneBy||[])]));
      // status: hvis en av dem er 'done', behold 'done'
      const status = (aL.status === 'done' || aC.status === 'done') ? 'done' : aL.status || aC.status || 'idle';
      return {
        ...aC,        // start med sky
        ...aL,        // ta inn lokale felt (inkl. tider)
        doneBy, status,
      };
    });
  }

  async function save() {
    try {
      els.sync.textContent = 'Lagrer…';

      // 1) Hent siste sky-data
      const cloud = await getLatest();
      const cloudList = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];

      // 2) Flett (slik at to traktorer ikke overskriver hverandre)
      const merged = mergeAddresses(S.addresses, cloudList);

      // 3) Skriv tilbake
      const payload = {
        version: window.APP_CFG?.APP_VER || '9.x',
        round: S.round?.number || 1,
        updated: Date.now(),
        by: S.round?.driver?.name || 'driver',
        driver: S.round?.driver || {},
        season: S.season,
        addresses: merged
      };
      await putPayload(payload);

      // 4) Oppdater lokalt også
      S.addresses = merged;
      S.filtered = filterByJob(S.addresses);
      renderProgress();
      setMeta('Lagret');
    } catch (e) {
      console.error(e);
      els.sync.textContent = 'Feil';
      alert('Lagring feilet: ' + e.message);
    }
  }
  els.syncBtn.onclick = sync; els.saveBtn.onclick = save;

  // ---- Avslutt runde (send til Service)
  function openFinish(){ els.modal.classList.remove('hidden'); }
  function closeFinish(){ els.modal.classList.add('hidden'); }
  els.finishBtn.onclick = openFinish; els.finishCancel.onclick = closeFinish;

  els.finishSame.onclick = () => {
    S.addresses.forEach(a => { a.done=false; a.status='idle'; a.startedAt=null; a.finishedAt=null; a.doneBy=[]; });
    const next = window.BroytState?.startRound?.({ job: S.round?.job, driver: S.round?.driver });
    S.round = next || S.round;
    S.filtered = filterByJob(S.addresses);
    S.i = (S.round?.driver?.direction === 'Motsatt') ? Math.max(0, S.filtered.length - 1) : 0;
    renderAddress(); renderProgress(); setMeta('Ny runde'); closeFinish();
  };

  els.finishSwitch.onclick = () => {
    const nextJob = S.round?.job === 'GRUS' ? 'SNØ' : 'GRUS';
    S.addresses.forEach(a => { a.done=false; a.status='idle'; a.startedAt=null; a.finishedAt=null; a.doneBy=[]; });
    const next = window.BroytState?.startRound?.({ job: nextJob, driver: S.round?.driver });
    S.round = next || S.round;
    S.filtered = filterByJob(S.addresses);
    S.i = (S.round?.driver?.direction === 'Motsatt') ? Math.max(0, S.filtered.length - 1) : 0;
    renderAddress(); renderProgress(); setMeta('Ny runde (byttet)'); closeFinish();
  };

  els.finishClose.onclick = () => {
    const payload = {
      round: S.round?.number || 0,
      startedAt: S.round?.startedAt || Date.now(),
      job: S.round?.job || 'SNØ',
      driver: S.round?.driver?.name || 'driver',
      createdAt: Date.now()
    };
    localStorage.setItem(LS_SERVICE_REQ, JSON.stringify(payload));
    closeFinish();
    location.hash = '#service';
    if (typeof window.APP?.go === 'function') window.APP.go('service');
  };

  // ---- Meta / boot ----
  function setMeta(syncMsg='—') {
    els.round.textContent = S.round?.number ?? '–';
    els.job.textContent   = S.round?.job ?? '–';
    els.dir.textContent   = S.round?.driver?.direction ?? '–';
    els.season.textContent= S.season || '–';
    els.sync.textContent  = syncMsg;
  }

  function boot() {
    S.season = window.BroytState?.getSeason?.() || S.season;
    S.round  = window.BroytState?.getRound?.() || S.round;
    S.prefs  = window.BroytState?.getPrefs?.() || S.prefs;

    setMeta('—');
    els.hint.textContent = (S.round?.job === 'GRUS') ? 'Viser kun adresser med grus-behov.' : 'Viser alle aktive adresser.';
    sync();
  }
  boot();
})();