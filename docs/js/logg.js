// logg.js — multi-BIN lesing, paring, og visning av siste N dager i norsk format.
const DEFAULT_BINS = ["68e89e3443b1c97be9611c48","68e7b4d2ae596e708f0bde7d"];

function byId(id){ return document.getElementById(id); }
function pad(n){ return n<10?('0'+n):''+n; }
function fmtDateInput(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtTime(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtNorDate(d){ return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`; }

function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function safeParseJSON(s){ try{return JSON.parse(s);}catch{return null;} }

function getBinIds(){
  const raw = localStorage.getItem('JSONBIN_BIN_IDS');
  const a = raw ? safeParseJSON(raw) : null;
  return (Array.isArray(a) && a.length) ? a : DEFAULT_BINS.slice();
}
function getKeyForBin(binId){
  const map = safeParseJSON(localStorage.getItem('JSONBIN_KEYS')||'{}') || {};
  if (typeof map[binId]==='string' && map[binId].length>10) return map[binId];
  return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
}
async function ensureKeyPrompt(){
  const k = localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY');
  if (!k){
    const v = prompt('Lim inn JSONBin X-Master-Key (lagres i localStorage)');
    if (v) { localStorage.setItem('X_MASTER_KEY', v.trim()); return true; }
    return false;
  }
  return true;
}

function extractEvents(rec){
  if (!rec) return [];
  if (Array.isArray(rec)) return rec;
  if (Array.isArray(rec.reports)) return rec.reports;
  if (Array.isArray(rec.events)) return rec.events;
  if (Array.isArray(rec.logs)) return rec.logs;
  const out=[]; const seen=new Set();
  function scan(o){
    if (!o || typeof o!=='object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)){
      if (o.length && typeof o[0]==='object' && ('ts' in o[0] || 'action' in o[0] || 'a' in o[0])){ out.push(...o); return; }
      for (const it of o) scan(it);
    } else {
      for (const v of Object.values(o)) scan(v);
    }
  }
  scan(rec);
  return out;
}

async function fetchLatestForBin(binId){
  if (!binId) return [];
  const key = getKeyForBin(binId);
  if (!key) { console.warn('Mangler key for BIN', binId); return []; }
  const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, { headers:{'X-Master-Key': key} });
  if (!r.ok) { console.warn('BIN',binId,'ga',r.status); return []; }
  const j = await r.json();
  return j && j.record ? j.record : [];
}

async function loadAll(){
  const ok = await ensureKeyPrompt(); if (!ok) return {events:[], addrRec:[]};

  const bins = getBinIds();
  const [rec0, rec1] = await Promise.all([
    fetchLatestForBin(bins[0] || ''),
    fetchLatestForBin(bins[1] || '')
  ]);

  const events = extractEvents(rec0);
  const addrRec = rec1;
  return { events, addrRec };
}

function buildTaskMap(addrRec){
  const map = new Map();
  const norm = s => (s||'').toString().trim().toLowerCase();
  function visit(o){
    if (!o || typeof o!=='object') return;
    if (Array.isArray(o)){
      for (const it of o) visit(it);
      return;
    }
    const adr = o.adresse || o.address || o.addr || o.navn || o.name || null;
    if (adr){
      let task = 'Snø';
      if (o.grus===true || o.hasGrus===true || (typeof o.type==='string' && o.type.toLowerCase().includes('grus')) || (typeof o.oppgave==='string' && o.oppgave.toLowerCase()==='grus')){
        task = 'Grus';
      }
      map.set(norm(adr), task);
    }
    for (const v of Object.values(o)) visit(v);
  }
  visit(addrRec);
  return map;
}

function pairRunsForDay(events, dayDate, driverFilter, taskMap){
  const sameDayEvt = events.filter(e => {
    const t = new Date(e.ts||e.t||0);
    return (t.getFullYear()===dayDate.getFullYear() && t.getMonth()===dayDate.getMonth() && t.getDate()===dayDate.getDate()) &&
           (!driverFilter || e.driver===driverFilter);
  });
  const groups = new Map();
  const norm = s => (s||'').toString().trim().toLowerCase();
  function taskFor(address, hint){
    if (hint && typeof hint==='string' && hint.toLowerCase()==='grus') return 'Grus';
    const t = taskMap.get(norm(address));
    return t || 'Snø';
  }
  function keyOf(e){
    const addr = e.address || e.addr || '';
    const task = (e.task || e.oppgave || '').toString();
    const driver = e.driver || '';
    return [norm(addr), norm(task), driver].join('|');
  }
  for (const e of sameDayEvt){
    const k = keyOf(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const rows = [];
  for (const list of groups.values()){
    list.sort((a,b)=> new Date(a.ts||a.t)-new Date(b.ts||b.t));
    let open=null;
    for (const e of list){
      const act = (e.action||e.a||'').toLowerCase();
      if (act==='start' && !open){ open=e; }
      else if (act==='ferdig' && open){
        const address = (e.address || open.address || '').trim();
        const task = taskFor(address, (e.task||open.task||e.oppgave||open.oppgave||''));
        rows.push({
          address,
          task,
          startTs: new Date(open.ts||open.t),
          endTs:   new Date(e.ts||e.t),
          driver:  e.driver || open.driver || ''
        });
        open = null;
      }
    }
    if (open){
      const address = (open.address || '').trim();
      const task = taskFor(address, (open.task||open.oppgave||''));
      rows.push({
        address,
        task,
        startTs: new Date(open.ts||open.t),
        endTs: null,
        driver: open.driver || ''
      });
    }
  }
  rows.sort((a,b)=> a.startTs - b.startTs);
  return rows;
}

function renderDaySection(container, dayDate, driver, rows){
  const section = document.createElement('section');

  const starts = rows.map(r=>r.startTs).filter(Boolean).sort((a,b)=>a-b);
  const ends   = rows.map(r=>r.endTs).filter(Boolean).sort((a,b)=>a-b);
  const oppstart = starts.length ? `${pad(starts[0].getHours())}:${pad(starts[0].getMinutes())}` : '—';
  const avslutt  = ends.length   ? `${pad(ends[ends.length-1].getHours())}:${pad(ends[ends.length-1].getMinutes())}` : '—';

  const hdr = document.createElement('div');
  hdr.className = 'hdr';
  hdr.innerHTML = `
    <div class="cell"><b>Navn:</b> <span>${driver || 'Alle'}</span></div>
    <div class="cell"><b>Dato:</b> <span>${`${pad(dayDate.getDate())}.${pad(dayDate.getMonth()+1)}.${dayDate.getFullYear()}`}</span></div>
    <div class="cell"><b>Måned og år:</b> <span>${pad(dayDate.getMonth()+1)}.${dayDate.getFullYear()}</span></div>
    <div class="cell"><b>Oppstart klokken:</b> <span>${oppstart}</span></div>
    <div class="cell"><b>Avsluttet klokken:</b> <span>${avslutt}</span></div>
  `;
  section.appendChild(hdr);

  const tbl = document.createElement('table');
  tbl.innerHTML = `
    <thead>
      <tr>
        <th>Adresse</th>
        <th>Oppgave</th>
        <th>Tid startet</th>
        <th>Tid ferdig</th>
        <th>Benyttet tid</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = tbl.querySelector('tbody');

  if (!rows.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="text-align:center;color:#777;padding:12px">Ingen registrerte intervaller.</td>`;
    tbody.appendChild(tr);
  } else {
    for (const r of rows){
      const start = r.startTs ? fmtTime(r.startTs) : '—';
      const end   = r.endTs ? fmtTime(r.endTs) : '—';
      let dur='—';
      if (r.startTs && r.endTs){
        const ms = r.endTs - r.startTs;
        const mins = Math.floor(ms/60000);
        const hh = Math.floor(mins/60), mm = mins%60;
        dur = hh ? `${hh}t ${mm}m` : `${mm}m`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.address || ''}</td>
        <td>${r.task || ''}</td>
        <td>${start}</td>
        <td>${end}</td>
        <td>${dur}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  section.appendChild(tbl);
  container.appendChild(section);
}

async function loadAndRender(){
  const status = byId('status'); if (status) status.textContent = 'Laster …';

  const driverSel = byId('selDriver').value || '';
  const endStr = byId('inpDato').value || fmtDateInput(new Date());
  const endDate = new Date(endStr);
  const days = parseInt(byId('selDays').value || '5', 10);

  const { events, addrRec } = await loadAll();

  const drivers = Array.from(new Set(events.map(e=>e.driver).filter(Boolean))).sort();
  const sel = byId('selDriver'); const keep = sel.value || driverSel;
  sel.innerHTML = '<option value="">Alle</option>'+drivers.map(d=>`<option value="${d}">${d}</option>`).join('');
  sel.value = keep || '';

  const taskMap = buildTaskMap(addrRec);
  const container = byId('logg_container');
  container.innerHTML = '';

  const haveDaysSet = new Set(events.map(e => {
    const d = new Date(e.ts||e.t||0); return startOfDay(d).getTime();
  }));
  const daysOut = [];
  let cursor = startOfDay(endDate);
  while (daysOut.length < days){
    if (haveDaysSet.has(cursor.getTime())) daysOut.push(new Date(cursor));
    cursor = addDays(cursor, -1);
    if (daysOut.length<days && addDays(endDate, -180) > cursor) break
  }
  while (daysOut.length < days){
    daysOut.append(addDays(startOfDay(endDate), -(daysOut.length)))
  }

  for (const day of daysOut){
    const rows = pairRunsForDay(events, day, sel.value || '', taskMap);
    renderDaySection(container, day, sel.value || '', rows);
  }

  if (status) status.textContent = '';
}

document.addEventListener('DOMContentLoaded', ()=>{
  const d = new Date();
  byId('inpDato').value = fmtDateInput(d);
  byId('selDays').value = '5';
  byId('btnLoadLogg').addEventListener('click', loadAndRender);
  byId('selDriver').addEventListener('change', loadAndRender);
  setTimeout(loadAndRender, 150);
});
