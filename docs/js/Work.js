/* ---------------------------------------------------------
   Work.js — knapper, fremdrift, og slutt-dialog
--------------------------------------------------------- */
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  function renderWork() {
    if (!$('#work') || $('#work').hasAttribute('hidden')) return;

    const { s, now, next, total } = getNowNext();
    $('#b_now')  && ($('#b_now').textContent  = now  ? now.name  : '—');
    $('#b_next') && ($('#b_next').textContent = next ? next.name : '—');
    $('#b_task') && ($('#b_task').textContent = now  ? (now.task || '—') : '—');

    // regn fremdrift
    const bag = statusStore();
    let me = 0, other = 0;
    (s.addresses || []).forEach(a => {
      const st = bag[a.id];
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
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent = `${Math.min(me + other, total)} av ${total} adresser fullført`);
    $('#b_status') && ($('#b_status').textContent = '—');
  }

  function goNextAddress() {
    const s = loadState();
    if (!Array.isArray(s.addresses) || !s.addresses.length) return;
    s.idx = Math.min((s.idx || 0) + 1, s.addresses.length - 1);
    saveState(s);
    renderWork();
    checkIfRoundFinished();
  }

  function markState(state) {
    const { s, now } = getNowNext();
    if (!now) return;
    const bag = statusStore();
    bag[now.id] = { state, driver: s.driver || '' };
    saveStatus(bag);
    saveState(s);
    renderWork();
  }

  function checkIfRoundFinished() {
    const { s, total } = getNowNext();
    const bag = statusStore();
    let doneCnt = 0;
    (s.addresses || []).forEach(a => { if (bag[a.id]?.state === 'done') doneCnt++; });
    if (doneCnt >= total && total > 0) {
      // slutt-dialog
      const choice = prompt(
        'Runden er fullført.\n\nVelg ett av følgende (skriv tallet):\n' +
        '1 = Start ny runde (samme oppsett)\n' +
        '2 = Start ny grusrunde (setter Sand/Grus)\n' +
        '3 = Ferdig (gå til Service)'
      );
      if (choice === '1') {
        // nullstill status og start igjen
        localStorage.removeItem('BRYT_STATUS');
        const s2 = loadState();
        s2.idx = 0; saveState(s2);
        renderWork();
      } else if (choice === '2') {
        localStorage.removeItem('BRYT_STATUS');
        const s2 = loadState();
        s2.idx = 0;
        s2.equipment = Object.assign({}, s2.equipment, { sand: true, plow: false, fres: false });
        saveState(s2);
        if (window.showPage) showPage('work');
        renderWork();
      } else if (choice === '3') {
        if (window.showPage) showPage('service'); else location.hash = '#service';
      }
    }
  }

  // ---------- wire knapper ----------
  function wire() {
    $('#act_start')?.addEventListener('click', () => {
      const s = loadState(); s.started = true; saveState(s);
      $('#b_status') && ($('#b_status').textContent = 'Pågår');
      renderWork();
    });

    $('#act_done')?.addEventListener('click', () => {
      markState('done');
      goNextAddress();
    });

    $('#act_next')?.addEventListener('click', () => {
      $('#b_status') && ($('#b_status').textContent = 'Hopper til neste');
      goNextAddress();
    });

    $('#act_skip')?.addEventListener('click', () => {
      markState('skip');
      goNextAddress();
    });

    $('#act_block')?.addEventListener('click', () => {
      markState('blocked');
      goNextAddress();
    });

    $('#act_nav')?.addEventListener('click', () => {
      // Prøv å navigere til "nå"-adresse (kun navn, åpner søk)
      const { now } = getNowNext();
      const q = now ? encodeURIComponent(now.name) : '';
      const url = q
        ? `https://www.google.com/maps/search/?api=1&query=${q}`
        : 'https://www.google.com/maps';
      window.open(url, '_blank');
    });
  }

// Oversett utstyrsvalg til menneskelig oppgave
function describeTask(s) {
  const eq = s.equipment || {};
  const hasPlow = eq.plow || eq.fres;
  const hasSand = eq.sand;

  if (hasPlow && hasSand) return 'Brøyting og strøing';
  if (hasPlow) return 'Brøyting (fjerne snø)';
  if (hasSand) return 'Strøing av grus';
  return 'Uspesifisert oppgave';
}

// Endre linjen i renderWork()
function renderWork() {
  if (!$('#work') || $('#work').hasAttribute('hidden')) return;

  const { s, now, next, total } = getNowNext();
  $('#b_now')  && ($('#b_now').textContent  = now  ? now.name  : '—');
  $('#b_next') && ($('#b_next').textContent = next ? next.name : '—');

  // HER: vis oppgaven basert på utstyr
  $('#b_task') && ($('#b_task').textContent = describeTask(s));

  ...
}

  window.addEventListener('hashchange', renderWork);
  document.addEventListener('DOMContentLoaded', () => { wire(); renderWork(); });
})();

