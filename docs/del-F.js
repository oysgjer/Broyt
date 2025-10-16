// Del-F (Service/Vedlikehold) – må fullføres etter hver runde
(function () {
  const $ = (s) => document.querySelector(s);
  const LS_SERVICE_REQ  = 'broyt:serviceRequired';
  const LS_SERVICE_LOGS = 'broyt:serviceLogs';
  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;
  const els = {
    reqBox:  $('#svc_required_banner'),
    note:    $('#svc_notes'),
    save:    $('#svc_save'),
    finishBtn: $('#svc_finish'),
    checks:  Array.from(document.querySelectorAll('[data-svc]')),
  };
  let required = null;
  try { required = JSON.parse(localStorage.getItem(LS_SERVICE_REQ) || 'null'); } catch {}
  function renderBanner() {
    if (!els.reqBox) return;
    if (required) {
      els.reqBox.classList.remove('hidden');
      els.reqBox.querySelector('[data-round]').textContent  = String(required.round || '–');
      els.reqBox.querySelector('[data-driver]').textContent = required.driver || '–';
    } else {
      els.reqBox.classList.add('hidden');
    }
  }
  function readForm() {
    const checks = {};
    els.checks.forEach(cb => { checks[cb.dataset.svc] = !!cb.checked; });
    const round = window.BroytState?.getRound?.();
    return { round: required?.round || round?.number || 0,
             driver: round?.driver?.name || required?.driver || '',
             job: round?.job || required?.job || '',
             when: Date.now(),
             notes: els.note?.value || '',
             checks };
  }
  function appendLocalLog(entry) {
    try { const arr = JSON.parse(localStorage.getItem(LS_SERVICE_LOGS) || '[]'); arr.push(entry);
          localStorage.setItem(LS_SERVICE_LOGS, JSON.stringify(arr)); } catch {}
  }
  async function fetchLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache:'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }
  async function putPayload(payload) {
    const r = await fetch(`${API}b/${BIN}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }
  async function saveService() {
    const entry = readForm(); appendLocalLog(entry);
    try {
      const cloud = await fetchLatest();
      const payload = (typeof cloud === 'object' && cloud) ? cloud : {};
      const prevLogs = Array.isArray(payload.serviceLogs) ? payload.serviceLogs : [];
      payload.serviceLogs = prevLogs.concat([ entry ]);
      payload.updated = Date.now();
      payload.lastServiceAt = entry.when;
      await putPayload(payload);
      return entry;
    } catch (e) {
      console.warn('Kunne ikke lagre service til sky. Lagrer lokalt.', e);
      return entry;
    }
  }
  async function finishRound() {
    const entry = await saveService();
    window.BroytState?.endRound?.({ serviceAt: entry.when });
    localStorage.removeItem(LS_SERVICE_REQ);
    location.hash = '#home';
    if (typeof window.APP?.go === 'function') window.APP.go('home');
    alert('Service lagret og runden er fullført.');
  }
  if (els.save) els.save.addEventListener('click', async () => { await saveService(); alert('Service lagret.'); });
  if (els.finishBtn) els.finishBtn.addEventListener('click', finishRound);
  renderBanner();
})();
