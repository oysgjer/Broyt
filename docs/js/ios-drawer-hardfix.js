// iOS Drawer Hardfix — injiserer CSS med høy spesifisitet + riktig z-index/opacity
// Laster på DOMContentLoaded og overstyrer alt som kan være cachet i gamle styles.
document.addEventListener('DOMContentLoaded', () => {
  const css = `
/* --- Drawer må være helt ugjennomsiktig og over scrim --- */
#drawer, .drawer, aside#drawer {
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
  height: 100vh !important;
  width: 80vw !important;
  max-width: 340px !important;
  transform: translateX(-100%) !important;
  transition: transform .25s ease !important;
  background: var(--surface, #0b1320) !important; /* solid bakgrunn */
  color: var(--text, #e8eefc) !important;
  opacity: 1 !important;              /* ikke halvtransparent */
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: 0 12px 32px rgba(0,0,0,.55) !important;
  border-right: 1px solid var(--sep, rgba(255,255,255,.08)) !important;
  z-index: 10002 !important;          /* over scrim */
  pointer-events: none !important;     /* blokkér klikk når lukket */
}
#drawer.open, .drawer.open, aside#drawer.open {
  transform: translateX(0) !important;
  pointer-events: auto !important;     /* klikk når åpen */
}

/* --- Scrim under drawer, mørk når aktiv --- */
#scrim {
  position: fixed !important;
  inset: 0 !important;
  background: transparent !important;
  opacity: 0 !important;
  transition: opacity .2s ease !important;
  z-index: 10001 !important;           /* under drawer, over innhold */
  pointer-events: none !important;      /* ikke blokkér når skjult */
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
#scrim.show {
  background: rgba(0,0,0,.66) !important;
  opacity: 1 !important;
  pointer-events: auto !important;      /* blokkér klikk når synlig */
}

/* --- Sikre kontrast i menytekst/lenker --- */
#drawer .drawer-header,
#drawer .drawer-content,
#drawer .drawer-link {
  color: var(--text, #e8eefc) !important;
}
#drawer .drawer-link:hover { background: var(--sep, rgba(255,255,255,.08)) !important; }

/* --- Appbar under drawer --- */
.appbar { z-index: 1000 !important; }

/* --- Når meny er åpen: lås body-scroll (mobilvennlig) --- */
html.drawer-open, body.drawer-open { overflow: hidden !important; touch-action: none !important; }
`;

  const styleEl = document.createElement('style');
  styleEl.id = 'ios-drawer-hardfix-20251020';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Lås opp/ned scroll når drawer åpnes/lukkes
  const drawer = document.getElementById('drawer');
  const scrim  = document.getElementById('scrim');

  const syncBody = () => {
    const open = drawer && drawer.classList.contains('open');
    document.documentElement.classList.toggle('drawer-open', !!open);
    document.body.classList.toggle('drawer-open', !!open);
  };

  if (drawer) {
    const mo = new MutationObserver(syncBody);
    mo.observe(drawer, { attributes: true, attributeFilter: ['class'] });
    syncBody();
  }

  // Hindrer “bouncing”/scroll under scrim (iOS)
  if (scrim) {
    const stop = e => { e.preventDefault(); e.stopPropagation(); };
    scrim.addEventListener('touchmove', stop, { passive: false });
    scrim.addEventListener('wheel', stop, { passive: false });
  }
});