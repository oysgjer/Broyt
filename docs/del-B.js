// Del-B – Under arbeid (retning fikset, auto-lagring, auto-nav, avslutt -> service)
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

    finishBtn: $('#b_finish_btn'),

    // "Ikke mulig" modal (valgfritt – beholdt hvis du allerede har den i HTML)
    blockModal: $('#b_block_modal'),
    blockText:  $('#b_block_text'),
    blockFile:  $('#b_block_file'),
    blockFileName: $('#b_block_file_name'),
    blockSave:  $('#b_block_save'),
    blockCancel:$('#b_block_cancel')
  };

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;
  const QKEY = 'broyt:offlineQueue';
  const SERVICE_REQ = 'broyt:serviceRequired';

  const S = {
    season: window.BroytState?.getSeason?.() || '',
    round:  window.BroytState?.getRound?.() || null,
    prefs:  window.BroytState?.getPrefs?.() || {},
    addresses: [],
    filtered: [],
    i: 0,
    saving: false
  };

  const fmtTime = (t) => !t ? '–' : new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const openMaps = (q) => window.open(`https://www.google.com/maps?q=${encodeURIComponent(q)}`, '_blank');

  // --- Nett
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

  // --- Offline-kø
  function getQueue() {
    try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; }
  }
  function setQueue(arr) {
    localStorage.setItem(QKEY, JSON.stringify(arr || []));
  }
  async function flushQueue() {
    const q = getQueue();
    if (!q.length) return;
    try {
      for (const payload of q) await putPayload(payload);
      setQueue([]);
      els.sync.textContent = 'OK (kø tømt)';
    } catch {
      els.sync.textContent = 'Kø venter';
    }
  }

  // --- Map / filter
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
      done: status === 'done', doneBy,
      stikkerSeason: st,
      stikkerCount: Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0,
      notes: a.notes || '',
      blockReason: a.blockReason || '',
      blockPhoto: a.blockPhoto || null
    };
  }

  function filterByJob(list) {
    const job = S.round?.job || 'SNØ';
    if (job === 'GRUS') return list.filter(a => a.equipment?.includes('stro'));
    return list;
  }

  // --- Render
  function renderNowNext() {
    const step = (S.round?.driver?.direction === 'Motsatt') ? -1 : 1;
    const cur = S.filtered[S.i];
    const nxt = S.filtered[S.i + step];
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

    els.name.textContent  = a.name;
    els.group.textContent = a.group ? `Gruppe: ${a.group}` : ' ';
    els.equip.textContent = a.equipment?.length ? `Utstyr (behov): ${a.equipment.join(', ')}` : ' ';
    els.stCount.textContent = (a.stikkerCount > 0) ? `${a.stikkerCount} stk` : '—';
    els.stChk.checked = !!a.stikkerSeason?.done;
    els.stLbl.textContent = `Stikker satt (${S.season})`;

    const statusTxt = {
      idle: 'Ikke påbegynt',
      started: `Pågår… (start ${fmtTime(a.startedAt)})`,
      skipped: 'Hoppet over',
      blocked: a.blockReason ? `Ikke mulig – ${a.blockReason}` : 'Ikke mulig',
      done: `Ferdig ${fmtTime(a.finishedAt)}`,
      accident: 'Uhell registrert'
    }[a.status] || '—';
    els.status.textContent = statusTxt;

    els.started.textContent  = `Start: ${fmtTime(a.startedAt)}`;
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
      if (Array.isArray(a.doneBy) && a.doneBy.length > 0 && !a.doneBy.includes(me)) otherDone++;
    });
    const n = list.length || 1;
    els.progMe.style.width = `${Math.round((myDone / n) * 100)}%`;
    els.progOther.style.width = `${Math.round((otherDone / n) * 100)}%`;
  }

  // --- Status
  function setStatus(a, status) {
    const me = S.round?.driver?.name || 'driver';
    a.status = status;
    if (status === 'started') {
      a.startedAt = a.startedAt || Date.now();
    }
    if (status === 'done') {
      a.finishedAt = Date.now();
      a.done = true;
      a.doneBy = a.doneBy || [];
      if (!a.doneBy.includes(me)) a.doneBy.push(me);
    } else if (status === 'idle') {
      a.done = false;
    } else {
      a.done = false;
    }
  }

  // --- Merge & lagring
  function mergeAddresses(localArr, cloudArr) {
    const byName = (arr) => Object.fromEntries(arr.map(a => [a.name, a]));
    const L = byName(localArr), C = byName(cloudArr);
    const names = Array.from(new Set([...Object.keys(L), ...Object.keys(C)]));
    return names.map(n => {
      const aL = L[n], aC = C[n] || {};
      const doneBy = Array.from(new Set([...(aC.doneBy||[]), ...(aL.doneBy||[])]));
      const status = (aL.status === 'done' || aC.status === 'done') ? 'done' : aL.status || aC.status || 'idle';
      const blockReason = aL.blockReason || aC.blockReason || '';
      const blockPhoto  = aL.blockPhoto  || aC.blockPhoto  || null;
      return { ...aC, ...aL, doneBy, status, blockReason, blockPhoto };
    });
  }

  async function saveQuiet() {
    if (S.saving) return;
    try {
      S.saving = true;
      els.sync.textContent = 'Lagrer…';

      const cloud = await getLatest();
      const cloudList = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];

      const merged = mergeAddresses(S.addresses, cloudList);

      const payload = {
        version: window.APP_CFG?.APP_VER || '9.x',
        updated: Date.now(),
        by: S.round?.driver?.name || 'driver',
        driver: S.round?.driver || {},
        season: S.season,
        addresses: merged,
        serviceLogs: Array.isArray(cloud.serviceLogs) ? cloud.serviceLogs : [],
        backups: Array.isArray(cloud.backups) ? cloud.backups : []
      };

      try {
        await putPayload(payload);
      } catch (e) {
        const q = getQueue(); q.push(payload); setQueue(q);
        els.sync.textContent = 'Kø (offline)';
        throw e;
      }

      S.addresses = merged;
      S.filtered  = filterByJob(S.addresses);
      renderProgress();
      els.sync.textContent = 'OK';
    } catch (e) {
      console.warn('saveQuiet feilet:', e.message);
    } finally {
      S.saving = false;
    }
  }

  // --- "Ikke mulig" modal (valgfritt)
  let blockPhotoDataUrl = null;
  if (els.blockFile) {
    els.blockFile.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) { blockPhotoDataUrl = null; els.blockFileName.textContent = 'Ingen fil valgt'; return; }
      els.blockFileName.textContent = f.name;
      blockPhotoDataUrl = await fileToCompressedDataURL(f, 1280, 0.7);
    });
  }
  function openBlockModal() {
    if (!els.blockModal) { // fallback uten modal
      const a = S.filtered[S.i]; setStatus(a, 'blocked'); saveQuiet(); goNext(true); return;
    }
    els.blockText.value = '';
    if (els.blockFile) els.blockFile.value = '';
    if (els.blockFileName) els.blockFileName.textContent = 'Ingen fil valgt';
    blockPhotoDataUrl = null;
    els.blockModal.classList.remove('hidden');
  }
  function closeBlockModal(){ if (els.blockModal) els.blockModal.classList.add('hidden'); }
  if (els.blockCancel) els.blockCancel.onclick = closeBlockModal;

  // --- Retningsbevisst navigasjon (kritisk fiks)
  function stepDir() { return (S.round?.driver?.direction === 'Motsatt') ? -1 : 1; }

  function prev(){
    const step = -stepDir();               // motsatt av "neste"
    S.i = clampIndex(S.i + step);
    renderAddress();
  }
  function next(){
    const step = stepDir();                // riktig retning
    S.i = clampIndex(S.i + step);
    renderAddress();
  }
  function clampIndex(idx) {
    if (!S.filtered.length) return 0;
    if (idx < 0) return 0;
    if (idx > S.filtered.length - 1) return S.filtered.length - 1;
    return idx;
  }

  function goNext(autoNav=false) {
    next();
    saveQuiet();
    if (autoNav && S.prefs?.autoNavNext) {
      const cur = S.filtered[S.i];
      if (cur) {
        const q = [cur.name, cur.group].filter(Boolean).join(', ');
        openMaps(q);
      }
    }
  }

  // --- Knapper
  els.actStart.onclick = () => { const a = S.filtered[S.i]; setStatus(a, 'started'); renderAddress(); saveQuiet(); };
  els.actSkip.onclick  = () => { const a = S.filtered[S.i]; setStatus(a, 'skipped'); goNext(true); };
  els.actBlock.onclick = openBlockModal;
  if (els.blockSave) els.blockSave.onclick = () => {
    const a = S.filtered[S.i];
    a.blockReason = (els.blockText?.value || '').trim();
    a.blockPhoto  = blockPhotoDataUrl || null;
    setStatus(a, 'blocked');
    closeBlockModal();
    goNext(true);
  };
  els.actDone.onclick  = () => { const a = S.filtered[S.i]; setStatus(a, 'done'); renderProgress(); goNext(true); };
  els.actAcc.onclick   = () => { const a = S.filtered[S.i]; setStatus(a, 'accident'); renderAddress(); saveQuiet(); };

  els.prevBtn.onclick=prev;
  els.nextBtn.onclick=() => goNext(true);

  // --- Avslutt runde: lagre + til Service
  els.finishBtn.onclick = async () => {
    try {
      await saveQuiet();
    } finally {
      const payload = {
        round: S.round?.number || 0,
        startedAt: S.round?.startedAt || Date.now(),
        job: S.round?.job || 'SNØ',
        driver: S.round?.driver?.name || 'driver',
        createdAt: Date.now()
      };
      localStorage.setItem(SERVICE_REQ, JSON.stringify(payload));
      if (typeof window.APP?.go === 'function') window.APP.go('service');
      else location.hash = '#service';
    }
  };

  // stikker (sesong)
  els.stChk.onchange = (e) => {
    const a = S.filtered[S.i];
    a.stikkerSeason = a.stikkerSeason || { season: S.season, done: false, doneAt: null };
    a.stikkerSeason.season = S.season;
    a.stikkerSeason.done = !!e.target.checked;
    a.stikkerSeason.doneAt = e.target.checked ? Date.now() : null;
    saveQuiet();
  };

  // --- Synk/init + autosynk ved fokus
  async function sync() {
    try {
      els.sync.textContent = 'Henter…';
      await flushQueue();

      const cloud = await getLatest();
      const arr = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];
      S.addresses = arr.filter(a => a.active !== false).map(mapAddr);
      S.filtered = filterByJob(S.addresses);

      // VIKTIG: startposisjon i riktig ende
      S.i = (S.round?.driver?.direction === 'Motsatt')
        ? Math.max(0, S.filtered.length - 1)
        : 0;

      els.hint.textContent = (S.round?.job === 'GRUS')
        ? 'Viser kun adresser med grus-behov.'
        : 'Viser alle aktive adresser.';
      setMeta('OK');
      renderAddress();
      renderProgress();

      // vis/skjul navigasjonsknapper
      if (S.prefs?.autoNavNext) {
        if (els.prevBtn) els.prevBtn.style.display = 'none';
        if (els.nextBtn) els.nextBtn.style.display = 'none';
      } else {
        if (els.prevBtn) els.prevBtn.style.display = '';
        if (els.nextBtn) els.nextBtn.style.display = '';
      }
    } catch (e) {
      console.error(e);
      els.sync.textContent = 'Feil';
    }
  }
  els.syncBtn.onclick = sync;
  els.saveBtn.onclick = () => saveQuiet();

  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { flushQueue(); sync(); } });
  window.addEventListener('focus', () => { flushQueue(); sync(); });
  window.addEventListener('online', () => { flushQueue(); sync(); });

  function setMeta(syncMsg='—') {
    S.prefs = window.BroytState?.getPrefs?.() || S.prefs || {};
    S.round = window.BroytState?.getRound?.() || S.round;
    els.round.textContent = S.round?.number ?? '–';
    els.job.textContent   = S.round?.job ?? '–';
    els.dir.textContent   = S.round?.driver?.direction ?? '–';
    els.season.textContent= S.season || '–';
    els.sync.textContent  = syncMsg;
  }

  (function boot(){
    S.season = window.BroytState?.getSeason?.() || S.season;
    setMeta('—');
    sync();
  })();

  // --- Komprimer foto til dataURL (jpeg)
  function fileToCompressedDataURL(file, maxW=1280, quality=0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
})();