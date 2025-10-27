// js/nav-shortcuts.js
(function(){
  'use strict';
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  function settings(){ return RJ('BRYT_SETTINGS', {}); }

  function mapsUrlFromShortcut(sc){
    if (!sc) return 'https://www.google.com/maps';
    if (typeof sc.lat === 'number' && typeof sc.lon === 'number'){
      const q = `${sc.lat},${sc.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    const q = (sc.query || sc.name || '').trim();
    if (q) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    return 'https://www.google.com/maps';
  }

  document.addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-shortcut]');
    if (!a) return;
    const key = a.dataset.shortcut; // 'diesel' | 'grus' | 'base'
    const sc  = (settings().navShortcuts || {})[key];
    const url = mapsUrlFromShortcut(sc);
    location.href = url;
    e.preventDefault();
    e.stopPropagation();
  }, true);
})();