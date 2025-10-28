// docs/js/work_uhell_fix.js
(function boot(){
  function ensureUhell(){
    const grid = document.querySelector('#work .btn-grid');
    if (!grid) return false;

    let u = document.getElementById('act_incident');
    if (!u) {
      u = document.createElement('button');
      u.id = 'act_incident';
      u.className = 'btn';
      u.addEventListener('click', () => {
        try { sessionStorage.setItem('SERVICE_PRESELECT', JSON.stringify({ type: 'incident' })); } catch(_){}
        location.hash = '#service';
      });
      const wrap = document.createElement('div');
      wrap.appendChild(u);
      grid.insertBefore(wrap, grid.lastElementChild || null);
    }
    u.innerHTML = '⚠️ Uhell';
    u.style.removeProperty('display');
    u.style.width = '100%';
    return true;
  }

  function ensureBroyt(){
    const grid = document.querySelector('#work .btn-grid');
    if (!grid) return false;

    document.getElementById('act_map')?.remove();

    let bk = document.querySelector('#btnBroytKart, #btnMap');
    if (!bk){
      bk = document.createElement('button');
      bk.id = 'btnBroytKart';
      bk.className = 'btn';
      bk.addEventListener('click', () => {
        const url = 'tools/kart.html'
          + '#addrBin=68ed425cae596e708f11d25f'
          + '&routeBin=68ed425cae596e708f11d25f'
          + '&field=geojsonRoutes';
        window.open(url, '_blank');
      });
      const wrap = document.createElement('div');
      wrap.appendChild(bk);
      grid.appendChild(wrap);
    }
    bk.innerHTML = '🚜 Brøytekart';
    bk.style.width = '100%';
    return true;
  }

  function run(){
    const active = location.hash === '#work' || document.querySelector('#work');
    if (!active) return;

    let ok1 = false, ok2 = false, tries = 0;
    const tick = setInterval(() => {
      ok1 = ok1 || ensureUhell();
      ok2 = ok2 || ensureBroyt();
      if ((ok1 && ok2) || (++tries > 30)) clearInterval(tick);
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#work') run();
  });
})();