// logg.js — leser JSONBin-bins, parer start/ferdig/skip, viser A4-vennlig logg
const DEFAULT_BINS = [
  "68e89e3443b1c97be9611c48", // hendelser
  "68e7b4d2ae596e708f0bde7d"  // adresser (oppgave)
];
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
function getMasterKey(){ return localStorage.getItem('X-Master-Key') || ''; }

async function jsonbinGetLatest(binId){
  const res = await fetch(`${JSONBIN_API}/${binId}/latest`, { headers:{'X-Master-Key': getMasterKey()} });
  if(!res.ok) throw new Error('JSONBin feilet');
  const js = await res.json();
  return js.record;
}

function toMap(arr, keyFn){
  const m = new Map();
  arr.forEach(x => m.set(keyFn(x), x));
  return m;
}

function normalizeAddrId(a){
  return a.id || a.ID || a.adresse || a.navn || String(a);
}

function ensureEls(){
  if (!byId('dateFrom')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div style="display:flex;gap:10px;align-items:end;margin:12px 0">
        <div><label>Fra</label><input id="dateFrom" type="date"></div>
        <div><label>Til</label><input id="dateTo" type="date"></div>
        <button id="btnReload">Oppdater</button>
      </div>
      <div id="logWrap"></div>
    `;
    document.body.prepend(wrap);
  }
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
  `;
  document.head.appendChild(st);
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

function renderTable(day, events, addrMap){
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
    const a = addrMap.get(e.addressId) || {};
    const title = a.navn || a.adresse || e.addressId || '—';
    const t = fmtTime(new Date(e.at));

    let tag = '';
    let label = '';
    let extra = '';
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

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

async function loadAndRender(){
  ensureEls();
  styleOnce();

  const from = byId('dateFrom').value ? new Date(byId('dateFrom').value) : startOfDay(new Date(Date.now()-DEFAULT_DAYS*24*3600*1000));
  const to   = byId('dateTo').value   ? new Date(byId('dateTo').value)   : endOfDay(new Date());

  // Laster
  const [hendelserRaw, adresserRaw] = await Promise.all([
    jsonbinGetLatest(DEFAULT_BINS[0]),
    jsonbinGetLatest(DEFAULT_BINS[1])
  ]);

  const hendelser = Array.isArray(hendelserRaw) ? hendelserRaw : (hendelserRaw.items || []);
  const adresser  = Array.isArray(adresserRaw)  ? adresserRaw  : (adresserRaw.items  || []);
  const addrMap = new Map(adresser.map(a => [normalizeAddrId(a), a]));

  // Filtrer på datointervall
  const filtered = hendelser.filter(e => {
    if (!e || !e.at) return false;
    const t = new Date(e.at).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });

  // Grupper på dato og render
  const by = groupByDate(filtered);
  const logWrap = byId('logWrap');
  logWrap.innerHTML = '';

  // Dato-velgere default
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
    const section = renderTable(day, by.get(day), addrMap);
    logWrap.appendChild(section);
  }
}

document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'btnReload'){
    loadAndRender().catch(err=>{
      alert('Kunne ikke laste logg. Sjekk nett og X-Master-Key.');
      console.error(err);
    });
  }
});

window.addEventListener('DOMContentLoaded', ()=>{
  // Sett standard datoperiode
  const dTo = new Date();
  const dFrom = new Date(Date.now()-DEFAULT_DAYS*24*3600*1000);
  ensureEls();
  byId('dateFrom').value = fmtDateInput(dFrom);
  byId('dateTo').value = fmtDateInput(dTo);
  loadAndRender().catch(err=>{
    console.error(err);
    byId('logWrap').innerHTML = `<div class="muted">Feil ved lasting av logg.</div>`;
  });
});