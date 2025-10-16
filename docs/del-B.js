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
      els.finished.classList.add('