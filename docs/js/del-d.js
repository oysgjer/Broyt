/* ========= del-d.js (ramme/meny/ruting/wake-lock) ========= */
(function () {
  /* Drawer */
  const drawer = $('#drawer'), scrim = $('#scrim');
  const openDrawer = () => { drawer?.classList.add('open'); scrim?.classList.add('show'); drawer?.setAttribute('aria-hidden','false'); };
  const closeDrawer = () => { drawer?.classList.remove('open'); scrim?.classList.remove('show'); drawer?.setAttribute('aria-hidden','true'); };

  on($('#btnMenu'), 'click', () => drawer?.classList.contains('open') ? closeDrawer() : openDrawer());
  on($('#btnCloseDrawer'), 'click', closeDrawer);
  on($('#scrim'), 'click', closeDrawer);

  $$('#drawer .drawer-link[data-go]').forEach(a => {
    a.addEventListener('click', () => { showPage(a.getAttribute('data-go')); closeDrawer(); });
  });

  /* Routing */
  function showPage(id) {
    $$('main section').forEach(s => s.hidden = s.id !== id);
    location.hash = '#' + id;
  }
  window.showPage = showPage;

  window.addEventListener('hashchange', () => {
    const id = (location.hash || '#home').replace('#', '');
    showPage($('#' + id) ? id : 'home');
  });
  showPage((location.hash || '#home').replace('#', '') || 'home');

  /* Wake Lock */
  let wakeLock = null;
  const wlDot = $('#qk_wl_dot') || $('#wl_dot');
  const wlStatus = $('#qk_wl_status');

  async function toggleWakeLock() {
    try {
      if (wakeLock && wakeLock.active) {
        await wakeLock.release(); wakeLock = null;
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
      // iOS fallback (lydløs video)
      let v = document.querySelector('#wlHiddenVideo');
      if (!v) {
        v = document.createElement('video');
        v.id = 'wlHiddenVideo'; v.loop = true; v.muted = true; v.playsInline = true; v.style.display = 'none';
        v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
        document.body.appendChild(v);
      }
      await v.play();
      wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
      wlStatus && (wlStatus.textContent = 'Status: på (iOS-fallback)');
    } catch (e) {
      console.error(e);
      wlStatus && (wlStatus.textContent = 'Status: feil');
    }
  }
  window.toggleWakeLock = toggleWakeLock;
  on($('#qk_wl'), 'click', toggleWakeLock);

  /* Snarveier (kart) */
  function mapsUrlFromLatLon(latlon) {
    if (!latlon) return 'https://www.google.com/maps';
    const q = String(latlon).replace(/\s+/g, '');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  function openDest(which) {
    const st = JSON.parse(localStorage.getItem('BRYT_SETTINGS') || '{}');
    const latlon = which === 'grus' ? st.grus : which === 'diesel' ? st.diesel : st.base;
    window.open(mapsUrlFromLatLon(latlon || ''), '_blank');
  }
  on($('#qk_grus'), 'click', () => openDest('grus'));
  on($('#qk_diesel'), 'click', () => openDest('diesel'));
  on($('#qk_base'), 'click', () => openDest('base'));

  /* Admin-demo – lagre koordinater */
  on($('#adm_save'), 'click', () => {
    const st = {
      grus:   $('#adm_grus')?.value.trim(),
      diesel: $('#adm_diesel')?.value.trim(),
      base:   $('#adm_base')?.value.trim()
    };
    localStorage.setItem('BRYT_SETTINGS', JSON.stringify(st));
    alert('Lagret (demo i nettleserens lagring)');
  });

  /* Synk-indikator (demo) */
  (function mockSync(){ const b = $('#sync_badge'); if (!b) return;
    setTimeout(()=>{ b.innerHTML = `<span class="dot dot-ok"></span> Synk: OK`; }, 400);
  })();
})();