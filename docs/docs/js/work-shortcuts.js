// js/work-shortcuts.js
(function(){
  'use strict';
  function onWork(){ return !!document.querySelector('#work') || !!document.querySelector('#act_start'); }
  function applyShortcut(){
    const key='BRYT_MENU_SHORTCUT';
    const s = sessionStorage.getItem(key);
    if (!s) return;
    sessionStorage.removeItem(key);
    const map={diesel:'Diesel',grus:'Grus',base:'Base'};
    try{ alert('Snarvei: ' + (map[s]||s)); }catch{}
  }
  document.addEventListener('DOMContentLoaded', ()=>{ if(onWork()) applyShortcut(); });
})();
