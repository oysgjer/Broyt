/* ===== del-F.js — Adresse-register (liste/visning) ===== */
(() => {
  const Core = window.Core;
  if (!Core) {
    console.error('Del C må lastes før Del F.');
    return;
  }

  const H     = Core.helpers || {};
  const state = Core.state;
  const $id   = (id) => document.getElementById(id);

  // Små hjelpere (uavhengige av resten)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
  );
  const seasonKey = Core.seasonKey || (() => {
    const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    return m>=7 ? `${y}/${String(y+1).slice(-2)}` : `${y-1}/${String(y).slice(-2)}`;
  });
  const hasPinsThisSeason = (s) => s?.pinsLockedYear && String(s.pinsLockedYear) === seasonKey();

  // En enkel rad-render
  function rowHTML(s) {
    const status =
      s.f ? '✅' :
      s.b ? '⛔' : '';

    const pinsBadge = s.pinsLockedYear
      ? `<span class="badge">📍 ${Number(s.pinsCount||0)}</span>`
      : '';

    const twoDrv = s.twoDriverRec ? `<span class="badge">👥 2 sjåfører</span>` : '';

    return `
      <div class="item" style="padding:10px 0;border-bottom:1px solid var(--cardBorder,#333);">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <b style="font-size:15px">${esc(s.n)}</b>
          ${twoDrv}
          ${pinsBadge}
          <span class="muted" style="margin-left:auto">${status}</span>
        </div>
        <div class="muted" style="margin-top:4px">${esc(s.t||'')}</div>
      </div>
    `;
  }

  function emptyHTML() {
    return `<div class="muted" style="padding:12px 0">Ingen adresser enda. Hent katalog i Admin-fanen.</div>`;
  }

  // Offentlig render-funksjon (kan kalles fra andre deler)
  function renderRegister() {
    try {
      const host = $id('addressList');
      if (!host) return;

      const arr = Array.isArray(state?.stops) ? state.stops : [];
      if (!arr.length) {
        host.innerHTML = emptyHTML();
        return;
      }

      // Valgfri enkel sortering: ikke-ferdige først, deretter alfabetisk
      const sorted = arr.slice().sort((a,b)=>{
        const ca = (a.f||a.b)?1:0, cb=(b.f||b.b)?1:0;
        if (ca!==cb) return ca-cb;
        return (a.n||'').localeCompare(b.n||'','no');
      });

      host.innerHTML = sorted.map(rowHTML).join('');
    } catch (e) {
      console.error('Register render feilet:', e);
    }
  }

  // Re-render ved relevante hendelser
  document.addEventListener('DOMContentLoaded', renderRegister);

  // Når katalog-data er hentet/oppdatert (del-H utløser disse eventene)
  window.addEventListener('catalog:loaded', renderRegister);
  window.addEventListener('catalog:updated', renderRegister);

  // Eksponer så andre kan trigge det
  window.Register = Object.assign(window.Register || {}, { render: renderRegister });

  console.log('del-F.js lastet');
})();