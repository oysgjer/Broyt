/* ====== del-d.js — App-skjelett: meny, ruter, wake lock, synk-badge ====== */
(function(){
  const qs  = (s,root=document)=>root.querySelector(s);
  const qsa = (s,root=document)=>Array.from(root.querySelectorAll(s));

  /* ---------- Drawer ---------- */
  const drawer = qs('#drawer');
  const scrim  = qs('#scrim');

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

  qs('#btnMenu')?.addEventListener('click', ()=>{
    if(drawer?.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  qs('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
  scrim?.addEventListener('click', closeDrawer);

  qsa('#drawer .drawer-link[data-go]').forEach(a=>{
    a.addEventListener('click', ()=>{
      showPage(a.getAttribute('data-go'));
      closeDrawer();
    });
  });

  /* ---------- Routing ---------- */
  function showPage(id){
    qsa('main section').forEach(s=>{
      s.hidden = (s.id!==id);
    });
    location.hash = '#'+id;
  }
  window.addEventListener('hashchange', ()=>{
    const id = (location.hash||'#home').replace('#','');
    showPage(qs('#'+id)?id:'home');
  });
  window.showPage = showPage;

  // start på hash eller home
  showPage((location.hash||'#home').replace('#','') || 'home');

  /* ---------- Wake Lock (meny-kort) ---------- */
  const wlDot = qs('#wl_dot');
  const wlStatus = qs('#wl_status');
  let wake = null;

  async function toggleWake(){
    try{
      if(wake && wake.active){
        await wake.release(); wake=null;
        wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
        wlStatus && (wlStatus.textContent='Status: av');
        return;
      }
      if('wakeLock' in navigator && navigator.wakeLock?.request){
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', ()=>{
          wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
          wlStatus && (wlStatus.textContent='Status: av');
        });
        wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
        wlStatus && (wlStatus.textContent='Status: på (native)');
        return;
      }
      // iOS fallback (lydløs, skjult video)
      let v = qs('#wlHiddenVideo');
      if(!v){
        v=document.createElement('video');
        v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
        v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
        document.body.appendChild(v);
      }
      await v.play();
      wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
      wlStatus && (wlStatus.textContent='Status: på (iOS-fallback)');
    }catch{ wlStatus && (wlStatus.textContent='Status: feil'); }
  }
  qs('#qk_wl')?.addEventListener('click', toggleWake);

  /* ---------- Quick actions (les fra JSONBin settings hvis finnes, ellers localStorage) ---------- */
  function mapsUrl(latlon){
    if(!latlon) return 'https://www.google.com/maps';
    const q=String(latlon).replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  async function openDest(which){
    try{
      // forsøk JSONBin settings hvis global finnes, ellers localStorage demo
      const st = (window.BROYT && BROYT.cloud && BROYT.cloud.settings) || JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}');
      const latlon = which==='grus' ? (st.grusDepot||st.grus) : which==='diesel' ? st.diesel : (st.base||st.hq||st.basePos);
      window.open(mapsUrl(latlon||''),'_blank');
    }catch{ window.open('https://www.google.com/maps','_blank'); }
  }
  qs('#qk_grus')  ?.addEventListener('click', ()=>openDest('grus'));
  qs('#qk_diesel')?.addEventListener('click', ()=>openDest('diesel'));
  qs('#qk_base')  ?.addEventListener('click', ()=>openDest('base'));

  /* ---------- Synk-badge demo (settes til OK etter 800ms) ---------- */
  const syncBadge = qs('#sync_badge');
  if(syncBadge){
    setTimeout(()=>{ syncBadge.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`; }, 800);
  }
})();