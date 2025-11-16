// logg.js — leser JSONBin-hendelser, lager jobber, viser logg + summeringer

(() => {
  const REPORT_BIN_ID = '68e89e3443b1c97be9611c48'; // samme som hendelser-bin
  const MASTER_KEY_KEYS = [
    'jsonbin_master_key',
    'jsonbin_master',
    'rt_jsonbin_master',
    'rt_jsonbin_key',
    'X-Master-Key'
  ];

  const $  = (sel, root = document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  function fmtDate(d) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  function fmtTime(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  // 125 -> "2 t 5 min", 60 -> "1 t", 15 -> "15 min"
  function fmtMinutesPretty(min) {
    if (!Number.isFinite(min) || min <= 0) return '0 min';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h > 0 && m > 0) return `${h} t ${m} min`;
    if (h > 0) return `${h} t`;
    return `${m} min`;
  }

  function getMasterKey() {
    for (const k of MASTER_KEY_KEYS) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
    return null;
  }

  // --- Hent råhendelser direkte fra JSONBin ---
  async function fetchRawEvents() {
    const url = `https://api.jsonbin.io/v3/b/${REPORT_BIN_ID}/latest`;
    const headers = {};
    const key = getMasterKey();
    if (key) headers['X-Master-Key'] = key;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('[logg] Klarte ikke å hente report-bin', res.status);
      throw new Error('Kunne ikke hente logg-data');
    }

    const data = await res.json();
    const record = data.record || data;

    if (Array.isArray(record)) return record;
    if (Array.isArray(record.reports)) return record.reports;
    if (Array.isArray(record.hendelser)) return record.hendelser;

    console.warn('[logg] Fant ingen array i record');
    return [];
  }

  // Gjør om blandet format til ett enkelt event-format
  // Vi bryr oss bare om start / ferdig fra auto-loggeren
  function normalizeEvents(raw) {
    if (!Array.isArray(raw)) return [];

    const out = [];

    for (const r of raw) {
      const action =
        r.action ||
        (r.type === 'start' ? 'start' :
         r.type === 'done' ? 'ferdig' : null);

      if (!action || (action !== 'start' && action !== 'ferdig')) {
        continue; // hopp over "neste", "ikke_mulig" osv.
      }

      const tsStr = r.ts || r.at;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;

      const driver =
        r.driver ||
        r.by ||
        'Ukjent';

      const address =
        r.address ||
        r.addressName ||
        r.addressId ||
        '—';

      out.push({
        ts,
        action,   // "start" | "ferdig"
        driver,
        address
      });
    }

    // sortér eldste først
    out.sort((a, b) => a.ts - b.ts);
    return out;
  }

  // Bygg "jobber": én linje per sammenhengende jobb (start → ferdig)
  function buildJobs(events) {
    const openByKey = new Map(); // key -> startTs
    const jobs = [];

    for (const ev of events) {
      const key = `${ev.driver}|||${ev.address}`;
      if (ev.action === 'start') {
        if (!openByKey.has(key)) {
          openByKey.set(key, ev.ts);
        }
      } else if (ev.action === 'ferdig') {
        const startTs = openByKey.get(key);
        if (startTs && ev.ts > startTs) {
          const minutes = (ev.ts - startTs) / 60000;
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

    // nyeste øverst i tabellen
    jobs.sort((a, b) => b.startTs - a.startTs);
    return jobs;
  }

  // --- Rendering ---

  function renderSummary(jobs) {
    const el = byId('sum_content');
    if (!el) return;

    if (!jobs || jobs.length === 0) {
      el.textContent = 'Fant ingen registrert brøytetid.';
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

    // Uke: mandag som første dag
    const day = now.getDay() || 7; // 1–7
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (day - 1)
    ).getTime();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    ).getTime();

    let totalMin = 0;
    let todayMin = 0;
    let weekMin = 0;
    let monthMin = 0;
    let prevMonthMin = 0;

    for (const job of jobs) {
      const start = job.startTs;
      const m = job.minutes || 0;
      totalMin += m;

      if (start >= todayStart && start < tomorrowStart) {
        todayMin += m;
      }
      if (start >= weekStart) {
        weekMin += m;
      }
      if (start >= monthStart) {
        monthMin += m;
      } else if (start >= prevMonthStart && start < monthStart) {
        prevMonthMin += m;
      }
    }

    el.innerHTML = `
      <div style="font-size:0.95rem; line-height:1.4;">
        <div>Totalt: <strong>${fmtMinutesPretty(totalMin)}</strong></div>
        <div>Forrige måned: <strong>${fmtMinutesPretty(prevMonthMin)}</strong></div>
        <div>Denne måneden: <strong>${fmtMinutesPretty(monthMin)}</strong></div>
        <div>Denne uken: <strong>${fmtMinutesPretty(weekMin)}</strong></div>
        <div>I dag: <strong>${fmtMinutesPretty(todayMin)}</strong></div>
        <div class="muted" style="margin-top:6px;font-size:0.85rem;">
          Hentes fra felles logg (alle sjåfører, etter valgte filtre).
        </div>
      </div>
    `;
  }

  function renderJobTable(jobs) {
    const tbody = byId('jobs_body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'Ingen jobber i valgt filter.';
      td.className = 'muted';
      td.style.padding = '8px';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const job of jobs) {
      const tr = document.createElement('tr');

      const dStart = new Date(job.startTs);
      const dEnd   = new Date(job.endTs);

      const cells = [
        fmtDate(dStart),
        fmtTime(dStart),
        fmtTime(dEnd),
        job.address || '—',
        job.driver || '—',
        Math.round(job.minutes || 0).toString()
      ];

      cells.forEach((txt, idx) => {
        const td = document.createElement('td');
        td.textContent = txt;
        td.style.padding = '6px';
        if (idx === cells.length - 1) {
          td.style.textAlign = 'right';
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }
  }

  function renderAddressTable(jobs) {
    const tbody = byId('addr_body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'Ingen data i valgt filter.';
      td.className = 'muted';
      td.style.padding = '8px';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Summerer per adresse
    const byAddr = new Map(); // address -> {minutes, count}
    for (const job of jobs) {
      const addr = job.address || '—';
      if (!byAddr.has(addr)) {
        byAddr.set(addr, { minutes: 0, count: 0 });
      }
      const obj = byAddr.get(addr);
      obj.minutes += job.minutes || 0;
      obj.count += 1;
    }

    const rows = [];
    for (const [address, info] of byAddr.entries()) {
      rows.push({
        address,
        minutes: info.minutes,
        count: info.count
      });
    }

    // Mest tid øverst
    rows.sort((a, b) => (b.minutes || 0) - (a.minutes || 0));

    for (const row of rows) {
      const tr = document.createElement('tr');

      const cells = [
        row.address,
        fmtMinutesPretty(row.minutes),
        row.count.toString()
      ];

      // Vi har fire kolonner i tabellen: Adresse | Oppgave | Tid | Antall runder
      // Oppgave er fjernet, men headeren din er allerede oppdatert til 3 brukte felt:
      // Adresse | Tid | Antall runder
      // Så vi lager tre celler her.
      const tdAddr = document.createElement('td');
      tdAddr.textContent = row.address;
      tdAddr.style.padding = '6px';
      tr.appendChild(tdAddr);

      const tdTime = document.createElement('td');
      tdTime.textContent = fmtMinutesPretty(row.minutes);
      tdTime.style.padding = '6px';
      tdTime.style.textAlign = 'right';
      tr.appendChild(tdTime);

      const tdCount = document.createElement('td');
      tdCount.textContent = row.count.toString();
      tdCount.style.padding = '6px';
      tdCount.style.textAlign = 'right';
      tr.appendChild(tdCount);

      tbody.appendChild(tr);
    }
  }

  function populateFilters(jobs) {
    const selDriver = byId('f_driver');
    const selAddr   = byId('f_addr');
    if (!selDriver || !selAddr) return;

    // Sjåfører
    const drivers = new Set();
    const addrs   = new Set();
    for (const j of jobs) {
      if (j.driver) drivers.add(j.driver);
      if (j.address) addrs.add(j.address);
    }

    const driverList = Array.from(drivers).sort((a, b) =>
      a.localeCompare(b, 'nb-NO')
    );
    const addrList = Array.from(addrs).sort((a, b) =>
      a.localeCompare(b, 'nb-NO')
    );

    // nullstill
    selDriver.innerHTML = '<option value="">Alle sjåfører</option>';
    selAddr.innerHTML   = '<option value="">Alle adresser</option>';

    for (const d of driverList) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      selDriver.appendChild(opt);
    }

    for (const a of addrList) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      selAddr.appendChild(opt);
    }
  }

  function applyFilters(allJobs) {
    const selDriver = byId('f_driver');
    const selAddr   = byId('f_addr');
    const driverVal = selDriver?.value || '';
    const addrVal   = selAddr?.value || '';

    let jobs = allJobs.slice();

    if (driverVal) {
      jobs = jobs.filter(j => j.driver === driverVal);
    }
    if (addrVal) {
      jobs = jobs.filter(j => j.address === addrVal);
    }

    renderSummary(jobs);
    renderJobTable(jobs);
    renderAddressTable(jobs);
  }

  async function init() {
    try {
      const raw = await fetchRawEvents();
      const events = normalizeEvents(raw);
      const jobs = buildJobs(events);

      populateFilters(jobs);

      const selDriver = byId('f_driver');
      const selAddr   = byId('f_addr');

      const onChange = () => applyFilters(jobs);
      selDriver?.addEventListener('change', onChange);
      selAddr?.addEventListener('change', onChange);

      applyFilters(jobs);
    } catch (err) {
      console.error(err);
      const sum = byId('sum_content');
      if (sum) sum.textContent = 'Feil ved henting av logg-data.';
      renderJobTable([]);
      renderAddressTable([]);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();