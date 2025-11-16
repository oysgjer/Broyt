// logg.js – leser JSONBin-report-bin, lager detaljert logg + summeringer

const REPORT_BIN_ID = '68e89e3443b1c97be9611c48';

// --- Små hjelpere ----------------------------------------------------------

const $  = (sel, root = document) => root.querySelector(sel);
const byId = (id) => document.getElementById(id);
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

function fmtDate(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function msToHhMm(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} t ${m.toString().padStart(2, '0')} min`;
}

// --- Hent master key fra localStorage -------------------------------------

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

// --- Normaliser rå-rader fra JSONBin ---------------------------------------

/**
 * Vi støtter:
 *  - Nytt format: { type:'start'|'done', addressId, addressName, at, by, roundTask? }
 *  - Gammelt format: { ts, driver, address, task, action:'start'|'ferdig'|'neste'|'ikke_mulig', notes }
 */
function normalizeEvents(raw) {
  if (!Array.isArray(raw)) return [];

  const norm = [];

  for (const r of raw) {
    if (!r) continue;

    const tsStr = r.at || r.ts;
    const ts = Date.parse(tsStr);
    if (!Number.isFinite(ts)) continue;

    const address =
      r.addressId ||
      r.addressName ||
      r.address ||
      '—';

    const driver =
      r.by ||
      r.driver ||
      '—';

    let op = null; // 'start' | 'stop' | 'not_possible' | 'next'

    if (r.type === 'start' || r.action === 'start') {
      op = 'start';
    } else if (r.type === 'done' || r.action === 'ferdig') {
      op = 'stop';
    } else if (r.action === 'ikke_mulig') {
      op = 'not_possible';
    } else if (r.action === 'neste') {
      op = 'next';
    } else {
      // andre typer bryr vi oss ikke om i loggen
      continue;
    }

    // Oppgave S/G – fremover vil vi legge inn roundTask på loggingen
    let task = null;
    if (r.roundTask === 'S' || r.roundTask === 'G') {
      task = r.roundTask;
    } else if (r.task === 'S' || r.task === 'G') {
      task = r.task;
    } else if (typeof r.task === 'string') {
      const t = r.task.toLowerCase();
      if (t.includes('grus')) task = 'G';
      else if (t.includes('snø')) task = 'S';
    }

    const notes = r.notes || '';

    norm.push({ ts, address, driver, op, task, notes });
  }

  return norm;
}

// --- Lag sammenhengende jobber (start -> ferdig/ikke_mulig) ----------------

/**
 * @param {Array} events - normaliserte events sortert etter tid
 * Returnerer array med jobber:
 *   { fromTs, toTs, address, driver, task, minutes, notPossible, notes }
 */
function buildJobs(events) {
  if (!Array.isArray(events)) return [];

  // Sorter i tidsrekkefølge
  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  // Grupper per adresse + sjåfør
  const groups = new Map();
  for (const ev of sorted) {
    if (!ev.address || !ev.driver) continue;
    if (!['start', 'stop', 'not_possible'].includes(ev.op)) continue;

    const key = `${ev.address}||${ev.driver}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  }

  const jobs = [];

  for (const [, arr] of groups) {
    arr.sort((a, b) => a.ts - b.ts);
    let openStart = null;

    for (const ev of arr) {
      if (ev.op === 'start') {
        // Ny start – overskriv evt. "glemt" start
        openStart = ev;
      } else if (ev.op === 'stop' || ev.op === 'not_possible') {
        if (!openStart) {
          // Ferdig uten start – lager ikke jobb
          continue;
        }
        if (ev.ts <= openStart.ts) {
          openStart = null;
          continue;
        }

        const fromTs = openStart.ts;
        const toTs = ev.ts;
        const minutes = (toTs - fromTs) / 60000;

        let task = ev.task || openStart.task;
        if (!task) {
          // Frem til vi har bedre data: antas snø (S)
          task = 'S';
        }

        let notes = ev.notes || openStart.notes || '';
        if (ev.op === 'not_possible') {
          notes = notes ? `${notes} (Ikke mulig)` : 'Ikke mulig';
        }

        jobs.push({
          fromTs,
          toTs,
          address: ev.address || openStart.address,
          driver: ev.driver || openStart.driver,
          task,
          minutes,
          notPossible: ev.op === 'not_possible',
          notes
        });

        openStart = null;
      }
    }
  }

  // Nyeste øverst
  jobs.sort((a, b) => b.toTs - a.toTs);
  return jobs;
}

// --- Samlet brøytetid (totalt / dag / uke / mnd) ---------------------------

function calcSamletTidBuckets(jobs) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Uke (mandag som første dag)
  const weekStart = new Date(todayStart);
  const dow = (weekStart.getDay() + 6) % 7; // 0 = mandag
  weekStart.setDate(weekStart.getDate() - dow);

  let totalMs = 0;
  let todayMs = 0;
  let weekMs = 0;
  let thisMonthMs = 0;
  let prevMonthMs = 0;

  for (const j of jobs) {
    if (!Number.isFinite(j.minutes)) continue;
    const durMs = j.minutes * 60000;
    totalMs += durMs;

    const mid = new Date((j.fromTs + j.toTs) / 2);

    if (mid >= todayStart && mid < tomorrowStart) {
      todayMs += durMs;
    }
    if (mid >= weekStart && mid < tomorrowStart) {
      weekMs += durMs;
    }
    if (mid >= monthStart && mid < nextMonthStart) {
      thisMonthMs += durMs;
    }
    if (mid >= prevMonthStart && mid < monthStart) {
      prevMonthMs += durMs;
    }
  }

  return { totalMs, todayMs, weekMs, thisMonthMs, prevMonthMs };
}

function renderSamletTid(jobs) {
  const { totalMs, todayMs, weekMs, thisMonthMs, prevMonthMs } =
    calcSamletTidBuckets(jobs);

  const statusEl = byId('sum_status');
  if (!jobs.length) {
    if (statusEl) statusEl.textContent = 'Fant ingen registrert brøytetid.';
  } else if (statusEl) {
    statusEl.textContent = 'Hentes fra felles logg (alle sjåfører).';
  }

  const set = (id, ms) => {
    const el = byId(id);
    if (el) el.textContent = msToHhMm(ms);
  };

  set('sum_total', totalMs);
  set('sum_prev_month', prevMonthMs);
  set('sum_this_month', thisMonthMs);
  set('sum_this_week', weekMs);
  set('sum_today', todayMs);
}

// --- Filtre (sjåfør / adresse) ---------------------------------------------

function buildFilterOptions(jobs) {
  const selDriver = byId('filter_driver');
  const selAddr = byId('filter_address');
  if (!selDriver || !selAddr) return;

  const drivers = new Set();
  const addrs = new Set();

  for (const j of jobs) {
    if (j.driver) drivers.add(j.driver);
    if (j.address) addrs.add(j.address);
  }

  // Rens opp først
  selDriver.innerHTML = '';
  selAddr.innerHTML = '';

  const optAllDriver = document.createElement('option');
  optAllDriver.value = '';
  optAllDriver.textContent = 'Alle sjåfører';
  selDriver.appendChild(optAllDriver);

  [...drivers].sort().forEach((d) => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = d;
    selDriver.appendChild(o);
  });

  const optAllAddr = document.createElement('option');
  optAllAddr.value = '';
  optAllAddr.textContent = 'Alle adresser';
  selAddr.appendChild(optAllAddr);

  [...addrs].sort().forEach((a) => {
    const o = document.createElement('option');
    o.value = a;
    o.textContent = a;
    selAddr.appendChild(o);
  });
}

function applyFilters(jobs) {
  const selDriver = byId('filter_driver');
  const selAddr = byId('filter_address');
  const d = selDriver ? selDriver.value : '';
  const a = selAddr ? selAddr.value : '';

  return jobs.filter((j) => {
    if (d && j.driver !== d) return false;
    if (a && j.address !== a) return false;
    return true;
  });
}

// --- Render: detaljert logg ------------------------------------------------

function renderDetaljertLogg(jobs) {
  const tbody = byId('jobs_tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!jobs.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'Ingen jobber i valgt filter.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const j of jobs) {
    const tr = document.createElement('tr');

    const from = new Date(j.fromTs);
    const to = new Date(j.toTs);

    const tdDato = document.createElement('td');
    tdDato.textContent = fmtDate(from);
    tr.appendChild(tdDato);

    const tdFra = document.createElement('td');
    tdFra.textContent = fmtTime(from);
    tr.appendChild(tdFra);

    const tdTil = document.createElement('td');
    tdTil.textContent = fmtTime(to);
    tr.appendChild(tdTil);

    const tdAddr = document.createElement('td');
    tdAddr.textContent = j.address;
    tr.appendChild(tdAddr);

    const tdOppg = document.createElement('td');
    tdOppg.textContent = j.task || '—'; // S / G
    tr.appendChild(tdOppg);

    const tdDrv = document.createElement('td');
    tdDrv.textContent = j.driver;
    tr.appendChild(tdDrv);

    const tdNotes = document.createElement('td');
    tdNotes.textContent = j.notes || '';
    tr.appendChild(tdNotes);

    tbody.appendChild(tr);
  }
}

// --- Render: tid per adresse -----------------------------------------------

function renderTidPerAdresse(jobs) {
  const tbody = byId('addr_tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!jobs.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Ingen data i valgt filter.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const map = new Map(); // key: address||task

  for (const j of jobs) {
    const task = j.task || 'S';
    const key = `${j.address}||${task}`;
    if (!map.has(key)) {
      map.set(key, { address: j.address, task, totalMin: 0, count: 0 });
    }
    const row = map.get(key);
    row.totalMin += j.minutes || 0;
    row.count += 1;
  }

  const rows = [...map.values()].sort((a, b) =>
    a.address.localeCompare(b.address, 'nb')
  );

  for (const r of rows) {
    const tr = document.createElement('tr');

    const tdAddr = document.createElement('td');
    tdAddr.textContent = r.address;
    tr.appendChild(tdAddr);

    const tdTask = document.createElement('td');
    tdTask.textContent = r.task;
    tr.appendChild(tdTask);

    const tdTid = document.createElement('td');
    tdTid.textContent = msToHhMm(r.totalMin * 60000);
    tr.appendChild(tdTid);

    const tdCount = document.createElement('td');
    tdCount.textContent = String(r.count);
    tr.appendChild(tdCount);

    tbody.appendChild(tr);
  }
}

// --- Hent fra JSONBin og start alt -----------------------------------------

async function fetchLogEvents() {
  const key = getMasterKey();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['X-Master-Key'] = key;

  const statusEl = byId('sum_status');
  if (statusEl) statusEl.textContent = 'Laster samlet tid…';

  try {
    const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('[logg] Klarte ikke å hente report-bin', res.status);
      if (statusEl) statusEl.textContent = 'Kunne ikke hente data fra JSONbin.';
      return [];
    }

    const data = await res.json();
    const record = data && (data.record || data);

    let raw = [];
    if (Array.isArray(record)) {
      raw = record;
    } else if (record && Array.isArray(record.reports)) {
      raw = record.reports;
    } else if (record && Array.isArray(record.hendelser)) {
      raw = record.hendelser;
    } else {
      console.warn('[logg] Ukjent struktur i record, forventer array');
    }

    return normalizeEvents(raw);
  } catch (err) {
    console.error('[logg] Feil ved henting av report-bin', err);
    if (statusEl) statusEl.textContent = 'Feil ved henting av data.';
    return [];
  }
}

// --- Init -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  const events = await fetchLogEvents();
  const allJobs = buildJobs(events);

  renderSamletTid(allJobs);
  buildFilterOptions(allJobs);

  function refresh() {
    const filtered = applyFilters(allJobs);
    renderDetaljertLogg(filtered);
    renderTidPerAdresse(filtered);
  }

  const selDriver = byId('filter_driver');
  const selAddr = byId('filter_address');
  selDriver && selDriver.addEventListener('change', refresh);
  selAddr && selAddr.addEventListener('change', refresh);

  refresh();
});