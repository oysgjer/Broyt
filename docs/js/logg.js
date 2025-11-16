// logg.js – detaljert logg + samlet brøytetid fra report-bin

// ----------------- KONFIG -----------------
const REPORT_BIN_ID = '68e89e3443b1c97be9611c48';
const MAX_INTERVAL_MS = 90 * 60 * 1000; // maks 90 min per økt

// ----------------- DOM-HJELPERE -----------------
const $    = (sel, root = document) => root.querySelector(sel);
const byId = (id) => document.getElementById(id);
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

function fmtNorDate(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtNorTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function msToNorDur(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} t`;
  return `${h} t ${m} min`;
}

// ----------------- DATO-INTERVALLER -----------------
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfPrevMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() - 1);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = søn
  const diff = (day + 6) % 7; // mandag som uke-start
  x.setDate(x.getDate() - diff);
  return x;
}

// ----------------- JSONBIN -----------------
const MASTER_KEY_KEYS = [
  'jsonbin_master_key',
  'jsonbin_master',
  'rt_jsonbin_master',
  'rt_jsonbin_key',
  'X-Master-Key'
];

function getMasterKey() {
  for (const k of MASTER_KEY_KEYS) {
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  return null;
}

async function fetchReports() {
  const key = getMasterKey();
  const headers = {};
  if (key) headers['X-Master-Key'] = key;

  const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`JSONbin feil ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const rec = data && (data.record || data);

  // Finn selve arrayen med rader
  if (Array.isArray(rec)) return rec;
  if (Array.isArray(rec.reports)) return rec.reports;
  if (rec && rec.reports && Array.isArray(rec.reports.reports)) return rec.reports.reports;

  console.warn('[logg] Fant ingen reports-array i record', rec);
  return [];
}

// ----------------- NORMALISER RADER -----------------
/**
 * Inn: rå rad fra reports-bin
 * Ut: { ts, driver, address, type: 'start'|'done'|'blocked', roundTask?:'S'|'G', notes }
 */
function normalizeRow(raw) {
  if (!raw) return null;

  const tsStr = raw.at || raw.ts || raw.time || raw.timestamp;
  const ts = Date.parse(tsStr);
  if (!Number.isFinite(ts)) return null;

  const driver = raw.by || raw.driver || 'Ukjent';
  const address =
    raw.addressId ||
    raw.addressName ||
    raw.address ||
    '—';

  const t = (raw.type || raw.action || '').toString().toLowerCase();
  let type;
  if (t === 'start') type = 'start';
  else if (t === 'done' || t === 'ferdig' || t === 'stopp' || t === 'stop') type = 'done';
  else if (t.includes('ikke')) type = 'blocked';
  else return null; // ignorer "neste" og annet støy

  // Oppgavekode for runden – logges av auto_logger på nye rader
  let roundTask = raw.roundTask;
  if (roundTask !== 'S' && roundTask !== 'G') roundTask = null;

  const notes =
    raw.notes ||
    (type === 'blocked' ? 'Ikke mulig' : '');

  return {
    ts,
    driver,
    address,
    type,
    roundTask, // kan være null
    notes,
    _raw: raw
  };
}

// ----------------- BYGG JOBBER (SESSIONS) -----------------
/**
 * sessions: [
 *   { from, to, durMs, driver, address, taskCode:'S'|'G'|'—', notes }
 * ]
 */
function buildSessions(normRows) {
  if (!Array.isArray(normRows) || normRows.length === 0) return [];

  // sortér eldste først for pairing
  const sorted = [...normRows].sort((a, b) => a.ts - b.ts);

  // gruppert per (driver + adresse)
  const byKey = new Map();
  for (const r of sorted) {
    const key = `${r.driver}@@${r.address}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }

  const sessions = [];

  for (const [, evs] of byKey) {
    let openStart = null;
    let openTask  = null;
    let openNotes = '';

    for (const ev of evs) {
      if (ev.type === 'start') {
        if (openStart == null) {
          openStart = ev.ts;
          openTask  = ev.roundTask || null;
          openNotes = '';
        }
      } else if (ev.type === 'done' || ev.type === 'blocked') {
        if (openStart != null && ev.ts > openStart) {
          let durMs = ev.ts - openStart;
          if (durMs > MAX_INTERVAL_MS) durMs = MAX_INTERVAL_MS;

          const taskCode = ev.roundTask || openTask || '—';
          const notes = (ev.type === 'blocked'
            ? (ev.notes || 'Ikke mulig')
            : ev.notes || openNotes || '');

          sessions.push({
            from: openStart,
            to: ev.ts,
            durMs,
            driver: ev.driver,
            address: ev.address,
            taskCode,
            notes
          });
        }
        openStart = null;
        openTask  = null;
        openNotes = '';
      }
    }
  }

  // NYESTE ØVERST
  sessions.sort((a, b) => b.to - a.to);
  return sessions;
}

// ----------------- AGGREGATER -----------------
function buildAggregates(sessions) {
  const now = new Date();
  const todayStart   = startOfDay(now).getTime();
  const weekStart    = startOfWeek(now).getTime();
  const monthStart   = startOfMonth(now).getTime();
  const prevMonthSt  = startOfPrevMonth(now).getTime();
  const thisMonthSt  = monthStart;

  let totalMs = 0;
  let todayMs = 0;
  let weekMs  = 0;
  let monthMs = 0;
  let prevMonthMs = 0;

  const driverMap = new Map();
  const addrMap   = new Map(); // key: address@@taskCode

  for (const s of sessions) {
    const mid = (s.from + s.to) / 2;
    const ms  = s.durMs;
    totalMs += ms;

    if (mid >= todayStart) todayMs += ms;
    if (mid >= weekStart)  weekMs  += ms;
    if (mid >= monthStart) monthMs += ms;
    if (mid >= prevMonthSt && mid < thisMonthSt) prevMonthMs += ms;

    // per sjåfør
    const dKey = s.driver || 'Ukjent';
    driverMap.set(dKey, (driverMap.get(dKey) || 0) + ms);

    // per adresse + oppgave
    const tCode = s.taskCode || '—';
    const aKey = `${s.address}@@${tCode}`;
    if (!addrMap.has(aKey)) {
      addrMap.set(aKey, {
        address: s.address,
        taskCode: tCode,
        ms: 0,
        count: 0
      });
    }
    const rec = addrMap.get(aKey);
    rec.ms += ms;
    rec.count += 1;
  }

  return {
    totalMs,
    todayMs,
    weekMs,
    monthMs,
    prevMonthMs,
    perDriver: Array.from(driverMap.entries())
      .map(([driver, ms]) => ({ driver, ms }))
      .sort((a, b) => b.ms - a.ms),
    perAddress: Array.from(addrMap.values())
      .sort((a, b) => b.ms - a.ms)
  };
}

// ----------------- RENDER: SAMLET TID -----------------
function renderSummary(agg) {
  const { totalMs, todayMs, weekMs, monthMs, prevMonthMs } = agg;

  const elTotal = byId('sum_total');
  const elPrev  = byId('sum_prev_month');
  const elMonth = byId('sum_this_month');
  const elWeek  = byId('sum_this_week');
  const elToday = byId('sum_today');

  if (elTotal) elTotal.textContent = msToNorDur(totalMs);
  if (elPrev)  elPrev.textContent  = msToNorDur(prevMonthMs);
  if (elMonth) elMonth.textContent = msToNorDur(monthMs);
  if (elWeek)  elWeek.textContent  = msToNorDur(weekMs);
  if (elToday) elToday.textContent = msToNorDur(todayMs);
}

// ----------------- RENDER: FILTRE -----------------
function populateFilters(sessions) {
  const selDriver = byId('filter_driver');
  const selAddr   = byId('filter_address');
  if (!selDriver || !selAddr) return;

  const drivers = new Set();
  const addrs   = new Set();
  sessions.forEach(s => {
    if (s.driver) drivers.add(s.driver);
    if (s.address) addrs.add(s.address);
  });

  selDriver.innerHTML = '';
  const optAllD = document.createElement('option');
  optAllD.value = '';
  optAllD.textContent = 'Alle sjåfører';
  selDriver.appendChild(optAllD);
  Array.from(drivers).sort().forEach(d => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = d;
    selDriver.appendChild(o);
  });

  selAddr.innerHTML = '';
  const optAllA = document.createElement('option');
  optAllA.value = '';
  optAllA.textContent = 'Alle adresser';
  selAddr.appendChild(optAllA);
  Array.from(addrs).sort().forEach(a => {
    const o = document.createElement('option');
    o.value = a;
    o.textContent = a;
    selAddr.appendChild(o);
  });
}

// ----------------- RENDER: TABELLER -----------------
function renderSessionsTable(sessions) {
  const tbody = byId('tbl_sessions');
  if (!tbody) return;
  tbody.innerHTML = '';

  sessions.forEach(s => {
    const tr = document.createElement('tr');
    const dFrom = new Date(s.from);
    const dTo   = new Date(s.to);

    const tdDate = document.createElement('td');
    const tdFrom = document.createElement('td');
    const tdTo   = document.createElement('td');
    const tdAddr = document.createElement('td');
    const tdTask = document.createElement('td');
    const tdDrv  = document.createElement('td');
    const tdDur  = document.createElement('td');
    const tdNote = document.createElement('td');

    tdDate.textContent = fmtNorDate(dFrom);
    tdFrom.textContent = fmtNorTime(dFrom);
    tdTo.textContent   = fmtNorTime(dTo);
    tdAddr.textContent = s.address || '—';
    tdTask.textContent = s.taskCode || '—';   // S / G / —
    tdDrv.textContent  = s.driver || 'Ukjent';
    tdDur.textContent  = msToNorDur(s.durMs);
    tdNote.textContent = s.notes || '';

    tr.appendChild(tdDate);
    tr.appendChild(tdFrom);
    tr.appendChild(tdTo);
    tr.appendChild(tdAddr);
    tr.appendChild(tdTask);
    tr.appendChild(tdDrv);
    tr.appendChild(tdDur);
    tr.appendChild(tdNote);

    tbody.appendChild(tr);
  });
}

function renderPerDriver(agg) {
  const tbody = byId('tbl_driver');
  if (!tbody) return;
  tbody.innerHTML = '';

  agg.perDriver.forEach(row => {
    const tr = document.createElement('tr');
    const tdDrv = document.createElement('td');
    const tdMs  = document.createElement('td');
    tdDrv.textContent = row.driver || 'Ukjent';
    tdMs.textContent  = msToNorDur(row.ms);
    tr.appendChild(tdDrv);
    tr.appendChild(tdMs);
    tbody.appendChild(tr);
  });
}

function renderPerAddress(agg) {
  const tbody = byId('tbl_addr');
  if (!tbody) return;
  tbody.innerHTML = '';

  agg.perAddress.forEach(row => {
    const tr = document.createElement('tr');
    const tdAddr = document.createElement('td');
    const tdTask = document.createElement('td');
    const tdMs   = document.createElement('td');
    const tdCnt  = document.createElement('td');

    tdAddr.textContent = row.address || '—';
    tdTask.textContent = row.taskCode || '—';
    tdMs.textContent   = msToNorDur(row.ms);
    tdCnt.textContent  = String(row.count);

    tr.appendChild(tdAddr);
    tr.appendChild(tdTask);
    tr.appendChild(tdMs);
    tr.appendChild(tdCnt);

    tbody.appendChild(tr);
  });
}

// ----------------- FILTRERING -----------------
function applyFilters(allSessions) {
  const selDriver = byId('filter_driver');
  const selAddr   = byId('filter_address');

  const driverVal = selDriver ? selDriver.value : '';
  const addrVal   = selAddr ? selAddr.value : '';

  return allSessions.filter(s => {
    if (driverVal && s.driver !== driverVal) return false;
    if (addrVal && s.address !== addrVal) return false;
    return true;
  });
}

// ----------------- HOVEDFLYT -----------------
document.addEventListener('DOMContentLoaded', async () => {
  const sumTotal = byId('sum_total');
  if (sumTotal) sumTotal.textContent = 'Laster…';

  try {
    const rawReports = await fetchReports();
    const normRows = rawReports.map(normalizeRow).filter(Boolean);

    const allSessions = buildSessions(normRows);
    const aggAll = buildAggregates(allSessions);

    renderSummary(aggAll);
    populateFilters(allSessions);
    renderSessionsTable(allSessions);
    renderPerDriver(aggAll);
    renderPerAddress(aggAll);

    const selDriver = byId('filter_driver');
    const selAddr   = byId('filter_address');
    const onChange  = () => {
      const filtered = applyFilters(allSessions);
      const aggF     = buildAggregates(filtered);
      renderSummary(aggF);
      renderSessionsTable(filtered);
      renderPerDriver(aggF);
      renderPerAddress(aggF);
    };
    selDriver && selDriver.addEventListener('change', onChange);
    selAddr   && selAddr.addEventListener('change', onChange);
  } catch (err) {
    console.error('[logg] Feil:', err);
    if (sumTotal) sumTotal.textContent = 'Feil ved henting av data';
  }
});