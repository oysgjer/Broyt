// js/include-partials.js
(() => {
  'use strict';
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  async function fetchText(url) {
    // cache-bust for å omgå iOS/GH Pages-cache
    const bust = (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const resp = await fetch(url + bust, { cache: 'no-store' });
    if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
    return await resp.text();
  }

  async function loadOne(el) {
    const orig = el.getAttribute('data-partial');
    if (!orig) return;

    // Prøv nøyaktig sti, deretter med './' prefiks som fallback
    const candidates = [orig, (orig.startsWith('./') ? orig : './' + orig)];
    let lastErr = null, html = '';

    for (const u of candidates) {
      try { html = await fetchText(u); lastErr = null; break; }
      catch (e) { lastErr = e; }
    }

    if (lastErr) {
      console.error('[partials] Kunne ikke laste', orig, lastErr);
      el.innerHTML = `<p class="muted">Klarte ikke å laste <code>${orig}</code>: ${String(lastErr)}</p>`;
      return;
    }

    el.innerHTML = html;

    // Varsle at dette elementet er klart
    const ev = new CustomEvent('partial:loaded', { bubbles: true, detail: { url: orig } });
    el.dispatchEvent(ev);
  }

  async function loadAll() {
    const parts = $$('[data-partial]');
    await Promise.all(parts.map(loadOne));
    document.dispatchEvent(new CustomEvent('partials:loaded'));
  }

  document.addEventListener('DOMContentLoaded', loadAll);
  // Eksponer manuelt kall hvis du vil trigge på nytt:
  window.loadPartials = loadAll;
})();