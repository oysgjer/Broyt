// js/menu-augment.js — adds Diesel/Grus/Base + navigates using BRYT_SETTINGS.navShortcuts
(function(){
  'use strict';

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  function settings(){ return RJ('BRYT_SETTINGS', {}); }

  function mapsUrlFromShortcut(sc){
    if (!sc) return 'https://www.google.com/maps';
    // Prefer lat/lon if both present
    if (typeof sc.lat === 'number' && typeof sc.lon === 'number'){
      const q = `${sc.lat},${sc.lon}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    // Fallback to query string
    const q = (sc.query || sc.name || '').trim();
    if (q) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    return 'https://www.google.com/maps';
  }

  function ensureMenu(){
    document.querySelectorAll('.drawer-list').forEach(ul=>{
      // Make sure Admin link points to a real page
      const adminItem = Array.from(ul.querySelectorAll('a')).find(a=>/admin/i.test(a.textContent||''));
      if (adminItem && !/admin\.html(\b|$)/.test(adminItem.getAttribute('href')||'')){
        adminItem.setAttribute('href','admin.html');
      }
      // Replace wood emoji for grus with rock
      Array.from(ul.querySelectorAll('a')).forEach(a=>{
        if ((a.textContent||'').includes('Grus')){
          a.textContent = (a.textContent||'').replace('🪵','🪨').replace(/^\s*/,'').replace(/^/, '🪨 ');
        }
      });
      function addShortcut(name, label, emoji){
        // Skip if already present
        const exists = Array.from(ul.querySelectorAll('a')).some(a=> a.dataset && a.dataset.shortcut === name);
        if (exists) return;
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.href = 'index.html#work';
        a.dataset.shortcut = name;
        a.textContent = `${emoji} ${label}`;
        li.appendChild(a);
        ul.appendChild(li);
      }
      addShortcut('diesel', 'Diesel', '⛽');
      addShortcut('grus',   'Grus',   '🪨');
      addShortcut('base',   'Base',   '🏠');
    });
  }

  function wireShortcuts(){
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('a[data-shortcut]');
      if (!a) return;
      const key = a.dataset.shortcut;
      const cfg = (settings().navShortcuts || {});
      const sc  = cfg[key];
      // Always set for Work-screen hint (optional)
      sessionStorage.setItem('BRYT_MENU_SHORTCUT', key);
      // Navigate out to Google Maps directly with destination
      const url = mapsUrlFromShortcut(sc);
      // Prefer same-tab navigation to avoid hidden-tab throttling in PWA
      location.href = url;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    try{ ensureMenu(); wireShortcuts(); }catch(e){ console.warn('menu-augment:', e); }
  });
})();
