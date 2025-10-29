// --- State & helpers ---
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const CFG = {
  get bin(){ return localStorage.getItem('jsonbin_bin') || ''; },
  set bin(v){ localStorage.setItem('jsonbin_bin', v || ''); },
  get key(){ return localStorage.getItem('jsonbin_key') || ''; },
  set key(v){ localStorage.setItem('jsonbin_key', v || ''); }
};

function show(id){
  ['viewWork','viewReports','viewSettings'].forEach(v => $('#'+v).classList.add('hidden'));
  $('#'+id).classList.remove('hidden');
  $$('#header nav button');
}

function setActive(btnId){
  ['tabWork','tabReports','tabSettings'].forEach(id => $('#'+id).classList.remove('active'));
  $('#'+btnId).classList.add('active');
}

// --- Tabs ---
$('#tabWork').addEventListener('click', ()=>{ show('viewWork'); setActive('tabWork'); });
$('#tabReports').addEventListener('click', ()=>{ show('viewReports'); setActive('tabReports'); });
$('#tabSettings').addEventListener('click', ()=>{ show('viewSettings'); setActive('tabSettings'); });

// --- Settings init ---
$('#binId').value = CFG.bin;
$('#masterKey').value = CFG.key;
$('#btnSaveCfg').addEventListener('click', ()=>{
  CFG.bin = $('#binId').value.trim();
  CFG.key = $('#masterKey').value.trim();
  $('#cfgStatus').textContent = 'Lagret.';
});
$('#btnTestCfg').addEventListener('click', async ()=>{
  const ok = await testJsonbin();
  $('#cfgStatus').textContent = ok ? 'Tilkobling OK.' : 'Feil mot JSONbin.';
});

async function testJsonbin(){
  try{
    if(!CFG.bin || !CFG.key) return false;
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CFG.bin}/latest`, {
      headers: { 'X-Master-Key': CFG.key }
    });
    return res.ok;
  }catch(e){ return false; }
}

// --- Weather (Open-Meteo) ---
const WX = {
  codeMap: {
    0: ['Klar himmel','sunny'],
    1: ['Hovedsakelig klar','sunny'],
    2: ['Delvis skyet','partly'],
    3: ['Overskyet','cloud'],
    45: ['Tåke','fog'],
    48: ['Ise-tåke','fog'],
    51: ['Lett yr','drizzle'],
    53: ['Yr','drizzle'],
    55: ['Kraftig yr','drizzle'],
    61: ['Lett regn','rain'],
    63: ['Regn','rain'],
    65: ['Kraftig regn','rain'],
    66: ['Underkjølt regn','rain'],
    67: ['Kraftig underkjølt regn','rain'],
    71: ['Lett snø','snow'],
    73: ['Snø','snow'],
    75: ['Kraftig snø','snow'],
    77: ['Snøfnugg','snow'],
    80: ['Regnbyger','rain'],
    81: ['Kraftige regnbyger','rain'],
    82: ['Meget kraftige regnbyger','rain'],
    85: ['Snøbyger','snow'],
    86: ['Kraftige snøbyger','snow'],
    95: ['Torden','storm'],
    96: ['Torden med hagl','storm'],
    99: ['Torden med kraftig hagl','storm']
  }
};

function iconFor(code){
  const typ = (WX.codeMap[code] && WX.codeMap[code][1]) || 'cloud';
  return `data:image/svg+xml;utf8,${encodeURIComponent(getIconSvg(typ))}`;
}
function getIconSvg(type){
  const common = `width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;
  if(type==='sunny') return `<svg ${common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  if(type==='partly') return `<svg ${common}><path d="M4 15a4 4 0 0 1 4-4h.5"/><circle cx="16" cy="8" r="3"/><path d="M2 16h12"/></svg>`;
  if(type==='rain') return `<svg ${common}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M8 19v2M12 19v2M16 19v2"/></svg>`;
  if(type==='snow') return `<svg ${common}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M12 17l-1 1 1 1 1-1-1-1zM8 17l-1 1 1 1 1-1-1-1zM16 17l-1 1 1 1 1-1-1-1z"/></svg>`;
  if(type==='storm') return `<svg ${common}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M13 16l-3 5 5-4-2 5"/></svg>`;
  return `<svg ${common}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/></svg>`;
}

async function loadWeather(){
  try{
    const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:5000}));
    const lat = pos.coords.latitude.toFixed(4);
    const lon = pos.coords.longitude.toFixed(4);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const t = Math.round(j.current.temperature_2m);
    const code = j.current.weather_code;
    const [desc] = WX.codeMap[code] || ['Vær'];
    $('#wxTemp').textContent = t + '°';
    $('#wxDesc').textContent = desc;
    $('#wxMeta').textContent = `Lat: ${lat}, Lon: ${lon}`;
    $('#wxIcon').src = iconFor(code);
  }catch(e){
    $('#wxDesc').textContent = 'Kunne ikke hente vær.';
    $('#wxMeta').textContent = '';
  }
}

// --- Funfacts (on page only) ---
const FUN = [
  'Visste du? Salt virker best rundt -5 °C til +5 °C.',
  'Strøing før snøfall kan redusere behovet for fresing.',
  'Reduser fart ved brøyting for å spare skjær.',
  'Loggfør uhell umiddelbart for rask oppfølging.',
  'Sjekk vindretning – snø driver raskere i åpne felt.'
];

function renderFunfacts(){
  const wrap = $('#funfacts');
  wrap.innerHTML = '';
  FUN.forEach(t => {
    const c = document.createElement('div');
    c.className = 'card';
    c.textContent = '• ' + t;
    wrap.appendChild(c);
  });
}

// --- JSONbin I/O ---
async function jsonbinFetch(method, body){
  if(!CFG.bin || !CFG.key) throw new Error('Mangler JSONbin konfig.');
  const url = method === 'GET'
    ? `https://api.jsonbin.io/v3/b/${CFG.bin}/latest`
    : `https://api.jsonbin.io/v3/b/${CFG.bin}`;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': CFG.key
    }
  };
  if(body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error('JSONbin feil ' + res.status);
  return res.json();
}

async function loadReports(){
  try{
    const data = await jsonbinFetch('GET');
    const list = (data && data.record && data.record.reports) || [];
    renderReports(list);
    $('#offlineBadge').classList.add('hidden');
  }catch(e){
    // Fallback to local
    const list = JSON.parse(localStorage.getItem('offline_reports')||'[]');
    renderReports(list);
    $('#offlineBadge').classList.remove('hidden');
  }
}

function renderReports(list){
  const el = $('#reportList');
  el.innerHTML = '';
  if(!list.length){
    const p = document.createElement('p');
    p.className='muted';
    p.textContent='Ingen rapporter enda.';
    el.appendChild(p);
    return;
  }
  list.slice().reverse().forEach(r => {
    const d = document.createElement('div');
    d.className='card';
    d.innerHTML = `<div><strong>${r.date}</strong> – ${r.task} – runde ${r.round} – ${r.driver}</div>
    <div class="muted">${r.notes||''}</div>`;
    el.appendChild(d);
  });
}

async function saveReport(){
  const rec = {
    date: $('#r_date').value || new Date().toISOString(),
    driver: $('#r_driver').value.trim() || 'Ukjent',
    round: parseInt($('#r_round').value||'1',10),
    task: $('#r_task').value,
    notes: $('#r_notes').value.trim()
  };
  try{
    // read latest, append, write back
    let data;
    try{
      data = await jsonbinFetch('GET');
    }catch{ data = { record: { reports: [] } }; }
    const list = (data && data.record && data.record.reports) || [];
    list.push(rec);
    await jsonbinFetch('PUT', { reports: list });
    alert('Lagret i JSONbin.');
    loadReports();
  }catch(e){
    // offline fallback
    const list = JSON.parse(localStorage.getItem('offline_reports')||'[]');
    list.push(rec);
    localStorage.setItem('offline_reports', JSON.stringify(list));
    alert('Lagret lokalt (offline).');
    loadReports();
  }
}

// --- PDF Export (exclude funfacts) ---
function exportPdf(){
  try{
    const doc = new jspdf.jsPDF();
    const title = 'Brøyterapport';
    doc.text(title, 10, 20);
    const lines = [
      'Dato/tid: ' + ($('#r_date').value || new Date().toISOString()),
      'Sjåfør: ' + ($('#r_driver').value.trim() || 'Ukjent'),
      'Runde: ' + ($('#r_round').value || '1'),
      'Oppgave: ' + ($('#r_task').value),
      'Notat: ' + ($('#r_notes').value.trim() || '-')
    ];
    let y = 40;
    lines.forEach(l => { doc.text(l, 10, y); y+=10; });
    doc.text('Brøyting Romerike Trefelling', 10, y+10);
    doc.save('broyt_rapport.pdf');
  }catch(e){
    window.print(); // extreme fallback
  }
}

// --- Wire up ---
$('#btnSaveReport').addEventListener('click', saveReport);
$('#btnPdfReport').addEventListener('click', exportPdf);

// Dummy handlers
$('#btnBroytKart').addEventListener('click', ()=> alert('Åpner brøytekart (legg inn lenke senere)…'));
$('#btnUhell').addEventListener('click', ()=> alert('Registrer uhell/avvik (implementeres)…'));

// Init
(function init(){
  // default date now
  const now = new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
  $('#r_date').value = now.toISOString().slice(0,16);
  renderFunfacts();
  loadReports();
  loadWeather();
})();