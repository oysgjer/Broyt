
// --- Patch: ensure BroytKart button placement ---
try {
  const bk = document.querySelector('#btnBroytKart, #btnMap');
  if (bk) {
    const grid = document.querySelector('#work .btn-grid') || bk.parentElement;
    const wrap = bk.parentElement && bk.parentElement.childElementCount === 1 ? bk.parentElement : bk;
    grid.appendChild(wrap);
  }
} catch (e) { console.warn('place BroytKart', e); }
