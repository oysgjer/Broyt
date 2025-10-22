// js/Status.js
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const JGET = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

  const K_RUN = 'BRYT_RUN';

  const Sync = {
    have() { return !!window.Sync; },
    addresses() {
      if (!window.Sync) return [];
      if (typeof window.Sync.getAddresses === 'function') return window.Sync.getAddresses() || [];
      if (Array.isArray(window.Sync.addresses)) return window.Sync.addresses;
      if (window.Sync.cache && Array.isArray(window.Sync.cache.addresses)) return window.Sync.cache.addresses;
      return [];
    },
    statuses() {
      if (!window.Sync) return {};
      if (typeof window.Sync.getStatuses === 'function') return window.Sync.getStatuses() || {};
      if (window.Sync.cache && window.Sync.cache.statuses) return window.Sync.cache.statuses;
      return {};
    }
  };

  function currentMode() {
    const run = JGET(K_RUN, null);
    if (run?.mode) return run.mode;
    const sand = !!run?.equipment?.sand;
    return sand ? 'grus' : 'snow';
  }

  function activeList() {
    const all = Sync.addresses();
    const mode = currentMode();
    const hasTask = (a) => {
      if (!a) return false;
      if (mode === 'grus') {
        if (typeof a.grus === 'boolean') return a.grus;
        if (a.tasks && typeof a.tasks.grus === 'boolean') return a.tasks.grus;
        return false;
      } else {
        if (typeof a.snow === 'boolean') return a.snow;
        if (a.tasks && typeof a.tasks.snow === 'boolean') return a.tasks.snow;
        return true;
      }
    };
    return all.filter(hasTask);
  }

  function humanState(s) {
    if (!s) return 'Ikke påbegynt';
    switch (s.state) {
      case 'start': return 'Pågår';
      case 'done':  return 'Ferdig';
      case 'skip':  return 'Hoppet over';
      case 'block': return 'Ikke mulig';
      default:      return 'Ikke påbegynt';
    }
  }

  function renderTable() {
    const host = $('#status');
    if (!host || host.hasAttribute('hidden')) return;

    const list = activeList();
    const statuses = Sync.statuses();

    // bygg enkel tabell
    let html = `
      <div class="card" style="overflow:auto">
        <table style="width:100%; border-collapse:separate; border-spacing:0 8px">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px">#</th>
              <th style="text-align:left; padding:8px">Adresse</th>
              <th style="text-align:left; padding:8px">Status</th>
              <th style="text-align:left; padding:8px">Sjåfør</th>
            </tr>
          </thead>
          <tbody>
    `;

    list.forEach((a, i) => {
      const id = a.id || a._id;
      const st = statuses[id] || null;
      const who = st?.driver || '—';
      html += `
        <tr>
          <td style="padding:6px 8px; opacity:.8">${i+1}</td>
          <td style="padding:6px 8px">${a.name || a.title || a.address || id}</td>
          <td style="padding:6px 8px">${humanState(st)}</td>
          <td style="padding:6px 8px">${who}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    // liten topp-oppsummering
    const done = list.filter(a => {
      const st = statuses[a.id || a._id];
      return st?.state === 'done';
    }).length;

    const header = $('#status_header');
    if (header) header.textContent = `Status – ${done} av ${list.length} fullført`;

    const cont = $('#status_table');
    if (cont) cont.innerHTML = html;
    else {
      // første gang: sett opp containere
      host.innerHTML = `
        <h1 id="status_header">Status</h1>
        ${html}
      `;
    }
  }

  function wire() {
    window.addEventListener('hashchange', renderTable);
    if (Sync.have() && typeof window.Sync.on === 'function') {
      window.Sync.on('status-changed', renderTable);
      window.Sync.on('addresses-loaded', renderTable);
    }
    renderTable();
  }

  document.addEventListener('DOMContentLoaded', wire);
})();