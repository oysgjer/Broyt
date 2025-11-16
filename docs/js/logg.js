// js/logg.js
(() => {
  const REPORT_BIN_ID   = '68e89e3443b1c97be9611c48'; // reports
  const ADDRESS_BIN_ID  = '68e7b4d2ae596e708f0bde7d'; // adresser/katalog
  const MAX_INTERVAL_MS = 90 * 60 * 1000;             // maks 90 min per interval

  // --- Små hjelpere ---
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const msToHhMm = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0:00';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${pad(m)}`;
  };

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

  async function fetchJsonbinLatest(binId) {
    const key = getMasterKey();
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['X-Master-Key'] = key;

    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`JSONbin ${binId} status ${res.status}`);
    }
    const data = await res.json();
    return data && (data.record || data);
  }

  // --- Normaliser reports til "row"-objekter ---
  function normalizeReports(record) {
    const raw = Array.isArray(record?.reports) ? record.reports
      : Array.isArray(record) ? record
      : [];

    const rows = [];

    for (const r of raw) {
      const tsStr = r.at || r.ts;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;

      const d = new Date(ts);
      const date = d.toISOString().slice(0, 10);
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

      const driver = r.by || r.driver || '';
      const address = r.addressId || r.addressName || r.address || '—';
      const taskRaw = (r.task || '').trim();

      let action = null;
      if (r.type === 'start' || r.action === 'start') {
        action = 'start';
      } else if (r.type === 'done' || r.action === 'ferdig') {
        action = 'ferdig';
      } else if (r.action === 'block' || r.action === 'ikke-mulig' || r.action === 'blocked') {
        action = 'ikke-mulig';
      } else {
        // hopp over "neste" og annet
        continue;
      }

      const notes = r.notes || '';

      rows.push({
        ts,
        date,
        time,
        driver,
        address,
        task: taskRaw,
        action,
        notes
      });
    }

    // Sorter stigende i tid – vi kan snu ved rendering hvis vi vil
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }

  // --- Hent adresser til dropdown ---
  function extractAddressList(addrRecord, rows) {
    const set = new Set();

    // Fra katalog-bin
    if (Array.isArray(addrRecord?.addresses)) {
      for (const a of addrRecord.addresses) {
        if (a?.name) set.add(a.name);
      }
    }
    if (Array.isArray(addrRecord?.stops)) {
      for (const s of addrRecord.stops) {
        if (s?.n) set.add(s.n);
      }
    }

    // I tillegg: alle adresser som faktisk finnes i reports
    for (const r of rows) {
      if (r.address && r.address !== '—') set.add(r.address);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'nb'));
  }

  function populateAddressSelect(addresses) {
    const sel = $('#f_address');
    if (!sel) return;
    // behold "Alle adresser"
    for (const addr of addresses) {
      const opt = document.createElement('option');
      opt.value = addr;
      opt.textContent = addr;
      sel.appendChild(opt);
    }
  }

  // --- Summeringer ---
  function buildAggregates(rows) {
    const byKey = new Map(); // key = driver || address || task

    for (const r of rows) {
      if (r.action !== 'start' && r.action !== 'ferdig') continue;

      const key = `${r.driver}||${r.address}||${r.task || ''}`;
      const kind = r.action === 'start' ? 'start' : 'stop';
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ kind, ts: r.ts, date: r.date });
    }

    const perDriverMs = new Map();
    const perAddressMs = new Map();
    const perRoundMs = new Map();   // sjåfør + dato
    let totalMs = 0;
    let totalJobs = 0;
    let totalSnowJobs = 0;
    let totalGrusJobs = 0;

    for (const [key, events] of byKey) {
      events.sort((a, b) => a.ts - b.ts);
      let openStart = null;
      let openDate = null;

      const [driver, address, taskRaw] = key.split('||');
      const task = (taskRaw || '').trim();
      const taskLower = task.toLowerCase();
      const isGrus = taskLower === 'grus' || taskLower.includes('grus');
      const isSnø = taskLower === 'snø' || taskLower.includes('snø');

      for (const ev of events) {
        if (ev.kind === 'start') {
          if (openStart == null) {
            openStart = ev.ts;
            openDate = ev.date;
          }
        } else if (ev.kind === 'stop') {
          if (openStart != null && ev.ts > openStart) {
            let dur = ev.ts - openStart;
            if (dur > MAX_INTERVAL_MS) dur = MAX_INTERVAL_MS;

            totalMs += dur;
            totalJobs++;

            if (isGrus) totalGrusJobs++;
            else if (isSnø) totalSnowJobs++;

            if (driver) {
              perDriverMs.set(driver, (perDriverMs.get(driver) || 0) + dur);
            }
            if (address) {
              perAddressMs.set(address, (perAddressMs.get(address) || 0) + dur);
            }

            if (driver && openDate) {
              const rKey = `${driver} – ${openDate}`;
              perRoundMs.set(rKey, (perRoundMs.get(rKey) || 0) + dur);
            }
          }
          openStart = null;
          openDate = null;
        }
      }
    }

    return {
      totalMs,
      totalJobs,
      totalSnowJobs,
      totalGrusJobs,
      perDriverMs,
      perAddressMs,
      perRoundMs
    };
  }

  function renderAggregates(agg) {
    $('#agg_total_time').textContent       = msToHhMm(agg.totalMs);
    $('#agg_total_jobs').textContent       = String(agg.totalJobs);
    $('#agg_total_snow_jobs').textContent  = String(agg.totalSnowJobs);
    $('#agg_total_grus_jobs').textContent  = String(agg.totalGrusJobs);

    // Per runde (sjåfør + dato)
    const roundBody = $('#agg_rounds_tbody');
    roundBody.innerHTML = '';
    const rounds = Array.from(agg.perRoundMs.entries())
      .sort((a, b) => b[1] - a[1]); // mest tid øverst

    for (const [label, ms] of rounds) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${msToHhMm(ms)}</td>
      `;
      roundBody.appendChild(tr);
    }

    // Per sjåfør
    const drvBody = $('#agg_driver_tbody');
    drvBody.innerHTML = '';
    const drivers = Array.from(agg.perDriverMs.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [driver, ms] of drivers) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${driver || 'Ukjent'}</td>
        <td>${msToHhMm(ms)}</td>
      `;
      drvBody.appendChild(tr);
    }

    // Per adresse
    const addrBody = $('#agg_address_tbody');
    addrBody.innerHTML = '';
    const addresses = Array.from(agg.perAddressMs.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [addr, ms] of addresses) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${addr}</td>
        <td>${msToHhMm(ms)}</td>
      `;
      addrBody.appendChild(tr);
    }
  }

  // --- Filtrering + tabell ---
  function applyFilters(allRows) {
    const fDateFrom = $('#f_date_from')?.value || '';
    const fDateTo   = $('#f_date_to')?.value || '';
    const fDriver   = ($('#f_driver')?.value || '').trim().toLowerCase();
    const fAddress  = $('#f_address')?.value || '';
    const fTask     = $('#f_task')?.value || '';

    let filtered = allRows;

    if (fDateFrom) {
      filtered = filtered.filter(r => r.date >= fDateFrom);
    }
    if (fDateTo) {
      filtered = filtered.filter(r => r.date <= fDateTo);
    }
    if (fDriver) {
      filtered = filtered.filter(r => (r.driver || '').toLowerCase().includes(fDriver));
    }
    if (fAddress) {
      filtered = filtered.filter(r => r.address === fAddress);
    }
    if (fTask) {
      if (fTask === 'Ukjent') {
        filtered = filtered.filter(r => !r.task);
      } else {
        filtered = filtered.filter(r => r.task === fTask);
      }
    }

    // Nyeste nederst (som i dag) eller øverst – her tar vi nyeste NEDERST
    filtered = filtered.slice().sort((a, b) => a.ts - b.ts);

    const tbody = $('#log_tbody');
    tbody.innerHTML = '';

    for (const r of filtered) {
      const tr = document.createElement('tr');

      let actionLabel = '';
      let actionClass = '';
      if (r.action === 'start') {
        actionLabel = 'Start';
        actionClass = 'pill-start';
      } else if (r.action === 'ferdig') {
        actionLabel = 'Ferdig';
        actionClass = 'pill-done';
      } else if (r.action === 'ikke-mulig') {
        actionLabel = 'Ikke mulig';
        actionClass = 'pill-block';
      }

      const taskLabel = r.task || '';
      const safeNotes = r.notes || '';

      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${r.time}</td>
        <td>${r.driver || ''}</td>
        <td>${r.address || ''}</td>
        <td>${taskLabel ? `<span class="pill pill-task">${taskLabel}</span>` : ''}</td>
        <td><span class="pill ${actionClass}">${actionLabel}</span></td>
        <td>${safeNotes}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function attachFilterListeners(allRows) {
    const ids = ['#f_date_from', '#f_date_to', '#f_driver', '#f_address', '#f_task'];
    for (const sel of ids) {
      const el = $(sel);
      if (!el) continue;
      el.addEventListener('input', () => applyFilters(allRows));
      el.addEventListener('change', () => applyFilters(allRows));
    }
  }

  // --- Init ---
  async function init() {
    try {
      const [reportRecord, addrRecord] = await Promise.all([
        fetchJsonbinLatest(REPORT_BIN_ID),
        fetchJsonbinLatest(ADDRESS_BIN_ID)
      ]);

      const allRows = normalizeReports(reportRecord);
      const addrList = extractAddressList(addrRecord, allRows);
      populateAddressSelect(addrList);

      const agg = buildAggregates(allRows);
      renderAggregates(agg);

      attachFilterListeners(allRows);
      applyFilters(allRows);
    } catch (err) {
      console.error('Feil ved lasting av logg:', err);
      const tbody = $('#log_tbody');
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7">Kunne ikke laste logg-data. Sjekk JSONbin-nøkkel og nettverk.</td>`;
        tbody.appendChild(tr);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();