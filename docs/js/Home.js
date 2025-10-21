// ===== HJEM – les/lagre valg og start runde =====
(() => {
  const nameInp  = $('#drv_name') || $('#driver_name') || $('#home_driver');
  const autonav  = $('#chk_autonav');
  const orderSel = $('#sel_order');
  const chSkj    = $('#chk_skj')   || $('#equip_skj');
  const chFres   = $('#chk_fres')  || $('#equip_fres');
  const chGrus   = $('#chk_grus')  || $('#equip_grus');
  const btnStart = $('#btn_start') || $('#home_start');

  // init fra storage
  if (nameInp)  nameInp.value = localStorage.getItem('BRYT_DRIVER') || (window.S?.driver || '');
  if (autonav)  autonav.checked = localStorage.getItem('BRYT_AUTONAV') === '1';
  if (orderSel) orderSel.value = localStorage.getItem('BRYT_ORDER') || 'normal';

  nameInp?.addEventListener('input', e => {
    localStorage.setItem('BRYT_DRIVER', e.target.value.trim());
    if (window.S) window.S.driver = e.target.value.trim();
  });
  autonav?.addEventListener('change', e => {
    localStorage.setItem('BRYT_AUTONAV', e.target.checked ? '1' : '0');
    if (window.S) window.S.autonav = !!e.target.checked;
  });
  orderSel?.addEventListener('change', e => {
    localStorage.setItem('BRYT_ORDER', e.target.value);
  });

  function pickMode() {
    if (chGrus?.checked) return 'grus';
    if (chFres?.checked) return 'fres';
    return 'skjær';
  }

  btnStart?.addEventListener('click', async () => {
    try {
      // lagre modus
      const mode = pickMode();
      if (window.S) window.S.mode = mode;

      await ensureAddressesSeeded();
      await refreshCloud();

      // startpeker = første adresse som ikke er "done"
      const bag = statusStore();
      const list = window.S.addresses;
      const first = list.find(a => !bag[a.id] || bag[a.id].state !== 'done') || list[0];

      // Del «nå/neste» til Work
      sessionStorage.setItem('BRYT_CURR_ID', first?.id || '');

      // gå til work
      showPage('work');
      document.dispatchEvent(new CustomEvent('round-started', { detail: { mode }}));
    } catch (e) {
      alert('Kunne ikke starte runde: ' + e.message);
    }
  });
})();