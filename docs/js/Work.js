// ===== UNDER ARBEID – vis nå/neste + knapper =====
(() => {
  const elNow   = $('#w_now_name');
  const elNext  = '#w_next_name';
  const elTask  = $('#w_task');
  const elStat  = $('#w_status');

  const bStart  = $('#w_start');
  const bDone   = $('#w_done');
  const bSkip   = $('#w_skip');
  const bNext   = $('#w_next');
  const bNav    = $('#w_nav');
  const bBlock  = $('#w_blocked');

  function currentIdx() {
    const curId = sessionStorage.getItem('BRYT_CURR_ID') || '';
    const idx = window.S.addresses.findIndex(a => a.id === curId);
    return idx >= 0 ? idx : 0;
  }

  function setCurrentByIndex(i) {
    const list = window.S.addresses;
    const clamped = Math.max(0, Math.min(list.length - 1, i));
    sessionStorage.setItem('BRYT_CURR_ID', list[clamped]?.id || '');
    render();
  }

  function updateProgressBars() {
    const total = window.S.addresses.length || 1;
    const bag = statusStore();
    let me = 0, other = 0;

    for (const id of window.S.addresses.map(a => a.id)) {
      const st = bag[id];
      if (st && st.state === 'done') {
        if (!window.S.driver || st.driver === window.S.driver) me++;
        else other++;
      }
    }
    const mePct = Math.round(100 * me / total);
    const otPct = Math.round(100 * other / total);

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm?.style) bm.style.width = mePct + '%';
    if (bo?.style) bo.style.width = otPct + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  function render() {
    const list = window.S.addresses;
    if (!list?.length) return;

    const idx = currentIdx();
    const now  = list[idx];
    const next = list[idx+1];

    if (elNow)  elNow.textContent  = now?.name  || '—';
    $(elNext) && ($(elNext).textContent = next?.name || '—');
    if (elTask) elTask.textContent = `Oppgave: ${now?.task || '—'}`;

    const bag = statusStore();
    const cur = bag[now?.id || ''];
    elStat && (elStat.textContent = `Status: ${cur?.state ? cur.state : '—'}`);

    updateProgressBars();
  }

  function setState(state) {
    const list = window.S.addresses;
    const idx  = currentIdx();
    const now  = list[idx];
    if (!now) return;

    const bag = statusStore();
    bag[now.id] = { state, driver: (window.S?.driver || ''), ts: Date.now() };
    statusStoreWrite(bag);
    refreshCloud().catch(()=>{});

    render();
  }

  // Knapper
  bStart?.addEventListener('click', () => setState('start'));
  bDone ?.addEventListener('click', () => setState('done'));
  bSkip ?.addEventListener('click', () => { setState('skip');  setCurrentByIndex(currentIdx()+1); });
  bNext ?.addEventListener('click', () => setCurrentByIndex(currentIdx()+1));
  bBlock?.addEventListener('click', () => setState('blocked'));
  bNav  ?.addEventListener('click', () => {
    const now = window.S.addresses[currentIdx()];
    if (!now) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(now.name)}`;
    window.open(url,'_blank');
  });

  document.addEventListener('round-started', render);
  document.addEventListener('page:shown', (e) => { if (e.detail.id === 'work') render(); });

  // første render ved lasting
  if ((location.hash||'#').includes('work')) render();
})();