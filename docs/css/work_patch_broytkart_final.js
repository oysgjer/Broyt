
// --- Patch: Fjern Kart-knapp, plasser Brøytekart nederst, riktig stil og ikon ---

// Fjern (nye) Kart-knappen fra DOM, om den finnes
try {
  const newMap = document.getElementById('act_map');
  newMap && newMap.parentElement && newMap.parentElement.remove();
} catch (_) {}

// Plasser Brøytekart nederst i samme grid + gi lik knappestil og ikon
try {
  const bk   = document.querySelector('#btnBroytKart, #btnMap');
  const grid = document.querySelector('#work .btn-grid');
  if (bk && grid) {
    // Sett riktig tekst/ikon
    bk.innerHTML = '🚜 Brøytekart';

    // Sørg for at knappen bruker samme base-klasse som de andre (for font, spacing osv.)
    bk.classList.add('btn');

    // Flytt eventuelt wrapperen hvis knappen er alene i sin div
    const nodeToMove = (bk.parentElement && bk.parentElement.childElementCount === 1)
      ? bk.parentElement : bk;

    // Rydd styles som kan gi overlapp
    bk.style.removeProperty('position');
    bk.style.width = '100%';
    bk.style.setProperty('display', 'block', 'important');

    // Legg helt nederst i grid (Uhell blir over)
    if (nodeToMove.parentElement !== grid) grid.appendChild(nodeToMove);
    else grid.appendChild(nodeToMove); // tving til slutten
  }
} catch (e) { console.warn('Brøytekart plassering/stil', e); }
