/*! auto_logger.js — robust autologging med driver-speil-støtte
 *  - Leser sjåførnavn fra #work_driver_mirror[data-driver], eller Hjem-felt, ellers LAST_DRIVER i localStorage
 *  - Leser adresse fra data-current-address eller brede fallbacks
 *  - Husk driver/adresse i localStorage (LAST_DRIVER / LAST_ADDR)
 */
(function(){
  'use strict';

  var BIN_ID = window.AUTOLOG_BIN_ID || '68e89e3443b1c97be9611c48';
  var API_LATEST = "https://api.jsonbin.io/v3/b/" + BIN_ID + "/latest";
  var API_PUT    = "https://api.jsonbin.io/v3/b/" + BIN_ID;
  var QKEY = 'AUTOLOG_QUEUE';

  (function injectCSS(){
    if (document.getElementById('logMarkCSS')) return;
    var st = document.createElement('style'); st.id='logMarkCSS';
    st.textContent = [
      '.logMark{position:absolute;top:-6px;right:-6px;font-size:12px;line-height:1;',
      'padding:2px 6px;border-radius:999px;border:1px solid transparent;pointer-events:none;',
      'box-shadow:0 1px 2px rgba(0,0,0,.08);z-index:5}',
      '.logMark.success{background:#e6f7ec;border-color:#b7e2c4;color:#0f7a2e}',
      '.logMark.pending{background:#fff3e0;border-color:#f7d7a7;color:#9a5b00}'
    ].join('');
    document.head.appendChild(st);
  })();

  function $(s,r){return (r||document).querySelector(s);}
  function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}

  function rememberDriver(name){ try{ if(name) localStorage.setItem('LAST_DRIVER', name); }catch{} }
  function recallDriver(){ try{ return localStorage.getItem('LAST_DRIVER') || ''; }catch{ return ''; } }

  function rememberAddress(addr){ try{ if(addr) localStorage.setItem('LAST_ADDR', addr); }catch{} }
  function recallAddress(){ try{ return localStorage.getItem('LAST_ADDR') || ''; }catch{ return ''; } }

  function getMasterKey(){
    try{
      var v = localStorage.getItem('X_MASTER_KEY') || localStorage.getItem('JSONBIN_MASTER_KEY');
      if (v && v.length > 10) return v;
    }catch{}
    return null;
  }

  function getDriver(){
    var mirror = document.querySelector('#work_driver_mirror[data-driver]');
    if (mirror){
      var m = (mirror.getAttribute('data-driver')||'').trim();
      if (m) return m;
    }
    var el = document.querySelector('#home input[type="text"], input[name="driver"], #driver, #sjafor, #sjåfør');
    if (el){
      var v = (el.value || el.textContent || '').trim();
      if (v){ rememberDriver(v); return v; }
    }
    var cached = recallDriver();
    return cached || 'Ukjent';
  }

  function sniffAddressFromDOM(){
    var sels = [
      '#work [data-current-address]',
      '#work .work-card h2',
      '#work .work-card .title',
      '#work h2',
      '#work h3',
      '#work [class*="addr"]',
      '[data-addr-now]',
      '[data-addr]'
    ];
    for (var i=0;i<sels.length;i++){
      var el = document.querySelector(sels[i]);
      if (!el) continue;
      var txt = (el.getAttribute('data-current-address') || el.textContent || '').trim();
      if (txt && !/^nå$/i.test(txt)) { rememberAddress(txt); return txt; }
    }
    var cached = recallAddress();
    return cached || '';
  }

  function nowIso(){ return new Date().toISOString(); }
  function readQueue(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }catch{ return []; } }
  function writeQueue(a){ try{ localStorage.setItem(QKEY, JSON.stringify(a)); }catch{} }

  async function fetchRecord(key){
    var r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if (!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }
  async function putRecord(key, body){
    var r = await fetch(API_PUT, {
      method:'PUT',
      headers:{'Content-Type':'application/json','X-Master-Key': key},
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }

  async function flushQueue(){
    var key = getMasterKey(); if (!key) return;
    var q = readQueue(); if (!q.length) return;
    try{
      var cur = await fetchRecord(key);
      var body = cur && cur.record ? cur.record : {};
      if (Array.isArray(body)) body = { reports: body.slice() };
      body.reports = Array.isArray(body.reports) ? body.reports : [];
      Array.prototype.push.apply(body.reports, q);
      await putRecord(key, body);
      writeQueue([]);
    }catch(e){}
  }

  function showMark(btn, type){
    var host = btn.closest('.btn, .menu-item, button') || btn.parentElement || btn;
    var cs = getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    var exist = host.querySelector('.logMark'); if (exist) exist.remove();
    var m = document.createElement('span');
    m.className = 'logMark ' + (type||'pending');
    m.textContent = (type==='success') ? '✓ Logget' : '⏳ Lagres …';
    host.appendChild(m);
    setTimeout(function(){ try{ m.remove(); }catch{} }, 1600);
  }

  function enqueue(evt, btn){
    var q = readQueue();
    q.push(evt);
    writeQueue(q);
    if (navigator.onLine && getMasterKey()) showMark(btn, 'success');
    else showMark(btn, 'pending');
    flushQueue();
  }

  function sniffTaskFromContext(){
    var btn = document.querySelector('#work .work-card .task, .task-badge');
    if (btn) return (btn.textContent||'').trim();
    var snow = document.querySelector('#home input[type="checkbox"][name*="snø" i], #home input[type="checkbox"][value*="snø" i]');
    var grus = document.querySelector('#home input[type="checkbox"][name*="grus" i], #home input[type="checkbox"][value*="grus" i]');
    if (grus && grus.checked) return 'Grus';
    if (snow && snow.checked) return 'Snø';
    return '';
  }

  var MAP = {
    start:      ['#btnStart','[data-action="start"]'],
    ferdig:     ['#btnFerdig','[data-action="done"]'],
    neste:      ['#btnNeste','[data-action="next"]'],
    hopp_over:  ['#btnSkip','[data-action="skip"]'],
    ikke_mulig: ['#btnNotPossible','[data-action="na"]']
  };
  var TEXT_TO_ACTION = { 'start':'start','ferdig':'ferdig','neste':'neste','hopp over':'hopp_over','ikke mulig':'ikke_mulig' };

  function bindOnce(el, action){
    if (!el || el.dataset.autologBound) return;
    el.dataset.autologBound = '1';
    el.addEventListener('click', function(){ enqueue({
      ts: nowIso(),
      driver: getDriver(),
      address: sniffAddressFromDOM(),
      task: sniffTaskFromContext(),
      action: action,
      notes: ''
    }, el); });
  }

  function scanAndBind(){
    Object.keys(MAP).forEach(function(action){
      MAP[action].forEach(function(sel){ $all(sel).forEach(function(el){ bindOnce(el, action); }); });
    });
    $all('button').forEach(function(btn){
      if (btn.dataset.autologBound) return;
      var t = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      for (var label in TEXT_TO_ACTION){
        if (t.includes(label)) { bindOnce(btn, TEXT_TO_ACTION[label]); break; }
      }
    });
  }

  function init(){
    scanAndBind();
    var mo = new MutationObserver(scanAndBind);
    mo.observe(document.body, {childList:true, subtree:true});
    setInterval(flushQueue, 5000);
    window.addEventListener('online', flushQueue);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
