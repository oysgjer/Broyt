Her er en komplett logg.js som:
	•	henter data fra hendelser-/report-bin 68e89e3443b1c97be9611c48 og adressekatalog 68e7b4d2ae596e708f0bde7d
	•	bygger sammenhengende jobber (start → ferdig)
	•	sorterer detaljert logg med nyeste øverst
	•	viser Samlet brøytetid (total / forrige mnd / denne mnd / denne uka / i dag)
	•	fyller filtre (sjåfør + adresse) med rullegardin-valg
	•	viser tid per sjåfør og tid per adresse
	•	bruker roundTask fra loggeren (Hjem-skjermen) som fasit for S/G – ellers gjetter ut fra tekst/utstyr

Forutsetter at logg.html har:
	•	select-felter med id: filter_driver, filter_address
	•	tabell-tbody for detaljert logg: tbl_sessions
	•	tabell-tbody for tid per sjåfør: tbl_driver
	•	tabell-tbody for tid per adresse: tbl_addr
	•	spans/diver for samlet tid: sum_total, sum_prev_month, sum_this_month, sum_this_week, sum_today

// logg.js – leser JSONBin, bygger samlet brøytetid og loggtabeller

// --- KONFIG ---
const HENDELSER_BIN_ID = '68e89e3443b1c97be9611c48'; // reports/hendelser
const KATALOG_BIN_ID   = '68e7b4d2ae596e708f0bde7d'; // public / adresser

// --- SMÅ HJELPERE ---
const $    = (sel, root = document) => root.querySelector(sel);
const byId = (id) => document.getElementById(id);
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

function fmtNorDate(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtNorTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 6 t 25 min
function msToNorDur(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} t`;
  return `${h} t ${m} min`;
}

// --- DATO-INTERVALLER ---
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfPrevMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() - 1);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0= søn
  const diff = (day + 6) % 7; // mandag som uke-start
  x.setDate(x.getDate() - diff);
  return x;
}

// --- JSONBIN ---
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

async function fetchJsonBinLatest(binId) {
  const key = getMasterKey();
  if (!binId) throw new Error('Mangler binId');
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['X-Master-Key'] = key;

  const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`JSONbin ${binId} feilet: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data && (data.record || data);
}

// --- NORMALISER RÅE REPORT-RADER TIL ENKLERE FORMAT ---
// Inn: rå report-rad (blanding av "reports"-format og eldre format)
// Ut: { ts, driver, address, type, roundTask?, notes? }
function normalizeRow(raw) {
  if (!raw) return null;

  // Timestamp
  const tsStr = raw.at || raw.ts || raw.time || raw.timestamp;
  const ts = Date.parse(tsStr);
  if (!Number.isFinite(ts)) return null;

  // Sjåfør
  const driver = raw.by || raw.driver || 'Ukjent';

  // Adresse
  const address =
    raw.addressId ||
    raw.addressName ||
    raw.address ||
    '—';

  // Type / action
  let type;
  const t = (raw.type || raw.action || '').toString().toLowerCase();
  if (t === 'start') type = 'start';
  else if (t === 'done' || t === 'ferdig' || t === 'stopp' || t === 'stop') type = 'done';
  else if (t.includes('ikke')) type = 'blocked';
  else return null; // ignorer "neste" og annet støy

  // Oppgavekode for runden (S/G) – logges av auto_logger
  let roundTask = raw.roundTask;
  if (roundTask !== 'S' && roundTask !== 'G') roundTask = null;

  // Notat
  const notes = raw.notes || (type === 'blocked' ? 'Ikke mulig' : '');

  return {
    ts,
    driver,
    address,
    type,
    roundTask, // kan være null
    notes,
    _raw: raw
  };
}

// --- BYGG "SESSIONS" (SAMMENHENGENDE JOBB START → FERDIG) ---
const MAX_INTERVAL_MS = 90 * 60 * 1000; // maks 90 min per økt

/**
 * sessions: [
 *   {
 *     from, to, durMs,
 *     driver,
 *     address,
 *     taskCode: 'S' | 'G',
 *     notes   : 'Ikke mulig...' | ''
 *   }
 * ]
 */
function buildSessions(rows, katalogMap) {
  // rows: normaliserte events
  if (!Array.isArray(rows)) return [];

  // sortér eldste først for pairing
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);

  // Gruppér per (driver + adresse) – enkel modell
  const byKey = new Map();
  for (const r of sorted) {
    const key = `${r.driver}@@${r.address}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }

  const sessions = [];

  for (const [, evs] of byKey) {
    let openStart = null;
    let openTask  = null;
    let openNotes = '';

    for (const ev of evs) {
      if (ev.type === 'start') {
        if (openStart == null) {
          openStart = ev.ts;
          openTask  = ev.roundTask || guessTaskCodeFromAddr(katalogMap.get(ev.address), ev._raw);
          openNotes = '';
        }
        // ekstra start ignoreres når vi allerede har openStart
      } else if (ev.type === 'done' || ev.type === 'blocked') {
        if (openStart != null) {
          const to = ev.ts;
          if (to > openStart) {
            let durMs = to - openStart;
            if (durMs > MAX_INTERVAL_MS) durMs = MAX_INTERVAL_MS;

            const taskCode = ev.roundTask || openTask || guessTaskCodeFromAddr(katalogMap.get(ev.address), ev._raw);
            const notes = (ev.type === 'blocked'
              ? (ev.notes || 'Ikke mulig')
              : ev.notes || openNotes || '');

            sessions.push({
              from: openStart,
              to,
              durMs,
              driver: ev.driver,
              address: ev.address,
              taskCode,
              notes
            });
          }
        }
        openStart = null;
        openTask  = null;
        openNotes = '';
      }
    }
    // evt. åpen start uten ferdig ignoreres
  }

  // NYESTE ØVERST i tabellen
  sessions.sort((a, b) => b.to - a.to);
  return sessions;
}

// --- OPPGAVEKODE (S / G) ---
// addrInfo: objekt fra katalog (public-bin)
// rawRow  : original rå rad fra report hvis vi vil sjekke tekst
function guessTaskCodeFromAddr(addrInfo, rawRow) {
  // 1) Hvis loggeren har lagt på roundTask på rå-raden, er det fasiten
  if (rawRow && (rawRow.roundTask === 'S' || rawRow.roundTask === 'G')) {
    return rawRow.roundTask;
  }

  const addrTask = (addrInfo && addrInfo.task) || '';
  const rawTask  = (rawRow && rawRow.task) || '';
  const combined = `${addrTask} ${rawTask}`.toLowerCase();

  // Tekst-regler
  if (
    combined.includes('grus') ||
    combined.includes('sand') ||
    combined.includes('strø') ||
    combined.includes('stro')
  ) {
    return 'G';
  }
  if (
    combined.includes('snø') ||
    combined.includes('sno') ||
    combined.includes('brøyte') ||
    combined.includes('broyte')
  ) {
    return 'S';
  }

  // Utstyr fra katalog
  const eq = addrInfo && Array.isArray(addrInfo.equipment)
    ? addrInfo.equipment
    : [];
  const eqLower = eq.map(x => (x || '').toLowerCase());

  if (
    eqLower.includes('sand') ||
    eqLower.includes('grus') ||
    eqLower.includes('strø') ||
    eqLower.includes('stro')
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

  // Default – snø
  return 'S';
}

// --- AGGREGAT: SAMLET TID, PER SJÅFØR, PER ADRESSE ---
function buildAggregates(sessions) {
  const now = new Date();
  const todayStart   = startOfDay(now).getTime();
  const weekStart    = startOfWeek(now).getTime();
  const monthStart   = startOfMonth(now).getTime();
  const prevMonthSt  = startOfPrevMonth(now).getTime();
  const thisMonthSt  = monthStart;

  let totalMs = 0;
  let todayMs = 0;
  let weekMs  = 0;
  let monthMs = 0;
  let prevMonthMs = 0;

  const driverMap  = new Map(); // name -> ms
  const addrMap    = new Map(); // name+task -> {address, taskCode, ms, count}

  for (const s of sessions) {
    const mid = (s.from + s.to) / 2;
    const ms  = s.durMs;
    totalMs += ms;

    if (mid >= todayStart) todayMs += ms;
    if (mid >= weekStart)  weekMs  += ms;
    if (mid >= monthStart) monthMs += ms;
    if (mid >= prevMonthSt && mid < thisMonthSt) prevMonthMs += ms;

    // per sjåfør
    const dKey = s.driver || 'Ukjent';
    driverMap.set(dKey, (driverMap.get(dKey) || 0) + ms);

    // per adresse + oppgave
    const aKey = `${s.address}@@${s.taskCode || 'S'}`;
    if (!addrMap.has(aKey)) {
      addrMap.set(aKey, {
        address: s.address,
        taskCode: s.taskCode || 'S',
        ms: 0,
        count: 0
      });
    }
    const rec = addrMap.get(aKey);
    rec.ms += ms;
    rec.count += 1;
  }

  return {
    totalMs,
    todayMs,
    weekMs,
    monthMs,
    prevMonthMs,
    perDriver: Array.from(driverMap.entries())
      .map(([driver, ms]) => ({ driver, ms }))
      .sort((a, b) => b.ms - a.ms),
    perAddress: Array.from(addrMap.values())
      .sort((a, b) => b.ms - a.ms)
  };
}

// --- RENDER: SAMLET TID ---
function renderSummary(agg) {
  const { totalMs, todayMs, weekMs, monthMs, prevMonthMs } = agg;

  const elTotal   = byId('sum_total');
  const elPrev    = byId('sum_prev_month');
  const elMonth   = byId('sum_this_month');
  const elWeek    = byId('sum_this_week');
  const elToday   = byId('sum_today');

  if (elTotal) elTotal.textContent   = msToNorDur(totalMs);
  if (elPrev)  elPrev.textContent    = msToNorDur(prevMonthMs);
  if (elMonth) elMonth.textContent   = msToNorDur(monthMs);
  if (elWeek)  elWeek.textContent    = msToNorDur(weekMs);
  if (elToday) elToday.textContent   = msToNorDur(todayMs);
}

// --- RENDER: FILTRE (SJÅFØR / ADRESSE) ---
function populateFilters(sessions, katalogMap) {
  const selDriver = byId('filter_driver');
  const selAddr   = byId('filter_address');
  if (!selDriver || !selAddr) return;

  // Sjåfører fra sessions
  const drivers = new Set();
  sessions.forEach(s => { if (s.driver) drivers.add(s.driver); });

  selDriver.innerHTML = '';
  const optAllD = document.createElement('option');
  optAllD.value = '';
  optAllD.textContent = 'Alle sjåfører';
  selDriver.appendChild(optAllD);
  Array.from(drivers).sort().forEach(d => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = d;
    selDriver.appendChild(o);
  });

  // Adresser fra katalog først (så vi får "alle adresser vi har jobber på")
  const allAddr = new Set();
  katalogMap.forEach((v, name) => allAddr.add(name));
  sessions.forEach(s => allAddr.add(s.address));

  selAddr.innerHTML = '';
  const optAllA = document.createElement('option');
  optAllA.value = '';
  optAllA.textContent = 'Alle adresser';
  selAddr.appendChild(optAllA);
  Array.from(allAddr).sort().forEach(a => {
    const o = document.createElement('option');
    o.value = a;
    o.textContent = a;
    selAddr.appendChild(o);
  });
}

// --- RENDER: DETALJERT LOGG (ÉN LINJE PER JOBB) ---
function renderSessionsTable(sessions) {
  const tbody = byId('tbl_sessions');
  if (!tbody) return;

  tbody.innerHTML = '';

  for (const s of sessions) {
    const tr = document.createElement('tr');

    const dFrom = new Date(s.from);
    const dTo   = new Date(s.to);

    const tdDate = document.createElement('td');
    tdDate.textContent = fmtNorDate(dFrom);

    const tdFrom = document.createElement('td');
    tdFrom.textContent = fmtNorTime(dFrom);

    const tdTo = document.createElement('td');
    tdTo.textContent = fmtNorTime(dTo);

    const tdAddr = document.createElement('td');
    tdAddr.textContent = s.address || '—';

    const tdTask = document.createElement('td');
    tdTask.textContent = s.taskCode || 'S'; // S eller G

    const tdDrv = document.createElement('td');
    tdDrv.textContent = s.driver || 'Ukjent';

    const tdDur = document.createElement('td');
    tdDur.textContent = msToNorDur(s.durMs);

    const tdNotes = document.createElement('td');
    tdNotes.textContent = s.notes || '';

    tr.appendChild(tdDate);
    tr.appendChild(tdFrom);
    tr.appendChild(tdTo);
    tr.appendChild(tdAddr);
    tr.appendChild(tdTask);
    tr.appendChild(tdDrv);
    tr.appendChild(tdDur);
    tr.appendChild(tdNotes);

    tbody.appendChild(tr);
  }
}

// --- RENDER: TID PER ADRESSE ---
function renderPerAddress(agg) {
  const tbody = byId('tbl_addr');
  if (!tbody) return;
  tbody.innerHTML = '';

  agg.perAddress.forEach(row => {
    const tr = document.createElement('tr');
    const tdAddr = document.createElement('td');
    const tdTask = document.createElement('td');
    const tdMs   = document.createElement('td');
    const tdCnt  = document.createElement('td');

    tdAddr.textContent = row.address || '—';
    tdTask.textContent = row.taskCode || 'S';
    tdMs.textContent   = msToNorDur(row.ms);
    tdCnt.textContent  = String(row.count);

    tr.appendChild(tdAddr);
    tr.appendChild(tdTask);
    tr.appendChild(tdMs);
    tr.appendChild(tdCnt);

    tbody.appendChild(tr);
  });
}

// --- FILTRERING ---
function applyFilters(allSessions) {
  const selDriver = byId('filter_driver');
  const selAddr   = byId('filter_address');

  const driverVal = selDriver ? selDriver.value : '';
  const addrVal   = selAddr ? selAddr.value : '';

  return allSessions.filter(s => {
    if (driverVal && s.driver !== driverVal) return false;
    if (addrVal && s.address !== addrVal) return false;
    return true;
  });
}

// --- HOVEDFLYT ---
document.addEventListener('DOMContentLoaded', async () => {
  const sumCard = byId('sum_total');
  if (sumCard) sumCard.textContent = 'Laster…';

  try {
    // Hent data parallelt
    const [hendelserRec, katalogRec] = await Promise.all([
      fetchJsonBinLatest(HENDELSER_BIN_ID),
      fetchJsonBinLatest(KATALOG_BIN_ID)
    ]);

    // Katalog: bygg map navn -> info
    const katalogMap = new Map();
    if (katalogRec && Array.isArray(katalogRec.addresses)) {
      katalogRec.addresses.forEach(a => {
        if (a && a.name) katalogMap.set(a.name, a);
      });
    } else if (katalogRec && Array.isArray(katalogRec.stops)) {
      katalogRec.stops.forEach(s => {
        if (s && s.n) katalogMap.set(s.n, s);
      });
    }

    // Reports/hendelser: finn arrayen
    let rawArr = [];
    if (Array.isArray(hendelserRec)) rawArr = hendelserRec;
    else if (Array.isArray(hendelserRec.reports)) rawArr = hendelserRec.reports;
    else if (Array.isArray(hendelserRec.hendelser)) rawArr = hendelserRec.hendelser;

    const normRows = rawArr
      .map(normalizeRow)
      .filter(Boolean);

    const allSessions = buildSessions(normRows, katalogMap);
    const agg = buildAggregates(allSessions);

    // Render
    renderSummary(agg);
    populateFilters(allSessions, katalogMap);
    renderSessionsTable(allSessions);       // nyeste øverst
    renderPerDriver(agg);
    renderPerAddress(agg);

    // Koble filtre
    const selDriver = byId('filter_driver');
    const selAddr   = byId('filter_address');
    const onChange  = () => {
      const filtered = applyFilters(allSessions);
      const aggFilt  = buildAggregates(filtered);
      renderSummary(aggFilt);
      renderSessionsTable(filtered);
      renderPerDriver(aggFilt);
      renderPerAddress(aggFilt);
    };
    selDriver && selDriver.addEventListener('change', onChange);
    selAddr   && selAddr.addEventListener('change', onChange);
  } catch (err) {
    console.error('Feil i logg.js:', err);
    if (sumCard) sumCard.textContent = 'Feil ved henting av data';
  }
});