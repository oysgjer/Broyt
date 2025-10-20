// del-d.js — base wiring (drawer, routing, wake lock, quick actions, sync badge)

/* ---------- Små helpers ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

/* ---------- Drawer ---------- */
const drawer = $('#drawer');
const scrim  = $('#scrim');

function openDrawer(){
  drawer?.classList.add('open');
  scrim?.classList.add('show');
  drawer?.setAttribute('aria-hidden','false');
}
function closeDrawer(){
  drawer?.classList.remove('open');
  scrim?.classList.remove('show');
  drawer?.setAttribute('aria-hidden','true');
}

// Toggle på hamburger-ikonet
$('#btnMenu')?.addEventListener('click', ()=>{
  if (drawer?.classList.contains('open')) closeDrawer();
  else openDrawer();
});
$('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);

// Navigasjon fra menyen
$$('#drawer .drawer-link[data-go]').forEach(a=>{
  a.addEventListener('click', ()=>{
    showPage(a.getAttribute('data-go'));
    closeDrawer();
  });
});

/* ---------- Routing ---------- */
function showPage(id){
  $$('main section').forEach(s=>{
    if(s.id===id){ s.hidden=false; }
    else { s.hidden=true; }
  });
  location.hash = '#'+id;
}
// Gjør funksjonen tilgjengelig for andre filer (Home.js/Work.js osv.)
window.showPage = showPage;

window.addEventListener('hashchange', ()=>{
  const id=(location.hash||'#home').replace('#','');
  showPage($('#'+id)?id:'home');
});
// init
showPage((location.hash||'#home').replace('#','') || 'home');

/* ---------- Synk-indikator (placeholder som viser "OK") ---------- */
(function mockSync(){
  const badge=$('#sync_badge'); if(!badge) return;
  setTimeout(()=>{
    badge.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`;
  }, 500);
})();

/* ---------- Quick actions (Grus/Diesel/Base) ---------- */
function mapsUrlFromLatLon(latlon){
  if(!latlon) return 'https://www.google.com/maps';
  const q=String(latlon).replace(/\s+/g,'');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
function openDest(which){
  // Leser demo-innstillinger fra localStorage (Admin-siden lagrer disse)
  const st = JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}');
  const latlon = which==='grus' ? st.grus : which==='diesel' ? st.diesel : st.base;
  const url = mapsUrlFromLatLon(latlon||'');
  window.open(url,'_blank');
}
$('#qk_grus')  ?.addEventListener('click', ()=>openDest('grus'));
$('#qk_diesel')?.addEventListener('click', ()=>openDest('diesel'));
$('#qk_base')  ?.addEventListener('click', ()=>openDest('base'));

/* ---------- Hold skjerm våken ---------- */
/*
  For å fungere på iOS må aktivering skje etter et ekte brukerklikk.
  Vi bruker:
   - navigator.wakeLock (Chrome/Android, noen desktop)
   - iOS-fallback: usynlig, lydløs, loopende video
*/
let wakeLock = null;
let iosVideo  = null;

const wlDot    = $('#qk_wl_dot') || $('#wl_dot');
const wlStatus = $('#qk_wl_status');
const wlBtn    = $('#qk_wl');  // knappen i menyen

function setWakeUI(on, note){
  if (wlDot){
    wlDot.classList.remove('dot-on','dot-off');
    wlDot.classList.add(on ? 'dot-on' : 'dot-off');
  }
  if (wlStatus){
    wlStatus.textContent = note || (on ? 'Status: på' : 'Status: av');
  }
}

async function requestNativeWakeLock(){
  if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) return null;
  try{
    const lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', ()=>{
      console.log('[WakeLock] Release event');
      setWakeUI(false,'Status: av');
      wakeLock = null;
    });
    console.log('[WakeLock] Native aktivert');
    return lock;
  }catch(err){
    console.warn('[WakeLock] Native feilet:', err?.message || err);
    return null;
  }
}

async function enableIosFallback(){
  try{
    if (!iosVideo){
      iosVideo = document.createElement('video');
      iosVideo.id = 'wlHiddenVideo';
      iosVideo.loop = true; iosVideo.muted = true; iosVideo.playsInline = true;
      iosVideo.style.display = 'none';
      iosVideo.src =
        'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
      document.body.appendChild(iosVideo);
    }
    await iosVideo.play(); // må trigges av brukerklikk
    console.log('[WakeLock] iOS fallback aktiv');
    return true;
  }catch(err){
    console.warn('[WakeLock] iOS fallback feilet:', err?.message || err);
    return false;
  }
}

async function toggleWakeLock(){
  try{
    // Hvis noe er aktivt -> slå av
    if (wakeLock && wakeLock.active){
      await wakeLock.release();
      wakeLock = null;
      setWakeUI(false,'Status: av');
      return;
    }
    if (iosVideo && !iosVideo.paused){
      try{ iosVideo.pause(); }catch{}
      setWakeUI(false,'Status: av');
      return;
    }

    // Prøv native først
    const native = await requestNativeWakeLock();
    if (native){
      wakeLock = native;
      setWakeUI(true,'Status: på (native)');
      return;
    }

    // iOS fallback
    const ok = await enableIosFallback();
    setWakeUI(!!ok, ok ? 'Status: på (iOS-fallback)' : 'Status: feil');
  }catch(e){
    console.error('[WakeLock] Uventet feil:', e);
    setWakeUI(false,'Status: feil');
  }
}

// Koble knapp (viktig: må kalles etter ekte klikk)
if (wlBtn){
  wlBtn.addEventListener('click', toggleWakeLock);
  // init-tekst
  setWakeUI(false,'Status: av');
}

/* ---------- Eksporter alt vi trenger fra denne "del-d" ---------- */
window.toggleWakeLock = toggleWakeLock;
window.openDest       = openDest;