// auto_logger.js — robust autologging m/ adresse + sjåfør + oppgave og "✓ Logget" badge

(function(){
  const BIN_ID = '68e89e3443b1c97be9611c48';   // HENDELSER-bin
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const API_PUT    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const QKEY = 'AUTOLOG_QUEUE';

  // ——— liten badge (på knappen)
  (function injectCSS(){
    if (document.getElementById('logMarkCSS')) return;
    const st = document.createElement('style'); st.id='logMarkCSS';
    st.textContent = `
      .logMark{
        position:absolute; top:-6px; right:-6px; font-size:12px; line-height:1;
        padding:2px 6px; border-radius:999px; border:1px solid transparent;
        pointer-events:none; box-shadow:0 1px 2px rgba(0,0,0,.08); z-index:5;
      }
      .logMark.success{background:#e6f7ec;border-color:#b7e2c4;color:#0f7a2e}
      .logMark.pending{background:#fff3e0;border-color:#f7d7a7;color:#9a5b00}
    `;
    document.head.appendChild(st);
  })();

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const nowIso = () => new Date().toISOString();

  function readQueue(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }catch{ return []; } }
  function writeQueue(a){ try{ localStorage.setItem(QKEY, JSON.stringify(a)); }catch{} }

  // ——— master key
  function getMasterKey(){
    try{
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']) {
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

  // ——— DRIVER (navn) — bred sniff + caching
  function sniffDriverFromDOM(){
    // typiske steder for “Fører”/navn
    const sels = [
      '#home input[type="text"]',         // Hjem: ett tekstfelt m/ navn
      '#home .grid2 input[type="text"]',
      'input[name="driver"]',
      'input[data-role="driver"]',
      '#driver', '#sjafor', '#sjåfør', '#inpDriver'
    ];
    for (const s of sels){
      const el = $(s);
      if (!el) continue;
      if (el.value && el.value.trim()) return el.value.trim();
      if (el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    // fallback: ta første tekst-input i “Fører”-seksjonen
    const labelLike = Array.from(document.querySelectorAll('#home label, #home .label'))
      .find(l => /før(er|ar)/i.test(l.textContent||''));
    if (labelLike){
      const input = labelLike.parentElement?.querySelector('input[type="text"]');
      if (input && input.value.trim()) return input.value.trim();
    }
    return '';
  }
  function rememberDriver(name){ try{ if(name) sessionStorage.setItem('LAST_DRIVER', name); }catch{} }
  function recallDriver(){ try{ return sessionStorage.getItem('LAST_DRIVER') || ''; }catch{ return ''; } }

  (function watchDriverChanges(){
    // oppdag endringer og cache
    const mo = new MutationObserver(()=> {
      const d = sniffDriverFromDOM(); if (d) rememberDriver(d);
    });
    mo.observe(document.body, {childList:true, subtree:true, characterData:true});
    const d = sniffDriverFromDOM(); if (d) rememberDriver(d);

    // og lagre ved input-typing
    document.addEventListener('input', (e)=>{
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type === 'text' && (t.closest('#home') || /driver|sjaf|sjåf/i.test(t.name||''))){
        if (t.value.trim()) rememberDriver(t.value.trim());
      }
    }, true);
  })();

  function getDriver(){
    const fromDom = sniffDriverFromDOM(); if (fromDom) return fromDom;
    const cached  = recallDriver();       if (cached)  return cached;

    const keys=['DRIVER','SJÅFØR','driver','bryter_driver','APP_CFG','DRIVER_NAME'];
    for (const k of keys){
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (!v) continue;
      try { const o=JSON.parse(v); if (o && o.driver) return o.driver; } catch {}
      if (typeof v === 'string') return v;
    }
    return 'Ukjent';
  }

  // ——— ADRESSE (Under arbeid) — bred sniff + caching
  function sniffAddressFromDOM() {
    const sels = [
      '#work [data-current-address]',
      '#work .work-card h2',
      '#work .work-card .title',
      '#work .now + h2',
      '.current-address',
      '[data-addr-now]',
      '[data-addr]'
    ];
    for (const s of sels) {
      const el = $(s);
      if (!el) continue;
      const txt = (el.getAttribute('data-current-address') || el.textContent || '').trim();
      if (txt) return txt;
    }
    return '';
  }
  function rememberAddress(addr){ try{ if (addr) sessionStorage.setItem('LAST_ADDR', addr); }catch{} }
  function recallAddress(){ try{ return sessionStorage.getItem('LAST_ADDR') || ''; }catch{ return ''; } }

  (function watchAddressChanges(){
    const mo = new MutationObserver(()=> {
      const a = sniffAddressFromDOM(); if (a) rememberAddress(a);
    });
    mo.observe(document.body, {childList:true, subtree:true, characterData:true});
    const a = sniffAddressFromDOM(); if (a) rememberAddress(a);
  })();

  function getAddress(){ return sniffAddressFromDOM() || recallAddress() || ''; }

  // ——— OPPGAVE: Snø/Grus (fres regnes som Snø)
  function getTask(){
    const grusSel = [
      '#utstyr_grus:checked',
      'input[name="grus"]:checked',
      'input[data-task="grus"]:checked',
      '#utstyr_sandgrus:checked'
    ];
    for (const s of grusSel) if (document.querySelector(s)) return 'Grus';
    return 'Snø';
  }

  // ——— JSONBin helpers m/ CORS-fallback for PUT
  async function fetchRecordForBin(key){
    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }
  async function putRecord(key, body){
    try{
      const r = await fetch(API_PUT, {
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Master-Key': key},
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error('PUT:'+r.status);
      return r.json();
    }catch(_){
      const url = "https://corsproxy.io/?" + encodeURIComponent(API_PUT);
      const r2 = await fetch(url, {
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Master-Key': key},
        body: JSON.stringify(body)
      });
      if (!r2.ok) throw new Error('PUT proxy:'+r2.status);
      return r2.json();
    }
  }

  async function flushQueue(){
    const key = getMasterKey(); if (!key) return;
    const q = readQueue(); if (!q.length) return;
    try{
      const cur  = await fetchRecordForBin(key);
      let body   = cur && cur.record ? cur.record : [];
      if (Array.isArray(body)) { body.push(...q); }
      else { body.reports = Array.isArray(body.reports) ? body.reports : []; body.reports.push(...q); }
      await putRecord(key, body);
      writeQueue([]); // tømt
    }catch(e){
      console.warn('primary put failed — will retry later', e);
    }
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

  function buildEvent(action){
    return {
      ts: nowIso(),
      driver: getDriver(),
      address: getAddress(),
      task: getTask(),
      action,
      notes: ''
    };
  }

  function enqueue(evt, btn){
    const q = readQueue();
    q.push(evt);
    writeQueue(q);
    if (navigator.onLine && getMasterKey()) showMark(btn, 'success');
    else showMark(btn, 'pending');
    flushQueue();
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
      sels.forEach(sel => $$(sel).forEach(el => bindOnce(el, action)));
    });
    $$('button').forEach(btn=>{
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