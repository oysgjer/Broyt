// del-E.js — Admin: Reorder adresser (drag&drop / knapper) + lagre til sky
(function () {
  const $ = (s) => document.querySelector(s);

  // Konfig (samme som resten av appen)
  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const els = {
    list: $('#adm_list'),
    reload: $('#adm_reload'),
    save: $('#adm_save'),
    status: $('#adm_status'),
  };

  const S = {
    cloud: null,        // full cloud-obj
    addresses: [],      // arbeidliste, bevarer objektene
    dragIdx: null,      // for DnD
  };

  // ---- Nett ----
  async function getLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return (data && data.record) ? data.record : data;
  }

  async function putAddresses(nextAddresses, meta = {}) {
    // Behold serviceLogs/backups fra latest
    const base = S.cloud || await getLatest();
    const payload = {
      version: window.APP_CFG?.APP_VER || '9.x',
      updated: Date.now(),
      by: (window.BroytState?.getPrefs?.()?.driver?.name || 'admin'),
      season: window.BroytState?.getSeason?.() || base.season || '',
      addresses: nextAddresses,
      serviceLogs: Array.isArray(base?.serviceLogs) ? base.serviceLogs : [],
      backups: Array.isArray(base?.backups) ? base.backups : [],
      ...meta
    };
    const r = await fetch(`${API}b/${BIN}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    return (await r.json());
  }

  // ---- UI render ----
  function renderList() {
    const frag = document.createDocumentFragment();

    S.addresses.forEach((a, idx) => {
      const li = document.createElement('li');
      li.className = 'sort-item';
      li.setAttribute('data-idx', String(idx));
      li.draggable = true;

      li.innerHTML = `
        <div class="item-row">
          <span class="handle" title="Dra for å flytte">☰</span>
          <div class="main">
            <div class="name">${a.name || 'Uten navn'}</div>
            <div class="meta small muted">
              ${a.group ? `Gruppe: ${a.group} • ` : ''}
              Utstyr: ${(Array.isArray(a.equipment) && a.equipment.length) ? a.equipment.join(', ') : '—'}
            </div>
          </div>
          <label class="active-toggle small">
            <input type="checkbox" ${a.active !== false ? 'checked' : ''}/> Aktiv
          </label>
          <div class="moves">
            <button class="btn btn-ghost btn-move" data-move="up" title="Flytt opp">⬆️</button>
            <button class="btn btn-ghost btn-move" data-move="down" title="Flytt ned">⬇️</button>
          </div>
        </div>
      `;

      // Aktiv-toggle
      li.querySelector('input[type="checkbox"]').addEventListener('change', (ev) => {
        a.active = !!ev.target.checked;
      });

      // DnD events
      li.addEventListener('dragstart', (ev) => {
        S.dragIdx = idx;
        li.classList.add('dragging');
        ev.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        S.dragIdx = null;
      });
      li.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
      });
      li.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const from = S.dragIdx;
        const to = Number(li.getAttribute('data-idx'));
        if (from == null || isNaN(to) || from === to) return;
        moveItem(from, to);
      });

      // Knapper opp/ned
      li.querySelectorAll('.btn-move').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = btn.getAttribute('data-move');
          const from = idx;
          const to = (dir === 'up') ? idx - 1 : idx + 1;
          moveItem(from, to);
        });
      });

      frag.appendChild(li);
    });

    els.list.innerHTML = '';
    els.list.appendChild(frag);
    updateIndices();
  }

  function moveItem(from, to) {
    if (to < 0 || to >= S.addresses.length) return;
    const item = S.addresses.splice(from, 1)[0];
    S.addresses.splice(to, 0, item);
    renderList();
    els.status.textContent = `Flyttet: ${item.name} → pos ${to + 1}`;
  }

  function updateIndices() {
    els.list.querySelectorAll('li.sort-item').forEach((li, i) => li.setAttribute('data-idx', String(i)));
  }

  // ---- Handling ----
  async function reload() {
    try {
      els.status.textContent = 'Henter…';
      els.save.disabled = true;
      S.cloud = await getLatest();
      const raw = Array.isArray(S.cloud) ? S.cloud
        : Array.isArray(S.cloud.addresses) ? S.cloud.addresses
        : (S.cloud.snapshot && Array.isArray(S.cloud.snapshot.addresses)) ? S.cloud.snapshot.addresses
        : [];
      // Arbeidskopi (behold objekter slik at felter ikke forsvinner)
      S.addresses = raw.map(x => ({ ...x }));
      renderList();
      els.status.textContent = `Hentet ${S.addresses.length} adresser. Dra for å endre rekkefølge, og lagre.`;
    } catch (e) {
      console.error(e);
      els.status.textContent = `Feil: ${e.message}`;
      alert('Kunne ikke hente adresser fra sky.');
    } finally {
      els.save.disabled = false;
    }
  }

  async function saveOrder() {
    try {
      els.status.textContent = 'Lagrer…';
      els.save.disabled = true;
      // S.addresses er i ønsket rekkefølge og med oppdatert "active"
      await putAddresses(S.addresses, { note: 'Admin: reorder + active' });
      els.status.textContent = 'OK – rekkefølge lagret.';
    } catch (e) {
      console.error(e);
      els.status.textContent = `Feil: ${e.message}`;
      alert('Kunne ikke lagre ny rekkefølge.');
    } finally {
      els.save.disabled = false;
    }
  }

  // ---- Init ----
  function bind() {
    if (!els.reload || !els.save || !els.list) return; // seksjonen ikke på denne siden
    els.reload.addEventListener('click', reload);
    els.save.addEventListener('click', saveOrder);
    // Auto-last når du åpner Admin-siden
    if (location.hash === '#admin') reload();
    window.addEventListener('hashchange', () => {
      if (location.hash === '#admin') reload();
    });
  }

  bind();
})();