// logg.js – Leser report-bin, viser detaljert logg og summeringer

(() => {
  const REPORT_BIN_ID = '68e89e3443b1c97be9611c48';
  const MAX_INTERVAL_MS = 90 * 60 * 1000; // maks 90 min per sammenhengende jobb

  // --- DOM helpers ---
  const $ = (sel) => document.querySelector(sel);

  const sumContentEl = $('#sum_content');
  const driverSel    = $('#f_driver');
  const addrSel      = $('#f_addr');
  const jobsBody     = $('#jobs_body');
  const addrBody     = $('#addr_body');
  const limitSel     = $('#jobs_limit'); // kan være undefined

  let ALL_JOBS = [];        // alle jobber (uansett filter)
  let ALL_DRIVERS = [];     // alle sjåfører
  let ALL_ADDRS = [];       // alle adresser

  // --- Tidshjelpere ---
  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  function fmtDate(d) {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function fmtTime(d) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtMinDetailed(min) {
    if (!Number.isFinite(min) || min <= 0) return '0 min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h <= 0) return `${m} min`;
    return `${h} t ${m} min`;
  }

  function fmtMinShort(min) {
    if (!Number.isFinite(min) || min <= 0) return '0';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h <= 0) return `${m} min`;
    if (m === 0) return `${h} t`;
    return `${h} t ${m} min`;
  }

  function minutesBetween(startMs, endMs) {
    const diff = endMs - startMs;
    if (!Number.isFinite(diff) || diff <= 0) return 0;
    const clamped = Math.min(diff, MAX_INTERVAL_MS);
    return Math.max(1, Math.round(clamped / 60000)); // alltid minst 1 min
  }

  // --- JSONBin master key ---
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

  // --- Henting av data fra report-bin ---

  async function fetchReports() {
    const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
    const headers = {};
    const key = getMasterKey();
    if (key) headers['X-Master-Key'] = key;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('[logg] Klarte ikke å hente reports', res.status);
      throw new Error('Kunne ikke hente reports');
    }
    const json = await res.json();
    const record = json.record || json;
    // Vi forventer at selve arrayet ligger i record.reports eller record
    if (Array.isArray(record)) return record;
    if (Array.isArray(record.reports)) return record.reports;
    return [];
  }

  // --- Normalisering til jobber (start -> ferdig) ---

  /**
   * Vi bruker kun entries med "action":
   *   start / ferdig / ikke_mulig
   * Ignorerer:
   *   neste, andre ting, og "type"- entries, for å unngå dobbelt-logging.
   */
  function reportsToEvents(reports) {
    const events = [];

    for (const r of reports) {
      if (!r || !r.action) continue;

      const action = String(r.action).toLowerCase();
      if (action === 'neste') continue; // påvirker ikke tid

      let kind = null;
      if (action === 'start') kind = 'start';
      else if (action === 'ferdig' || action === 'ikke_mulig') kind = 'stop';

      if (!kind) continue;

      const ts = Date.parse(r.ts);
      if (!Number.isFinite(ts)) continue;

      const driver = (r.driver || 'Ukjent').trim() || 'Ukjent';
      const address = (r.address || '—').trim() || '—';

      events.push({
        ts,
        driver,
        address,
        kind
      });
    }

    return events;
  }

  /**
   * Lager jobber (start → stop) per (driver + adresse)
   * Returnerer: [{driver, address, startMs, endMs, minutes}]
   */
  function eventsToJobs(events) {
    const byKey = new Map();

    for (const ev of events) {
      const key = `${ev.driver}|||${ev.address}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(ev);
    }

    const jobs = [];

    for (const [key, arr] of byKey.entries()) {
      const [driver, address] = key.split('|||');
      arr.sort((a, b) => a.ts - b.ts);

      let open = null;

      for (const ev of arr) {
        if (ev.kind === 'start') {
          // Ignorer dobbelt-start, vi tar den siste som gjelder
          open = ev;
        } else if (ev.kind === 'stop') {
          if (open && ev.ts > open.ts) {
            const minutes = minutesBetween(open.ts, ev.ts);
            if (minutes > 0) {
              jobs.push({
                driver,
                address,
                startMs: open.ts,
                endMs:   ev.ts,
                minutes
              });
            }
          }
          open = null;
        }
      }
    }

    // Nyeste først
    jobs.sort((a, b) => b.startMs - a.startMs);
    return jobs;
  }

  // --- Filtrering & stats ---

  function getFilters() {
    const fDriver = driverSel?.value || '';
    const fAddr   = addrSel?.value || '';
    return { fDriver, fAddr };
  }

  function applyFilters(jobs) {
    const { fDriver, fAddr } = getFilters();
    return jobs.filter(job => {
      if (fDriver && job.driver !== fDriver) return false;
      if (fAddr && job.address !== fAddr) return false;
      return true;
    });
  }

  function computeSummary(filteredJobs) {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    // Forrige måned
    const prevMonthDate = new Date(todayY, todayM - 1, 1);
    const prevM = prevMonthDate.getMonth();
    const prevY = prevMonthDate.getFullYear();

    // Start på uke (mandag)
    const dow = (now.getDay() + 6) % 7; // 0 = mandag
    const weekStart = new Date(todayY, todayM, todayD - dow);
    weekStart.setHours(0, 0, 0, 0);

    let total = 0;
    let thisMonth = 0;
    let prevMonth = 0;
    let thisWeek = 0;
    let today = 0;

    for (const job of filteredJobs) {
      const min = job.minutes;
      if (!Number.isFinite(min) || min <= 0) continue;

      const d = new Date(job.startMs);
      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();

      total += min;

      if (y === todayY && m === todayM) {
        thisMonth += min;
        const dOnly = new Date(y, m, day);
        if (dOnly >= weekStart) thisWeek += min;
        if (day === todayD) today += min;
      } else if (y === prevY && m === prevM) {
        prevMonth += min;
      }
    }

    return { total, thisMonth, prevMonth, thisWeek, today };
  }

  // --- Renderere ---

  function renderSummary(filteredJobs) {
    if (!sumContentEl) return;

    if (!filteredJobs || filteredJobs.length === 0) {
      sumContentEl.innerHTML = `
        Fant ingen registrert brøytetid.
      `;
      return;
    }

    const { total, thisMonth, prevMonth, thisWeek, today } =
      computeSummary(filteredJobs);

    sumContentEl.innerHTML = `
      <div style="line-height:1.5;">
        <div>Totalt: <strong>${fmtMinDetailed(total)}</strong></div>
        <div>Forrige måned: <strong>${fmtMinDetailed(prevMonth)}</strong></div>
        <div>Denne måneden: <strong>${fmtMinDetailed(thisMonth)}</strong></div>
        <div>Denne uken: <strong>${fmtMinDetailed(thisWeek)}</strong></div>
        <div>I dag: <strong>${fmtMinDetailed(today)}</strong></div>
      </div>
      <div class="muted" style="margin-top:6px;">
        Hentes fra felles logg (alle sjåfører, etter valgte filtre).
      </div>
    `;
  }

  function getJobsLimit() {
    if (!limitSel) return Infinity;
    const val = parseInt(limitSel.value, 10);
    if (!Number.isFinite(val) || val <= 0) return Infinity;
    return val;
  }

  function renderJobs(filteredJobs) {
    if (!jobsBody) return;

    jobsBody.innerHTML = '';

    if (!filteredJobs || filteredJobs.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="6" style="padding:6px; text-align:center;" class="muted">
          Ingen jobber i valgt filter.
        </td>
      `;
      jobsBody.appendChild(tr);
      return;
    }

    const limit = getJobsLimit();
    const jobsToShow = filteredJobs.slice(0, limit);

    for (const job of jobsToShow) {
      const tr = document.createElement('tr');
      const dStart = new Date(job.startMs);
      const dEnd   = new Date(job.endMs);

      tr.innerHTML = `
        <td style="padding:6px;">${fmtDate(dStart)}</td>
        <td style="padding:6px;">${fmtTime(dStart)}</td>
        <td style="padding:6px;">${fmtTime(dEnd)}</td>
        <td style="padding:6px;">${job.address}</td>
        <td style="padding:6px;">${job.driver}</td>
        <td style="padding:6px; text-align:right;">${job.minutes}</td>
      `;
      jobsBody.appendChild(tr);
    }
  }

  function renderTimePerAddress(filteredJobs) {
    if (!addrBody) return;

    addrBody.innerHTML = '';

    if (!filteredJobs || filteredJobs.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="3" style="padding:6px; text-align:center;" class="muted">
          Ingen data i valgt filter.
        </td>
      `;
      addrBody.appendChild(tr);
      return;
    }

    // Aggreger per adresse
    const map = new Map(); // addr -> {minutes, count}
    for (const job of filteredJobs) {
      const key = job.address || '—';
      if (!map.has(key)) map.set(key, { minutes: 0, count: 0 });
      const agg = map.get(key);
      agg.minutes += job.minutes;
      agg.count += 1;
    }

    const rows = Array.from(map.entries())
      .map(([address, agg]) => ({
        address,
        minutes: agg.minutes,
        count: agg.count
      }))
      .sort((a, b) => b.minutes - a.minutes); // mest tid øverst

    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px;">${row.address}</td>
        <td style="padding:6px; text-align:right;">${fmtMinShort(row.minutes)}</td>
        <td style="padding:6px; text-align:right;">${row.count}</td>
      `;
      addrBody.appendChild(tr);
    }
  }

  function renderFilters(jobs) {
    if (driverSel) {
      const drivers = Array.from(
        new Set(jobs.map(j => j.driver || 'Ukjent'))
      ).sort((a, b) => a.localeCompare(b, 'nb'));

      driverSel.innerHTML = `<option value="">Alle sjåfører</option>`;
      for (const d of drivers) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        driverSel.appendChild(opt);
      }
      ALL_DRIVERS = drivers;
    }

    if (addrSel) {
      const addrs = Array.from(
        new Set(jobs.map(j => j.address || '—'))
      ).sort((a, b) => a.localeCompare(b, 'nb'));

      addrSel.innerHTML = `<option value="">Alle adresser</option>`;
      for (const a of addrs) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        addrSel.appendChild(opt);
      }
      ALL_ADDRS = addrs;
    }
  }

  function rerenderAll() {
    const filtered = applyFilters(ALL_JOBS);
    renderSummary(filtered);
    renderJobs(filtered);
    renderTimePerAddress(filtered);
  }

  // --- Init ---

  async function init() {
    try {
      if (sumContentEl) {
        sumContentEl.textContent = 'Laster samlet tid…';
      }

      const reports = await fetchReports();
      const events  = reportsToEvents(reports);
      const jobs    = eventsToJobs(events);

      ALL_JOBS = jobs;
      renderFilters(jobs);
      rerenderAll();
    } catch (err) {
      console.error('[logg] Feil under lasting:', err);
      if (sumContentEl) {
        sumContentEl.textContent = 'Kunne ikke laste loggdata.';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Lytt på filter-endringer
    driverSel?.addEventListener('change', rerenderAll);
    addrSel?.addEventListener('change', rerenderAll);
    limitSel?.addEventListener('change', rerenderAll);

    init();
  });
})();