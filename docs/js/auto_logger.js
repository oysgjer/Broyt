// auto_logger.js — robust autologging + flytende "✓ Logget / ⏳ Lagres …" ved knappen
(function(){
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const API_PUT    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const QKEY = 'AUTOLOG_QUEUE';

  (function injectCSS(){
    if (document.getElementById('logMarkCSS')) return;
    const st = document.createElement('style'); st.id='logMarkCSS';
    st.textContent = `
      .logMark{
        position:absolute; top:-6px; right:-6px;
        font-size:12px; line-height:1;
        padding:2px 6px; border-radius:999px;
        border:1px solid transparent; pointer-events:none;
        box-shadow:0 1px 2px rgba(0,0,0,.08); z-index:5;
      }
      .logMark.success{background:#e6f7ec;border-color:#b7e2c4;color:#0f7a2e}
      .logMark.pending{background:#fff3e0;border-color:#f7d7a7;color:#9a5b00}
    `;
    document.head.appendChild(st);
  })();

  const nowIso = () => new Date().toISOString();

  function getMasterKey(){
    try{
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']){
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      const blobs=['BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'];
      const fields=['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of blobs){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k); if (!raw) continue;
        try{
          const o = JSON.parse(raw);
          for (const f of fields){ if (typeof o[f]==='string' && o[f].length>10) return o[f]; }
          const st=[o]; while(st.length){ const it=st.pop();
            if (typeof it==='string' && it.length>20) return it;
            if (it && typeof it==='object') Object.values(it).forEach(v=>st.push(v));
          }
        }catch{}
      }
    }catch{}
    return null;
  }

  function getDriver(){
    const keys=['DRIVER','SJÅFØR','driver','bryter_driver','APP_CFG','DRIVER_NAME'];
    for (const k of keys){
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (!v) continue;
      try { const o=JSON.parse(v); if (o && o.driver) return o.driver; } catch {}
      if (typeof v === 'string') return v;
    }
    return 'Ukjent';
  }

  function getAddress(){
    const el = document.querySelector('#addr,#address,.current-address,[data-current-address]');
    if (el) return (el.getAttribute('data-current-address') || el.textContent || '').trim();
    const active = document.querySelector('.job-item.active,.address.active,[data-addr]');
    if (active) return (active.getAttribute('data-addr') || active.textContent || '').trim();
    const now = document.querySelector('#work .work-card h2, #work .work-card .now, #work .work-card .title');
    if (now) return now.textContent.trim();
    return '';
  }

  function readQueue(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }catch{ return []; } }
  function writeQueue(a){ try{ localStorage.setItem(QKEY, JSON.stringify(a)); }catch{} }

  async function fetchRecord(key){
    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }
  async function putRecord(key, body){
    const r = await fetch(API_PUT, {
      method:'PUT', headers:{'Content-Type':'application/json','X-Master-Key': key},
      body: JSON.stringify(body)
    });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }

  async function flushQueue(){
    const key = getMasterKey(); if (!key) return;
    const q = readQueue(); if (!q.length) return;
    try{
      const cur = await fetchRecord(key);
      const body = cur && cur.record ? cur.record : {};
      body.reports = Array.isArray(body.reports) ? body.reports : [];
      Array.prototype.push.apply(body.reports, q);
      await putRecord(key, body);
      writeQueue([]);
    }catch(e){ /* keep queued */ }
  }

  function showMark(btn, type){
    const host = btn.closest('.btn, .menu-item, button') || btn.parentElement || btn;
    const cs = getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    const exist = host.querySelector('.logMark'); if (exist) exist.remove();
    const m = document.createElement('span');
    m.className = 'logMark ' + type;
    m.textContent = (type==='success') ? '✓ Logget' : '⏳ Lagres …';
    host.appendChild(m);
    setTimeout(()=> m.remove(), 1600);
  }

  function enqueue(evt, btn){
    const q = readQueue();
    q.push(evt);
    writeQueue(q);
    if (navigator.onLine && getMasterKey()) showMark(btn, 'success');
    else showMark(btn, 'pending');
    flushQueue();
  }

  function buildEvent(action){
    return { ts: nowIso(), driver: getDriver(), action, address: getAddress(), notes: '' };
  }

  const MAP = {
    start:      ['#btnStart','[data-action="start"]'],
    ferdig:     ['#btnFerdig','[data-action="done"]'],
    neste:      ['#btnNeste','[data-action="next"]'],
    hopp_over:  ['#btnSkip','[data-action="skip"]'],
    ikke_mulig: ['#btnNotPossible','[data-action="na"]']
  };
  const TEXT_TO_ACTION = {
    'start':'start','ferdig':'ferdig','neste':'neste',
    'hopp over':'hopp_over','ikke mulig':'ikke_mulig'
  };

  function bindOnce(el, action){
    if (!el || el.dataset.autologBound) return;
    el.dataset.autologBound = '1';
    el.addEventListener('click', ()=> enqueue(buildEvent(action), el));
  }

  function scanAndBind(){
    Object.entries(MAP).forEach(([action, sels])=>{
      sels.forEach(sel => (document.querySelectorAll(sel)).forEach(el => bindOnce(el, action)));
    });
    (document.querySelectorAll('button')).forEach(btn=>{
      if (btn.dataset.autologBound) return;
      const t = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      for (const [label, act] of Object.entries(TEXT_TO_ACTION)){
        if (t.includes(label)) { bindOnce(btn, act); break; }
      }
    });
  }

  function init(){
    scanAndBind();
    const mo = new MutationObserver(()=> scanAndBind());
    mo.observe(document.body, {childList:true, subtree:true});
    setInterval(flushQueue, 5000);
    window.addEventListener('online', flushQueue);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
