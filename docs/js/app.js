/* js/app.js
   Router + Drawer + Tema + WakeLock + Synk-badge
*/
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const SECTIONS = ['home','work','service','status','admin'];
  const K_THEME  = 'BRYT_THEME';     // 'light' | 'dark' | null (system)
  const K_WL     = 'BRYT_WL_PREF';   // bool
  let wakeLockObj = null;

  /* ---------- Routing ---------- */
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
  function handleHashChange(){
    const id = (location.hash || '#home').replace('#','');
    showSection(id);
  }

  /* ---------- Drawer ---------- */
  function openDrawer(){ $('#drawer')?.classList.add('show'); $('#scrim')?.classList.add('show'); }
  function closeDrawer(){ $('#drawer')?.classList.remove('show'); $('#scrim')?.classList.remove('show'); }
  function wireDrawer(){
    $('#btnMenu')?.addEventListener('click', openDrawer);
    $('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
    $('#scrim')?.addEventListener('click', closeDrawer);
    $$('.drawer-link[data-go]').forEach(a=>{
      a.addEventListener('click',(e)=>{
        e.preventDefault();
        const to = a.getAttribute('data-go');
        closeDrawer();
        location.hash = '#'+to;
      });
    });
  }

  /* ---------- Tema ---------- */
  function applyTheme(theme){
    // theme: 'light' | 'dark' | null (system)
    if (theme==='light' || theme==='dark') {
      document.documentElement.setAttribute('data-theme', theme);
      WJ(K_THEME, theme);
    } else {
      // system (null)
      localStorage.removeItem(K_THEME);
      document.documentElement.removeAttribute('data-theme'); // lar @media styre
    }
    // Oppdater menylabel
    const cur = RJ(K_THEME, null);
    const label = $('#theme_label');
    if (label) label.textContent = cur ? (cur==='dark' ? 'Mørk' : 'Lys') : 'System';
  }
  function toggleTheme(){
    const cur = RJ(K_THEME, null); // kan være null=system
    const next = cur==='dark' ? 'light' : cur==='light' ? null : 'dark';
    applyTheme(next);
  }
  function wireTheme(){
    $('#theme_toggle')?.addEventListener('click', toggleTheme);
    // Start med lagret preferanse (eller system)
    applyTheme(RJ(K_THEME, null));
  }

  /* ---------- Wake Lock ---------- */
  async function requestWakeLock(){
    if (!('wakeLock' in navigator)) return false;
    try{
      wakeLockObj = await navigator.wakeLock.request('screen');
      wakeLockObj.addEventListener?.('release', updateWakeUI);
      return true;
    }catch{ return false; }
  }
  function releaseWakeLock(){ try{ wakeLockObj?.release?.(); }catch{} wakeLockObj=null; }
  async function setWakeDesired(on){
    WJ(K_WL, !!on);
    if (on) await requestWakeLock(); else releaseWakeLock();
    updateWakeUI();
  }
  function updateWakeUI(){
    const on = !!wakeLockObj;
    const lbl = $('#qk_wl_status'); if (lbl) lbl.textContent = 'Status: ' + (on ? 'på (native)' : 'av');
    const dot = $('#qk_wl_dot') || $('#wl_dot');
    if (dot){
      dot.classList.toggle('dot-on',  on);
      dot.classList.toggle('dot-off', !on);
    }
  }
  function wireWakeLock(){
    const btn = $('#qk_wl');
    btn?.addEventListener('click', async ()=>{
      const on = !!wakeLockObj;
      await setWakeDesired(!on);
    });
    // Respekter tidligere ønske
    if (RJ(K_WL, false)) requestWakeLock().then(updateWakeUI);
    updateWakeUI();
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState==='visible' && RJ(K_WL,false) && !wakeLockObj){
        requestWakeLock().then(updateWakeUI);
      }
    });
  }

  /* ---------- Synk-badge ---------- */
  function setSyncBadge(state, whenText=''){
    const badge = $('#sync_badge'); if (!badge) return;
    const dot = $('#sync_dot') || badge.querySelector('.dot');
    const text = (state==='ok') ? 'Synk: OK' : (state==='error'?'Synk: feil':'Synk: ukjent');
    badge.textContent = ' ' + text + (whenText ? ' • ' + whenText : '');
    if (dot){ dot.className = 'dot ' + (state==='ok' ? 'dot-ok' : state==='error' ? 'dot-err' : 'dot-unknown'); badge.prepend(dot); }
  }
  function refreshSyncBadge(){
  try{
    if (!window.Sync) { setSyncBadge('unknown'); return; }
    const cfg   = window.Sync.getConfig?.() || {};
    const cache = window.Sync.getCache?.() || {};

    if (!cfg.binId || !cfg.apiKey) { setSyncBadge('unknown'); return; }

    // «OK» når vi har adresser i cachen
    const ok = Array.isArray(cache.addresses) && cache.addresses.length>0;

    // tidspunkt = sist vellykket write ELLER sist fetch
    const ts = cache._lastWriteAt || cache._fetchedAt ||
               Number(localStorage.getItem('BRYT_LAST_SYNC') || '') || null;

    const when = ts ? new Date(ts).toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit' }) : '';
    setSyncBadge(ok ? 'ok' : 'unknown', when);
  }catch{
    setSyncBadge('unknown');
  }
}
  function wireSyncBadge(){
    refreshSyncBadge();
    if (window.Sync?.on){
      window.Sync.on('change', refreshSyncBadge);
      window.Sync.on('synced', refreshSyncBadge); // <- nytt
      window.Sync.on('error',  ()=>setSyncBadge('error'));
    }
    setInterval(refreshSyncBadge, 15000);
  }

  /* ---------- Boot ---------- */
  function boot(){
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    wireDrawer();
    wireTheme();
    wireWakeLock();
    wireSyncBadge();
  }
  document.addEventListener('DOMContentLoaded', boot);

  window.App = { show: showSection, refreshSyncBadge, setTheme: applyTheme };
})();