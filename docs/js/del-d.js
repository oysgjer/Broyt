// ===== Core helpers + app state (må lastes først) =====
(() => {
  // Korte query helpers (brukes av alle filer)
  window.$  = (s, root = document) => root.querySelector(s);
  window.$$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  // Globalt "S" – enkel app-state
  const S = window.S || {};
  S.mode = S.mode || 'skjær';         // valgt oppdragstype
  S.driver = S.driver || (localStorage.getItem('BRYT_DRIVER') || '');
  S.autonav = S.autonav ?? (localStorage.getItem('BRYT_AUTONAV') === '1');

  // Demo-adresser (enkle IDer og navn)
  S.addresses = S.addresses || [
    { id: 'a1', name: 'Tunlandvegen', task: 'Sand/Grus' },
    { id: 'a2', name: 'Sessvollvegen 9', task: 'Skjær' },
    { id: 'a3', name: 'Åsvegen 12', task: 'Skjær' },
    { id: 'a4', name: 'Gamleveien 3', task: 'Fres' }
  ];

  window.S = S;

  /* ---------- Drawer (hamburger) ---------- */
  const drawer   = $('#drawer');
  const scrim    = $('#scrim');
  const btnMenu  = $('#btnMenu');
  const btnClose = $('#btnCloseDrawer');

  const openDrawer = () => {
    drawer?.classList.add('open');
    scrim?.classList.add('show');
    drawer?.setAttribute('aria-hidden','false');
  };
  const closeDrawer = () => {
    drawer?.classList.remove('open');
    scrim?.classList.remove('show');
    drawer?.setAttribute('aria-hidden','true');
  };

  btnMenu?.addEventListener('click', () => {
    drawer?.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  btnClose?.addEventListener('click', closeDrawer);
  scrim?.addEventListener('click', closeDrawer);

  $$('#drawer .drawer-link[data-go]').forEach(a => {
    a.addEventListener('click', () => {
      showPage(a.getAttribute('data-go'));
      closeDrawer();
    });
  });

  /* ---------- Router ---------- */
  function showPage(id) {
    if (!id) id = 'home';
    $$('main section').forEach(sec => {
      sec.hidden = (sec.id !== id);
    });
    if (location.hash !== '#'+id) location.hash = '#'+id;
    document.dispatchEvent(new CustomEvent('page:shown', { detail: { id }}));
  }
  window.showPage = showPage;

  window.addEventListener('hashchange', () => {
    const id = (location.hash || '#home').slice(1) || 'home';
    showPage($('#'+id) ? id : 'home');
  });
  // startvisning
  requestAnimationFrame(() => showPage((location.hash || '#home').slice(1)));

  /* ---------- Wake Lock (meny) ---------- */
  const wlDot    = $('#qk_wl_dot') || $('#wl_dot');
  const wlStatus = $('#wl_badge')  || $('#qk_wl_status');
  let   wakeLock = null;

  async function toggleWakeLock() {
    try {
      if (wakeLock?.active) {
        await wakeLock.release();
        wakeLock = null;
        wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
        wlStatus && (wlStatus.textContent = 'Status: av');
        return;
      }
      if ('wakeLock' in navigator && navigator.wakeLock?.request) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
          wlStatus && (wlStatus.textContent = 'Status: av');
        });
        wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
        wlStatus && (wlStatus.textContent = 'Status: på (native)');
        return;
      }
      // iOS fallback – lydløs loop-video
      let v = document.querySelector('#wlHiddenVideo');
      if (!v) {
        v = document.createElement('video');
        v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
        // 1px mp4 stub
        v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
        document.body.appendChild(v);
      }
      await v.play();
      wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
      wlStatus && (wlStatus.textContent = 'Status: på (iOS-fallback)');
    } catch(e) {
      wlStatus && (wlStatus.textContent = 'Status: feil');
    }
  }
  $('#qk_wl')?.addEventListener('click', toggleWakeLock);

  /* ---------- Snarveier (åpner Maps) ---------- */
  function mapsUrlFromLatLon(latlon) {
    if (!latlon) return 'https://maps.google.com';
    const q = String(latlon).replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  function openDest(which) {
    try {
      const st = JSON.parse(localStorage.getItem('BRYT_SETTINGS') || '{}');
      const latlon = which === 'grus' ? st.grus : which === 'diesel' ? st.diesel : st.base;
      const url = mapsUrlFromLatLon(latlon || '');
      window.open(url, '_blank');
    } catch(e){}
  }
  $('#qk_grus')  ?.addEventListener('click', () => openDest('grus'));
  $('#qk_diesel')?.addEventListener('click', () => openDest('diesel'));
  $('#qk_base')  ?.addEventListener('click', () => openDest('base'));

  /* ---------- Sky/lokal status (enkel) ---------- */
  // Lagrer status per adresse-id: { state: 'none'|'start'|'done'|'skip'|'blocked', driver: 'navn', ts: number }
  function statusStore() {
    const raw = localStorage.getItem('BRYT_STATUS');
    return raw ? JSON.parse(raw) : {};
  }
  function statusStoreWrite(bag) {
    localStorage.setItem('BRYT_STATUS', JSON.stringify(bag));
  }
  window.statusStore = statusStore;
  window.statusStoreWrite = statusStoreWrite;

  // Demo "cloud": no-op med kort delay – men behold navnet, andre filer kaller den
  async function refreshCloud() {
    await new Promise(r => setTimeout(r, 150));
    return true;
  }
  window.refreshCloud = refreshCloud;

  // Sikrer at demo-adresser finnes (her bare returnerer vi S.addresses)
  async function ensureAddressesSeeded() {
    if (!Array.isArray(S.addresses) || S.addresses.length === 0) {
      S.addresses = [{ id: 'x1', name: 'Demo-vei 1', task: 'Skjær' }];
    }
    return S.addresses;
  }
  window.ensureAddressesSeeded = ensureAddressesSeeded;

  // Enkel synk-indikator -> OK etter 0.5s
  const badge = $('#sync_badge');
  if (badge) {
    setTimeout(() => { badge.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`; }, 500);
  }
})();