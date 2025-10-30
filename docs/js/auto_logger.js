// auto_logger.js — logger adresse/oppgave + multi-BIN skriving

const QKEY = 'AUTOLOG_QUEUE';

function readQueue(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }catch{ return []; } }
function writeQueue(a){ try{ localStorage.setItem(QKEY, JSON.stringify(a)); }catch{} }

// Hvilke BINs å skrive til (sett i localStorage om du vil endre)
function getWriteBins(){
  try{
    const raw=localStorage.getItem('JSONBIN_BIN_IDS_WRITE');
    const arr=raw?JSON.parse(raw):null;
    if (Array.isArray(arr) && arr.length) return arr;
  }catch{}
  return ["68e7b4d2ae596e708f0bde7d"];
}
function getKeyForBin(binId){
  try{
    const map=JSON.parse(localStorage.getItem('JSONBIN_KEYS')||'{}');
    if (map && typeof map[binId]==='string' && map[binId].length>10) return map[binId];
  }catch{}
  return localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY') || null;
}
async function fetchRecordForBin(binId,key){
  const r=await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`,{headers:{'X-Master-Key':key}});
  if(!r.ok) throw new Error(`fetch ${r.status}`); return r.json();
}
async function putRecordForBin(binId,key,body){
  const r=await fetch(`https://api.jsonbin.io/v3/b/${binId}`,{
    method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':key},body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`put ${r.status}`); return r.json();
}

// Finn oppgave fra UI (tilpass etter dine id-er/labels)
function detectTask(){
  // Prøv eksplisitte felter/lagring
  const stored = localStorage.getItem('OPPGAVE') || '';
  if (stored) return stored;

  // Se etter checkboxer/labels i Hjem
  const text = (sel)=> document.querySelector(sel)?.closest('label')?.textContent?.toLowerCase() || '';
  const isChecked = (sel)=> !!document.querySelector(sel)?.checked;

  if (isChecked('input[type="checkbox"][value="Skjær"]') || text('input[value="Skjær"]').includes('skjær')) return 'Snø';
  if (isChecked('input[type="checkbox"][value="Fres"]') || text('input[value="Fres"]').includes('fres')) return 'Fres';
  if (isChecked('input[type="checkbox"][value="Sand/Grus"]') || text('input[value="Sand/Grus"]').includes('grus')) return 'Grus';

  // Fallback
  return 'Snø';
}

// Vis «✓ Logget / ⏳ Lagres …» ved knappen uten å flytte layout
function showMark(btn, type){
  const host = btn.closest('button, .btn, .menu-item') || btn.parentElement || btn;
  const cs = getComputedStyle(host); if (cs.position==='static') host.style.position='relative';
  const exist=host.querySelector('.logMark'); if (exist) exist.remove();
  const m=document.createElement('span'); m.className='logMark '+type;
  m.textContent = type==='success' ? '✓ Logget' : '⏳ Lagres …';
  m.style.cssText='position:absolute;top:-8px;right:-8px;font-size:12px;padding:4px 6px;border-radius:999px;pointer-events:none;z-index:5';
  if (type==='success'){ m.style.background='#e6f7ec'; m.style.border='1px solid #b7e2c4'; m.style.color='#0f7a2e'; }
  else{ m.style.background='#fff3e0'; m.style.border='1px solid #f7d7a7'; m.style.color='#9a5b00'; }
  host.appendChild(m); setTimeout(()=>m.remove(),1600);
}

function buildEvent(action){
  const addr = (document.querySelector('#addr,.current-address,[data-current-address]')?.textContent || '').trim();
  const driver = localStorage.getItem('DRIVER_NAME') || localStorage.getItem('DRIVER') || 'Ukjent';
  return {
    ts: new Date().toISOString(),
    driver,
    action,                    // "start" | "ferdig" | ...
    address: addr,
    task: detectTask(),        // "Snø" | "Fres" | "Grus"
    notes: '',
    device: navigator.platform || '',
    userAgent: navigator.userAgent || ''
  };
}

function enqueue(evt, btn){
  const q=readQueue(); q.push(evt); writeQueue(q);
  if (navigator.onLine && getKeyForBin(getWriteBins()[0])) showMark(btn,'success'); else showMark(btn,'pending');
  flushQueue();
}

async function flushQueue(){
  const bins=getWriteBins(); const q=readQueue(); if (!q.length) return;
  const primary=bins[0]; const pKey=getKeyForBin(primary); if(!pKey){ console.warn('missing primary key'); return; }

  try{
    const cur=await fetchRecordForBin(primary,pKey);
    let body=cur && cur.record ? cur.record : [];
    if (Array.isArray(body)) body.push(...q); else { body.reports=Array.isArray(body.reports)?body.reports:[]; body.reports.push(...q); }
    await putRecordForBin(primary,pKey,body);

    // sekundære BINs (best effort)
    for (const b of bins.slice(1)){
      try{
        const k=getKeyForBin(b); if(!k){ console.warn('no key for',b); continue; }
        const c=await fetchRecordForBin(b,k);
        let bd=c && c.record ? c.record : [];
        if (Array.isArray(bd)) bd.push(...q); else { bd.reports=Array.isArray(bd.reports)?bd.reports:[]; bd.reports.push(...q); }
        await putRecordForBin(b,k,bd);
      }catch(e){ console.warn('secondary put failed', b, e); }
    }
    writeQueue([]);
  }catch(e){ console.warn('primary put failed — will retry later', e); }
}

// Binder til knapper (id, data-action, norsk tekst)
(function bindAuto(){
  const MAP = {
    start:      ['#btnStart','[data-action="start"]'],
    ferdig:     ['#btnFerdig','[data-action="done"]'],
    neste:      ['#btnNeste','[data-action="next"]'],
    hopp_over:  ['#btnSkip','[data-action="skip"]'],
    ikke_mulig: ['#btnNotPossible','[data-action="na"]']
  };
  const TEXT2 = {'start':'start','ferdig':'ferdig','neste':'neste','hopp over':'hopp_over','ikke mulig':'ikke_mulig'};
  const $all=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function bindOnce(el, action){
    if (!el || el.dataset.autologBound) return;
    el.dataset.autologBound='1';
    el.addEventListener('click', ()=> enqueue(buildEvent(action), el));
  }
  function scan(){
    Object.entries(MAP).forEach(([a, sels])=> sels.forEach(sel=> $all(sel).forEach(el=>bindOnce(el,a))));
    $all('button').forEach(btn=>{
      if (btn.dataset.autologBound) return;
      const t=(btn.innerText||btn.textContent||'').toLowerCase();
      for (const [label, act] of Object.entries(TEXT2)){ if (t.includes(label)) { bindOnce(btn,act); break; } }
    });
  }
  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ scan(); const mo=new MutationObserver(scan); mo.observe(document.body,{childList:true,subtree:true}); setInterval(flushQueue,5000); window.addEventListener('online',flushQueue); });
  } else { scan(); const mo=new MutationObserver(scan); mo.observe(document.body,{childList:true,subtree:true}); setInterval(flushQueue,5000); window.addEventListener('online',flushQueue); }
})();
