
(function(){
  'use strict';
  const drawer = ()=>document.getElementById('drawer');
  const overlay= ()=>document.getElementById('drawer_overlay');
  function openMenu(){ drawer()?.classList.add('open'); overlay()?.classList.add('show'); }
  function closeMenu(){ drawer()?.classList.remove('open'); overlay()?.classList.remove('show'); }
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('hdr_menu')?.addEventListener('click', (e)=>{ e.stopPropagation(); openMenu(); });
    overlay()?.addEventListener('click', closeMenu);
    // Close drawer when navigating via A tags
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('a');
      if (!a) return;
      if (a.closest('#drawer')) closeMenu();
    }, true);
  });
})();
