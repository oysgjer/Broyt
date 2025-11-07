// logg.js — viser hendelser + beregner totaltid
const BINS = {
  HENDELSER: "68e89e3443b1c97be9611c48",      // PRIVAT: hendelser
  ADRESSER:  "68ed425cae596e708f11d25f"       // ✅ RIKTIG: samme som addrBin i app/kart
};
const DEFAULT_DAYS = 5;

const $ = (s, r=document) => r.querySelector(s);
const byId = (id) => document.getElementById(id);
const pad = (n) => (n<10?('0'+n):''+n);
const fmtDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtNorDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d)=> { const x=new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d)=> { const x=new Date(d); x.setHours(23,59,59,999); return x; };

const JSONBIN_API = "https://api.jsonbin.io/v3/b";
function getMasterKey(){
  return (localStorage.getItem('X-Master-Key') ||
          localStorage.getItem('x-master-key') ||
          localStorage.getItem('XMasterKey')   ||
          localStorage.getItem('jsonbin_master_key') || '').trim();
}
function getAccessKey(){
  return (localStorage.getItem('X-Access-Key') ||
          localStorage.getItem('x-access-key') ||
          localStorage.getItem('jsonbin_access_key') || '').trim();
}

async function jsonbinGetLatest(binId){
  const headers = { 'X-Master-Key': getMasterKey() };
  const ak = getAccessKey(); if (ak) headers['X-Access-Key'] = ak;
  const res = await fetch(`${JSONBIN_API}/${binId}/latest`, { headers });
  if(!res.ok) throw new Error('JSONBin feilet ' + res.status);
  const js = await res.json();
  return js.record;
}

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function styleOnce(){
  if (byId('logStyle')) return;
  const st = document.createElement('style');
  st.id = 'logStyle';
  st.textContent = `
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e5e7eb;padding:8px 6px;vertical-align:top}
    th{text-align:left;background:#f8fafc}
    .tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
    .tag-start{background:#e0e7ff;color:#1d4ed8}
    .tag-done{background:#dcfce7;color:#166534}
    .tag-skip{background:#fef3c7;color:#b45309}
    .tag-block{background:#fee2e2;color:#b91c1c}
    .muted{color:#6b7280}
    .reason{font-style:italic;color:#7c2d12}
    .totals{margin:6px 0 14px; font-weight:700}
  `;
  document.head.appendChild(st);
}

function ensureControls(){
  if (byId('dateFrom')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div style="display:flex;gap:10px;align-items:end;margin:12px 0">
      <div><label>Fra</label><input id="dateFrom" type="date"></div>
      <div><label>Til</label><input id="dateTo" type="date"></div>
      <button id="btnReload">Oppdater</button>
    </div>
    <div id="totals" class="totals"></div>
    <div id="logWrap"></div>
  `;
  document.body.prepend(wrap);
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'btnReload') loadAndRender().catch(err=>{
      alert('Kunne ikke laste logg'); console.error(err);
    });
  });
}

function normalizeAddrId(a){
  // Forsøk å finne unik ID for adresseobjektet
  return a.id ?? a.ID ?? a.uuid ?? a.adresseId ?? a.adresse_id ?? a.adresse ?? a.navn ?? String(a);
}

function buildAddressIndexes(adresser){
  // Primært kart: id -> objekt
  const byIdMap = new Map();
  // Fallback: navn/label -> objekt (i tilfelle events mangler id)
  const byNameMap = new Map();
  for (const a of adresser){
    const id = normalizeAddrId(a);
    if (id) byIdMap.set(String(id), a);
    if (a?.navn) byNameMap.set(String(a.navn).trim(), a);
    if (a?.adresse) byNameMap.set(String(a.adresse).trim(), a);
  }
  return { byIdMap, byNameMap };
}

function groupByDate(events){
  const by = new Map();
  for (const e of events){
    const day = fmtNorDate(new Date(e.at));
    if(!by.has(day)) by.set(day, []);
    by.get(day).push(e);
  }
  return by;
}

function keyForPairing(e){
  // Par start->done per adresse + fører
  const addrKey = e.addressId || e.addressName || '';
  return `${addrKey}|${e.by || ''}`;
}

function computeTotals(events){
  const ev = [...events].sort((a,b)=> new Date(a.at)-new Date(b.at));
  const stacks = new Map(); // key -> [start ms]
  let totalMs = 0;

  for (const e of ev){
    const k = keyForPairing(e);
    if (!stacks.has(k)) stacks.set(k, []);
    const st = stacks.get(k);

    if (e.type === 'start'){
      st.push(new Date(e.at).getTime());
    } else if (e.type === 'done'){
      if (st.length){
        const t0 = st.pop();
        const t1 = new Date(e.at).getTime();
        if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) totalMs += (t1 - t0);
      }
    }
  }
  return Math.round(totalMs/60000); // minutter
}

function renderTable(day, events, addrIdx){
  const wrap = document.createElement('section');
  wrap.innerHTML = `<h2 style="margin-top:18px">${day}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:120px">Tid</th>
        <th>Adresse</th>
        <th>Hendelse</th>
        <th>Av</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>`;
  const tb = wrap.querySelector('tbody');

  for (const e of events.sort((a,b)=> new Date(a.at)-new Date(b.at))){
    const tr = document.createElement('tr');

    // slå opp adresse
    const fromId = e.addressId ? addrIdx.byIdMap.get(String(e.addressId)) : null;
    const fromName = (!fromId && e.addressName) ? addrIdx.byNameMap.get(String(e.addressName)) : null;
    const a = fromId || fromName || {};
    const title = a.navn || a.adresse || e.addressName || e.addressId || '—';

    const t = fmtTime(new Date(e.at));

    let tag = '', label = '', extra = '';
    if (e.type === 'start'){ tag='tag-start'; label='Startet'; }
    else if (e.type === 'done'){ tag='tag-done'; label='Ferdig'; }
    else if (e.type === 'blocked'){ tag='tag-block'; label='Sperret'; }
    else if (e.type === 'skip'){ tag='tag-skip'; label='Ikke mulig'; if (e.reason) extra = `<div class="reason">Årsak: ${escapeHtml(e.reason)}</div>`; }

    tr.innerHTML = `
      <td>${t}</td>
      <td>
        <div>${escapeHtml(title)}</div>
        ${a.kunde ? `<div class="muted">${escapeHtml(a.kunde)}</div>` : ''}
        ${a.adresse && a.navn ? `<div class="muted">${escapeHtml(a.adresse)}</div>` : ''}
      </td>
      <td>
        <span class="tag ${tag}">${label}</span>
        ${extra}
      </td>
      <td>${escapeHtml(e.by || '—')}</td>
    `;
    tb.appendChild(tr);
  }

  return wrap;
}

async function loadAndRender(){
  styleOnce();
  ensureControls();

  const from = byId('dateFrom').value ? new Date(byId('dateFrom').value) : startOfDay(new Date(Date.now()-DEFAULT_DAYS*24*3600*1000));
  const to   = byId('dateTo').value   ? new Date(byId('dateTo').value)   : endOfDay(new Date());

  const [hendelserRaw, adresserRaw] = await Promise.all([
    jsonbinGetLatest(BINS.HENDELSER),
    jsonbinGetLatest(BINS.ADRESSER)
  ]);

  const hendelser = Array.isArray(hendelserRaw) ? hendelserRaw : (hendelserRaw?.items || []);
  const adresser  = Array.isArray(adresserRaw)  ? adresserRaw  : (adresserRaw?.items  || []);
  const addrIdx = buildAddressIndexes(adresser);

  const filtered = hendelser.filter(e => e && e.at && new Date(e.at).getTime() >= from.getTime() && new Date(e.at).getTime() <= to.getTime());

  // totals (minutter) på tvers av hele intervallet
  const totalMin = computeTotals(filtered);
  byId('totals').textContent = `Totaltid: ${totalMin} min`;

  const by = groupByDate(filtered);
  const logWrap = byId('logWrap');
  logWrap.innerHTML = '';

  byId('dateFrom').value = fmtDateInput(from);
  byId('dateTo').value   = fmtDateInput(to);

  const days = Array.from(by.keys()).sort((a,b)=>{
    const [da,ma,ya]=a.split('.').map(Number);
    const [db,mb,yb]=b.split('.').map(Number);
    return new Date(ya,ma-1,da) - new Date(yb,mb-1,db);
  });

  if (days.length === 0){
    logWrap.innerHTML = `<div class="muted">Ingen hendelser i valgt periode.</div>`;
    return;
  }

  for (const day of days){
    const section = renderTable(day, by.get(day), addrIdx);
    logWrap.appendChild(section);
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  const dTo = new Date();
  const dFrom = new Date(Date.now()-DEFAULT_DAYS*24*3600*1000);
  styleOnce();
  ensureControls();
  byId('dateFrom').value = fmtDateInput(dFrom);
  byId('dateTo').value   = fmtDateInput(dTo);
  loadAndRender().catch(err=>{
    console.error(err);
    byId('logWrap').innerHTML = `<div class="muted">Feil ved lasting av logg.</div>`;
  });
});