// logg.js — multi-BIN, pairing og A4-visning

// ——— Konfig via localStorage ———
//  JSONBIN_BIN_IDS: '["bin1","bin2"]'   (hvilke bins loggen skal lese)
//  JSONBIN_KEYS:    '{"bin1":"key1","bin2":"key2"}'  (valgfritt per-BIN keys)
//  X_MASTER_KEY:    "..."  (felles key hvis JSONBIN_KEYS ikke satt)

// Fallback hvis ingenting er satt:
const DEFAULT_BINS = ["68e7b4d2ae596e708f0bde7d"];

// ---------- HJELPERE ----------
function byId(id){ return document.getElementById(id); }
function pad(n){ return n<10?('0'+n):n; }
function fmtTime(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDateInput(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function sameDayISO(iso, d0){
  if(!iso) return false;
  const d=new Date(iso);
  return d.getFullYear()===d0.getFullYear() && d.getMonth()===d0.getMonth() && d.getDate()===d0.getDate();
}
function getBinIds(){
  try{
    const raw = localStorage.getItem('JSONBIN_BIN_IDS'); if (raw){ const a=JSON.parse(raw); if (Array.isArray(a)&&a.length) return a; }
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
    const v = prompt('Lim inn JSONBin X-Master-Key (lagres i localStorage)');
    if (v) { localStorage.setItem('X_MASTER_KEY', v.trim()); return true; }
    return false;
  }
  return true;
}
async function fetchLatestForBin(binId){
  const key=getKeyForBin(binId); if(!key){ console.warn('Mangler key for',binId); return []; }
  const url=`https://api.jsonbin.io/v3/b/${binId}/latest`;
  const r=await fetch(url,{headers:{'X-Master-Key':key}});
  if(!r.ok){ console.warn('BIN',binId,'ga',r.status); return []; }
  const j=await r.json(); const rec=j && j.record;
  return Array.isArray(rec)?rec:(rec && Array.isArray(rec.reports)?rec.reports:[]);
}
function mergeEvents(lists){
  const flat=lists.flat().filter(Boolean);
  flat.sort((a,b)=> new Date(a.ts||a.t||0)-new Date(b.ts||b.t||0));
  return flat;
}

// ---------- PARING start/ferdig ----------
function pairRuns(events, d0, driverFilter){
  // filtrer først på dato/sjåfør
  const filtered = events.filter(e => sameDayISO(e.ts||e.t, d0) && (!driverFilter || (e.driver===driverFilter)));
  // grupper på address + task + driver
  const groups = new Map();
  const keyOf = e => [ (e.address||e.addr||'').trim(), (e.task||e.oppgave||'').trim(), e.driver||'' ].join('｜');
  filtered.forEach(e=>{
    const k=keyOf(e); if(!groups.has(k)) groups.set(k, []); groups.get(k).push(e);
  });

  // paring: hver gang vi ser start → hold åpen; første 'ferdig' etterpå → par
  const rows = [];
  for (const [k, arr] of groups){
    arr.sort((a,b)=> new Date(a.ts||a.t)-new Date(b.ts||b.t));
    let open=null;
    for (const e of arr){
      const action=(e.action||e.a||'').toLowerCase();
      if (action==='start' && !open){
        open=e;
      } else if (action==='ferdig' && open){
        rows.push({
          address: (e.address||open.address||'').trim(),
          task: (e.task||open.task||e.oppgave||open.oppgave||'').trim(),
          startTs: new Date(open.ts||open.t),
          endTs: new Date(e.ts||e.t),
          driver: e.driver || open.driver || ''
        });
        open=null;
      }
    }
    // hvis det ble stående en start uten slutt, vis den som ufullstendig
    if (open){
      rows.push({
        address: (open.address||'').trim(),
        task: (open.task||open.oppgave||'').trim(),
        startTs: new Date(open.ts||open.t),
        endTs: null,
        driver: open.driver || ''
      });
    }
  }
  // sorter rader etter starttid
  rows.sort((a,b)=> a.startTs - b.startTs);
  return rows;
}

// ---------- RENDER ----------
function renderHeader(rows, d0, driverSel){
  byId('hdrName').textContent = driverSel ? driverSel : 'Alle';
  byId('hdrMonthYear').textContent = `${pad(d0.getMonth()+1)}.${d0.getFullYear()}`;

  if (rows.length){
    const starts = rows.map(r=>r.startTs).filter(Boolean).sort((a,b)=>a-b);
    const ends   = rows.map(r=>r.endTs).filter(Boolean).sort((a,b)=>a-b);
    byId('hdrStart').textContent = starts.length ? fmtTime(starts[0]) : '—';
    byId('hdrEnd').textContent   = ends.length   ? fmtTime(ends[ends.length-1]) : '—';
  } else {
    byId('hdrStart').textContent = '—';
    byId('hdrEnd').textContent   = '—';
  }
}

function renderRows(rows){
  const tbody = byId('logg_tbody'); tbody.innerHTML='';
  if (!rows.length){
    const tr=document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="text-align:center;color:#777;padding:12px">Ingen registrerte intervaller for valgt dato.</td>`;
    tbody.appendChild(tr); return;
  }
  for (const r of rows){
    const start = r.startTs ? fmtTime(r.startTs) : '—';
    const end   = r.endTs ? fmtTime(r.endTs) : '—';
    let dur = '—';
    if (r.startTs && r.endTs){
      const ms = r.endTs - r.startTs;
      const m  = Math.round(ms/60000);
      const hh = Math.floor(m/60), mm = m%60;
      dur = hh ? `${hh}t ${mm}m` : `${mm}m`;
    }
    const tr=document.createElement('tr');
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

// ---------- MAIN ----------
async function loadAndRender(){
  const ok = await ensureKeyPrompt(); if (!ok) return;
  const dStr = byId('inpDato').value || fmtDateInput(new Date());
  const d0   = new Date(dStr);
  const driverSel = byId('selDriver')?.value || '';

  const bins = getBinIds();
  const lists = await Promise.all(bins.map(id=>fetchLatestForBin(id)));
  const all = mergeEvents(lists);

  // bygg sjåfør-lista (filtrering)
  const drivers = Array.from(new Set(all.map(x=>x.driver).filter(Boolean))).sort();
  const sel = byId('selDriver');
  const keep = sel?.value || driverSel;
  if (sel){
    sel.innerHTML = '<option value="">Alle</option>' + drivers.map(d=>`<option value="${d}">${d}</option>`).join('');
    sel.value = keep || '';
  }

  const rows = pairRuns(all, d0, sel?.value || '');
  renderHeader(rows, d0, sel?.value || '');
  renderRows(rows);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const d = new Date(); byId('inpDato').value = fmtDateInput(d);
  byId('btnLoadLogg')?.addEventListener('click', loadAndRender);
  setTimeout(loadAndRender, 150);
});
