// del-d.js — base/wiring (IKKE dupliser $ i andre filer)
const $  = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

/* ---------------- Global state (enkelt) ---------------- */
window.S = window.S || {
  driver: 'driver',
  dir: 'Normal',
  mode: 'snow',
  autoNav: false
};

/* ---------------- Drawer / scrim ---------------- */
const drawer = $('#drawer'), scrim = $('#scrim');

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

$('#btnMenu')?.addEventListener('click', () => {
  if (drawer?.classList.contains('open')) closeDrawer();
  else openDrawer();
});
$('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);

/* lukk alltid ved oppstart */
document.addEventListener('DOMContentLoaded', closeDrawer);

/* ---------------- Routing ---------------- */
window.showPage = function(id){
  $$('main section').forEach(s => s.hidden = (s.id !== id));
  location.hash = '#'+id;
  closeDrawer();
};
window.addEventListener('hashchange', ()=>{
  const id=(location.hash||'#home').replace('#','');
  showPage($('#'+id)?id:'home');
});
showPage((location.hash||'#home').replace('#','') || 'home');

/* ---------------- Synk-badge (dummy) ---------------- */
(function mockSync(){
  const el = $('#sync_badge'); if(!el) return;
  el.innerHTML = `<span class="dot dot-unknown"></span> Synk: ukjent`;
  setTimeout(()=>{ el.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`; }, 800);
})();

/* ---------------- Wake lock i meny ---------------- */
const wlDot = $('#wl_dot');
let wakeLock = null;
async function toggleWakeLock(){
  try{
    if (wakeLock && wakeLock.active){
      await wakeLock.release(); wakeLock = null;
      wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
      $('#wl_status') && ($('#wl_status').textContent = 'Status: av');
      return;
    }
    if ('wakeLock' in navigator && navigator.wakeLock?.request){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', ()=>{
        wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
        $('#wl_status') && ($('#wl_status').textContent = 'Status: av');
      });
      wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
      $('#wl_status') && ($('#wl_status').textContent = 'Status: på (native)');
      return;
    }
    let v = document.querySelector('#wlHiddenVideo');
    if(!v){
      v = document.createElement('video');
      v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
      v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
      document.body.appendChild(v);
    }
    await v.play();
    wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
    $('#wl_status') && ($('#wl_status').textContent = 'Status: på (iOS-fallback)');
  }catch(e){
    $('#wl_status') && ($('#wl_status').textContent = 'Status: feil');
  }
}
$('#qk_wl')?.addEventListener('click', toggleWakeLock);

/* ---------------- Eksporter evt. helpers ---------------- */
window.$ = $; window.$$ = $$;
window.closeDrawer = closeDrawer; // kan brukes av andre