// js/Service.js
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const qs = (s, r = document) => Array.from(r.querySelectorAll(s));
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const KEY_LOGS = 'BRYT_SERVICE_LOGS';

  function collect(root = document) {
    const val = id => (root.querySelector('#' + id) || {}).checked ?? false;
    const text = id => (root.querySelector('#' + id) || {}).value ?? '';

    return {
      time: new Date().toISOString(),
      greit: true,
      smoring: {
        skjaer:       val('svc_skjaer'),
        fres:         val('svc_fres'),
        forstilling:  val('svc_forstilling'),
      },
      olje: {
        foran:       val('svc_olje_foran'),
        bak:         val('svc_olje_bak'),
        etterfylt:   val('svc_olje_etterfylt'),
      },
      diesel: {
        fylt:        val('svc_diesel'),
      },
      grus: text('svc_grus'),
      annet: text('svc_annet'),
    };
  }

  function save(root = document) {
    const entry = collect(root);
    const logs = readJSON(KEY_LOGS, []);
    logs.push(entry);
    writeJSON(KEY_LOGS, logs);

    const statusEl = root.querySelector('#svc_status');
    if (statusEl) statusEl.textContent = '✅ Service lagret ' + new Date(entry.time).toLocaleString();

    // Tilbud om e-post (testadresse)
    setTimeout(() => {
      const body =
        'Servicerapport\n\n' +
        JSON.stringify(entry, null, 2);
      if (confirm('Vil du sende servicerapport på e-post til oysgjer@gmail.com?')) {
        window.location.href = `mailto:oysgjer@gmail.com?subject=Servicerapport&body=${encodeURIComponent(body)}`;
      }
    }, 150);
  }

  function wire(root = document) {
    // Unngå dobbelt-wiring hvis partial lastes flere ganger
    if (root?.dataset?.svcWired === '1') return;
    const btn = root.querySelector('#svc_save');
    if (btn) btn.addEventListener('click', () => save(root));
    root.dataset.svcWired = '1';
  }

  // 1) Hvis service ligger inline i HTML (eller partial allerede er satt inn)
  document.addEventListener('DOMContentLoaded', () => {
    const service = $('#service');
    if (service && service.querySelector('#svc_save')) wire(service);
  });

  // 2) Når include-partials har injisert service.html
  document.addEventListener('partial:loaded', ev => {
    const host = ev.target;                       // elementet som fikk partial
    if (host && host.id === 'service') wire(host);
  });
})();