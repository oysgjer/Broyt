/* ---------------------------------------------------------
   del-d.js — meny, drawer, wake-lock og snarveier
--------------------------------------------------------- */
(function(){
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  /* Drawer */
  const drawer=$('#drawer'), scrim=$('#scrim');
  const openDrawer = () => { drawer?.classList.add('open'); scrim?.classList.add('show'); };
  const closeDrawer= () => { drawer?.classList.remove('open'); scrim?.classList.remove('show'); };
  $('#btnMenu')?.addEventListener('click', ()=>drawer?.classList.contains('open')?closeDrawer():openDrawer());
  $('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
  $('#scrim')?.addEventListener('click', closeDrawer);
  $$('#drawer .drawer-link[data-go]').forEach(a=>a.addEventListener('click',()=>{ showPage(a.getAttribute('data-go')); closeDrawer(); }));

  /* Routing */
  window.showPage = function(id){
    Array.from(document.querySelectorAll('main section')).forEach(s=>{
      if(s.id===id) s.hidden=false; else s.hidden=true;
    });
    location.hash='#'+id;
  }
  window.addEventListener('hashchange', ()=> {
    const id=(location.hash||'#home').replace('#','');
    showPage(document.getElementById(id)?id:'home');
  });
  showPage((location.hash||'#home').replace('#','') || 'home');

  /* WakeLock */
  const wlDot = $('#qk_wl_dot') || $('#wl_dot');
  const wlStatus = $('#qk_wl_status');
  let wakeLock=null;
  async function toggleWakeLock(){
    try{
      if(wakeLock && wakeLock.active){ await wakeLock.release(); wakeLock=null; wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off'); wlStatus && (wlStatus.textContent='Status: av'); return; }
      if('wakeLock' in navigator && navigator.wakeLock?.request){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release',()=>{ wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off'); wlStatus && (wlStatus.textContent='Status: av'); });
        wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on'); wlStatus && (wlStatus.textContent='Status: på (native)'); return;
      }
      // iOS fallback – stille video
      let v=document.querySelector('#wlHiddenVideo');
      if(!v){ v=document.createElement('video'); v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
        v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
        document.body.appendChild(v);
      }
      await v.play(); wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on'); wlStatus && (wlStatus.textContent='Status: på (iOS-fallback)');
    }catch(e){ wlStatus && (wlStatus.textContent='Status: feil'); }
  }
  $('#qk_wl')?.addEventListener('click', toggleWakeLock);

  /* Snarveier → Google Maps med robust parsing av lat/lon */
  function parseLatLon(str){
    if(!str) return null;
    const s=String(str).trim().replace(/[;|]/g, ',').replace(/\s+/g,'');
    const m=s.match(/^([-+]?\d+(\.\d+)?),([-+]?\d+(\.\d+)?)$/);
    if(!m) return null;
    return { lat: Number(m[1]), lon: Number(m[3]) };
  }
  function destFromSettings(which){
    const st = (window.loadSettings ? loadSettings() : {});
    const raw = which==='grus' ? st.grus : which==='diesel' ? st.diesel : st.base;
    return parseLatLon(raw);
  }
  function openDest(which){
    const p = destFromSettings(which);
    const url = p
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.lat+','+p.lon)}`
      : 'https://www.google.com/maps';
    if(!p) alert('Mangler koordinater – legg inn i Admin.');
    window.open(url,'_blank');
  }
  $('#qk_grus')  ?.addEventListener('click', ()=>openDest('grus'));
  $('#qk_diesel')?.addEventListener('click', ()=>openDest('diesel'));
  $('#qk_base')  ?.addEventListener('click', ()=>openDest('base'));

})();