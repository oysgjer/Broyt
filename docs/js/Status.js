/* Status.js — viser fremdrift og tabell over adresser/tilstander.
   Leser fra localStorage (BRYT_STATUS) og – hvis tilgjengelig – fra global S.addresses.
*/
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LS_STATUS_KEY = 'BRYT_STATUS';

  function statusStore() {
    try { return JSON.parse(localStorage.getItem(LS_STATUS_KEY) || '{}'); }
    catch { return {}; }
  }
  function readSettings(){
    try { return JSON.parse(localStorage.getItem('BRYT_SETTINGS') || '{}'); }
    catch { return {}; }
  }

  const LABELS = {
    idle: 'Ikke påbegynt',
    start: 'Pågår',
    done: 'Ferdig',
    skip: 'Hoppet over',
    blocked: 'Ikke mulig'
  };

  function summarize(addresses, bag) {
    let idle=0, start=0, done=0, skip=0, blocked=0;
    const total = addresses.length;
    for (const a of addresses) {
      const st = bag[a.id]?.state || 'idle';
      if      (st === 'done')    done++;
      else if (st === 'start')   start++;
      else if (st === 'skip')    skip++;
      else if (st === 'blocked') blocked++;
      else idle++;
    }
    return { total, idle, start, done, skip, blocked };
  }

  function render() {
    const root = $('#status');
    if (!root) return;

    // Finn adresser – bruk global S.addresses om finnes, ellers tom
    const S = window.S || {};
    const addresses = Array.isArray(S.addresses) ? S.addresses : [];
    const bag = statusStore();
    const sum = summarize(addresses, bag);

    root.innerHTML = `
      <h1>Status</h1>

      <div class="card" id="st_kpis">
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div class="chip">Alle: <strong>${sum.total}</strong></div>
          <div class="chip">Ikke påbegynt: <strong>${sum.idle}</strong></div>
          <div class="chip">Pågår: <strong>${sum.start}</strong></div>
          <div class="chip">Ferdig: <strong>${sum.done}</strong></div>
          <div class="chip">Hoppet over: <strong>${sum.skip}</strong></div>
          <div class="chip">Ikke mulig: <strong>${sum.blocked}</strong></div>
          <span style="flex:1 1 auto"></span>
          <button id="st_refresh" class="btn-ghost">Oppfrisk</button>
          <button id="st_export" class="btn-ghost">Eksporter CSV</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" id="st_tbl">
          <thead>
            <tr><th>#</th><th>Adresse</th><th>Status</th><th>Sjåfør</th><th>Tid</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    // Fyll tabell
    const tbody = $('#st_tbl tbody', root);
    if (addresses.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" class="muted">Ingen adresser tilgjengelig. Sjekk JSONBin-oppsett i Admin.</td>`;
      tbody.appendChild(tr);
    } else {
      addresses.forEach((a, i) => {
        const s = bag[a.id] || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${a.name || a.address || '-'}</td>
          <td>${LABELS[s.state] || LABELS.idle}</td>
          <td>${s.driver || ''}</td>
          <td>${s.ts ? new Date(s.ts).toLocaleString() : ''}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Oppfrisk → bare re-render lokalt (ev. sync.js kan trigges separat)
    $('#st_refresh')?.addEventListener('click', () => render());

    // Eksporter CSV
    $('#st_export')?.addEventListener('click', () => {
      const rows = [['#','adresse','status','sjåfør','tid']];
      addresses.forEach((a, i) => {
        const s = bag[a.id] || {};
        rows.push([
          i+1,
          a.name || a.address || '',
          LABELS[s.state] || LABELS.idle,
          s.driver || '',
          s.ts ? new Date(s.ts).toISOString() : ''
        ]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'status.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  document.addEventListener('DOMContentLoaded', render);
  // Gjør funksjonen tilgjengelig hvis andre vil trigge oppfriskning
  window.__BRYT_STATUS_RENDER = render;
})();