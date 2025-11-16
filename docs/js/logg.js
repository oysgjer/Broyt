// js/logg.js – detaljert logg / rapport

const REPORT_BIN_ID   = '68e89e3443b1c97be9611c48'; // reports / hendelser
const ADDR_BIN_ID     = '68e7b4d2ae596e708f0bde7d'; // adressekatalog
const MAX_INTERVAL_MS = 90 * 60 * 1000;             // maks 90 min per intervall

// ----- Hjelpere -----

const pad = (n) => (n < 10 ? '0' + n : '' + n);

// Normaliser adressenavn slik at små forskjeller ikke ødelegger oppgave-oppslag
function normalizeAddr(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, ' ')     // flere mellomrom -> ett
    .replace(/\s+,/g, ',')    // mellomrom før komma
    .replace(/,\s+/g, ', ')   // pent komma + mellomrom
    .trim();
}

function fmtTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(d) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function msToHhMm(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 t 0 min';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} t ${m} min`;
}

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
  return null;
}

// ----- Hent JSONbin -----

async function fetchJsonBinLatest(binId) {
  const key = getMasterKey();
  const headers = {};
  if (key) headers['X-Master-Key'] = key;

  const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for bin ${binId}`);
  const data = await res.json();
  return data.record || data;
}

// ----- Reports → events -----

function normalizeReportsToEvents(reports) {
  if (!Array.isArray(reports)) return [];

  return reports
    .map(r => {
      const tsStr = r.at || r.ts;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) return null;

      const action = (r.action || '').toLowerCase();
      const type = r.type;

      let kind = null;
      if (type === 'start' || action === 'start') {
        kind = 'start';
      } else if (
        type === 'done' ||
        action === 'ferdig' ||
        action === 'ikke mulig'
      ) {
        // ferdig + ikke mulig avslutter intervall
        kind = 'stop';
      } else {
        return null; // hopp over "neste" osv.
      }

      const addrRaw =
        r.addressId ||
        r.addressName ||
        r.address ||
        '—';

      const addrNorm = normalizeAddr(addrRaw);
      const driver = r.by || r.driver || '';

      return { ts, kind, addrRaw, addrNorm, driver, raw: r };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);
}

// ----- Utled S / G -----

function deriveTaskCode(addrEquip, rawTask) {
  const t = (rawTask || '').toLowerCase();

  // Direkte fra logg (hvis vi senere lagrer "S" / "G" eller tekst)
  if (t === 'g') return 'G';
  if (t === 's') return 'S';
  if (t.includes('grus') || t.includes('sand') || t.includes('strø')) return 'G';
  if (t.includes('snø') || t.includes('brøyte')) return 'S';

  // Fallback fra utstyr på adressen (fra katalog)
  const eq = Array.isArray(addrEquip) ? addrEquip : [];
  const eqLower = eq.map(x => (x || '').toLowerCase());
  if (
    eqLower.includes('sand') ||
    eqLower.includes('grus') ||
    eqLower.includes('stro') ||
    eqLower.includes('strø')
  ) {
    return 'G';
  }
  if (
    eqLower.includes('fres') ||
    eqLower.includes('plog') ||
    eqLower.includes('skjær') ||
    eqLower.includes('skjaer')
  ) {
    return 'S';
  }

  // Hvis vi ikke vet – default til snø (S)
  return 'S';
}

// ----- events → sessions (start → stop) -----

function buildSessions(events, addrInfoMap) {
  const byKey = new Map(); // key = addrNorm||driver

  for (const ev of events) {
    const key = `${ev.addrNorm}||${ev.driver || ''}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(ev);
  }

  const sessions = [];

  for (const [key, list] of byKey.entries()) {
    list.sort((a, b) => a.ts - b.ts);

    let openStart = null;
    let lastStartEv = null;

    for (const ev of list) {
      if (ev.kind === 'start') {
        if (openStart == null) {
          openStart = ev.ts;
          lastStartEv = ev;
        }
      } else if (ev.kind === 'stop') {
        if (openStart != null && ev.ts > openStart) {
          let dur = ev.ts - openStart;
          if (dur > MAX_INTERVAL_MS) dur = MAX_INTERVAL_MS;

          const [addrNorm, driver] = key.split('||');
          const displayAddr = ev.addrRaw || '—';

          const addrInfo = addrInfoMap.get(addrNorm) || {};
          const rawTask =
            (lastStartEv && lastStartEv.raw && lastStartEv.raw.task) ||
            (ev.raw && ev.raw.task) ||
            '';

          const taskCode = deriveTaskCode(addrInfo.equipment, rawTask); // 'S' eller 'G'

          // Merknad (ikke mulig + notes)
          let note = '';
          const raw = ev.raw || {};
          const action = (raw.action || '').toLowerCase();
          if (action.includes('ikke')) {
            note = 'Ikke mulig';
            if (raw.notes && raw.notes.trim()) note += ': ' + raw.notes.trim();
          } else if (raw.notes && raw.notes.trim()) {
            note = raw.notes.trim();
          }

          sessions.push({
            addr: displayAddr,
            addrNorm,
            driver,
            startTs: openStart,
            endTs: ev.ts,
            durMs: dur,
            taskCode, // 'S' eller 'G'
            note
          });
        }
        openStart = null;
        lastStartEv = null;
      }
    }
  }

  // Nyeste øverst
  sessions.sort((a, b) => b.startTs - a.startTs);
  return sessions;
}

// ----- Summeringer -----

function summarizeTotal(sessions) {
  let totalMs = 0, todayMs = 0, weekMs = 0, monthMs = 0, prevMonthMs = 0;

  const now = new Date();
  const todayStr = fmtDate(now);

  const weekStart = new Date(now);
  const day = weekStart.getDay() || 7;
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (day - 1));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  for (const s of sessions) {
    totalMs += s.durMs;
    const start = new Date(s.startTs);
    const dStr = fmtDate(start);

    if (dStr === todayStr) todayMs += s.durMs;
    if (start >= weekStart && start <= now) weekMs += s.durMs;
    if (start >= monthStart && start <= now) monthMs += s.durMs;
    if (start >= prevMonthStart && start < monthStart) prevMonthMs += s.durMs;
  }

  return { totalMs, todayMs, weekMs, monthMs, prevMonthMs };
}

function summarizeByDriver(sessions) {
  const map = new Map();
  for (const s of sessions) {
    const key = s.driver || 'Ukjent';
    map.set(key, (map.get(key) || 0) + s.durMs);
  }
  return map;
}

function summarizeByAddress(sessions) {
  const map = new Map();
  for (const s of sessions) {
    const key = s.addrNorm || s.addr;
    if (!map.has(key)) {
      map.set(key, {
        displayAddr: s.addr,
        durMs: 0,
        count: 0,
        taskCode: s.taskCode || 'S'
      });
    }
    const obj = map.get(key);
    obj.durMs += s.durMs;
    obj.count += 1;
    // La første oppgavekoden «vinne» – S eller G
  }
  return map;
}

// ----- Rendering -----

function renderTimeSummary(summary) {
  const el = document.getElementById('timeSummary');
  if (!el) return;
  el.innerHTML = `
    <div><strong>Totalt:</strong> ${msToHhMm(summary.totalMs)}</div>
    <div><strong>Forrige måned:</strong> ${msToHhMm(summary.prevMonthMs)}</div>
    <div><strong>Denne måneden:</strong> ${msToHhMm(summary.monthMs)}</div>
    <div><strong>Denne uken:</strong> ${msToHhMm(summary.weekMs)}</div>
    <div><strong>I dag:</strong> ${msToHhMm(summary.todayMs)}</div>
  `;
}

function renderFilters(sessions) {
  const driverSel = document.getElementById('filter_driver');
  const addrSel   = document.getElementById('filter_addr');
  if (!driverSel || !addrSel) return;

  const drivers = new Set();
  const addrs   = new Set();

  for (const s of sessions) {
    if (s.driver) drivers.add(s.driver);
    if (s.addr) addrs.add(s.addr);
  }

  driverSel.length = 1;
  addrSel.length   = 1;

  Array.from(drivers).sort().forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    driverSel.appendChild(opt);
  });

  Array.from(addrs).sort().forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    addrSel.appendChild(opt);
  });
}

function applyFilters(allSessions) {
  const dSel = document.getElementById('filter_driver');
  const aSel = document.getElementById('filter_addr');
  const driver = dSel?.value || '';
  const addr   = aSel?.value || '';

  return allSessions.filter(s => {
    if (driver && s.driver !== driver) return false;
    if (addr && s.addr !== addr) return false;
    return true;
  });
}

function renderDetailTable(sessions) {
  const tbody = document.getElementById('log_tbody');
  const empty = document.getElementById('log_empty');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!sessions.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  for (const s of sessions) {
    const start = new Date(s.startTs);
    const end   = new Date(s.endTs);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:4px;">${fmtDate(start)}</td>
      <td style="padding:4px;">${fmtTime(start)}</td>
      <td style="padding:4px;">${fmtTime(end)}</td>
      <td style="padding:4px;">${s.addr}</td>
      <td style="padding:4px; text-align:center;">${s.taskCode || 'S'}</td>
      <td style="padding:4px;">${s.driver || '—'}</td>
      <td style="padding:4px;">${s.note || ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderDriverSummary(map) {
  const tbody = document.getElementById('driver_tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  for (const [driver, ms] of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:4px;">${driver}</td>
      <td style="padding:4px;">${msToHhMm(ms)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAddrSummary(map) {
  const tbody = document.getElementById('addr_tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const entries = Array.from(map.entries()).sort((a, b) => b[1].durMs - a[1].durMs);
  for (const [, info] of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:4px;">${info.displayAddr}</td>
      <td style="padding:4px; text-align:center;">${info.taskCode || 'S'}</td>
      <td style="padding:4px;">${msToHhMm(info.durMs)}</td>
      <td style="padding:4px;">${info.count}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ----- Init -----

async function initLogg() {
  try {
    const [reportRecord, addrRecord] = await Promise.all([
      fetchJsonBinLatest(REPORT_BIN_ID),
      fetchJsonBinLatest(ADDR_BIN_ID)
    ]);

    const reports = Array.isArray(reportRecord.reports)
      ? reportRecord.reports
      : (Array.isArray(reportRecord) ? reportRecord : []);

    // Bygg kart: normalisert adresse -> { task, equipment }
    const addrInfoMap = new Map();
    if (addrRecord && Array.isArray(addrRecord.addresses)) {
      for (const a of addrRecord.addresses) {
        if (!a || !a.name) continue;
        const key = normalizeAddr(a.name);
        addrInfoMap.set(key, {
          task: a.task || '',
          equipment: Array.isArray(a.equipment) ? a.equipment : []
        });
      }
    }

    const events      = normalizeReportsToEvents(reports);
    const allSessions = buildSessions(events, addrInfoMap);

    renderFilters(allSessions);

    const filtered = applyFilters(allSessions);
    renderDetailTable(filtered);
    renderTimeSummary(summarizeTotal(filtered));
    renderDriverSummary(summarizeByDriver(filtered));
    renderAddrSummary(summarizeByAddress(filtered));

    const dSel = document.getElementById('filter_driver');
    const aSel = document.getElementById('filter_addr');
    const onChange = () => {
      const f = applyFilters(allSessions);
      renderDetailTable(f);
      renderTimeSummary(summarizeTotal(f));
      renderDriverSummary(summarizeByDriver(f));
      renderAddrSummary(summarizeByAddress(f));
    };
    dSel?.addEventListener('change', onChange);
    aSel?.addEventListener('change', onChange);

  } catch (err) {
    console.error('Feil ved lasting av logg:', err);
    const tbody = document.getElementById('log_tbody');
    if (tbody) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="padding:6px; color:#b91c1c;">
        Feil ved lasting av logg. Sjekk nett / JSONbin-nøkkel.
      </td>`;
      tbody.appendChild(tr);
    }
    const ts = document.getElementById('timeSummary');
    if (ts) ts.textContent = 'Kunne ikke laste tid (feil mot JSONbin).';
  }
}

document.addEventListener('DOMContentLoaded', initLogg);