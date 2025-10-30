// logg.js — viser siste N dager, norsk format og A4-visning

const DEFAULT_BINS = ["68e7b4d2ae596e708f0bde7d"];
const DEFAULT_DAYS = 5; // vis de 5 siste dagene

function byId(id){ return document.getElementById(id); }
function pad(n){ return n<10?('0'+n):n; }
function fmtDateInput(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtNorDate(d){ return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`; }
function fmtTime(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

function getBinIds(){
  try{
    const raw = localStorage.getItem('JSONBIN_BIN_IDS');
    if(raw){ const a=JSON.parse(raw); if(Array.isArray(a)&&a.length) return a; }
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
  const filtered = events.filter(e => sameDay(new Date(e.ts||e.t), d0) && (!driverFilter || e.driver===driverFilter));
  const groups = new Map();
  const keyOf = e => [ (e.address||e.addr||'').trim(), (e.task||e.oppgave||'').trim(), e.driver||'' ].join('|');
  filtered.forEach(e=>{
    const k=keyOf(e); if(!groups.has(k)) groups.set(k, []); groups.get(k).push(e);
  });
  const rows=[];
  for (const arr of groups.values()){
    arr.sort((a,b)=> new Date(a.ts||a.t)-new Date(b.ts||b.t));
    let open=null;
    for (const e of arr){
      const act=(e.action||e.a||'').toLowerCase();
      if (act==='start' && !open) open=e;
      else if (act==='ferdig' && open){
        rows.push({
          address:(e.address||open.address||'').trim(),
          task:(e.task||open.task||e.oppgave||open.oppgave||'').trim(),
          startTs:new Date(open.ts||open.t),
          endTs:new Date(e.ts||e.t),
          driver:e.driver||open.driver||''
        });
        open=null;
      }
    }
    if(open){
      rows.push({
        address:(open.address||'').trim(),
        task:(open.task||open.oppgave||'').trim(),
        startTs:new Date(open.ts||open.t),
        endTs:null,
        driver:open.driver||''
      });
    }
  }
  rows.sort((a,b)=>a.startTs-b.startTs);
  return rows;
}

// ---------- RENDER ----------
function renderDay(container, d0, rows, driverSel){
  const section=document.createElement('section');
  const starts=rows.map(r=>r.startTs).filter(Boolean).sort((a,b)=>a-b);
  const ends=rows.map(r=>r.endTs).filter(Boolean).sort((a,b)=>a-b);
  const oppstart=starts.length?fmtTime(starts[0]):'—';
  const avslutt=ends.length?fmtTime(ends[ends.length-1]):'—';

  section.innerHTML=`
    <h3 style="margin:10px 0 4px">${fmtNorDate(d0)} — ${driverSel||'Alle'}</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:6px;">
      <div><b>Måned og år:</b> ${pad(d0.getMonth()+1)}.${d0.getFullYear()}</div>
      <div><b>Oppstart klokken:</b> ${oppstart}</div>
      <div><b>Avsluttet klokken:</b> ${avslutt}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr>
        <th>Adresse</th><th>Oppgave</th><th>Tid startet</th><th>Tid ferdig</th><th>Benyttet tid</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  `;
  const tb=section.querySelector('tbody');
  if(!rows.length){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td colspan="5" style="text-align:center;color:#777;padding:10px">Ingen registrerte intervaller.</td>`;
    tb.appendChild(tr);
  }else{
    for(const r of rows){
      const start=r.startTs?fmtTime(r.startTs):'—';
      const end=r.endTs?fmtTime(r.endTs):'—';
      let dur='—';
      if(r.startTs && r.endTs){
        const ms=r.endTs-r.startTs;
        const mins=Math.floor(ms/60000);
        const hh=Math.floor(mins/60), mm=mins%60;
        dur=hh?`${hh}t ${mm}m`:`${mm}m`;
      }
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${r.address}</td><td>${r.task||'Snø'}</td><td>${start}</td><td>${end}</td><td>${dur}</td>`;
      tb.appendChild(tr);
    }
  }
  container.appendChild(section);
}

// ---------- MAIN ----------
async function loadAndRender(){
  const ok=await ensureKeyPrompt(); if(!ok)return;
  const bins=getBinIds();
  const lists=await Promise.all(bins.map(id=>fetchLatestForBin(id)));
  const all=mergeEvents(lists);

  const endDate=new Date(byId('inpDato').value||fmtDateInput(new Date()));
  const days=DEFAULT_DAYS;
  const driverSel=byId('selDriver')?.value||'';

  // bygg sjåfør-lista
  const drivers=Array.from(new Set(all.map(e=>e.driver).filter(Boolean))).sort();
  const sel=byId('selDriver'); const keep=sel?.value||driverSel;
  if(sel){
    sel.innerHTML='<option value="">Alle</option>'+drivers.map(d=>`<option value="${d}">${d}</option>`).join('');
    sel.value=keep||'';
  }

  const container=byId('logg_container'); container.innerHTML='';
  for(let i=0;i<days;i++){
    const day=addDays(endDate,-i);
    const rows=pairRuns(all,day,sel?.value||'');
    renderDay(container,day,rows,sel?.value||'');
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const d=new Date();
  byId('inpDato').value=fmtDateInput(d);
  byId('btnLoadLogg')?.addEventListener('click',loadAndRender);
  byId('selDriver')?.addEventListener('change',loadAndRender);
  setTimeout(loadAndRender,150);
});