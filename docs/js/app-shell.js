// Drawer + client navigation
(function(){
  const $ = s=>document.querySelector(s);
  function show(id){
    ['home','work','service','status','admin'].forEach(x=>{
      const el = document.getElementById(x);
      if (el) el.hidden = (x!==id);
    });
  }
  document.addEventListener('click', (e)=>{
    const a = e.target.closest('[data-go]');
    if (!a) return;
    e.preventDefault();
    const id = a.getAttribute('data-go');
    show(id);
    history.replaceState(null,'','#'+id);
    closeDrawer();
  });
  function openDrawer(){ document.getElementById('drawer')?.classList.add('open'); document.getElementById('scrim')?.classList.add('show'); }
  function closeDrawer(){ document.getElementById('drawer')?.classList.remove('open'); document.getElementById('scrim')?.classList.remove('show'); }
  document.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'btnOpenDrawer') openDrawer();
    if (e.target && (e.target.id === 'btnCloseDrawer' || e.target.id === 'scrim')) closeDrawer();
  });
  // init from hash
  window.addEventListener('DOMContentLoaded', ()=>{
    const h = location.hash.replace('#','') || 'work';
    show(h);
  });
})();
