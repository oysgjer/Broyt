/* =============== UNDER ARBEID – LOGIKK =============== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let workState = {
  idx: 0,
  dir: 'Normal',
  mode: 'snow',
  driver: '',
  addresses: [],
  cloud: null
};

async function refreshCloud() {
  const res = await fetch(localStorage.getItem('BROYT_BIN_URL'), {
    headers: { 'X-Master-Key': localStorage.getItem('BROYT_XKEY') }
  });
  const data = await res.json();
  workState.cloud = data.record || data;
}

function statusStore() {
  return workState.mode === 'snow'
    ? workState.cloud.statusSnow
    : workState.cloud.statusGrit;
}

/* ---------- Oppdater fremdriftslinje ---------- */
function updateProgressBars() {
  const total = workState.addresses.length || 1;
  const bag = statusStore();
  let me = 0, other = 0;

  for (const k in bag) {
    const st = bag[k];
    if (st && st.state === 'done') {
      if (st.driver === workState.driver) me++;
      else other++;
    }
  }

  const mePct = Math.round((100 * me) / total);
  const otPct = Math.round((100 * other) / total);

  $('#prog-me').style.width = mePct + '%';
  $('#prog-other').style.width = otPct + '%';
}

/* ---------- Oppdater adressevisning ---------- */
function updateAddressUI() {
  const cur = workState.addresses[workState.idx] || {};
  const next =
    workState.addresses[
      workState.dir === 'Motsatt'
        ? workState.idx - 1
        : workState.idx + 1
    ] || {};

  $('#addr-now').textContent = cur.name
    ? `📍 ${cur.name}`
    : '📍 —';
  $('#addr-next').textContent = next.name
    ? `Neste: ${next.name}`
    : 'Neste: —';

  updateProgressBars();
}

/* ---------- Naviger ---------- */
function mapsUrlFromAddr(addr) {
  if (!addr) return 'https://www.google.com/maps';
  if (addr.coords && /-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?/.test(addr.coords)) {
    const q = addr.coords.replace(/\s+/g, '');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.name || '')}, Norge`;
}

/* ---------- Statusendring ---------- */
async function stepState(patch, moveNext = true) {
  const cur = workState.addresses[workState.idx];
  if (!cur) return;

  const bag = statusStore();
  const curState = bag[cur.name] || {};
  bag[cur.name] = { ...curState, ...patch, driver: workState.driver };

  await fetch(localStorage.getItem('BROYT_BIN_PUT'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': localStorage.getItem('BROYT_XKEY')
    },
    body: JSON.stringify(workState.cloud)
  });

  if (moveNext) {
    workState.idx =
      workState.dir === 'Motsatt'
        ? workState.idx - 1
        : workState.idx + 1;
  }
  updateAddressUI();
}

/* ---------- Knapper ---------- */
$('#btn-start')?.addEventListener('click', () =>
  stepState({ state: 'in_progress', startedAt: Date.now() }, false)
);
$('#btn-done')?.addEventListener('click', () =>
  stepState({ state: 'done', finishedAt: Date.now() })
);
$('#btn-skip')?.addEventListener('click', () =>
  stepState({ state: 'skipped', finishedAt: Date.now() })
);
$('#btn-block')?.addEventListener('click', () =>
  stepState({ state: 'blocked', finishedAt: Date.now() })
);
$('#btn-next')?.addEventListener('click', () => {
  workState.idx++;
  updateAddressUI();
});
$('#btn-nav')?.addEventListener('click', () => {
  const cur = workState.addresses[workState.idx];
  if (cur) window.open(mapsUrlFromAddr(cur), '_blank');
});

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  await refreshCloud();

  const cloud = workState.cloud;
  workState.driver =
    JSON.parse(localStorage.getItem('BROYT_PREFS') || '{}').driver ||
    'fører';
  workState.mode = 'snow';
  workState.dir = 'Normal';
  workState.addresses =
    cloud?.snapshot?.addresses?.filter((a) => a.active !== false) || [];

  updateAddressUI();
});