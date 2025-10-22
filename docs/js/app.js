/* js/app.js
   Router + Drawer + Tema + WakeLock + Synk-badge
*/
(() => {
  'use strict';

  // ---------- Små helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  // ---------- Konstanter ----------
  const SECTIONS = ['home','work','service','status','admin'];
  const K_THEME  = 'BRYT_THEME';    // 'light' | 'dark'
  const K_WL     = 'BRYT_WL_PREF';  // true | false (ønske)
  let wakeLockObj = null;

  // ---------- Routing ----------
  function showSection(id) {
    const target = SECTIONS.includes(id) ? id : 'home';
    for (const sec of SECTIONS) {
      const el = $('#'+sec);
      if (!el) continue;
      if (sec === target) el.removeAttribute('hidden');
      else el.setAttribute('hidden','');
    }
    // Liten kosmetikk: sett hash "rent"
    if (location.hash !== '#'+target) {
      history.replaceState({}, '', '#'+target);
    }
  }

  function handleHashChange(){
    const id = (location.hash || '#home').replace('#','');
    showSection(id);
  }

  // ---------- Drawer ----------
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

    // Navigasjon via data-go
    $$('.drawer-link[data-go]').forEach(a=>{
      a.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const to = a.getAttribute('data-go');
        closeDrawer();
        location.hash = '#'+to;
      });
    });
  }

  // ---------- Tema (lys/mørk) ----------
  function applyTheme(theme){
    const t = (theme==='dark' || theme==='light') ? theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    WJ(K_THEME, t);
    // Oppdater label i meny hvis finnes
    const themeLabel = $('#theme_label');
    if (themeLabel) themeLabel.textContent = (t==='dark') ? 'Mørk' : 'Lys';
  }
  function toggleTheme(){
    const cur = RJ(K_THEME, null) || (document.documentElement.getAttribute('data-theme') || 'light');
    applyTheme(cur==='dark' ? 'light' : 'dark');
  }
  function wireTheme(){
    // event på “Bytt tema”-knapp (støtt både #theme_toggle og #qk_theme)
    $('#theme_toggle')?.addEventListener('click', toggleTheme);
    $('#qk_theme')?.addEventListener('click', toggleTheme);
    // starttema
    applyTheme(RJ(K_THEME, null));
  }

  // ---------- Wake Lock (hold skjerm våken) ----------
  async function requestWakeLock(){
    if (!('wakeLock' in navigator)) return false;
    try{
      wakeLockObj = await navigator.wakeLock.request('screen');
      wakeLockObj.addEventListener?.('release', updateWakeUI);
      return true;
    }catch{ return false; }
  }
  function releaseWakeLock(){
    try{ wakeLockObj?.release?.(); }catch{}
    wakeLockObj = null;
  }
  async function setWakeDesired(on){
    WJ(K_WL, !!on);
    if (on) {
      const ok = await requestWakeLock();
      if (!ok) alert('Kunne ikke slå på “hold skjerm våken” på denne enheten.');
    } else {
      releaseWakeLock();
    }
    updateWakeUI();
  }
  function updateWakeUI(){
    const on = !!wakeLockObj;
    // Meny-kortet
    const lbl = $('#qk_wl_status') || $('#wl_status');
    if (lbl) lbl.textContent = 'Status: ' + (on ? 'på (native)' : 'av');
    // Grønn/grå prikk i meny
    const dot = $('#qk_wl_dot') || $('#wl_dot');
    if (dot){
      dot.classList.toggle('dot-on',  on);
      dot.classList.toggle('dot-off', !on);
    }
    // Liten badge i appbar (den ekstra grå prikken)
    const wlb = $('#wl_badge');
    if (wlb){
      wlb.classList.toggle('on',  on);
      wlb.classList.toggle('off', !on);
    }
  }
  function wireWakeLock(){
    // knapp i meny (støtt begge id-varianter)
    const btn = $('#qk_wl') || $('#wl_toggle');
    btn?.addEventListener('click', async ()=>{
      const on = !!wakeLockObj;
      await setWakeDesired(!on);
    });
    // Respekter tidligere ønske
    const want = !!RJ(K_WL, false);
    if (want) requestWakeLock().then(updateWakeUI);
    updateWakeUI();
    // iOS kan slippe wakelock ved skjermlås/visning: prøv å re-requeste ved visibilitychange
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'visible' && RJ(K_WL,false) && !wakeLockObj){
        requestWakeLock().then(updateWakeUI);
      }
    });
  }

  // ---------- Synk-badge ----------
  function setSyncBadge(state, whenText=''){
    const badge = $('#sync_badge');
    if (!badge) return;
    // forventer markup: <span id="sync_badge" class="badge"><span id="sync_dot" class="dot ..."></span> Synk: ...</span>
    const dot = $('#sync_dot') || badge.querySelector('.dot');
    const text = (state==='ok') ? 'Synk: OK' :
                 (state==='error') ? 'Synk: feil' :
                 'Synk: ukjent';
    badge.textContent = ' ' + text + (whenText ? ' • ' + whenText : '');
    // Sett dot først i badge
    if (dot){
      dot.className = 'dot ' + (state==='ok' ? 'dot-ok' : state==='error' ? 'dot-err' : 'dot-unknown');
      badge.prepend(dot);
    }
  }

  function refreshSyncBadge(){
    try{
      if (!window.Sync) { setSyncBadge('unknown'); return; }
      const cfg = window.Sync.getConfig?.() || {};
      const cache = window.Sync.getCache?.() || {};
      if (!cfg.binId || !cfg.apiKey){
        setSyncBadge('unknown');
        return;
      }
      // Enkel heuristikk: hvis vi har adresser i cache, anta OK og vis tidspunkt
      const ok = Array.isArray(cache.addresses) && cache.addresses.length>0;
      const t  = cache._fetchedAt ? new Date(cache._fetchedAt) : null;
      const when = t ? t.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit' }) : '';
      setSyncBadge(ok ? 'ok' : 'unknown', when);
    }catch{
      setSyncBadge('unknown');
    }
  }

  function wireSyncBadge(){
    refreshSyncBadge();
    // oppdater når Sync sier fra
    if (window.Sync?.on){
      window.Sync.on('change', refreshSyncBadge);
      window.Sync.on('error',  ()=>setSyncBadge('error'));
    }
    // fallback: poll litt sjeldent
    setInterval(refreshSyncBadge, 15000);
  }

  // ---------- Boot ----------
  function boot(){
    // Routing
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    // Drawer, tema, wl, synk
    wireDrawer();
    wireTheme();
    wireWakeLock();
    wireSyncBadge();
  }

  document.addEventListener('DOMContentLoaded', boot);

  // Eksponer litt for evt. andre moduler
  window.App = {
    show: showSection,
    refreshSyncBadge,
    setTheme: applyTheme
  };
})();