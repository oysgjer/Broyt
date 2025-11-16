// js/logg.js — Leser report-bin (type=start/done) og bygger logg + samlet brøytetid

(() => {
  'use strict';

  const REPORT_BIN_ID = '68e89e3443b1c97be9611c48';

  // --- Små helpers ---
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => (n < 10 ? '0' + n : '' + n);

  const fmtDate = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const msToMinutes = ms => Math.round(ms / 60000);

  // --- Hent master key fra localStorage (samme logikk som ellers i appen) ---
  const MASTER_KEY_KEYS = [
    'jsonbin_master_key',
    'jsonbin_master',
    'rt_jsonbin_master',
    'rt_jsonbin_key',
    'X-Master-Key',
    'JSONBIN_MASTER_KEY'
  ];

  function getMasterKey() {
    for (const k of MASTER_KEY_KEYS) {
      try {
        const v = localStorage.getItem(k);
        if (v && v.trim()) return v.trim();
      } catch {}
    }
    return null;
  }

  // --- Hent rå-data fra JSONbin ---
  async function fetchReports() {
    const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
    const headers = {};
    const key = getMasterKey();
    if (key) headers['X-Master-Key'] = key;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('JSONbin ' + res.status);
    const data = await res.json();
    const record = data.record ?? data;

    // Støtt både:
    //   [ { type:"start"... }, ... ]
    //   { reports: [ { ... }, ... ] }
    if (Array.isArray(record)) return record;
    if (Array.isArray(record.reports)) return record.reports;
    return [];
  }

  // --- Normaliser til events vi kan jobbe med ---
  // Vi støtter både:
  //   { type:"start"/"done", addressId, addressName, at, by }
  //   og evt. { action:"start"/"ferdig", address, ts, driver } fra gammel autologger
  function normalizeEvents(raw) {
    const out = [];
    for (const r of raw) {
      const tsStr = r.at || r.ts;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;

      let kind = null;
      if (r.type === 'start' || r.action === 'start') kind = 'start';
      else if (r.type === 'done' || r.action === 'ferdig' || r.type === 'stopp') kind = 'stop';
      if (!kind) continue;

      const address =
        r.addressId ||
        r.addressName ||
        r.address ||
        'Ukjent adresse';

      const driver = (r.by || r.driver || 'Ukjent sjåfør').trim();

      out.push({ kind, ts, address, driver });
    }
    // Sorter kronologisk
    out.sort((a, b) => a.ts - b.ts);
    return out;
  }

  // --- Bygg "jobber" (sammenhengende start → stop) per sjåfør + adresse ---
  function buildJobs(events) {
    const open = new Map(); // key -> startTs
    const jobs = [];

    for (const ev of events) {
      const key = `${ev.driver}|||${ev.address}`;

      if (ev.kind === 'start') {
        // Ignorer ekstra start hvis det allerede er åpent
        if (!open.has(key)) open.set(key, ev.ts);
      } else if (ev.kind === 'stop') {
        const startTs = open.get(key);
        if (startTs && ev.ts > startTs) {
          const durMin = msToMinutes(ev.ts - startTs);
          jobs.push({
            driver: ev.driver,
            address: ev.address,
            startTs,
            endTs: ev.ts,
            durMin
          });
        }
        open.delete(key);
      }
    }

    // Nyeste øverst
    jobs.sort((a, b) => b.startTs - a.startTs);
    return jobs;
  }

  // --- Filtrering ---
  function applyFilters(jobs) {
    const fDriver = $('#f_driver')?.value || '';
    const fAddr   = $('#f_addr')?.value || '';
    const fLimit  = parseInt($('#f_limit')?.value || '50', 10);

    let list = jobs;

    if (fDriver) {
      list = list.filter(j => j.driver === fDriver);
    }
    if (fAddr) {
      list = list.filter(j => j.address === fAddr);
    }

    // Begrens hvor mange som vises i detaljert logg
    const limited = list.slice(0, fLimit);
    return { filtered: list, limited };
  }

  // --- Samlet brøytetid-kort ---
  function renderSamletKort(jobs) {
    const el = $('#sum_content');
    if (!el) return;

    if (!jobs.length) {
      el.textContent = 'Fant ingen registrert brøytetid.';
      return;
    }

    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    const thisMonthKey = `${todayY}-${todayM}`;
    let prevMonthY = todayY;
    let prevMonthM = todayM - 1;
    if (prevMonthM < 0) { prevMonthM = 11; prevMonthY--; }
    const prevMonthKey = `${prevMonthY}-${prevMonthM}`;

    // Sett mandag denne uken som start (eller søndag, men mandag føles mer norsk)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = mandag
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    let totalMin = 0;
    let prevMonthMin = 0;
    let thisMonthMin = 0;
    let thisWeekMin = 0;
    let todayMin = 0;

    for (const j of jobs) {
      const start = new Date(j.startTs);
      const dur = j.durMin;

      totalMin += dur;

      const key = `${start.getFullYear()}-${start.getMonth()}`;

      if (key === thisMonthKey) thisMonthMin += dur;
      if (key === prevMonthKey) prevMonthMin += dur;

      if (start >= weekStart) thisWeekMin += dur;
      if (
        start.getFullYear() === todayY &&
        start.getMonth() === todayM &&
        start.getDate() === todayD
      ) {
        todayMin += dur;
      }
    }

    const fmt = m => {
      if (!m || m <= 0) return '0 min';
      const h = Math.floor(m / 60);
      const rest = m % 60;
      if (h === 0) return `${rest} min`;
      if (rest === 0) return `${h} t`;
      return `${h} t ${rest} min`;
    };

    el.innerHTML = `
      Totalt: <strong>${fmt(totalMin)}</strong><br>
      Forrige måned: <strong>${fmt(prevMonthMin)}</strong><br>
      Denne måneden: <strong>${fmt(thisMonthMin)}</strong><br>
      Denne uken: <strong>${fmt(thisWeekMin)}</strong><br>
      I dag: <strong>${fmt(todayMin)}</strong><br>
      <span class="muted">Hentes fra felles logg (alle sjåfører, etter valgte filtre).</span>
    `;
  }

  // --- Detaljert logg-tabell ---
  function renderJobsTable(jobsLimited) {
    const tbody = $('#jobs_body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!jobsLimited.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'Ingen jobber i valgt filter.';
      td.className = 'muted';
      td.style.padding = '8px';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const j of jobsLimited) {
      const tr = document.createElement('tr');

      const dStart = new Date(j.startTs);
      const dEnd   = new Date(j.endTs);

      const cells = [
        fmtDate(dStart),
        fmtTime(dStart),
        fmtTime(dEnd),
        j.address,
        j.driver,
        String(j.durMin)
      ];

      // Dato, Fra, Til, Adresse, Sjåfør, Min
      ['left','left','left','left','left','right'].forEach((align, idx) => {
        const td = document.createElement('td');
        td.textContent = cells[idx];
        td.style.padding = '4px 6px';
        td.style.textAlign = align;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }
  }

  // --- Tid per adresse ---
  function renderPerAddress(jobsFiltered) {
    const tbody = $('#addr_body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!jobsFiltered.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'Ingen data i valgt filter.';
      td.className = 'muted';
      td.style.padding = '8px';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const byAddr = new Map(); // address -> {min, count}
    for (const j of jobsFiltered) {
      if (!byAddr.has(j.address)) {
        byAddr.set(j.address, { min: 0, count: 0 });
      }
      const agg = byAddr.get(j.address);
      agg.min += j.durMin;
      agg.count += 1;
    }

    const rows = Array.from(byAddr.entries()).map(([address, agg]) => ({
      address,
      totalMin: agg.min,
      count: agg.count
    }));

    // Adresse med mest tid øverst
    rows.sort((a, b) => b.totalMin - a.totalMin);

    const fmtMin = m => {
      if (!m || m <= 0) return '0 min';
      const h = Math.floor(m / 60);
      const rest = m % 60;
      if (h === 0) return `${rest} min`;
      if (rest === 0) return `${h} t`;
      return `${h} t ${rest} min`;
    };

    for (const r of rows) {
      const tr = document.createElement('tr');

      const tdAddr = document.createElement('td');
      tdAddr.textContent = r.address;
      tdAddr.style.padding = '4px 6px';

      const tdRounds = document.createElement('td');
      tdRounds.textContent = String(r.count);
      tdRounds.style.padding = '4px 6px';
      tdRounds.style.textAlign = 'right';

      const tdTime = document.createElement('td');
      tdTime.textContent = fmtMin(r.totalMin);
      tdTime.style.padding = '4px 6px';
      tdTime.style.textAlign = 'right';

      tr.appendChild(tdAddr);
      tr.appendChild(tdTime);
      tr.appendChild(tdRounds);
      tbody.appendChild(tr);
    }
  }

  // --- Fyll nedtrekkslister for sjåfør / adresse ---
  function populateFilters(jobs) {
    const selDriver = $('#f_driver');
    const selAddr   = $('#f_addr');
    if (!selDriver || !selAddr) return;

    const drivers = new Set();
    const addrs   = new Set();

    for (const j of jobs) {
      if (j.driver) drivers.add(j.driver);
      if (j.address) addrs.add(j.address);
    }

    // Rens og legg inn
    selDriver.innerHTML = '<option value="">Alle sjåfører</option>';
    for (const d of Array.from(drivers).sort()) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      selDriver.appendChild(opt);
    }

    selAddr.innerHTML = '<option value="">Alle adresser</option>';
    for (const a of Array.from(addrs).sort()) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      selAddr.appendChild(opt);
    }
  }

  // --- Init ---
  async function init() {
    const sumCard = $('#sum_card');
    if (sumCard) {
      // litt ekstra luft under appbaren så teksten ikke havner bak klokka
      sumCard.parentElement.closest('main')?.style.setProperty('margin-top', '8px');
    }

    let raw = [];
    try {
      raw = await fetchReports();
    } catch (e) {
      console.warn('Klarte ikke å hente reports fra JSONbin', e);
    }

    const events = normalizeEvents(raw);
    const jobs   = buildJobs(events);

    populateFilters(jobs);

    function rerender() {
      const { filtered, limited } = applyFilters(jobs);
      renderSamletKort(filtered);
      renderJobsTable(limited);
      renderPerAddress(filtered);
    }

    // Koble filtre
    ['f_driver', 'f_addr', 'f_limit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', rerender);
    });

    rerender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();