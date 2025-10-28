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

    // Fjern bare gamle "Kart"-knappen
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
      if ((ok1 && ok2) || (++tries > 30)) {
        clearInterval(tick);
        // Når begge finnes → plasser dem side om side
        pairUhellBroyt();
      }
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#work') run();
  });

// --- Flytt Uhell og Brøytekart ved siden av hverandre (50/50 layout)
function pairUhellBroyt(){
  const grid = document.querySelector('#work .btn-grid');
  const uWrap = document.getElementById('act_incident')?.closest('div');
  const bWrap = document.getElementById('btnBroytKart')?.closest('div');
  if (!grid || !uWrap || !bWrap) return;

  // Finn selve knappene
  const uBtn = uWrap.querySelector('button');
  const bBtn = bWrap.querySelector('button');
  if (!uBtn || !bBtn) return;

  // Fjern gamle wrappere fra grid
  if (uWrap.parentElement === grid) grid.removeChild(uWrap);
  if (bWrap.parentElement === grid) grid.removeChild(bWrap);

  // Lag ny rad for dem
  const row = document.createElement('div');
  row.className = 'btn-pair-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 1fr';
  row.style.gap = '12px';
  row.style.marginTop = '12px';
  row.style.marginBottom = '6px';

  // Legg knappene inn i raden
  row.appendChild(uBtn);
  row.appendChild(bBtn);

  // Legg raden nederst i grid
  grid.appendChild(row);

  // Sørg for felles stil
  [uBtn, bBtn].forEach(k => {
    k.style.width = '100%';
    k.style.display = 'block';
    k.style.minHeight = '60px';
    k.style.fontSize = '1.2rem';
    k.style.fontWeight = '600';
    k.style.borderRadius = '10px';
  });
}