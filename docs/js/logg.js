// logg.js – bygger detaljert logg og tid per adresse fra report-bin
(() => {
  'use strict';

  const REPORT_BIN_ID = '68e89e3443b1c97be9611c48';

  // --- DOM ---
  const sumContentEl = document.getElementById('sum_content');
  const driverSelect = document.getElementById('f_driver');
  const addrSelect   = document.getElementById('f_addr');
  const jobsBody     = document.getElementById('jobs_body');
  const addrBody     = document.getElementById('addr_body');

  // --- State ---
  let allEvents = [];   // normaliserte hendelser (start/ferdig osv.)
  let allJobs   = [];   // sammenhengende jobber (start→ferdig)

  // --- Hjelpere for tid/format ---
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  const fmtDate = (d) =>
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

  const fmtTime = (d) =>
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  // --- Finn X-Master-Key fra localStorage (samme logikk som ellers i appen) ---
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

  // --- Normaliser raw JSONbin-data til et enkelt event-format ---
  function normalizeEvents(record) {
    let raw = [];

    if (Array.isArray(record)) {
      raw = record;
    } else if (record && Array.isArray(record.reports)) {
      raw = record.reports;
    } else if (record && Array.isArray(record.hendelser)) {
      raw = record.hendelser;
    } else {
      raw = [];
    }

    const events = [];

    for (const r of raw) {
      if (!r) continue;

      // Vi bryr oss om rader med "action" (start/ferdig/ikke_mulig/neste)
      if (!r.action) continue;

      const tsStr = r.ts;
      if (!tsStr) continue;

      const t = Date.parse(tsStr);
      if (!Number.isFinite(t)) continue;

      // Normaliser action
      let action = String(r.action).toLowerCase();
      if (action === 'stopp') action = 'ferdig';
      if (action === 'done')  action = 'ferdig';

      // Vi bruker driver + adresse som i appen
      const driver  = r.driver || r.by || 'Ukjent';
      const address = r.address || r.addressName || r.addressId || '—';

      events.push({
        ts: t,
        date: new Date(t),
        driver,
        address,
        action
      });
    }

    return events;
  }

  // --- Bygg jobber (én linje per start→ferdig) ---
  function buildJobs(events) {
    const jobs = [];

    // Grupper pr. driver+adresse
    const groups = new Map();
    for (const ev of events) {
      if (ev.action !== 'start' && ev.action !== 'ferdig') continue;
      const key = `${ev.driver}||${ev.address}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }

    for (const [key, arr] of groups) {
      arr.sort((a, b) => a.ts - b.ts);
      let open = null;

      for (const ev of arr) {
        if (ev.action === 'start') {
          if (!open) {
            open = ev;
          }
        } else if (ev.action === 'ferdig') {
          if (open && ev.ts >= open.ts) {
            let minutes = Math.round((ev.ts - open.ts) / 60000);
            if (minutes < 0) minutes = 0;

            jobs.push({
              startTs: open.ts,
              endTs:   ev.ts,
              start:   new Date(open.ts),
              end:     new Date(ev.ts),
              driver:  ev.driver,
              address: ev.address,
              minutes
            });

            open = null;
          }
        }
      }
      // Åpen start uten ferdig ignoreres.
    }

    return jobs;
  }

  // --- Fyll nedtrekkslister for sjåfør og adresse ---
  function populateFilters(events) {
    const drivers = new Set();
    const addrs   = new Set();

    for (const ev of events) {
      if (ev.driver)  drivers.add(ev.driver);
      if (ev.address) addrs.add(ev.address);
    }

    // Sjåfør
    driverSelect.innerHTML = '<option value="">Alle sjåfører</option>';
    Array.from(drivers).sort((a, b) => a.localeCompare(b, 'nb')).forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      driverSelect.appendChild(opt);
    });

    // Adresse
    addrSelect.innerHTML = '<option value="">Alle adresser</option>';
    Array.from(addrs).sort((a, b) => a.localeCompare(b, 'nb')).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      addrSelect.appendChild(opt);
    });
  }

  // --- Render samlet brøytetid (øverst på siden) ---
  function renderSummary(jobs) {
    if (!sumContentEl) return;

    if (!jobs || jobs.length === 0) {
      sumContentEl.textContent = 'Ingen registrerte jobber i valgt filter.';
      return;
    }

    const totalMin = jobs.reduce((acc, j) => acc + (j.minutes || 0), 0);
    const totalJobs = jobs.length;

    // Enkle tall – dette er logg-sida, så her skal det være detaljert/ærlig
    sumContentEl.textContent =
      `Totalt ${totalMin} minutter fordelt på ${totalJobs} jobber ` +
      `(etter valgte filtre).`;
  }

  // --- Render detaljert logg (nyeste øverst) ---
  function renderJobs(jobs) {
    if (!jobsBody) return;
    jobsBody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="6" style="padding:8px;text-align:center;" class="muted">
          Ingen jobber å vise.
        </td>`;
      jobsBody.appendChild(tr);
      return;
    }

    const sorted = [...jobs].sort((a, b) => b.startTs - a.startTs);

    for (const j of sorted) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${fmtDate(j.start)}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${fmtTime(j.start)}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${fmtTime(j.end)}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${j.address}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${j.driver}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid var(--sep);">${j.minutes}</td>
      `;
      jobsBody.appendChild(tr);
    }
  }

  // --- Lag "tid per adresse" fra jobber ---
  function buildAddressTotals(jobs) {
    const map = new Map();

    for (const j of jobs) {
      const key = j.address || '—';
      if (!map.has(key)) {
        map.set(key, { address: key, minutes: 0, rounds: 0 });
      }
      const agg = map.get(key);
      agg.minutes += j.minutes || 0;
      agg.rounds  += 1;
    }

    return Array.from(map.values());
  }

  function renderAddressTotalsFromJobs(jobs) {
    if (!addrBody) return;
    addrBody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="3" style="padding:8px;text-align:center;" class="muted">
          Ingen data å vise.
        </td>`;
      addrBody.appendChild(tr);
      return;
    }

    const totals = buildAddressTotals(jobs);

    // Mest tid øverst
    const sorted = totals.sort((a, b) => b.minutes - a.minutes);

    for (const t of sorted) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${t.address}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid var(--sep);">${t.rounds}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid var(--sep);">${t.minutes}</td>
      `;
      addrBody.appendChild(tr);
    }
  }

  // --- Bruk filtre på eksisterende data ---
  function applyFilters() {
    const driver = driverSelect?.value || '';
    const addr   = addrSelect?.value || '';

    let jobs = allJobs;

    if (driver) {
      jobs = jobs.filter(j => j.driver === driver);
    }
    if (addr) {
      jobs = jobs.filter(j => j.address === addr);
    }

    renderSummary(jobs);
    renderJobs(jobs);
    renderAddressTotalsFromJobs(jobs);
  }

  // --- Hent data fra JSONbin og bygg alt ---
  async function loadAndRender() {
    try {
      const key = getMasterKey();
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['X-Master-Key'] = key;

      const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        console.warn('Klarte ikke å hente report-bin', res.status);
        if (sumContentEl) {
          sumContentEl.textContent = `Feil ved henting av data (${res.status}).`;
        }
        return;
      }

      const data = await res.json();
      const record = data && (data.record || data);

      allEvents = normalizeEvents(record);
      allJobs   = buildJobs(allEvents);

      populateFilters(allEvents);
      applyFilters();
    } catch (err) {
      console.error('Feil i logg.js loadAndRender', err);
      if (sumContentEl) {
        sumContentEl.textContent = 'Ukjent feil ved henting av data.';
      }
    }
  }

  // --- Lyttere ---
  driverSelect?.addEventListener('change', applyFilters);
  addrSelect?.addEventListener('change', applyFilters);

  window.addEventListener('DOMContentLoaded', () => {
    loadAndRender();
  });
})();