// reports_spa_addon.js — Render Rapporter inside index.html to avoid 404
(function(){
  function ensureMenuLink(){
    const menu = document.querySelector('[data-include="partials/menu.html"], aside.drawer, .drawer-list') || document.body;
    // If menu HTML is already included, just rely on existing link. Otherwise, do nothing.
    // This addon is safe even if you already have the link.
  }
  function injectSection(){
    const main = document.querySelector('main.container') || document.querySelector('main') || document.body;
    if (document.getElementById('reports')) return; // already present
    const sec = document.createElement('section');
    sec.id = 'reports';
    sec.hidden = true;
    sec.innerHTML = `
      <h1>Rapporter</h1>
      <div class="card">
        <h2 style="margin:0 0 8px 0">Ny rapport</h2>
        <div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">
          <label class="field">Dato/klokkeslett
            <input id="r_date" type="datetime-local" class="input">
          </label>
          <label class="field">Sjåfør
            <input id="r_driver" type="text" class="input" placeholder="Navn">
          </label>
          <label class="field">Runde
            <input id="r_round" type="number" class="input" min="1" value="1" style="max-width:120px">
          </label>
          <label class="field">Oppgave
            <select id="r_task" class="input">
              <option>Brøyte</option>
              <option>Frese</option>
              <option>Strø</option>
              <option>Brøyte og strø</option>
              <option>Frese og strø</option>
            </select>
          </label>
          <label class="field" style="flex:1 1 100%;">Notat
            <input id="r_notes" type="text" class="input" placeholder="Kort beskrivelse…">
          </label>
          <button id="btnSaveReport" class="btn">💾 Lagre til JSONbin</button>
          <button id="btnPdfReport" class="btn-ghost">🧾 Eksporter PDF</button>
          <span id="offlineBadge" class="muted" style="display:none">Offline lagring</span>
        </div>
        <small class="muted">Funfacts (kun på denne siden, ikke i PDF):</small>
        <ul id="funfacts" class="muted" style="margin-top:6px"></ul>
      </div>
      <div id="summary" class="card">Ingen data lastet enda.</div>
      <div id="tableWrap" class="card" style="padding:0;overflow:auto;"></div>
      <section id="printSheet" class="card" style="display:none">
        <h1>Brøyterapport</h1>
        <div id="p_date"></div>
        <div id="p_driver"></div>
        <div id="p_round"></div>
        <div id="p_task"></div>
        <div id="p_notes"></div>
        <div>Brøyting Romerike Trefelling</div>
      </section>
    `;
    main.appendChild(sec);

    // If your app shell uses data-go navigation, add a link if missing
    const drawer = document.querySelector('.drawer-list');
    if (drawer && !drawer.querySelector('[data-go="reports"]')){
      const li = document.createElement('li');
      li.innerHTML = '<a class="drawer-link" data-go="reports"><span class="emoji">🧾</span>Rapporter</a>';
      drawer.appendChild(li);
      // Hook up navigation to show/hide sections
      document.addEventListener('click', (e)=>{
        const a = e.target.closest('[data-go="reports"]');
        if (!a) return;
        e.preventDefault();
        // hide others
        document.querySelectorAll('main section').forEach(s=> s.hidden = (s.id !== 'reports'));
        history.replaceState(null, '', '#reports');
        // close drawer if present
        document.getElementById('drawer')?.classList.remove('open');
        document.getElementById('scrim')?.classList.remove('show');
      });
    }
  }
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(()=>{ injectSection(); ensureMenuLink(); });
})();
