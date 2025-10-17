// del-E.js — Admin: Rediger navn/gruppe/oppdrag + flytt opp/ned + lagre til sky (v9.12i)
(function () {
  const $ = (s) => document.querySelector(s);

  // Konfig (fra del-A.js)
  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const els = {
    list:   $('#adm_list'),
    reload: $('#adm_reload'),
    save:   $('#adm_save'),
    status: $('#adm_status'),
  };

  const S = { cloud:null, addresses:[] };

  // ---- Hjelpere ----
  async function getLatest() {
    const keyOk = window.JSONBIN?.checkConfigOrWarn?.();
    if (!keyOk) throw new Error('Mangler konfig/nøkkel');
    const r = await window.JSONBIN.apiFetch(`b/${BIN}/latest`);
    if (!r.ok) throw new Error('GET ' + r.status);
    const data = await r.json();
    return (data && data.record) ? data.record : data;
  }

  async function putAddresses(nextAddresses, meta = {}) {
    const base = S.cloud || await getLatest();
    const payload = {
      version: window.APP_CFG?.APP_VER || '9.x',
      updated: Date.now(),
      by: (JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}')?.driver || 'admin'),
      season: base.season || '',
      addresses: nextAddresses,
      serviceLogs: Array.isArray(base?.serviceLogs) ? base.serviceLogs : [],
      backups: Array.isArray(base?.backups) ? base.backups : [],
      ...meta
    };
    const r = await window.JSONBIN.apiFetch(`b/${BIN}`, {
      method: 'PUT', body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('PUT ' + r.status);
    return await r.json();
  }

  function equipForTask(task) {
    // "Snø" -> bare fres (plog er kjøretøy)
    // "Snø og grus" -> fres + stro (kan strø)
    if (task === 'Snø og grus') return ['fres','stro'];
    return ['fres'];
  }

  // ---- UI ----
  function renderList() {
    const frag = document.createDocumentFragment();
    S.addresses.forEach((a, idx) => {
      const li = document.createElement('li');
      li.className = 'sort-item';
      li.setAttribute('data-idx', String(idx));

      const taskVal = (a.task === 'Snø og grus') ? 'Snø og grus' : 'Snø';

      li.innerHTML = `
        <div class="item-row">
          <div class="main">
            <div class="name">${a.name || ''}</div>
            <div class="inline-edit">
              <label>Navn: <input class="inp-name" type="text" value="${(a.name||'').replace(/"/g,'&quot;')}"></label>
              <label>Gruppe: <input class="inp-group" type="text" value="${(a.group||'').replace(/"/g,'&quot;')}"></label>
              <label>Oppdrag:
                <select class="sel-task">
                  <option ${taskVal==='Snø'?'selected':''}>Snø</option>
                  <option ${taskVal==='Snø og grus'?'selected':''}>Snø og grus</option>
                </select>
              </label>
            </div>
            <div class="meta small">
              Utstyr lagres automatisk fra Oppdrag: <em>${taskVal}</em>
            </div>
          </div>

          <label class="active-toggle small">
            <input class="chk-active" type="checkbox" ${a.active!==false?'checked':''}/> Aktiv
          </label>

          <div class="moves">
            <button class="btn btn-ghost btn-move" data-move="up"   title="Flytt opp">⬆️</button>
            <button class="btn btn-ghost btn-move" data-move="down" title="Flytt ned">⬇️</button>
          </div>
        </div>
      `;

      // bindings
      li.querySelector('.inp-name').addEventListener('input', ev => { a.name = ev.target.value; li.querySelector('.name').textContent = a.name || ''; });
      li.querySelector('.inp-group').addEventListener('input', ev => { a.group = ev.target.value; });
      li.querySelector('.sel-task').addEventListener('change', ev => {
        a.task = ev.target.value;
        a.equipment = equipForTask(a.task);
        li.querySelector('.meta').innerHTML = `Utstyr lagres automatisk fra Oppdrag: <em>${a.task}</em>`;
      });
      li.querySelector('.chk-active').addEventListener('change', ev => { a.active = !!ev.target.checked; });

      li.querySelectorAll('.btn-move').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const dir = btn.getAttribute('data-move');
          const from = idx;
          const to = dir === 'up' ? idx - 1 : idx + 1;
          if (to < 0 || to >= S.addresses.length) return;
          const item = S.addresses.splice(from,1)[0];
          S.addresses.splice(to,0,item);
          renderList();
          els.status.textContent = `Flyttet: ${item.name} → pos ${to+1}`;
        });
      });

      frag.appendChild(li);
    });

    els.list.innerHTML = '';
    els.list.appendChild(frag);
  }

  // ---- Handling ----
  async function reload() {
    try {
      els.status.textContent = 'Henter…';
      els.save.disabled = true;
      S.cloud = await getLatest();
      const raw = Array.isArray(S.cloud?.addresses) ? S.cloud.addresses
        : (S.cloud?.snapshot?.addresses || []);
      S.addresses = raw.map(x => ({ ...x }));
      renderList();
      els.status.textContent = `Hentet ${S.addresses.length} adresser. Rediger, flytt og lagre.`;
    } catch (e) {
      console.error(e);
      els.status.textContent = `Feil: ${e.message}`;
      alert('Kunne ikke hente adresser fra sky.');
    } finally {
      els.save.disabled = false;
    }
  }

  async function saveAll() {
    try {
      els.status.textContent = 'Lagrer…';
      els.save.disabled = true;
      // sørg for equipment i tråd med task
      const next = S.addresses.map(a => {
        const t = (a.task === 'Snø og grus') ? 'Snø og grus' : 'Snø';
        return { ...a, task: t, equipment: equipForTask(t) };
      });
      await putAddresses(next, { note: 'Admin: edit + order' });
      els.status.textContent = 'OK – lagret.';
    } catch (e) {
      console.error(e);
      els.status.textContent = `Feil: ${e.message}`;
      alert('Kunne ikke lagre.');
    } finally {
      els.save.disabled = false;
    }
  }

  function bind() {
    if (!els.reload || !els.save || !els.list) return;
    els.reload.addEventListener('click', reload);
    els.save.addEventListener('click', saveAll);
    if (location.hash === '#admin') reload();
    window.addEventListener('hashchange', () => {
      if (location.hash === '#admin') reload();
    });
  }

  bind();
})();