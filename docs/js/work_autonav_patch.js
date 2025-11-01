// work_autonav_patch.js — gjør at "Ferdig" = "Ferdig + Naviger" når Auto-naviger er på
(function(){
  function isAutoNavOn(){ return localStorage.getItem('AUTO_NAV') === '1'; }

  function mapsUrlFor(dest){
    const q = encodeURIComponent(dest);
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      return `comgooglemaps://?daddr=${q}&directionsmode=driving&zoom=14`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving&dir_action=navigate`;
  }

  function openNavAndRemember(dest){
    if (!dest) return;
    sessionStorage.setItem('returnTo', location.origin + location.pathname + '#work');
    const url = mapsUrlFor(dest);

    if (url.startsWith('comgooglemaps://')) {
      // iOS: prøv app først, fall tilbake til web
      location.href = url;
      setTimeout(()=>{
        const web = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving&dir_action=navigate`;
        location.href = web;
      }, 800);
    } else {
      // Android / desktop: åpne i ny fane
      window.open(url, '_blank');
    }
  }

  // Når sjåføren kommer tilbake fra Maps → tilbake til #work og refreshe
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible'){
      const ret = sessionStorage.getItem('returnTo');
      if (ret){
        sessionStorage.removeItem('returnTo');
        if (location.hash.toLowerCase() !== '#work') location.hash = '#work';
        else {
          try{ if (typeof window.workRefresh === 'function') window.workRefresh(); }catch{}
        }
      }
    }
  });

  function bindDoneAutoNav(){
    const btn = document.getElementById('act_done');
    if (!btn || btn.dataset.autonavBound) return;
    btn.dataset.autonavBound = '1';

    btn.addEventListener('click', ()=>{
      // La din eksisterende "Ferdig"-logikk kjøre først (logging/reservasjon/hopp til neste)
      // … og så, litt etter, naviger automatisk hvis aktivert
      setTimeout(()=>{
        if (!isAutoNavOn()) return;
        const nextAddr = (document.getElementById('b_next')?.textContent || '').trim();
        if (nextAddr) openNavAndRemember(nextAddr);
      }, 250);
    });
  }

  function init(){
    bindDoneAutoNav();
    // Hvis DOM-en endres dynamisk
    const mo = new MutationObserver(bindDoneAutoNav);
    mo.observe(document.body, {subtree:true, childList:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();