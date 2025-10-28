// === Uhell visibility fix & safe removal of #act_map ===
// Drop this at the end of docs/js/Work.js or load after Work.js in index.html.

(function(){
  function ensureUhellVisible(){
    try{
      const inc = document.getElementById('act_incident');
      if (!inc) return;
      inc.style.removeProperty('display');
      inc.innerHTML = '⚠️ Uhell';
      const grid = document.querySelector('#work .btn-grid');
      if (grid && !grid.contains(inc)) {
        const wrap = document.createElement('div');
        wrap.appendChild(inc);
        grid.insertBefore(wrap, grid.lastElementChild); // above the last tool (e.g., Brøytekart)
      }
    }catch(e){ console.warn('ensureUhellVisible', e); }
  }

  function removeOnlyMapButton(){
    try{
      const mapBtn = document.getElementById('act_map');
      if (mapBtn) {
        mapBtn.remove(); // only remove the button itself
      }
    }catch(e){ console.warn('removeOnlyMapButton', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      removeOnlyMapButton();
      ensureUhellVisible();
    });
  } else {
    removeOnlyMapButton();
    ensureUhellVisible();
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#work') {
      removeOnlyMapButton();
      ensureUhellVisible();
    }
  });
})();
