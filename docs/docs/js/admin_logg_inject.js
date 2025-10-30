// admin_logg_inject.js — injiser "Logg (A4)"-knapp i Admin hvis den mangler
(function(){
  function addLoggButton(){
    const admin = document.querySelector('#admin');
    if (!admin || admin.querySelector('#adm_open_logg')) return;

    // Plasser rett under "Adresse-register"-knapperaden
    const addrRow = admin.querySelector('h2:nth-of-type(2) + .row');
    const frag = document.createRange().createContextualFragment(`
      <h2>Rapporter</h2>
      <div class="row" style="flex-wrap:wrap">
        <button id="adm_open_logg" class="btn">🧾 Åpne Logg (A4)</button>
        <span class="badge">Les &amp; skriv ut</span>
      </div>
    `);

    (addrRow?.parentNode || admin).insertBefore(frag, addrRow?.nextSibling || null);

    admin.addEventListener('click', (e)=>{
      if (e.target && e.target.id === 'adm_open_logg') {
        location.href = './logg.html';
      }
    }, { once:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLoggButton);
  } else {
    addLoggButton();
  }
})();
