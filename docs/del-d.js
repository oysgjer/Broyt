// Minimal app-logikk for UTSEENDE + MENY/NAVIGASJON
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

/* ---------- Drawer wiring ---------- */
const drawer=$('#drawer'), scrim=$('#scrim');
const openDrawer = () => { drawer?.classList.add('open'); scrim?.classList.add('show'); drawer?.setAttribute('aria-hidden','false'); };
const closeDrawer= () => { drawer?.classList.remove('open'); scrim?.classList.remove('show'); drawer?.setAttribute('aria-hidden','true'); };

$('#btnMenu')?.addEventListener('click', () => {
  if (drawer?.classList.contains('open')) {
    closeDrawer();
  } else {
    openDrawer();
  }
});
$('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
$('#scrim')?.addEventListener('click', closeDrawer);

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
window.addEventListener('hashchange', ()=>{
  const id=(location.hash||'#home').replace('#','');
  showPage($('#'+id)?id:'home');
});
showPage((location.hash||'#home').replace('#','') || 'home');

/* ---------- Wake Lock ---------- */
const wlDot = $('#qk_wl_dot') || $('#wl_dot');
const wlStatus = $('#qk_wl_status');
let wakeLock = null;

async function toggleWakeLock(){
  try{
    // Slå av hvis aktiv
    if(wakeLock && wakeLock.active){
      await wakeLock.release(); wakeLock=null;
      wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
      wlStatus && (wlStatus.textContent='Status: av');
      return;
    }
    // Native
    if('wakeLock' in navigator && navigator.wakeLock?.request){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', ()=>{
        wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
        wlStatus && (wlStatus.textContent='Status: av');
      });
      wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
      wlStatus && (wlStatus.textContent='Status: på (native)');
      return;
    }
    // iOS-fallback – lydløs video
    let v=document.querySelector('#wlHiddenVideo');
    if(!v){
      v=document.createElement('video');
      v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
      v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
      document.body.appendChild(v);
    }
    await v.play();
    wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
    wlStatus && (wlStatus.textContent='Status: på (iOS-fallback)');
  }catch(e){
    wlStatus && (wlStatus.textContent='Status: feil');
  }
}
$('#qk_wl')?.addEventListener('click', toggleWakeLock);

/* ---------- Quick actions (demo: les fra localStorage) ---------- */
function mapsUrlFromLatLon(latlon){
  if(!latlon) return 'https://www.google.com/maps';
  const q=String(latlon).replace(/\s+/g,'');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
function openDest(which){
  const st = JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}');
  const latlon = which==='grus' ? st.grus : which==='diesel' ? st.diesel : st.base;
  const url = mapsUrlFromLatLon(latlon||'');
  window.open(url,'_blank');
}
$('#qk_grus')  ?.addEventListener('click', ()=>openDest('grus'));
$('#qk_diesel')?.addEventListener('click', ()=>openDest('diesel'));
$('#qk_base')  ?.addEventListener('click', ()=>openDest('base'));

/* ---------- Admin lagre (demo til localStorage) ---------- */
$('#adm_save')?.addEventListener('click', ()=>{
  const st={
    grus:  $('#adm_grus')?.value.trim(),
    diesel:$('#adm_diesel')?.value.trim(),
    base:  $('#adm_base')?.value.trim()
  };
  localStorage.setItem('BRYT_SETTINGS', JSON.stringify(st));
  alert('Lagret (demo i nettleserens lagring)');
});

/* ---------- Synk-indikator (demo) ---------- */
(function mockSync(){
  const badge=$('#sync_badge'); if(!badge) return;
  // demo: sett til OK etter 800ms
  setTimeout(()=>{
    badge.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`;
  }, 800);
})();
