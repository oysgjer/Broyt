/* HJEM – skjema og start-knapp */
document.addEventListener('DOMContentLoaded', () => {
  const inpDriver  = $('#home_driver')  || $('#driver')  || $('#homeName');
  const selOrder   = $('#home_order')   || $('#orderSel');
  const cbAutoNav  = $('#home_autonav') || $('#autoNav');
  const btnStart   = $('#home_start')   || $('#btnStart');

  // Prefyll fra state
  if (inpDriver) inpDriver.value = S.driver || '';
  if (selOrder)  selOrder.value  = S.order  || 'normal';
  if (cbAutoNav) cbAutoNav.checked = !!S.autoNav;

  btnStart && btnStart.addEventListener('click', () => {
    if (inpDriver) S.driver = inpDriver.value.trim();
    if (selOrder)  S.order  = selOrder.value || 'normal';
    if (cbAutoNav) S.autoNav = !!cbAutoNav.checked;

    ensureAddressesSeeded();   // lager demo-adresser om tomt
    S.cursor = 0;
    saveState();

    // Vis “Under arbeid”
    showPage('work');

    // Oppdater progresjon på toppen av “Under arbeid”
    try { updateProgressBars(); } catch {}
  });
});