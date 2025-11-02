// js/admin_logg_inject.js
// Legger inn "Åpne logg"-kort nederst i #admin, og passer på at det ikke forsvinner.

(function () {
  const BLOCK_ID = 'adm_logg_block';

  function isAdminActive() {
    const sec = document.querySelector('#admin');
    if (!sec) return false;
    // Aktiv hvis SPA viser admin (hidden fjernet) eller hash peker dit
    if (!sec.hasAttribute('hidden')) return true;
    return (location.hash || '').replace('#','').toLowerCase() === 'admin';
  }

  function createBlockHTML() {
    return `
      <section id="${BLOCK_ID}" class="card" style="margin-top:12px">
        <h2 style="margin:0 0 8px">Rapporter &amp; Logg</h2>
        <p class="muted" style="margin:0 0 8px">
          Åpner printvennlig logg med auto-fyll av adresser, S/G og tider.
        </p>
        <div class="row" style="flex-wrap:wrap; gap:8px">
          <a class="btn" href="./logg.html">🧾 Åpne Logg</a>
          <button class="btn-ghost" onclick="window.open('./logg.html','_blank')">Skriv ut / PDF</button>
          <span class="badge">Les &amp; skriv ut</span>
        </div>
      </section>
    `;
  }

  function ensureBlock() {
    if (!isAdminActive()) return;
    const admin = document.querySelector('#admin');
    if (!admin) return;

    // Sørg for at blokken ligger nederst i #admin
    if (!admin.querySelector('#' + BLOCK_ID)) {
      admin.insertAdjacentHTML('beforeend', createBlockHTML());
    }
  }

  // Kjør når hash endres (navigasjon), når siden blir aktiv igjen, og på intervall
  window.addEventListener('hashchange', ensureBlock);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureBlock(); });

  // Observér endringer i #admin (i tilfelle Admin.js re-renderer og fjerner blokken)
  const mo = new MutationObserver(() => ensureBlock());
  const startObserver = () => {
    const admin = document.querySelector('#admin');
    if (admin) mo.observe(admin, { childList: true, subtree: false });
  };

  // Init – vent til DOM er klar, så start observer og sett inn blokk
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { startObserver(); ensureBlock(); }, { once: true });
  } else {
    startObserver();
    ensureBlock();
  }
})();