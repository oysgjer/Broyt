// logg.js – leser report-bin, parer start/ferdig og viser logg + summer
// Bin med rapporter
const REPORT_BIN_ID = '68e89e3443b1c97be9611c48';

// --- Tidshjelpere ---
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

function fmtDate(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(
    d.getFullYear()
  ).slice(-2)}`;
}
function fmtTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function msToHhMm(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} t ${m} min`;
}

// --- Master key fra localStorage ---
function getMasterKey() {
  const KEYS = [
    'jsonbin_master_key',
    'jsonbin_master',
    'rt_jsonbin_master',
    'rt_jsonbin_key',
    'X-Master-Key'
  ];
  for (const k of KEYS) {
    const v = localStorage.getItem(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

// --- Hent rapporter fra JSONbin ---
async function fetchReports() {
  const key = getMasterKey();
  if (!key) {
    console.warn('[logg] Fant ingen X-Master-Key i localStorage');
    return [];
  }

  const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
  const res = await fetch(url, {
    headers: { 'X-Master-Key': key }
  });

  if (!res.ok) {
    console.warn('[logg] Klarte ikke å hente reports', res.status);
    return [];
  }

  const data = await res.json();
  const record = data && (data.record || data);
  if (!record) return [];
  return Array.isArray(record.reports) ? record.reports : [];
}

// --- Normaliser til interne events for paring ---
function normalizeReportsToEvents(reports) {
  const events = [];

  for (const r of reports) {
    // Type: start / ferdig
    let kind = null;
    if (r.type === 'start' || r.action === 'start') kind = 'start';
    else if (r.type === 'done' || r.action === 'ferdig') kind = 'stop';
    else continue; // ignorer "neste" osv.

    const addr =
      r.addressId || r.addressName || r.address || r.addrId || 'Ukjent adresse';
    const driver = (r.by || r.driver || 'Ukjent sjåfør').trim() || 'Ukjent sjåfør';

    const tsStr = r.at || r.ts;
    const ts = Date.parse(tsStr);
    if (!Number.isFinite(ts)) continue;

    // Oppgave: S / G – vi forventer at nye rader får roundTask = 'S' eller 'G'
    let task = null;
    if (r.roundTask === 'S' || r.roundTask === 'G') {
      task = r.roundTask;
    } else if (typeof r.roundTask === 'string') {
      const t = r.roundTask.trim().toUpperCase();
      if (t.startsWith('S')) task = 'S';
      else if (t.startsWith('G')) task = 'G';
    } else if (typeof r.task === 'string') {
      const t = r.task.trim().toUpperCase();
      if (t === 'S' || t === 'G') task = t;
    }
    // Hvis vi fortsatt ikke vet: null => vises som "—" i tabell

    events.push({
      kind,
      addr,
      driver,
      task, // 'S' | 'G' | null
      ts
    });
  }

  return events;
}

// --- Par start/stop til jobber ---
function pairEventsToJobs(events) {
  if (!Array.isArray(events) || !events.length) return [];

  // grupper på adresse + sjåfør + oppgave-type
  const groups = new Map();
  for (const e of events) {
    const key = `${e.addr}||${e.driver}||${e.task || '-'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const jobs = [];

  for (const [key, arr] of groups.entries()) {
    arr.sort((a, b) => a.ts - b.ts);
    let openStart = null;

    for (const e of arr) {
      if (e.kind === 'start') {
        // start på ny periode
        openStart = e.ts;
      } else if (e.kind === 'stop') {
        if (openStart != null && e.ts > openStart) {
          const [addr, driver, taskStr] = key.split('||');
          const task = taskStr === '-' ? null : taskStr;
          jobs.push({
            addr,
            driver,
            task, // 'S'|'G'|null
            fromTs: openStart,
            toTs: e.ts,
            durMs: e.ts - openStart
          });
        }
        openStart = null;
      }
    }
  }

  // Nyeste først
  jobs.sort((a, b) => b.toTs - a.toTs);
  return jobs;
}

// --- Samlet brøytetid (ALLE jobber, uavhengig av filtre) ---
function renderSummary(jobs) {
  const el = document.getElementById('sum_content');
  if (!el) return;

  if (!jobs.length) {
    el.textContent = 'Fant ingen registrert brøytetid.';
    return;
  }

  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  // Start på uke (mandag)
  const dow = (now.getDay() + 6) % 7; // 0 = mandag
  const weekStart = new Date(todayY, todayM, todayD - dow);

  const thisMonth = { y: todayY, m: todayM };
  const prevMonth =
    todayM === 0
      ? { y: todayY - 1, m: 11 }
      : { y: todayY, m: todayM - 1 };

  let msTotal = 0;
  let msToday = 0;
  let msThisWeek = 0;
  let msThisMonth = 0;
  let msPrevMonth = 0;

  for (const j of jobs) {
    const d = new Date(j.fromTs);
    const dy = d.getFullYear();
    const dm = d.getMonth();
    const dd = d.getDate();

    msTotal += j.durMs;

    // I dag
    if (dy === todayY && dm === todayM && dd === todayD) {
      msToday += j.durMs;
    }

    // Denne uka (fra mandag)
    if (d >= weekStart && d <= now) {
      msThisWeek += j.durMs;
    }

    // Denne måneden
    if (dy === thisMonth.y && dm === thisMonth.m) {
      msThisMonth += j.durMs;
    }

    // Forrige måned
    if (dy === prevMonth.y && dm === prevMonth.m) {
      msPrevMonth += j.durMs;
    }
  }

  el.innerHTML = `
    <div>Totalt: <strong>${msToHhMm(msTotal)}</strong></div>
    <div>Forrige måned: <strong>${msToHhMm(msPrevMonth)}</strong></div>
    <div>Denne måneden: <strong>${msToHhMm(msThisMonth)}</strong></div>
    <div>Denne uken: <strong>${msToHhMm(msThisWeek)}</strong></div>
    <div>I dag: <strong>${msToHhMm(msToday)}</strong></div>
  `;
}

// --- Filtre UI ---
function buildFilters(jobs) {
  const fDriver = document.getElementById('f_driver');
  const fAddr = document.getElementById('f_addr');
  if (!fDriver || !fAddr) return;

  const drivers = new Set();
  const addrs = new Set();

  for (const j of jobs) {
    drivers.add(j.driver);
    addrs.add(j.addr);
  }

  // Sjåfør
  fDriver.innerHTML = '<option value="">Alle sjåfører</option>';
  Array.from(drivers)
    .sort((a, b) => a.localeCompare(b))
    .forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      fDriver.appendChild(opt);
    });

  // Adresse
  fAddr.innerHTML = '<option value="">Alle adresser</option>';
  Array.from(addrs)
    .sort((a, b) => a.localeCompare(b))
    .forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      fAddr.appendChild(opt);
    });
}

function applyFilters(jobs) {
  const fDriver = document.getElementById('f_driver');
  const fAddr = document.getElementById('f_addr');
  const dVal = fDriver ? fDriver.value : '';
  const aVal = fAddr ? fAddr.value : '';

  return jobs.filter((j) => {
    if (dVal && j.driver !== dVal) return false;
    if (aVal && j.addr !== aVal) return false;
    return true;
  });
}

// --- Render detaljert logg ---
function renderJobsTable(jobs) {
  const body = document.getElementById('jobs_body');
  if (!body) return;
  body.innerHTML = '';

  if (!jobs.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'Ingen jobber i valgt filter.';
    td.style.padding = '6px';
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  for (const j of jobs) {
    const tr = document.createElement('tr');
    const from = new Date(j.fromTs);
    const to = new Date(j.toTs);
    const mins = Math.round(j.durMs / 60000);

    const tds = [
      fmtDate(from),
      fmtTime(from),
      fmtTime(to),
      j.addr,
      j.task === 'S' ? 'S' : j.task === 'G' ? 'G' : '—',
      j.driver,
      String(mins)
    ];

    tds.forEach((val, idx) => {
      const td = document.createElement('td');
      td.textContent = val;
      td.style.padding = '4px 6px';
      if (idx === 6) td.style.textAlign = 'right';
      tr.appendChild(td);
    });

    body.appendChild(tr);
  }
}

// --- Render tid per adresse ---
function renderAddrTable(jobs) {
  const body = document.getElementById('addr_body');
  if (!body) return;
  body.innerHTML = '';

  if (!jobs.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Ingen data i valgt filter.';
    td.style.padding = '6px';
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  // grupper på adresse + task
  const byKey = new Map();
  for (const j of jobs) {
    const key = `${j.addr}||${j.task || '-'}`;
    if (!byKey.has(key)) byKey.set(key, { addr: j.addr, task: j.task, ms: 0, count: 0 });
    const agg = byKey.get(key);
    agg.ms += j.durMs;
    agg.count += 1;
  }

  const rows = Array.from(byKey.values()).sort((a, b) =>
    a.addr.localeCompare(b.addr)
  );

  for (const r of rows) {
    const tr = document.createElement('tr');

    const cols = [
      r.addr,
      r.task === 'S' ? 'S' : r.task === 'G' ? 'G' : '—',
      msToHhMm(r.ms),
      String(r.count)
    ];

    cols.forEach((val, idx) => {
      const td = document.createElement('td');
      td.textContent = val;
      td.style.padding = '4px 6px';
      if (idx >= 2) td.style.textAlign = 'right';
      tr.appendChild(td);
    });

    body.appendChild(tr);
  }
}

// --- Init ---
async function initLogg() {
  try {
    const reports = await fetchReports();
    const events = normalizeReportsToEvents(reports);
    const allJobs = pairEventsToJobs(events);

    renderSummary(allJobs);
    buildFilters(allJobs);

    const updateAll = () => {
      const filtered = applyFilters(allJobs);
      renderJobsTable(filtered);
      renderAddrTable(filtered);
    };

    updateAll();

    const fDriver = document.getElementById('f_driver');
    const fAddr = document.getElementById('f_addr');
    fDriver && fDriver.addEventListener('change', updateAll);
    fAddr && fAddr.addEventListener('change', updateAll);
  } catch (err) {
    console.error('[logg] Init-feil', err);
    const el = document.getElementById('sum_content');
    if (el) el.textContent = 'Feil ved lasting av logg.';
  }
}

document.addEventListener('DOMContentLoaded', initLogg);