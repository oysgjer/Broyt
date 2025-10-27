// js/menu-augment.js
(function(){
  'use strict';
  function ensureMenu(){
    document.querySelectorAll('.drawer-list').forEach(ul=>{
      const adminItem = Array.from(ul.querySelectorAll('a')).find(a=>/admin/i.test(a.textContent||''));
      if (adminItem && !/admin\.html(\b|$)/.test(adminItem.getAttribute('href')||'')){
        adminItem.setAttribute('href','admin.html');
      }
      Array.from(ul.querySelectorAll('a')).forEach(a=>{
        if ((a.textContent||'').includes('Grus')){
          a.textContent = (a.textContent||'').replace('🪵','🪨').replace(/^\s*/,'').replace(/^/, '🪨 ');
        }
      });
      function hasShortcut(name){
        return !!Array.from(ul.querySelectorAll('a')).find(a=> (a.dataset.shortcut===name));
      }
      function addShortcut(name, label, emoji){
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.href = 'index.html#work';
        a.dataset.shortcut = name;
        a.textContent = `${emoji} ${label}`;
        li.appendChild(a);
        ul.appendChild(li);
      }
      if (!hasShortcut('diesel')) addShortcut('diesel', 'Diesel', '⛽');
      if (!hasShortcut('grus'))   addShortcut('grus',   'Grus',   '🪨');
      if (!hasShortcut('base'))   addShortcut('base',   'Base',   '🏠');
    });
  }
  function wireShortcuts(){
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('a[data-shortcut]');
      if (!a) return;
      sessionStorage.setItem('BRYT_MENU_SHORTCUT', a.dataset.shortcut || '');
    }, true);
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    try{ ensureMenu(); wireShortcuts(); }catch(e){ console.warn('menu-augment:', e); }
  });
})();
