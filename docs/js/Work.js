/* Demo-datastruktur for å SE UI nå */
  driver: localStorage.getItem('BROYT_DEMO_DRIVER') || 'Fører',
  idx: 0,
  addresses: [
    { name:'Hjeramoen 12–24', coords:'60.2664414,11.2208819' },
    { name:'Grendehuset',     coords:'60.2527264,11.1687230' },
    { name:'Vognvegen 17',    coords:'60.2523185,11.1899926' }
  ],
  bag: {} // name -> {state,driver}
};

/* ---------- UI oppfrisking ---------- */
function updateProgressBars(){
  const total = Demo.addresses.length || 1;
  let me = 0, other = 0;

  for (const a of Demo.addresses){
    const st = Demo.bag[a.name];
    if (st?.state === 'done'){
      if (st.driver === Demo.driver) me++; else other++;
    }
  }
  const mePct = Math.round(100 * me / total);
  const otPct = Math.round(100 * other / total);

  const bm = $('#b_prog_me'), bo = $('#b_prog_other');
  if (bm) bm.style.width = mePct + '%';
  if (bo) bo.style.width = otPct + '%';

  const mc = $('#b_prog_me_count'), oc = $('#b_prog_other_count');
  if (mc) mc.textContent = `${me}/${total}`;
  if (oc) oc.textContent = `${other}/${total}`;

  const sum = $('#b_prog_summary');
  if (sum) sum.textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`;
}

function showCurrent(){
  const now = Demo.addresses[Demo.idx] || null;
  const next = Demo.addresses[Demo.idx+1] || null;
  $('#addr_now') && ($('#addr_now').textContent = now?.name || '—');
  $('#addr_next') && ($('#addr_next').textContent = next?.name || '—');
}

/* ---------- Navigasjon / hjelpere ---------- */
function mapsUrlFromLatLon(latlon){
  if(!latlon) return 'https://www.google.com/maps';
  const q=String(latlon).replace(/\s+/g,'');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
function log(msg){
  const el = $('#work_log'); if(!el) return;
  const t = new Date().toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
  el.textContent = `[${t}] ${msg}`;
}

/* ---------- Knapper ---------- */
$('#act_start')?.addEventListener('click', ()=>{
  const now = Demo.addresses[Demo.idx]; if(!now) return;
  Demo.bag[now.name] = {state:'in_progress', driver: Demo.driver, startedAt: Date.now()};
  log(`Startet «${now.name}»`);
  updateProgressBars(); showCurrent();
});

$('#act_done')?.addEventListener('click', ()=>{
  const now = Demo.addresses[Demo.idx]; if(!now) return;
  Demo.bag[now.name] = {state:'done', driver: Demo.driver, finishedAt: Date.now()};
  log(`Ferdig «${now.name}»`);
  updateProgressBars();
});

$('#act_skip')?.addEventListener('click', ()=>{
  const now = Demo.addresses[Demo.idx]; if(!now) return;
  Demo.bag[now.name] = {state:'skipped', driver: Demo.driver, finishedAt: Date.now()};
  log(`Hoppet over «${now.name}»`);
  updateProgressBars();
});

$('#act_block')?.addEventListener('click', ()=>{
  const now = Demo.addresses[Demo.idx]; if(!now) return;
  const note = prompt('Hvorfor ikke mulig? (valgfritt)','') || '';
  Demo.bag[now.name] = {state:'blocked', driver: Demo.driver, finishedAt: Date.now(), note};
  log(`Ikke mulig «${now.name}»${note?` – ${note}`:''}`);
  updateProgressBars();
});

$('#act_next')?.addEventListener('click', ()=>{
  if (Demo.idx < Demo.addresses.length-1){
    Demo.idx++;
    showCurrent();
    log('Gikk til neste');
  } else {
    log('Ingen flere adresser');
  }
});

$('#act_nav')?.addEventListener('click', ()=>{
  const next = Demo.addresses[Demo.idx+1] || Demo.addresses[Demo.idx];
  if (!next){ log('Ingen destinasjon'); return; }
  const url = next.coords ? mapsUrlFromLatLon(next.coords)
           : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(next.name+', Norge');
  window.open(url,'_blank');
  log('Åpnet navigasjon');
});

/* ---------- Init når seksjonen vises ---------- */
(function initWork(){
  // Hvis Work-seksjonen allerede er synlig når skriptet lastes
  showCurrent();
  updateProgressBars();

  // Hvis du bytter side senere:
  window.addEventListener('hashchange', ()=>{
    const id=(location.hash||'#home').slice(1);
    if (id==='work'){ showCurrent(); updateProgressBars(); }
  });
})();
