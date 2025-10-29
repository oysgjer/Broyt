// auto_logger.js — logger og viser "✓ Logget" / "⏳ Lagres …" ved knappen
(function(){
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const API_PUT    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const QKEY = 'AUTOLOG_QUEUE';

  // Small CSS for the log mark
  (function injectCSS(){
    if (document.getElementById('logMarkCSS')) return;
    const st = document.createElement('style'); st.id='logMarkCSS';
    st.textContent = `.logMark{margin-left:8px;font-size:.85em;padding:1px 6px;border-radius:999px;border:1px solid transparent;vertical-align:middle}
      .logMark.success{background:#e6f7ec;border-color:#b7e2c4;color:#0f7a2e}
      .logMark.pending{background:#fff3e0;border-color:#f7d7a7;color:#9a5b00}`;
    document.head.appendChild(st);
  })();

  function getMasterKey(){
    try{
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']) {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      const candidates = ['BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'];
      const fields = ['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of candidates){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) continue;
        try{
          const obj = JSON.parse(raw);
          for (const f of fields){ if (typeof obj[f] === 'string' && obj[f].length > 10) return obj[f]; }
          const stack=[obj];
          while (stack.length){
            const it = stack.pop();
            if (typeof it === 'string' && it.length > 20) return it;
            if (it && typeof it === 'object'){ for (const v of Object.values(it)) stack.push(v); }
          }
        }catch{}
      }
    }catch{}
    return null;
  }

  function getDriver(){
    const keys = ['DRIVER','SJÅFØR','driver','bryter_driver','APP_CFG'];
    for (const k of keys){
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (!v) continue;
      try { const o=JSON.parse(v); if (o && o.driver) return o.driver; } catch {}
      if (typeof v === 'string' && v.length<=40) return v;
    }
    return localStorage.getItem('DRIVER_NAME') || 'Ukjent';
  }

  function getAddress(){
    const el = document.querySelector('#addr,#address,.current-address,[data-current-address]');
    if (el){ return (el.getAttribute('data-current-address') || el.textContent || '').trim(); }
    const sel = document.querySelector('.job-item.active,.address.active,[data-addr]');
    if (sel){ return (sel.getAttribute('data-addr') || sel.textContent || '').trim(); }
    return '';
  }

  function nowIso(){ return new Date().toISOString(); }
  function readQueue(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }catch{ return []; } }
  function writeQueue(a){ try{ localStorage.setItem(QKEY, JSON.stringify(a)); }catch{} }

  async function fetchRecord(key){
    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }
  async function putRecord(key, body){
    const r = await fetch(API_PUT, { method:'PUT', headers:{'Content-Type':'application/json','X-Master-Key': key}, body: JSON.stringify(body) });
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

  function mark(btn, type){
    const existing = btn.parentElement?.querySelector('.logMark');
    if (existing) existing.remove();
    const m = document.createElement('span');
    m.className = 'logMark ' + type;
    m.textContent = (type==='success') ? '✓ Logget' : '⏳ Lagres …';
    btn.insertAdjacentElement('afterend', m);
    setTimeout(()=>{ m.remove(); }, 2000);
  }

  function enqueue(evt, btn){
    const q = readQueue();
    q.push(evt);
    writeQueue(q);
    if (navigator.onLine && getMasterKey()) mark(btn, 'success');
    else mark(btn, 'pending');
    flushQueue();
  }

  function buildEvent(action){
    return { ts: nowIso(), driver: getDriver(), action, address: getAddress(), notes: '' };
  }

  function bind(idOrSel, action){
    const el = document.getElementById(idOrSel) || document.querySelector(idOrSel);
    if (!el || el.dataset.autologBound) return;
    el.dataset.autologBound = '1';
    el.addEventListener('click', ()=> enqueue(buildEvent(action), el));
  }

  function init(){
    bind('btnStart',      'start');
    bind('btnFerdig',     'ferdig');
    bind('btnNeste',      'neste');
    bind('btnSkip',       'hopp_over');
    bind('btnNotPossible','ikke_mulig');

    bind('[data-action="start"]', 'start');
    bind('[data-action="done"]',  'ferdig');
    bind('[data-action="next"]',  'neste');
    bind('[data-action="skip"]',  'hopp_over');
    bind('[data-action="na"]',    'ikke_mulig');

    setInterval(flushQueue, 5000);
    window.addEventListener('online', flushQueue);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
