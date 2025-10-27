// Sikrer at meny og scrim alltid fungerer, uansett rekkefølge på andre skript
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);

  function openDrawer(){ $('#drawer')?.classList.add('open'); $('#scrim')?.classList.add('show'); }
  function closeDrawer(){ $('#drawer')?.classList.remove('open'); $('#scrim')?.classList.remove('show'); }

  function wireDrawer(){
    $('#btnMenu')?.addEventListener('click', openDrawer);
    $('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
    $('#scrim')?.addEventListener('click', closeDrawer);

    // linker inne i skuffen skal også lukke
    document.querySelectorAll('#drawer a.drawer-link').forEach(a=>{
      a.addEventListener('click', () => { closeDrawer(); });
    });
  }

  document.addEventListener('DOMContentLoaded', wireDrawer);
})();