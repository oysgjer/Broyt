/* Admin.js — rendrer Admin-siden og lagrer oppsett i localStorage
   Nøkler lagres under BRYT_SETTINGS, og brukes av sync.js / resten av appen.
*/
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LS_SETTINGS_KEY = 'BRYT_SETTINGS';

  function readSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS_KEY) || '{}'); }
    catch { return {}; }
  }
  function writeSettings(obj) {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(obj));
  }

  // Små helpers som kan brukes fra Status.js også
  function statusStore() {
    try { return JSON.parse(localStorage.getItem('BRYT_STATUS') || '{}'); }
    catch { return {}; }
  }
  function clearStatusStore() { localStorage.removeItem('BRYT_STATUS'); }

  // Render Admin-siden dynamisk (slik at vi slipper å endre index.html)
  function renderAdmin() {
    const root = $('#admin');
    if (!root) return;

    root.innerHTML = `
      <h1>Admin</h1>

      <div class="card" style="margin-bottom:12px">
        <div class="label-muted">JSONBin (sky)</div>
        <div class="grid2" style="gap:10px">
          <label class="field">
            <span>Bin ID</span>
            <input id="adm_binid" class="input" placeholder="f.eks. 66fabc...">
          </label>
          <label class="field">
            <span>API-nøkkel (X-Master-Key)</span>
            <input id="adm_apikey" class="input" placeholder="••••••••••" type="password">
          </label>
        </div>
        <div class="row" style="margin-top:8px; gap:8px">
          <button id="adm_test" class="btn-ghost">Test tilkobling</button>
          <span id="adm_test_msg" class="muted"></span>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="label-muted">E-post</div>
        <label class="field">
          <span>Service-rapport sendes til</span>
          <input id="adm_mail" class="input" placeholder="oysgjer@gmail.com">
        </label>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="label-muted">Snarveier (lat,lon)</div>
        <div class="grid2" style="gap:10px">
          <label class="field">
            <span>Grus</span>
            <input id="adm_grus" class="input" placeholder="60.xxxxx,11.xxxxx">
          </label>
          <label class="field">
            <span>Diesel</span>
            <input id="adm_diesel" class="input" placeholder="60.xxxxx,11.xxxxx">
          </label>
          <label class="field">
            <span>Base</span>
            <input id="adm_base" class="input" placeholder="60.xxxxx,11.xxxxx">
          </label>
        </div>
      </div>

      <div class="row" style="gap:8px">
        <button id="adm_save" class="btn">Lagre</button>
        <button id="adm_export" class="btn-ghost">Eksporter status (CSV)</button>
        <button id="adm_clear" class="btn-ghost">Tøm lokal status</button>
      </div>
    `;

    // Fyll feltene fra localStorage
    const st = readSettings();
    $('#adm_binid').value   = st?.jsonbin?.binId   || '';
    $('#adm_apikey').value  = st?.jsonbin?.apiKey  || '';
    $('#adm_mail').value    = st?.serviceEmail     || 'oysgjer@gmail.com';
    $('#adm_grus').value    = st?.grus             || '';
    $('#adm_diesel').value  = st?.diesel           || '';
    $('#adm_base').value    = st?.base             || '';

    // Lagre
    $('#adm_save')?.addEventListener('click', () => {
      const next = readSettings();
      next.jsonbin = {
        binId: ($('#adm_binid')?.value || '').trim(),
        apiKey: ($('#adm_apikey')?.value || '').trim()
      };
      next.serviceEmail = ($('#adm_mail')?.value || '').trim();
      next.grus   = ($('#adm_grus')?.value || '').trim();
      next.diesel = ($('#adm_diesel')?.value || '').trim();
      next.base   = ($('#adm_base')?.value || '').trim();
      writeSettings(next);
      alert('Lagret.');
    });

    // Test JSONBin
    $('#adm_test')?.addEventListener('click', async () => {
      const binId = ($('#adm_binid')?.value || '').trim();
      const key   = ($('#adm_apikey')?.value || '').trim();
      const msgEl = $('#adm_test_msg');
      if (!binId || !key) {
        msgEl.textContent = 'Fyll inn både Bin ID og API-nøkkel.';
        return;
      }
      msgEl.textContent = 'Tester…';
      try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}/latest`, {
          headers: { 'X-Master-Key': key }
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const arr = Array.isArray(data?.record) ? data.record : (data?.record?.addresses || []);
        msgEl.textContent = `OK – fant ${arr.length} adresser.`;
      } catch (e) {
        msgEl.textContent = 'Feil: ' + (e.message || 'ukjent');
      }
    });

    // Tøm lokal status
    $('#adm_clear')?.addEventListener('click', () => {
      if (confirm('Tømme lokal status (kun denne enheten)?')) {
        clearStatusStore();
        alert('Tømt.');
      }
    });

    // Eksporter CSV
    $('#adm_export')?.addEventListener('click', () => {
      const bag = statusStore();
      const rows = [['id','adresse','status','sjåfør','tid']];
      for (const k in bag) {
        const s = bag[k];
        rows.push([k, s.address||'', s.state||'', s.driver||'', s.ts||'']);
      }
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'broyterute-status.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // Vis Admin-UI straks DOM er klar (scriptet er lastet med defer)
  document.addEventListener('DOMContentLoaded', renderAdmin);

  // Eksponer noen helpers globalt i tilfelle andre moduler vil bruke dem
  window.__BRYT_READ_SETTINGS  = readSettings;
  window.__BRYT_WRITE_SETTINGS = writeSettings;
})();