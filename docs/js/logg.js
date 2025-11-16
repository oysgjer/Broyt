// logg.js – leser hendelser fra JSONbin, bygger jobber, viser A4-vennlig logg

(() => {
  const HENDELSER_BIN_ID = '68e89e3443b1c97be9611c48';

  // --- DOM helpers ---
  const $ = (s, r = document) => r.querySelector(s);
  const jobsBody = $('#jobs_body');
  const addrBody = $('#addr_body');
  const sumCard  = $('#sum_card');
  const sumContent = $('#sum_content');
  const fDriver = $('#f_driver');
  const fAddr   = $('#f_addr');
  const limitSel = $('#jobs_limit');

  // --- Tid/format helpers ---
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  const fmtDate = (d) =>
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

  const fmtTime = (d) =>
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  // Brukes i “Samlet brøytetid” og “Tid per adresse”
  function fmtMinutesLong(minTotal) {
    if (!Number.isFinite(minTotal) || minTotal <= 0) return '0 min';
    const h = Math.floor(minTotal / 60);
    const m = minTotal % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} t`;
    return `${h} t ${m} min`;
  }

  // --- Global state ---
  let allJobs = [];      // alle jobber (start→ferdig) uansett filter
  let allDrivers = new Set();
  let allAddresses = new Set();

  // --- JSONbin master key ---
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

  // --- Normalisering av hendelser → jobber ---

  /**
   * Normaliser rå-hendelser fra JSONbin til:
   *   { ts, driver, address, action: 'start' | 'ferdig' }
   */
  function normalizeEvents(raw) {
    if (!Array.isArray(raw)) return [];

    const norm = [];

    for (const r of raw) {
      const actionRaw = r.action || r.type;
      let action = null;
      if (actionRaw === 'start') action = 'start';
      else if (actionRaw === 'ferdig' || actionRaw === 'done') action = 'ferdig';
      else continue; // ignorér neste / ikke_mulig / osv.

      const tsStr = r.ts || r.at;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;

      const driver = (r.driver || r.by || 'Ukjent').trim() || 'Ukjent';
      const address = (r.address || r.addressName || r.addressId || '—').trim() || '—';

      norm.push({ ts, driver, address, action });
    }

    // sortér kronologisk (eldst → nyest)
    norm.sort((a, b) => a.ts - b.ts);
    return norm;
  }

  /**
   * Bygg jobber (sammenhengende intervaller) per sjåfør+adresse.
   * Kun start→første ferdig teller; dobbelt-klikk håndteres greit.
   *
   * Resultat:
   *   { driver, address, startTs, endTs, minutes }
   */
  function buildJobs(normEvents) {
    const openByKey = new Map();
    const jobs = [];

    for (const ev of normEvents) {
      const key = `${ev.driver}|||${ev.address}`;

      if (ev.action === 'start') {
        if (!openByKey.has(key)) {
          openByKey.set(key, ev.ts);
        }
      } else if (ev.action === 'ferdig') {
        const startTs = openByKey.get(key);
        if (startTs && ev.ts > startTs) {
          const minutes = Math.round((ev.ts - startTs) / 60000);
          jobs.push({
            driver: ev.driver,
            address: ev.address,
            startTs,
            endTs: ev.ts,
            minutes
          });
        }
        openByKey.delete(key);
      }
    }

    // nyeste øverst som standard
    jobs.sort((a, b) => b.startTs - a.startTs);
    return jobs;
  }

  // --- Rendering ---

  function renderSummary(jobs) {
    if (!sumContent) return;

    if (!jobs || jobs.length === 0) {
      sumContent.textContent = 'Fant ingen registrert brøytetid.';
      return;
    }

    const now = new Date();

    let total = 0;
    let today = 0;
    let week = 0;
    let month = 0;
    let prevMonth = 0;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay() || 7; // mandag = 1, søndag = 7
    startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const endOfPrevMonth = new Date(startOfMonth.getTime() - 1);

    for (const j of jobs) {
      const m = j.minutes || 0;
      total += m;

      const d = new Date(j.startTs);
      if (d >= startOfToday) today += m;
      if (d >= startOfWeek) week += m;
      if (d >= startOfMonth) month += m;
      if (d >= startOfPrevMonth && d <= endOfPrevMonth) prevMonth += m;
    }

    sumContent.innerHTML = `
      <div style="font-weight:600; margin-bottom:4px;">Totalt: <span style="font-weight:700;">${fmtMinutesLong(total)}</span></div>
      <div>Forrige måned: <span style="font-weight:700;">${fmtMinutesLong(prevMonth)}</span></div>
      <div>Denne måneden: <span style="font-weight:700;">${fmtMinutesLong(month)}</span></div>
      <div>Denne uken: <span style="font-weight:700;">${fmtMinutesLong(week)}</span></div>
      <div>I dag: <span style="font-weight:700;">${fmtMinutesLong(today)}</span></div>
      <p class="muted" style="margin-top:6px;">Hentes fra felles logg (alle sjåfører, etter valgte filtre).</p>
    `;
  }

  function renderJobsTable(jobs) {
    if (!jobsBody) return;
    jobsBody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'muted';
      td.style.padding = '8px';
      td.textContent = 'Ingen jobber i valgt filter.';
      tr.appendChild(td);
      jobsBody.appendChild(tr);
      return;
    }

    for (const j of jobs) {
      const tr = document.createElement('tr');

      const dStart = new Date(j.startTs);
      const dEnd   = new Date(j.endTs);

      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${fmtDate(dStart)}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${fmtTime(dStart)}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${fmtTime(dEnd)}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${j.address}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${j.driver}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:right;">${j.minutes}</td>
      `;

      jobsBody.appendChild(tr);
    }
  }

  function renderAddrTable(jobs) {
    if (!addrBody) return;
    addrBody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'muted';
      td.style.padding = '8px';
      td.textContent = 'Ingen data i valgt filter.';
      tr.appendChild(td);
      addrBody.appendChild(tr);
      return;
    }

    const map = new Map(); // address -> { minutes, count }

    for (const j of jobs) {
      const key = j.address || '—';
      if (!map.has(key)) {
        map.set(key, { minutes: 0, count: 0 });
      }
      const entry = map.get(key);
      entry.minutes += j.minutes || 0;
      entry.count += 1;
    }

    const rows = [...map.entries()].sort(
      (a, b) => b[1].minutes - a[1].minutes
    ); // mest tid øverst

    for (const [addr, info] of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid var(--sep);">${addr}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:right;">${info.count}</td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:right;">${fmtMinutesLong(info.minutes)}</td>
      `;
      addrBody.appendChild(tr);
    }
  }

  // --- Filtre & limit ---

  function populateFilters() {
    if (fDriver) {
      const cur = fDriver.value;
      fDriver.innerHTML = '<option value="">Alle sjåfører</option>';
      [...allDrivers].sort().forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === cur) opt.selected = true;
        fDriver.appendChild(opt);
      });
    }

    if (fAddr) {
      const curA = fAddr.value;
      fAddr.innerHTML = '<option value="">Alle adresser</option>';
      [...allAddresses].sort().forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        if (a === curA) opt.selected = true;
        fAddr.appendChild(opt);
      });
    }
  }

  function applyFiltersAndRender() {
    const driverFilter = (fDriver && fDriver.value) || '';
    const addrFilter   = (fAddr && fAddr.value) || '';
    const limitVal = limitSel ? parseInt(limitSel.value || '0', 10) : 0;

    let jobs = allJobs;

    if (driverFilter) {
      jobs = jobs.filter((j) => j.driver === driverFilter);
    }
    if (addrFilter) {
      jobs = jobs.filter((j) => j.address === addrFilter);
    }

    // Agg-regn på ALLE i filteret
    renderSummary(jobs);
    renderAddrTable(jobs);

    // Men detaljerte rader kan begrenses
    let toShow = jobs;
    if (limitVal > 0 && jobs.length > limitVal) {
      toShow = jobs.slice(0, limitVal);
    }
    renderJobsTable(toShow);
  }

  // --- Hent fra JSONbin ---

  async function loadFromJsonbin() {
    if (!sumContent) return;

    sumContent.textContent = 'Laster samlet tid…';

    try {
      const key = getMasterKey();
      const url = `https://api.jsonbin.io/v3/b/${HENDELSER_BIN_ID}/latest`;
      const headers = {};
      if (key) headers['X-Master-Key'] = key;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        sumContent.textContent = `Klarte ikke å hente logg (${res.status}).`;
        console.warn('[logg] fetch-feil', res.status, await res.text());
        return;
      }

      const data = await res.json();
      const record = data.record || data;

      // Din bin er et rent array av events
      const rawEvents = Array.isArray(record)
        ? record
        : (record.hendelser || record.reports || []);

      const norm = normalizeEvents(rawEvents);
      const jobs = buildJobs(norm);

      allJobs = jobs;
      allDrivers = new Set(jobs.map((j) => j.driver));
      allAddresses = new Set(jobs.map((j) => j.address));

      populateFilters();
      applyFiltersAndRender();
    } catch (err) {
      sumContent.textContent = 'Feil ved henting av logg.';
      console.error('[logg] unntak ved henting', err);
    }
  }

  // --- Init ---

  document.addEventListener('DOMContentLoaded', () => {
    if (fDriver) fDriver.addEventListener('change', applyFiltersAndRender);
    if (fAddr)   fAddr.addEventListener('change', applyFiltersAndRender);
    if (limitSel) limitSel.addEventListener('change', applyFiltersAndRender);

    loadFromJsonbin();
  });
})();