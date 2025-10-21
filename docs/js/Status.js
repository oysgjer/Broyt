// js/Status.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_STATUS = 'BRYT_STATUS';

  function loadStatus() { return readJSON(K_STATUS, {}); }
  function saveStatus(s) { writeJSON(K_STATUS, s); }

  async function resetMine() {
    const s = loadStatus();
    const me = (localStorage.getItem('BRYT_SETTINGS') ? JSON.parse(localStorage.getItem('BRYT_SETTINGS')).driver : '') || '';
    Object.values(s).forEach(addr => {
      if (addr.driver === me) {
        addr.state = 'Ikke påbegynt';
        delete addr.startedAt;
        delete addr.finishedAt;
      }
    });
    saveStatus(s);
    alert('Nullstilte mine adresser.');
    render();
  }

  async function resetAll() {
    if (!confirm('Er du sikker på at du vil nullstille ALT for denne runden?')) return;
    const s = loadStatus();
    Object.values(s).forEach(addr => {
      addr.state = 'Ikke påbegynt';
      delete addr.startedAt;
      delete addr.finishedAt;
      delete addr.driver;
    });
    saveStatus(s);

    // Skyreset hvis Sync har støtte
    if (window.Sync && typeof window.Sync.resetAll === 'function') {
      try { await window.Sync.resetAll(); } catch(e){ console.warn('Sky-reset feilet', e); }
    }

    alert('Hele runden er nullstilt.');
    render();
  }

  function render() {
    if (location.hash !== '#status') return;
    const root = $('#status');
    if (!root) return;
    const s = loadStatus();

    let html = `
      <h1>Status</h1>
      <div class="row" style="gap:8px; margin-bottom:12px;">
        <button class="btn" id="btn_reset_mine">Nullstill mine</button>
        <button class="btn-ghost" id="btn_reset_all">Nullstill alt</button>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr><th>Adresse</th><th>Status</th><th>Fører</th><th>Startet</th><th>Fullført</th></tr>
        </thead>
        <tbody>
    `;

    for (const [addr, v] of Object.entries(s)) {
      html += `<tr>
        <td>${addr}</td>
        <td>${v.state || ''}</td>
        <td>${v.driver || ''}</td>
        <td>${v.startedAt || ''}</td>
        <td>${v.finishedAt || ''}</td>
      </tr>`;
    }

    html += `</tbody></table>`;
    root.innerHTML = html;

    $('#btn_reset_mine')?.addEventListener('click', resetMine);
    $('#btn_reset_all')?.addEventListener('click', resetAll);
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();