// js/logg.js — leser report-bin + adresser, viser logg + sammendrag

(() => {
  // JSONbin ID-er
  const REPORT_BIN_ID   = '68e89e3443b1c97be9611c48'; // reports (start/ferdig osv.)
  const ADDR_BIN_ID     = '68e7b4d2ae596e708f0bde7d'; // adresser/katalog

  const MAX_INTERVAL_MS = 90 * 60 * 1000; // maks 90 min per sammenhengende intervall

  // --- DOM helpers ---
  const $ = (s, r = document) => r.querySelector(s);
  const byId = (id) => document.getElementById(id);

  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const msToHhMm = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0:00';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${pad(m)}`;
  };

  // Master key: prøv noen vanlige nøkler + den du brukte i index
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
      if (v && v.trim()) return v.trim();
    }
    return '';
  }

  async function fetchJsonbinLatest(binId) {
    const key = getMasterKey();
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;

    const headers = {
      'Content-Type': 'application/json'
    };
    if (key) headers['X-Master-Key'] = key;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`JSONbin ${binId} feilet: ${res.status}`);
    }
    const data = await res.json();
    return data.record || data;
  }

  // --- Normalisering av reports til "events" (start/stop) med driver + adresse ---
  function reportsToEvents(reports) {
    if (!Array.isArray(reports)) return [];

    return reports
      .map((r) => {
        // Finn type
        let kind = null;
        if (r.type === 'start' || r.action === 'start') {
          kind = 'start';
        } else if (r.type === 'done' || r.action === 'ferdig') {
          kind = 'stop';
        } else {
          return null;
        }

        const addr =
          r.addressId ||
          r.addressName ||
          r.address ||
          '—';

        const driver =
          r.by ||
          r.driver ||
          'Ukjent';

        const tsStr = r.at || r.ts;
        const ts = Date.parse(tsStr);
        if (!Number.isFinite(ts)) return null;

        return {
          kind,
          addr,
          driver,
          ts
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts);
  }

  // Bygg "økter" (stints) per (adresse + sjåfør)
  function buildStints(events) {
    const byKey = new Map(); // key = addr|driver → events[]
    for (const ev of events) {
      const key = `${ev.addr}||${ev.driver}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(ev);
    }

    const stints = [];

    for (const [key, list] of byKey) {
      list.sort((a, b) => a.ts - b.ts);

      let openStart = null;
      for (const ev of list) {
        if (ev.kind === 'start') {
          if (openStart == null) {
            openStart = ev.ts; // ignorér dobbelt-start
          }
        } else if (ev.kind === 'stop') {
          if (openStart != null && ev.ts > openStart) {
            const dur = Math.min(ev.ts - openStart, MAX_INTERVAL_MS);
            const [addr, driver] = key.split('||');
            stints.push({
              addr,
              driver,
              startTs: openStart,
              stopTs: ev.ts,
              durMs: dur
            });
          }
          openStart = null;
        }
      }
    }

    return stints;
  }

  // Gruppér stints per sjåfør
  function summarizePerDriver(stints) {
    const map = new Map();
    for (const s of stints) {
      const key = s.driver || 'Ukjent';
      const prev = map.get(key) || 0;
      map.set(key, prev + s.durMs);
    }
    return Array.from(map.entries())
      .map(([driver, ms]) => ({ driver, ms }))
      .sort((a, b) => b.ms - a.ms);
  }

  // Gruppér stints per adresse
  function summarizePerAddress(stints) {
    const map = new Map(); // addr -> {ms, count}
    for (const s of stints) {
      const addr = s.addr || '—';
      if (!map.has(addr)) {
        map.set(addr, { ms: 0, count: 0 });
      }
      const v = map.get(addr);
      v.ms += s.durMs;
      v.count += 1;
    }
    return Array.from(map.entries())
      .map(([addr, v]) => ({ addr, ms: v.ms, count: v.count }))
      .sort((a, b) => b.ms - a.ms);
  }

  // --- FILTRERING ---

  function passesFilters(r, filters) {
    // Dato
    const tsStr = r.at || r.ts;
    const d = new Date(tsStr);
    if (!Number.isFinite(d.getTime())) return false;

    if (filters.fromDate) {
      const from = new Date(filters.fromDate + 'T00:00:00');
      if (d < from) return false;
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate + 'T23:59:59');
      if (d > to) return false;
    }

    // Sjåfør
    if (filters.driver) {
      const drv = (r.by || r.driver || '').toLowerCase();
      if (!drv.includes(filters.driver.toLowerCase())) return false;
    }

    // Adresse
    if (filters.address) {
      const addr =
        (r.addressId || r.addressName || r.address || '').toLowerCase();
      if (!addr.includes(filters.address.toLowerCase())) return false;
    }

    // Type / hendelse
    if (filters.type) {
      const isStart = r.type === 'start' || r.action === 'start';
      const isDone  = r.type === 'done'  || r.action === 'ferdig';
      if (filters.type === 'start' && !isStart) return false;
      if (filters.type === 'ferdig' && !isDone) return false;
    }

    return true;
  }

  function readFilters() {
    return {
      fromDate: byId('f_date_from')?.value || '',
      toDate:   byId('f_date_to')?.value || '',
      driver:   byId('f_driver')?.value || '',
      address:  byId('f_address')?.value || '',
      type:     byId('f_type')?.value || ''
    };
  }

  // --- RENDERING AV SAMMENDRAG OG TABELL ---

  function renderSummary(filteredReports, addressesByName) {
    const sumEmpty   = byId('summary_empty');
    const sumContent = byId('summary_content');
    const elTotal    = byId('sum_total_time');
    const elTotalCnt = byId('sum_total_count');
    const tbodyDrv   = byId('sum_per_driver');
    const tbodyAddr  = byId('sum_per_address');

    if (!filteredReports || filteredReports.length === 0) {
      if (sumEmpty)   sumEmpty.style.display = 'block';
      if (sumContent) sumContent.style.display = 'none';
      return;
    }

    if (sumEmpty)   sumEmpty.style.display = 'none';
    if (sumContent) sumContent.style.display = 'grid';

    // Bygg events → stints basert på filtrerte reports
    const events = reportsToEvents(filteredReports);
    const stints = buildStints(events);

    const totalMs = stints.reduce((acc, s) => acc + s.durMs, 0);
    if (elTotal) elTotal.textContent = msToHhMm(totalMs);
    if (elTotalCnt) {
      elTotalCnt.textContent =
        `${stints.length} fullførte økter (start→ferdig) i valgt filter.`;
    }

    // Per sjåfør
    if (tbodyDrv) {
      tbodyDrv.innerHTML = '';
      const perDrv = summarizePerDriver(stints);
      if (perDrv.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 2;
        td.textContent = 'Ingen data.';
        tr.appendChild(td);
        tbodyDrv.appendChild(tr);
      } else {
        for (const row of perDrv) {
          const tr = document.createElement('tr');
          const tdName = document.createElement('td');
          const tdTime = document.createElement('td');
          tdName.textContent = row.driver || 'Ukjent';
          tdTime.textContent = msToHhMm(row.ms);
          tr.appendChild(tdName);
          tr.appendChild(tdTime);
          tbodyDrv.appendChild(tr);
        }
      }
    }

    // Per adresse
    if (tbodyAddr) {
      tbodyAddr.innerHTML = '';
      const perAddr = summarizePerAddress(stints);
      if (perAddr.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.textContent = 'Ingen data.';
        tr.appendChild(td);
        tbodyAddr.appendChild(tr);
      } else {
        for (const row of perAddr) {
          const tr = document.createElement('tr');
          const tdAddr = document.createElement('td');
          const tdTime = document.createElement('td');
          const tdCnt  = document.createElement('td');

          tdAddr.textContent = row.addr || '—';
          tdTime.textContent = msToHhMm(row.ms);
          tdCnt.textContent  = String(row.count);

          tr.appendChild(tdAddr);
          tr.appendChild(tdTime);
          tr.appendChild(tdCnt);
          tbodyAddr.appendChild(tr);
        }
      }
    }
  }

  function renderTable(filteredReports, addressesByName) {
    const tbody = byId('logg_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!filteredReports || filteredReports.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'Ingen hendelser for valgt filter.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const rows = filteredReports
      .slice()
      .sort((a, b) => {
        const ta = Date.parse(a.at || a.ts || 0);
        const tb = Date.parse(b.at || b.ts || 0);
        return tb - ta; // nyeste først
      });

    for (const r of rows) {
      const tr = document.createElement('tr');

      const d = new Date(r.at || r.ts || Date.now());
      const dateStr = fmtDate(d);
      const timeStr = fmtTime(d);

      const driver = r.by || r.driver || '';
      const addr =
        r.addressId ||
        r.addressName ||
        r.address ||
        '';

      // Finn oppgave fra adresseregister hvis mulig
      let task = r.task || '';
      if (!task && addr && addressesByName && addressesByName.has(addr)) {
        task = addressesByName.get(addr).task || '';
      }

      let actionLabel = '';
      if (r.type === 'start' || r.action === 'start') {
        actionLabel = 'Start';
      } else if (r.type === 'done' || r.action === 'ferdig') {
        actionLabel = 'Ferdig';
      } else if (r.action) {
        actionLabel = r.action;
      } else if (r.type) {
        actionLabel = r.type;
      }

      const cells = [
        dateStr,
        timeStr,
        driver,
        addr,
        task,
        actionLabel
      ];

      for (const val of cells) {
        const td = document.createElement('td');
        td.textContent = val || '—';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  function fillDriverFilterOptions(reports) {
    const sel = byId('f_driver');
    if (!sel) return;
    const seen = new Set();
    const drivers = [];

    for (const r of reports) {
      const d = (r.by || r.driver || '').trim();
      if (!d) continue;
      if (!seen.has(d)) {
        seen.add(d);
        drivers.push(d);
      }
    }
    drivers.sort((a, b) => a.localeCompare(b, 'nb'));

    // Behold første "Alle"
    sel.innerHTML = '<option value="">Alle</option>';
    for (const d of drivers) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      sel.appendChild(opt);
    }
  }

  function fillAddressDatalist(addressesByName, reports) {
    const dl = byId('addrList');
    if (!dl) return;
    dl.innerHTML = '';

    const seen = new Set();

    // Fra adresseregister
    if (addressesByName) {
      for (const name of addressesByName.keys()) {
        if (!name) continue;
        seen.add(name);
      }
    }

    // Fra logg (i tilfelle noen ikke ligger i katalog)
    if (Array.isArray(reports)) {
      for (const r of reports) {
        const addr =
          r.addressId ||
          r.addressName ||
          r.address ||
          '';
        if (addr) seen.add(addr);
      }
    }

    const list = Array.from(seen).sort((a, b) => a.localeCompare(b, 'nb'));
    for (const name of list) {
      const opt = document.createElement('option');
      opt.value = name;
      dl.appendChild(opt);
    }
  }

  // --- HOVEDLASTER ---

  async function loadAllAndRender() {
    const metaEl = byId('logg_meta');
    if (metaEl) metaEl.textContent = 'Laster logg fra JSONbin …';

    try {
      const [reportRecord, addrRecord] = await Promise.all([
        fetchJsonbinLatest(REPORT_BIN_ID),
        fetchJsonbinLatest(ADDR_BIN_ID).catch(() => null)
      ]);

      const reports = Array.isArray(reportRecord.reports)
        ? reportRecord.reports
        : (Array.isArray(reportRecord) ? reportRecord : []);

      let addressesByName = null;
      if (addrRecord && Array.isArray(addrRecord.addresses)) {
        addressesByName = new Map();
        for (const a of addrRecord.addresses) {
          if (!a || !a.name) continue;
          addressesByName.set(a.name, a);
        }
      }

      if (metaEl) {
        const total = reports.length;
        let latestStr = '';
        if (total > 0) {
          const latest = reports
            .slice()
            .sort((a, b) => Date.parse(b.at || b.ts || 0) - Date.parse(a.at || a.ts || 0))[0];
          const d = new Date(latest.at || latest.ts || Date.now());
          latestStr = ` – siste: ${fmtDate(d)} kl ${fmtTime(d)}`;
        }
        metaEl.textContent = `Totalt ${total} rå-hendelser${latestStr}`;
      }

      // Oppdater filter-valg (sjåfør + adresseliste)
      fillDriverFilterOptions(reports);
      fillAddressDatalist(addressesByName, reports);

      // Lag en renderer-funksjon som kan kalles ved filter-endring
      function applyFiltersAndRender() {
        const filters = readFilters();
        const filtered = reports.filter((r) => passesFilters(r, filters));
        renderSummary(filtered, addressesByName);
        renderTable(filtered, addressesByName);
      }

      // Første render uten filter (alt)
      applyFiltersAndRender();

      // Koble filter-events
      ['f_date_from', 'f_date_to', 'f_driver', 'f_address', 'f_type'].forEach((id) => {
        const el = byId(id);
        if (!el) return;
        el.addEventListener('change', applyFiltersAndRender);
        el.addEventListener('input', () => {
          // for tekstfelter
          if (el.tagName === 'INPUT') applyFiltersAndRender();
        });
      });

      const btnClear = byId('btn_clear_filters');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          const f = ['f_date_from', 'f_date_to', 'f_driver', 'f_address', 'f_type'];
          f.forEach((id) => {
            const el = byId(id);
            if (!el) return;
            if (el.tagName === 'SELECT') {
              el.value = '';
            } else {
              el.value = '';
            }
          });
          applyFiltersAndRender();
        });
      }

      const btnReload = byId('btn_reload');
      if (btnReload) {
        btnReload.addEventListener('click', () => {
          loadAllAndRender(); // re-load fra JSONbin
        });
      }
    } catch (err) {
      console.error('Feil i logg-laster:', err);
      if (metaEl) metaEl.textContent = 'Feil ved lasting av logg. Sjekk JSONbin/X-Master-Key.';
      const tbody = byId('logg_tbody');
      if (tbody) {
        tbody.innerHTML = '';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = 'Feil ved lasting av logg-data.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
    }
  }

  // Start når siden er klar
  window.addEventListener('DOMContentLoaded', () => {
    loadAllAndRender();
  });
})();