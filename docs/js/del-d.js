/* =========================================================
   del-d.js
   Baselogikk: meny, routing, wake lock, snarveier
   - Robust mot duplikate definisjoner
   - Solid drawer (ingen transparens, riktig scrim/klikking)
   - Wake Lock med grønn/rød prikk
   - Snarveier (grus/diesel/base) fra localStorage (Admin)
   ========================================================= */

/* ---------- Små hjelpefunksjoner (definer kun hvis mangler) ---------- */
(function(){
  if(!window.$)   window.$   = (s,root=document)=>root.querySelector(s);
  if(!window.$$)  window.$$  = (s,root=document)=>Array.from(root.querySelectorAll(s));
})();

/* ---------- Drawer (hamburger-meny) ---------- */
(function(){
  const drawer = $('#drawer');
  const scrim  = $('#scrim');
  const btn    = $('#btnMenu');
  const btnX   = $('#btnCloseDrawer');

  function openDrawer(){
    if(!drawer || !scrim) return;
    drawer.classList.add('open');
    scrim.classList.add('show');
    drawer.setAttribute('aria-hidden','false');
  }
  function closeDrawer(){
    if(!drawer || !scrim) return;
    drawer.classList.remove('open');
    scrim.classList.remove('show');
    drawer.setAttribute('aria-hidden','true');
  }

  // Toggle på hamburger-ikon
  btn && btn.addEventListener('click', ()=>{
    if(drawer?.classList.contains('open')) closeDrawer();
    else openDrawer();
  });
  // Lukkeknapp + klikk på scrim
  btnX   && btnX.addEventListener('click', closeDrawer);
  scrim  && scrim.addEventListener('click', closeDrawer);

  // Klikk på menylenker – naviger og lukk
  $$('#drawer .drawer-link[data-go]').forEach(a=>{
    a.addEventListener('click', ()=>{
      const target = a.getAttribute('data-go');
      if(target) showPage(target);
      closeDrawer();
    });
  });

  // Eksponer dersom andre filer vil bruke det
  window.openDrawer  = openDrawer;
  window.closeDrawer = closeDrawer;
})();

/* ---------- Routing mellom seksjoner ---------- */
(function(){
  function showPage(id){
    // Skjul alt, vis valgt
    $$('main section').forEach(s=>{
      s.hidden = (s.id !== id);
    });
    // Oppdater hash
    if(id && location.hash !== '#'+id){
      history.replaceState(null,'','#'+id);
    }
  }
  // Init – gå til hash eller 'home'
  const initial = (location.hash||'#home').replace('#','') || 'home';
  showPage($('#'+initial)? initial : 'home');

  // Endringer på hash (tilfeller der man skriver manuelt i url)
  window.addEventListener('hashchange', ()=>{
    const id=(location.hash||'#home').replace('#','');
    showPage($('#'+id)? id : 'home');
  });

  // Eksponer for andre moduler
  window.showPage = showPage;
})();

/* ---------- Wake Lock (grønn/rød prikk) ---------- */
(function(){
  const dot    = $('#wl_dot') || $('#qk_wl_dot');   // støtt begge id-er
  const status = $('#wl_status') || $('#qk_wl_status');
  let wakeLock = null;

  function setDot(on){
    if(!dot) return;
    dot.classList.toggle('dot-on',  !!on);
    dot.classList.toggle('dot-off', !on);
  }
  // init
  setDot(false);
  if(status) status.textContent = 'Status: av';

  async function toggleWakeLock(){
    try{
      // Slå av hvis aktiv
      if(wakeLock && wakeLock.active){
        await wakeLock.release();
        wakeLock = null;
        setDot(false);
        if(status) status.textContent = 'Status: av';
        return;
      }
      // Native API (Chrome/Android m.fl.)
      if('wakeLock' in navigator && navigator.wakeLock?.request){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', ()=>{
          setDot(false);
          if(status) status.textContent = 'Status: av';
        });
        setDot(true);
        if(status) status.textContent = 'Status: på (native)';
        return;
      }
      // iOS/PWA fallback: lydløs loop-video
      let v = document.querySelector('#wlHiddenVideo');
      if(!v){
        v = document.createElement('video');
        v.id='wlHiddenVideo';
        v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
        v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
        document.body.appendChild(v);
      }
      await v.play(); // må trigges av faktisk trykk
      setDot(true);
      if(status) status.textContent = 'Status: på (iOS-fallback)';
    }catch(e){
      setDot(false);
      if(status) status.textContent = 'Status: feil';
    }
  }

  // Koble til knapp i menyen hvis den finnes
  $('#qk_wl') && $('#qk_wl').addEventListener('click', toggleWakeLock);

  // Eksponer hvis andre skjermer skal styre WL
  window.toggleWakeLock = toggleWakeLock;
})();

/* ---------- Snarveier (grus / diesel / base) ---------- */
(function(){
  function mapsUrlFromLatLon(latlon){
    if(!latlon) return 'https://www.google.com/maps';
    const q = String(latlon).replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  function openDest(which){
    try{
      const st = JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}');
      const latlon = which==='grus' ? st.grus
                    : which==='diesel' ? st.diesel
                    : which==='base' ? st.base
                    : '';
      const url = mapsUrlFromLatLon(latlon||'');
      window.open(url,'_blank');
    }catch(e){
      alert('Kunne ikke åpne destinasjon.');
    }
  }
  $('#qk_grus')   && $('#qk_grus').addEventListener('click', ()=>openDest('grus'));
  $('#qk_diesel') && $('#qk_diesel').addEventListener('click',()=>openDest('diesel'));
  $('#qk_base')   && $('#qk_base').addEventListener('click',  ()=>openDest('base'));

  // Eksponer (kan være nyttig i andre moduler)
  window.openDepot = openDest;
})();

/* ---------- Synk-indikator (enkel, kan erstattes av JSONBin) ---------- */
(function(){
  const badge = $('#sync_badge');
  function setSync(state){
    if(!badge) return;
    // state: 'ok' | 'local' | 'unknown' | 'error'
    const dotClass = state==='ok' ? 'dot-ok'
                   : state==='local' ? 'dot-warn'
                   : state==='error' ? 'dot-err'
                   : 'dot-unknown';
    const txt = state==='ok' ? 'Synk: OK'
              : state==='local' ? 'Synk: lokal'
              : state==='error' ? 'Synk: feil'
              : 'Synk: ukjent';
    badge.innerHTML = `<span class="dot ${dotClass}"></span> ${txt}`;
  }
  // Sett «OK» etter en liten stund slik at UI ser levende ut.
  setTimeout(()=>setSync('ok'), 600);

  // Eksponer slik at Work/Admin kan oppdatere ved ekte kall
  window.setSyncBadge = setSync;
})();

/* ---------- Liten init for å være sikker ---------- */
(function(){
  // Sørg for at kun én seksjon er synlig når DOM er klar
  document.addEventListener('DOMContentLoaded', ()=>{
    const current = (location.hash||'#home').replace('#','') || 'home';
    if($('#'+current)) window.showPage(current); else window.showPage('home');
  });
})();