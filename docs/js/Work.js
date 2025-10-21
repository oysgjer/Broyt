/* ---------------------------------------------------------
   Work.js
   Viser nå/neste + enkel fremdrift.
   (Knappene kan fylles ut mer etter hvert.)
--------------------------------------------------------- */
(function () {
  const $ = (s, root = document) => root.querySelector(s);

  function renderWork() {
    if (!$('#work') || $('#work').hasAttribute('hidden')) return;

    const { now, next, total } = (window.getNowNext ? getNowNext() : { now:null, next:null, total:0 });

    // Tekster
    $('#b_now')  && ($('#b_now').textContent  = now  ? now.name  : '—');
    $('#b_next') && ($('#b_next').textContent = next ? next.name : '—');
    $('#b_task') && ($('#b_task').textContent = now  ? (now.task || '—') : '—');

    // Status/fremdrift
    const bag = window.statusStore ? statusStore() : {};
    let me = 0, other = 0;
    const s = window.loadState ? loadState() : {};
    (s.addresses || []).forEach(addr => {
      const st = bag[addr.id];
      if (st && st.state === 'done') {
        if (st.driver && s.driver && st.driver === s.driver) me++;
        else other++;
      }
    });
    const mePct = total ? Math.round(100 * me / total) : 0;
    const otPct = total ? Math.round(100 * other / total) : 0;

    $('#b_prog_me')    && ($('#b_prog_me').style.width = mePct + '%');
    $('#b_prog_other') && ($('#b_prog_other').style.width = otPct + '%');
    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  // Koble til de viktigste knappene (kan utvides senere)
  function wireActions() {
    $('#act_start')?.addEventListener('click', () => {
      const s = loadState();
      s.started = true;
      saveState(s);
      renderWork();
    });

    $('#act_done')?.addEventListener('click', () => {
      const { s, now } = getNowNext();
      if (!now) return;
      const bag = statusStore();
      bag[now.id] = { state: 'done', driver: s.driver || '' };
      saveState(s); // idx oppdateres under
      // Flytt til neste adresse
      s.idx = Math.min((s.idx || 0) + 1, (s.addresses?.length || 1) - 1);
      localStorage.setItem('BRYT_STATUS', JSON.stringify(bag));
      saveState(s);
      renderWork();
    });

    $('#act_next')?.addEventListener('click', () => {
      const s = loadState();
      s.idx = Math.min((s.idx || 0) + 1, (s.addresses?.length || 1) - 1);
      saveState(s);
      renderWork();
    });
  }

  // Re-render når siden vises
  window.addEventListener('hashchange', renderWork);
  document.addEventListener('DOMContentLoaded', () => { wireActions(); renderWork(); });
})();