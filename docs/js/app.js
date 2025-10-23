/* js/app.js
   Router + Drawer + Tema + WakeLock + Synk-badge (med pålitelig klokkeslett)
*/
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  // ---------- Keys / state ----------
  const SECTIONS    = ['home','work','service','status','admin'];
  const K_THEME     = 'BRYT_THEME';         // 'light' | 'dark'
  const K_WL        = 'BRYT_WL_PREF';       // boolean
  const K_LASTSYNC  = 'BRYT_LAST_SYNC_AT';  // number (ms)
  let wakeLockObj   = null;

  // ---------- Routing ----------
  function showSection(id) {
    const target = SECTIONS.includes(id) ? id : 'home';
    for (const sec of SECTIONS) {
      const el = $('#'+sec);
      if (!el) continue;
      if (sec === target) el.removeAttribute('hidden');
      else el.setAttribute('hidden','');
    }
    if (location.hash !== '#'+target) {
      history.replaceState({}, '', '#'+target);
    }
  }
  function handleHashChange(){ showSection((location.hash||'#home').slice(1)); }

  // ---------- Drawer ----------
  function openDrawer(){ $('#drawer')?.classList.add('show'); $('#scrim')?.classList.add('show'); }
  function closeDrawer(){ $('#drawer')?.classList.remove('show'); $('#scrim')?.classList.remove('show'); }
  function wireDrawer(){
    $('#btnMenu')?.addEventListener('click', openDrawer);
    $('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
    $('#scrim')?.addEventListener('click', closeDrawer);
    $$('.drawer-link[data-go]').forEach(a=>{
      a.addEventListener('click', e=>{
        e.preventDefault();
        const to=a.getAttribute('data-go'); closeDrawer(); location.hash='#'+to;
      });
    });
  }

  // ---------- Tema ----------
  function applyTheme(theme){
    const t = (theme==='dark'||theme==='light')
      ? theme
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    WJ(K_THEME, t);
    const label = $('#theme_label');
    if (label) label.textContent = (t==='dark')?'Mørk':'Lys';
  }
  function toggleTheme(){
    const cur = RJ(K_THEME, null) || document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur==='dark' ? 'light' : 'dark');
  }
  function wireTheme(){
    $('#theme_toggle')?.addEventListener('click', toggleTheme);
    $('#qk_theme')?.addEventListener('click', toggleTheme);
    applyTheme(RJ(K_THEME, null));
  }

(function(){
  function applyDisplayMode(){
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari
    document.documentElement.classList.toggle('standalone', standalone);
  }

  // Kjør ved start og ved endring av display-mode
  window.addEventListener('DOMContentLoaded', applyDisplayMode);
  try {
    window.matchMedia('(display-mode: standalone)')
      .addEventListener('change', applyDisplayMode);
  } catch(_) {}
})();

  // ---------- Wake Lock ----------
  async function requestWakeLock(){
    if (!('wakeLock' in navigator)) return false;
    try{
      wakeLockObj = await navigator.wakeLock.request('screen');
      wakeLockObj.addEventListener?.('release', updateWakeUI);
      return true;
    }catch{ return false; }
  }
  function releaseWakeLock(){ try{wakeLockObj?.release?.();}catch{} wakeLockObj=null; }
  async function setWakeDesired(on){
    WJ(K_WL, !!on);
    if (on) { const ok=await requestWakeLock(); if(!ok) alert('Kunne ikke slå på “hold skjerm våken”.'); }
    else { releaseWakeLock(); }
    updateWakeUI();
  }
  function updateWakeUI(){
    const on = !!wakeLockObj;
    const lbl = $('#qk_wl_status') || $('#wl_status');
    if (lbl) lbl.textContent = 'Status: ' + (on ? 'på (native)' : 'av');
    const dot = $('#qk_wl_dot') || $('#wl_dot');
    if (dot){ dot.classList.toggle('dot-on',on); dot.classList.toggle('dot-off',!on); }
    const wlb = $('#wl_badge');
    if (wlb){ wlb.classList.toggle('on',on); wlb.classList.toggle('off',!on); }
  }
  function wireWakeLock(){
    const btn = $('#qk_wl') || $('#wl_toggle');
    btn?.addEventListener('click', async ()=>{ await setWakeDesired(!wakeLockObj); });
    if (RJ(K_WL,false)) requestWakeLock().then(updateWakeUI);
    updateWakeUI();
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState==='visible' && RJ(K_WL,false) && !wakeLockObj){
        requestWakeLock().then(updateWakeUI);
      }
    });
  }

  // ---------- Synk-badge ----------
  function formatHM(d){
    try{ return d.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}); }catch{ return ''; }
  }
  function setSyncBadge(state, whenMs=null){
    const badge = $('#sync_badge'); if (!badge) return;
    let dot = badge.querySelector('.dot');
    if (!dot){ dot = document.createElement('span'); dot.className='dot'; badge.prepend(dot); }
    dot.className = 'dot ' + (state==='ok' ? 'dot-ok' : state==='error' ? 'dot-err' : 'dot-unknown');

    const t = (state==='ok') ? 'Synk: OK' : (state==='error') ? 'Synk: feil' : 'Synk: ukjent';
    const whenTxt = whenMs ? ' • ' + formatHM(new Date(whenMs)) : '';
    // behold dot-elementet og sett resten som tekst
    const txtNode = document.createTextNode(' ' + t + whenTxt);
    // tøm alt unntatt dot
    badge.innerHTML = '';
    badge.appendChild(dot);
    badge.appendChild(txtNode);
  }

  // Kilde for “siste synk”: vi bruker tre signaler:
  // 1) Sync-cache._fetchedAt (fra sync.js)
  // 2) event fra Sync.on('change') => sett “nå”
  // 3) fallback: poll
  function refreshSyncBadge(){
    try{
      const cfg = window.Sync?.getConfig?.() || {};
      if (!cfg.binId || !cfg.apiKey){ setSyncBadge('unknown', null); return; }

      const cache = window.Sync?.getCache?.() || {};
      // lastKnown fra cache
      let lastMs = cache._fetchedAt || RJ(K_LASTSYNC, null);
      if (!lastMs) { setSyncBadge('ok', null); return; }
      setSyncBadge('ok', lastMs);
    }catch{
      setSyncBadge('unknown', null);
    }
  }

  function wireSyncBadge(){
    // når Sync sier “endring”, sett siste synk = nå
    if (window.Sync?.on){
      window.Sync.on('change', ()=>{
        const now = Date.now();
        WJ(K_LASTSYNC, now);
        setSyncBadge('ok', now);
      });
      window.Sync.on('error', ()=> setSyncBadge('error', RJ(K_LASTSYNC,null)));
    }
    // første visning
    refreshSyncBadge();
    // poll i bakgrunnen som sikkerhet
    setInterval(refreshSyncBadge, 15000);
  }

  // ---------- Boot ----------
  function boot(){
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    wireDrawer();
    wireTheme();
    wireWakeLock();
    wireSyncBadge();
  }

  document.addEventListener('DOMContentLoaded', boot);

  // Eksponer litt
  window.App = {
    show: showSection,
    refreshSyncBadge,
    setTheme: applyTheme
  };
})();