// js/home_dashboard.js
// Enkel versjon uten "Samlet brøytetid" på Hjem-skjermen

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  function renderStats() {
    const statsEl = $('#stats');
    if (!statsEl) return;

    // Tømmer alt innhold – ingen samlet brøytetid her lenger
    statsEl.innerHTML = '';

    // Hvis du vil ha en liten info-tekst i stedet, kan du bruke dette:
    // statsEl.innerHTML = `
    //   <div class="card">
    //     <div class="muted">Detaljert tid finner du nå under Admin → Logg.</div>
    //   </div>
    // `;
  }

  document.addEventListener('DOMContentLoaded', renderStats);
})();