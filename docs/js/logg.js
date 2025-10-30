// logg.js — flere dager, norsk format, A4-vennlig

// Standard BINs (kan overstyres via localStorage.JSONBIN_BIN_IDS)
const DEFAULT_BINS = [
  "68e89e3443b1c97be9611c48", // HENDELSER (start/ferdig)
  "68e7b4d2ae596e708f0bde7d"  // ADRESSER (oppgave m.m.)
];

// Vis siste N dager fra valgt sluttdato
const DEFAULT_DAYS = 5;

// ---------- Små hjelpere ----------
const $ = (sel, r = document) => r.querySelector(sel);
const byId = (id) => document.getElementById(id);
const pad = (n) => (n < 10 ? "0" + n : "" + n);
const fmtDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtNorDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

// ---------- Konfig fra localStorage ----------
function getBinIds(){
  try{
    const raw = localStorage.getItem('JSONBIN_BIN_IDS');
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; }
  }catch{}
  return DEFAULT_BINS.slice();
}
function getKeyForBin(binId){
  try{
    const m = JSON.parse(localStorage.getItem('JSONBIN_KEYS')||'{}');
    if (m && typeof m[binId]==='string' && m[binId].length>10) return m[binId];
  }catch{}
  return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
}
async function ensureKeyPrompt(){
  const k = localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY');
  if (!k){
    const v = prompt('Lim inn JSONBin X-Master-Key (lagres i nettleseren)');
    if (v) { localStorage.setItem('X_MASTER_KEY', v.trim()); return true; }
    return false;
  }
  return true;
}

// ---------- Henting (med gratis CORS-proxy) ----------
async function fetchLatestForBin(binId){
  const key = getKeyForBin(binId);
  if (!key){ console.warn('Mangler key for', binId); return []; }

  // Gratis CORS-proxy: https://allorigins.win
  const proxy = "https://api.allorigins.win/raw?url=";
  const target = encodeURIComponent(`https://api.jsonbin.io/v3/b/${binId}/latest`);

  const r = await fetch(proxy + target, { headers: { 'X-Master-Key': key } });
  if (!r.ok){ console.warn('BIN', binId, 'ga', r.status); return []; }

  const j = await r.json();
  const rec = j && j.record;
  // Støtt både {record:{reports:[...]}} og {record:[...]}
  return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
}

// Leser alt vi trenger (hendelser + adresser)
async function loadAll() {
  const ids = getBinIds();
  const lists = await Promise.all(ids.map(id => fetchLatestForBin(id)));
  // antas: [hendelser, adresser] (rekkefølge kan overstyres via JSONBIN_BIN_IDS)
  // sorter hendelser kronologisk
  const events = lists.flat().filter(x => x && (x.ts || x.t));
  events.sort((a,b)=> new Date(a.ts||a.t) - new Date(b.ts||b.t));
  // prøv å finne en liste som ligner adresse-register
  const addrRec = lists.find(arr => Array.isArray(arr) && arr.length && (arr[0].address || arr[0].addr || arr[0].gruppe || arr[0].snø || arr[0].grus)) || [];
  return { events, addrRec };
}

// ---------- Oppgavekart fra adresse-register ----------
function buildTaskMap(addrRec){
  const m = new Map();
  for (const it of addrRec){
    const addr = (it.address || it.adresse || it.addr || '').trim();
    if (!addr) continue;
    // prøv å lese “Grus” vs “Snø”
    let task = '';
    if (typeof it.oppgave === 'string') task = it.oppgave;
    else if (it.grus || it.hasGrus || it.type === 'Grus') task = 'Grus';
    else if (it.snø || it.hasSnow || it.type === 'Snø') task = 'Snø';
    if (!task) task = 'Snø';
    m.set(addr, task);
  }
  return m;
}

// ---------- Paring Start → Ferdig pr. dag ----------
function pairRunsForDay(events, day, driverFilter, taskMap){
  const sameDayEv = events.filter(e => sameDay(new Date(e.ts||e.t), day)
    && (!driverFilter || (e.driver === driverFilter)));
  // grupper på adresse + sjåfør
  const groups = new Map();
  const keyOf = e => `${(e.address||e.addr||'').trim()}|${e.driver||''}`;
  sameDayEv.forEach(e=>{
    const k=keyOf(e); if(!groups.has(k)) groups.set(k, []); groups.get(k).push(e);
  });

  const rows = [];
  for (const arr of groups.values()){
    arr.sort((a,b)=> new Date(a.ts||a.t) - new Date(b.ts||b.t));
    let open = null;
    for (const e of arr){
      const act = (e.action || e.a || '').toLowerCase();
      if (act === 'start' && !open) {
        open = e;
      } else if (act === 'ferdig' && open) {
        const addr = (e.address || open.address || '').trim();
        const task = (e.task || open.task || e.oppgave || open.oppgave || taskMap.get(addr) || 'Snø');
        rows.push({
          address: addr,
          task,
          startTs: new Date(open.ts || open.t),
          endTs: new Date(e.ts || e.t),
          driver: e.driver || open.driver || ''
        });
        open = null;
      }
    }
    if (open){
      const addr = (open.address || '').trim();
      const task = (open.task || open.oppgave || taskMap.get(addr) || 'Snø');
      rows.push({
        address: addr,
        task,
        startTs: new Date(open.ts || open.t),
        endTs: null,
        driver: open.driver || ''
      });
    }
  }
  rows.sort((a,b)=> a.startTs - b.startTs);
  return rows;
}

// ---------- Render ----------
function renderDaySection(container, d0, rows, driverSel){
  const starts = rows.map(r=>r.startTs).filter(Boolean).sort((a,b)=>a-b);
  const ends = rows.map(r=>r.endTs).filter(Boolean).sort((a,b)=>a-b);
  const oppstart = starts.length ? fmtTime(starts[0]) : '—';
  const avslutt  = ends.length   ? fmtTime(ends[ends.length-1]) : '—';

  const section = document.createElement('section');
  section.innerHTML = `
    <h3 style="margin:12px 0 6px">${fmtNorDate(d0)} — ${driverSel||'Alle'}</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:8px">
      <div><b>Måned og år:</b> ${pad(d0.getMonth()+1)}.${d0.getFullYear()}</div>
      <div><b>Oppstart klokken:</b> ${oppstart}</div>
      <div><b>Avsluttet klokken:</b> ${avslutt}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead>
        <tr><th>Adresse</th><th>Oppgave</th><th>Tid startet</th><th>Tid ferdig</th><th>Benyttet tid</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const tb = section.querySelector('tbody');

  if (!rows.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="text-align:center;color:#777;padding:10px">Ingen registrerte intervaller.</td>`;
    tb.appendChild(tr);
  } else {
    for (const r of rows){
      const start = r.startTs ? fmtTime(r.startTs) : '—';
      const end   = r.endTs ? fmtTime(r.endTs) : '—';
      let dur = '—';
      if (r.startTs && r.endTs){
        const mins = Math.floor((r.endTs - r.startTs)/60000);
        const hh = Math.floor(mins/60), mm = mins%60;
        dur = hh ? `${hh}t ${mm}m` : `${mm}m`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.address||''}</td><td>${r.task||'Snø'}</td><td>${start}</td><td>${end}</td><td>${dur}</td>`;
      tb.appendChild(tr);
    }
  }
  container.appendChild(section);
}

// ---------- Main ----------
async function loadAndRender(){
  const status = byId('status'); if (status) status.textContent = 'Laster …';

  const driverSel = byId('selDriver')?.value || '';
  const endStr = byId('inpDato')?.value || fmtDateInput(new Date());
  const endDate = new Date(endStr);
  const days = parseInt(byId('selDays')?.value || `${DEFAULT_DAYS}`, 10);

  const ok = await ensureKeyPrompt(); if (!ok){ if(status) status.textContent=''; return; }

  const { events, addrRec } = await loadAll();
  const drivers = Array.from(new Set(events.map(e=>e.driver).filter(Boolean))).sort();
  const sel = byId('selDriver'); const keep = sel?.value || driverSel;
  if (sel){
    sel.innerHTML = '<option value="">Alle</option>' + drivers.map(d=>`<option value="${d}">${d}</option>`).join('');
    sel.value = keep || '';
  }

  const taskMap = buildTaskMap(addrRec);
  const container = byId('logg_container'); container.innerHTML = '';

  // — finn hvilke dager som faktisk har hendelser (for bedre “siste N dager”)
  const haveDaysSet = new Set(events.map(e => startOfDay(new Date(e.ts||e.t)).getTime()));
  const daysOut = [];
  let cursor = startOfDay(endDate);

  while (daysOut.length < days) {
    if (haveDaysSet.has(cursor.getTime())) daysOut.push(new Date(cursor));
    cursor = addDays(cursor, -1);
    if (daysOut.length < days && addDays(endDate, -180) > cursor) break;
  }
  while (daysOut.length < days) {
    daysOut.push(addDays(startOfDay(endDate), -(daysOut.length)));
  }

  for (const day of daysOut){
    const rows = pairRunsForDay(events, day, sel?.value || '', taskMap);
    renderDaySection(container, day, rows, sel?.value || '');
  }

  if (status) status.textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const d = new Date();
  byId('inpDato') && (byId('inpDato').value = fmtDateInput(d));
  byId('selDays') && (byId('selDays').value = `${DEFAULT_DAYS}`);
  byId('btnLoadLogg')?.addEventListener('click', loadAndRender);
  byId('selDriver')?.addEventListener('change', loadAndRender);
  setTimeout(loadAndRender, 150);
});