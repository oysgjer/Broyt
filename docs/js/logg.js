// js/logg.js – leser reports-bin og lager intervaller + detaljert tabell
(() => {
  const REPORT_BIN_ID   = '68e89e3443b1c97be9611c48'; // hendelser / reports
  const ADDR_BIN_ID     = '68e7b4d2ae596e708f0bde7d'; // adresser
  const MAX_INTERVAL_MS = 90 * 60 * 1000;

  const MASTER_KEY_KEYS = [
    'jsonbin_master_key',
    'jsonbin_master',
    'rt_jsonbin_master',
    'rt_jsonbin_key',
    'X-Master-Key'
  ];

  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  const fmtDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const fmtNorDate = (d) =>
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

  const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const msToHhMm = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0:00';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${pad(m)}`;
  };

  function getMasterKey() {
    for (const k of MASTER_KEY_KEYS) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
    return null;
  }

  async function fetchJsonbinLatest(binId) {
    const key = getMasterKey();
    const headers = {};
    if (key) headers['X-Master-Key'] = key;

    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`JSONbin ${binId}: ${res.status}`);
    }

    const data = await res.json();
    return data && (data.record || data);
  }

  // --- Normaliser reports ---
  function normalizeReports(record) {
    const raw = Array.isArray(record?.reports)
      ? record.reports
      : Array.isArray(record)
      ? record
      : [];

    const rows = [];

    for (const r of raw) {
      const tsStr = r.at || r.ts;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;
      const d = new Date(ts);

      // Finn handling
      let kind = null;
      if (r.type === 'start' || r.action === 'start') {
        kind = 'start';
      } else if (r.type === 'done' || r.action === 'ferdig') {
        kind = 'done';
      } else if (
        r.type === 'blocked' ||
        r.action === 'ikke-mulig' ||
        r.action === 'blokker' ||
        r.action === 'ikke mulig'
      ) {
        kind = 'blocked';
      } else {
        // hopp over "neste" og annet støy
        continue;
      }

      const driver  = (r.by || r.driver || '').trim() || 'Ukjent';
      const address = (r.addressId || r.addressName || r.address || '—').trim();
      const notes   = (r.notes || '').trim();

      // Oppgave – bruker r.task hvis det finnes, ellers står tomt.
      // (Kan senere fylles ut mer via adresser / utstyr)
      let task = (r.task || '').trim();

      rows.push({
        ts,
        dateIso: fmtDate(d),
        dateNor: fmtNorDate(d),
        time: fmtTime(d),
        driver,
        address,
        task,
        kind,   // start | done | blocked
        notes
      });
    }

    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }

  // --- Bygg intervaller start→stopp per (sjåfør + adresse + oppgave) ---
  function buildIntervals(rows) {
    const byKey = new Map();

    for (const r of rows) {
      const key = `${r.driver}||${r.address}||${r.task}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(r);
    }

    const intervals = [];

    for (const [key, list] of byKey) {
      list.sort((a, b) => a.ts - b.ts);
      const [driver, address, task] = key.split('||');
      let openStart = null;
      let openDateIso = null;
      let openDateNor = null;

      for (const ev of list) {
        if (ev.kind === 'start') {
          if (openStart == null) {
            openStart   = ev.ts;
            openDateIso = ev.dateIso;
            openDateNor = ev.dateNor;
          }
        } else if (ev.kind === 'done' || ev.kind === 'blocked') {
          if (openStart != null && ev.ts > openStart) {
            let dur = ev.ts - openStart;
            if (dur > MAX_INTERVAL_MS) dur = MAX_INTERVAL_MS;

            const startD = new Date(openStart);
            const stopD  = new Date(ev.ts);

            intervals.push({
              startTs: openStart,
              stopTs: ev.ts,
              dateIso: openDateIso,
              dateNor: openDateNor,
              startTime: fmtTime(startD),
              stopTime: fmtTime(stopD),
              driver,
              address,
              task,
              durationMs: dur,
              notPossible: ev.kind === 'blocked',
              note: ev.kind === 'blocked'
                ? (ev.notes ? `Ikke mulig: ${ev.notes}` : 'Ikke mulig')
                : ev.notes || ''
            });
          }
          openStart   = null;
          openDateIso = null;
          openDateNor = null;
        }
      }
    }

    intervals.sort((a, b) => a.startTs - b.startTs);
    return intervals;
  }

  // --- Adresser for rullegardin og evt. oppgave-resonnering ---
  function normalizeAddresses(record) {
    const list = [];

    // Public/catalog-format: {addresses:[{name, task, equipment:[...]}]}
    if (record && Array.isArray(record.addresses)) {
      for (const a of record.addresses) {
        if (!a || !a.name) continue;
        list.push({
          name: a.name,
          task: a.task || '',
          equipment: Array.isArray(a.equipment) ? a.equipment : []
        });
      }
    }
    // Master-format: {stops:[{n,t,...}]}
    if (record && Array.isArray(record.stops)) {
      for (const s of record.stops) {
        if (!s || !s.n) continue;
        list.push({
          name: s.n,
          task: s.t || '',
          equipment: []
        });
      }
    }

    // Unike navn
    const seen = new Map();
    for (const a of list) {
      if (!seen.has(a.name)) seen.set(a.name, a);
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'nb')
    );
  }

  function guessTask(taskRaw, addrMeta) {
    // Hvis vi har eksplisitt oppgave lagret i loggen, bruk den
    if (taskRaw && taskRaw.toLowerCase) {
      const t = taskRaw.toLowerCase();
      if (t.includes('grus')) return 'grus';
      if (t.includes('snø') && t.includes('grus')) return 'snø+grus';
      if (t.includes('snø')) return 'snø';
    }

    // Hvis ikke: prøv å se på utstyr for adressen
    if (addrMeta && Array.isArray(addrMeta.equipment) && addrMeta.equipment.length) {
      const eq = addrMeta.equipment;
      const hasFres = eq.includes('fres');
      const hasSand = eq.includes('stro') || eq.includes('sand') || eq.includes('grus');

      if (hasSand && !hasFres) return 'grus';
      if (hasFres && !hasSand) return 'snø';
      if (hasFres && hasSand) return 'snø+grus';
    }

    // Fallback: hvis tekst på adressen sier noe
    if (addrMeta && addrMeta.task) {
      const t = addrMeta.task.toLowerCase();
      if (t.includes('grus')) return 'grus';
      if (t.includes('snø') && t.includes('grus')) return 'snø+grus';
      if (t.includes('snø')) return 'snø';
    }

    return ''; // ukjent / begge
  }

  // --- Rendering ---
  let gIntervals = [];
  let gAddressesMeta = [];

  function populateFilters() {
    const selDriver  = document.getElementById('f_driver');
    const selAddress = document.getElementById('f_address');

    if (selDriver) {
      const drivers = Array.from(
        new Set(gIntervals.map((iv) => iv.driver).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'nb'));
      for (const d of drivers) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        selDriver.appendChild(opt);
      }
    }

    if (selAddress) {
      const names = new Set();
      for (const iv of gIntervals) names.add(iv.address);
      for (const a of gAddressesMeta) names.add(a.name);

      const list = Array.from(names).sort((a, b) =>
        a.localeCompare(b, 'nb')
      );
      for (const n of list) {
        if (!n) continue;
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        selAddress.appendChild(opt);
      }
    }
  }

  function getAddrMeta(name) {
    return gAddressesMeta.find((a) => a.name === name) || null;
  }

  function applyFilters() {
    const tbody      = document.getElementById('logg_tbody');
    const summaryEl  = document.getElementById('summary_text');
    const fFrom      = document.getElementById('f_date_from');
    const fTo        = document.getElementById('f_date_to');
    const fDriver    = document.getElementById('f_driver');
    const fAddress   = document.getElementById('f_address');
    const fTask      = document.getElementById('f_task');

    if (!tbody) return;

    const fromVal = fFrom?.value || '';
    const toVal   = fTo?.value || '';
    const driver  = fDriver?.value || '';
    const addr    = fAddress?.value || '';
    const taskF   = fTask?.value || '';

    // Normaliser tasks på intervaller før filtrering
    const intervalsWithTask = gIntervals.map((iv) => {
      const addrMeta = getAddrMeta(iv.address);
      const guessed  = guessTask(iv.task, addrMeta);
      return {
        ...iv,
        taskNorm: guessed || ''
      };
    });

    let list = intervalsWithTask;

    if (fromVal) {
      list = list.filter((iv) => iv.dateIso >= fromVal);
    }
    if (toVal) {
      list = list.filter((iv) => iv.dateIso <= toVal);
    }
    if (driver) {
      list = list.filter((iv) => iv.driver === driver);
    }
    if (addr) {
      list = list.filter((iv) => iv.address === addr);
    }
    if (taskF) {
      list = list.filter((iv) => iv.taskNorm === taskF);
    }

    // Render tabell
    tbody.innerHTML = '';
    let totalMs = 0;

    for (const iv of list) {
      totalMs += iv.durationMs;

      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = iv.dateNor;
      tdDate.style.padding = '4px';
      tdDate.style.borderBottom = '1px solid var(--sep)';

      const tdFrom = document.createElement('td');
      tdFrom.textContent = iv.startTime;
      tdFrom.style.padding = '4px';
      tdFrom.style.borderBottom = '1px solid var(--sep)';

      const tdTo = document.createElement('td');
      tdTo.textContent = iv.stopTime;
      tdTo.style.padding = '4px';
      tdTo.style.borderBottom = '1px solid var(--sep)';

      const tdAddr = document.createElement('td');
      tdAddr.textContent = iv.address;
      tdAddr.style.padding = '4px';
      tdAddr.style.borderBottom = '1px solid var(--sep)';

      const tdTask = document.createElement('td');
      let taskText = '';
      if (iv.taskNorm === 'grus') taskText = 'Grus';
      else if (iv.taskNorm === 'snø') taskText = 'Snø';
      else if (iv.taskNorm === 'snø+grus') taskText = 'Snø + grus';
      tdTask.textContent = taskText || '—';
      tdTask.style.padding = '4px';
      tdTask.style.borderBottom = '1px solid var(--sep)';

      const tdDrv = document.createElement('td');
      tdDrv.textContent = iv.driver;
      tdDrv.style.padding = '4px';
      tdDrv.style.borderBottom = '1px solid var(--sep)';

      const tdNote = document.createElement('td');
      tdNote.textContent = iv.note || '';
      tdNote.style.padding = '4px';
      tdNote.style.borderBottom = '1px solid var(--sep)';
      if (iv.notPossible) {
        tdNote.style.fontWeight = '600';
      }

      tr.appendChild(tdDate);
      tr.appendChild(tdFrom);
      tr.appendChild(tdTo);
      tr.appendChild(tdAddr);
      tr.appendChild(tdTask);
      tr.appendChild(tdDrv);
      tr.appendChild(tdNote);

      tbody.appendChild(tr);
    }

    if (summaryEl) {
      const count = list.length;
      summaryEl.textContent =
        count === 0
          ? 'Ingen intervaller i valgt filter.'
          : `${count} intervaller • Sum tid ${msToHhMm(totalMs)}`;
    }
  }

  function wireFilters() {
    const ids = ['f_date_from', 'f_date_to', 'f_driver', 'f_address', 'f_task'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFilters);
    }
    const resetBtn = document.getElementById('f_reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const fFrom    = document.getElementById('f_date_from');
        const fTo      = document.getElementById('f_date_to');
        const fDriver  = document.getElementById('f_driver');
        const fAddress = document.getElementById('f_address');
        const fTask    = document.getElementById('f_task');
        if (fFrom) fFrom.value = '';
        if (fTo) fTo.value = '';
        if (fDriver) fDriver.value = '';
        if (fAddress) fAddress.value = '';
        if (fTask) fTask.value = '';
        applyFilters();
      });
    }
  }

  async function init() {
    const summaryEl = document.getElementById('summary_text');
    if (summaryEl) summaryEl.textContent = 'Laster logg…';

    try {
      const [repRecord, addrRecord] = await Promise.all([
        fetchJsonbinLatest(REPORT_BIN_ID).catch(() => ({})),
        fetchJsonbinLatest(ADDR_BIN_ID).catch(() => ({}))
      ]);

      const rows      = normalizeReports(repRecord);
      gIntervals      = buildIntervals(rows);
      gAddressesMeta  = normalizeAddresses(addrRecord);

      populateFilters();
      wireFilters();
      applyFilters();
    } catch (err) {
      console.error('Feil i logg.js:', err);
      if (summaryEl) {
        summaryEl.textContent = 'Kunne ikke laste logg fra JSONbin.';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();