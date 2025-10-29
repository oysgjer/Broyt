/* js/app.js
   Router + Drawer + Tema + WakeLock + Synk-badge (robust)
*/
(() => {
  'use strict';

// Marker når vi kjører som installert app (standalone)
  const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true; // iOS

  if (isStandalone) {
  document.documentElement.classList.add('standalone');
}

  // ---------- helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const SECTIONS = ['home','work','service','status','admin'];
  const K_THEME  = 'BRYT_THEME';
  const K_WL     = 'BRYT_WL_PREF';

  let wakeLockObj = null;

  // ---------- routing ----------
  function showSection(id) {
    const target = SECTIONS.includes(id) ? id : 'home';
    for (const sec of SECTIONS) {
      const el = $('#'+sec);
      if (!el) continue;
      if (sec === target) el.removeAttribute('hidden');
      else el.setAttribute('hidden','');
    }
    // hold hash konsistent
    if (location.hash !== '#'+target) {
      history.replaceState({}, '', '#'+target);
    }
    // kall "onEnter" hooks ved behov
    if (target === 'admin' && window.Admin?.onEnter) {
      window.Admin.onEnter();
    }
  }
  function handleHashChange(){
    const id = (location.hash || '#home').replace('#','');
    showSection(id);
  }

  // ---------- drawer ----------
  function openDrawer(){
    $('#drawer')?.classList.add('show');
    $('#scrim')?.classList.add('show');
  }
  function closeDrawer(){
    $('#drawer')?.classList.remove('show');
    $('#scrim')?.classList.remove('show');
  }
  function wireDrawer(){
    $('#btnMenu')?.addEventListener('click', openDrawer);
    $('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
    $('#scrim')?.addEventListener('click', closeDrawer);
    // legg både data-go og href for å tåle lite JS
    $$('.drawer-link').forEach(a=>{
      const to = a.getAttribute('data-go');
      if (to) a.setAttribute('href', '#'+to);
      a.addEventListener('click', (ev)=>{
        // la hash oppdatere alltid:
        // (på iOS WebApp kan preventDefault stoppe hash)
        // derfor stopper vi ikke eventen — vi bare lukker menyen.
        closeDrawer();
      });
    });
  }

  // ---------- tema ----------
  function applyTheme(theme){
    const t = (theme==='dark'||theme==='light')
      ? theme
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    WJ(K_THEME, t);
    const themeLabel = $('#theme_label');
    if (themeLabel) themeLabel.textContent = (t==='dark' ? 'Mørk' : 'Lys');
  }
  function toggleTheme(){
    const cur = RJ(K_THEME, null) || (document.documentElement.getAttribute('data-theme') || 'light');
    applyTheme(cur==='dark' ? 'light' : 'dark');
  }
  function wireTheme(){
    $('#theme_toggle')?.addEventListener('click', toggleTheme);
    $('#qk_theme')?.addEventListener('click', toggleTheme);
    applyTheme(RJ(K_THEME, null));
  }

  // ---------- wakelock ----------
  async function requestWakeLock(){
    if (!('wakeLock' in navigator)) return false;
    try{
      wakeLockObj = await navigator.wakeLock.request('screen');
      wakeLockObj.addEventListener?.('release', updateWakeUI);
      updateWakeUI();
      return true;
    }catch{ return false; }
  }
  function releaseWakeLock(){
    try{ wakeLockObj?.release?.(); }catch{}
    wakeLockObj = null; updateWakeUI();
  }
  async function setWakeDesired(on){
    WJ(K_WL, !!on);
    if (on) await requestWakeLock(); else releaseWakeLock();
  }
  function updateWakeUI(){
    const on = !!wakeLockObj;
    const lbl = $('#qk_wl_status') || $('#wl_status');
    if (lbl) lbl.textContent = 'Status: ' + (on ? 'på (native)' : 'av');
    const dot = $('#qk_wl_dot') || $('#wl_dot');
    if (dot){
      dot.classList.toggle('dot-on',  on);
      dot.classList.toggle('dot-off', !on);
    }
  }
  function wireWakeLock(){
    const btn = $('#qk_wl') || $('#wl_toggle');
    btn?.addEventListener('click', async ()=>{
      const on = !!wakeLockObj;
      await setWakeDesired(!on);
    });
    if (RJ(K_WL,false)) requestWakeLock();
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'visible' && RJ(K_WL,false) && !wakeLockObj){
        requestWakeLock();
      }
    });
    updateWakeUI();
  }

  // ---------- synk-badge ----------
  function setSyncBadge(state, whenText=''){
    const badge = $('#sync_badge');
    if (!badge) return;
    const dot = badge.querySelector('.dot') || $('#sync_dot');
    const text = (state==='ok') ? 'Synk: OK' :
                 (state==='error') ? 'Synk: feil' :
                 'Synk: ukjent';
    badge.textContent = ' ' + text + (whenText ? ' • ' + whenText : '');
    if (dot){
      dot.className = 'dot ' + (state==='ok' ? 'dot-ok' : state==='error' ? 'dot-err' : 'dot-unknown');
      badge.prepend(dot);
    }
  }
  function refreshSyncBadge(){
    try{
      const cache = window.Sync?.getCache?.() || {};
      const cfg   = window.Sync?.getConfig?.() || {};
      if (!cfg.binId || !cfg.apiKey){ setSyncBadge('unknown'); return; }
      const ok = Array.isArray(cache.addresses) && cache.addresses.length>0;
      const t  = cache._fetchedAt ? new Date(cache._fetchedAt) : null;
      const when = t ? t.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit' }) : '';
      setSyncBadge(ok ? 'ok' : 'unknown', when);
    }catch{ setSyncBadge('unknown'); }
  }
  function wireSyncBadge(){
    refreshSyncBadge();
    if (window.Sync?.on){
      window.Sync.on('change', refreshSyncBadge);
      window.Sync.on('error', ()=>setSyncBadge('error'));
    }
    setInterval(refreshSyncBadge, 15000);
  }

  // ---------- boot ----------
  function boot(){
    wireDrawer();
    wireTheme();
    wireWakeLock();
    wireSyncBadge();

    // initial route
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    // start polling (for Admin/Work live-oppdateringer)
    if (window.Sync?.startPolling) window.Sync.startPolling(12000);
  }

  document.addEventListener('DOMContentLoaded', boot);

  // eksponér lite API hvis ønskelig
  window.App = { show: showSection, refreshSyncBadge, setTheme: applyTheme };
})();