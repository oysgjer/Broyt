// Del-C (Status) – oversikt + nullstilling av viste rader
(function () {
  const $ = (s) => document.querySelector(s);

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const els = {
    sync:   $('#c_sync'),
    scope:  $('#c_scope'),
    search: $('#c_search'),
    counts: $('#c_counts'),
    tbody:  $('#c_tbody'),
    table:  $('#c_table'),
    reset:  $('#c_reset'),
  };

  const S = {
    round:  window.BroytState?.getRound?.() || null,
    season: window.BroytState?.getSeason?.() || '',
    list:   [],
    filtered: [],
    iNow:    0, // peker til "nå"
  };

  // --- Nett
  async function getLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache:'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }
  async function putPayload(payload) {
    const r = await fetch(`${API}b/${BIN}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }

  function mapAddr(a) {
    const status = a.status || (a.done ? 'done' : 'idle');
    const doneBy = Array.isArray(a.doneBy) ? [...new Set(a.doneBy)] : (a.done ? ['ukjent'] : []);
    const st = (a.stikkerSeason && a.stikkerSeason.season === S.season)
      ? a.stikkerSeason : {season:S.season, done:false, doneAt:null};

    return {
      name: a.name || 'Uten navn',
      group: a.group || '',
      equipment: Array.isArray(a.equipment) ? a.equipment : [],
      status,
      startedAt: a.startedAt || null,
      finishedAt: a.finishedAt || null,
      doneBy,
      stikkerCount: Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0,
      stikkerSeason: st,
      active: a.active !== false
    };
  }

  function fmtTime(t) {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // --- Filter/søk
  function applyFilters() {
    const text = (els.search.value || '').toLowerCase().trim();
    const scope = els.scope.value; // 'ALLE' | 'SNO' | 'GRUS'

    let arr = S.list.slice();

    if (scope === 'GRUS') {
      // Grus: kun adresser som faktisk kan strøs
      arr = arr.filter(a => a.equipment?.includes('stro'));
    } // Snø: alle aktive

    if (text) {
      arr = arr.filter(a =>
        a.name.toLowerCase().includes(text) ||
        a.group.toLowerCase().includes(text)
      );
    }

    S.filtered = arr;
    renderCounts();
    renderTable();
  }

  function renderCounts() {
    const n = S.filtered.length;
    const c = { idle:0, started:0, skipped:0, blocked:0, done:0 };
    S.filtered.forEach(a => { c[a.status] = (c[a.status] || 0) + 1; });
    els.counts.textContent = `${n} adresser • Ikke påbegynt: ${c.idle||0} • Pågår: ${c.started||0} • Ferdig: ${c.done||0} • Hoppet over: ${c.skipped||0} • Ikke mulig: ${c.blocked||0}`;
  }

  // bestem "nå" og "neste" rad (enkelt)
  function computeNowIndex() {
    const dir = S.round?.driver?.direction || 'Normal';
    const seq = S.filtered;
    if (!seq.length) { S.iNow = 0; return; }
    if (dir === 'Motsatt') {
      let idx = seq.length - 1;
      while (idx > 0 && (seq[idx].status === 'done' || seq[idx].status === 'blocked' || seq[idx].status === 'skipped')) idx--;
      S.iNow = idx;
    } else {
      let idx = 0;
      while (idx < seq.length-1 && (seq[idx].status === 'done' || seq[idx].status === 'blocked' || seq[idx].status === 'skipped')) idx++;
      S.iNow = idx;
    }
  }

  function statusBadge(s) {
    const map = {
      'idle':   { cls:'badge badge-idle',   txt:'Ikke påbegynt' },
      'started':{ cls:'badge badge-started',txt:'Pågår' },
      'skipped':{ cls:'badge badge-skip',   txt:'Hoppet over' },
      'blocked':{ cls:'badge badge-block',  txt:'Ikke mulig' },
      'done':   { cls:'badge badge-done',   txt:'Ferdig' },
    };
    const {cls, txt} = map[s] || map['idle'];
    return `<span class="${cls}">${txt}</span>`;
  }

  function renderTable() {
    computeNowIndex();

    const me = S.round?.driver?.name || '';
    const dir = S.round?.driver?.direction || 'Normal';

    els.tbody.innerHTML = S.filtered.map((a, i) => {
      const isNow = (i === S.iNow);
      const isNext = (dir === 'Motsatt') ? (i === S.iNow - 1) : (i === S.iNow + 1);

      const who = (a.doneBy && a.doneBy.length)
        ? a.doneBy.map(n => `<span class="tag ${n===me?'tag-me':'tag-other'}">${n}</span>`).join(' ')
        : '<span class="muted">—</span>';

      const stikkerTxt = (a.stikkerCount > 0)
        ? `${a.stikkerSeason?.done ? '✅' : '⬜️'} ${a.stikkerCount} stk`
        : '—';

      return `
        <tr class="${isNow?'now-row':''} ${isNext?'next-row':''}">
          <td>${i+1}</td>
          <td>${a.name}</td>
          <td>${a.group || '—'}</td>
          <td>${statusBadge(a.status)}</td>
          <td>${fmtTime(a.startedAt)}</td>
          <td>${fmtTime(a.finishedAt)}</td>
          <td>${who}</td>
          <td>${stikkerTxt}</td>
        </tr>
      `;
    }).join('');
  }

  async function sync() {
    try {
      els.sync.disabled = true;
      const cloud = await getLatest();
      const arr = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];
      S.list = arr.filter(a => a.active !== false).map(mapAddr);
      applyFilters();
    } catch (e) {
      alert('Kunne ikke hente status: ' + e.message);
    } finally {
      els.sync.disabled = false;
    }
  }

  // --- Nullstill viste (sett alle viste til idle, null tider, clear doneBy)
  async function resetVisible() {
    const n = S.filtered.length;
    if (!n) return alert('Ingen adresser i visning å nullstille.');
    const scope = els.scope.value;
    const ok = confirm(`Nullstille ${n} viste adresser?\n\nDette fjerner status (Pågår/Ferdig/Hoppet over/Ikke mulig), start-/ferdig-tider og "Utført av".\n\nStikker for sesong beholdes.\n\nFiltrering: ${scope}.`);
    if (!ok) return;

    try {
      els.reset.disabled = true;
      els.reset.textContent = 'Nullstiller…';

      // hent fersk sky
      const cloud = await getLatest();
      const list = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];

      // lag oppslag over navn vi skal nullstille
      const namesToReset = new Set(S.filtered.map(a => a.name));

      // gå gjennom cloud-lista og nullstill matchede navn
      const next = list.map(a => {
        if (!namesToReset.has(a.name)) return a; // ikke i visning
        return {
          ...a,
          status: 'idle',
          done: false,
          startedAt: null,
          finishedAt: null,
          doneBy: [],
          // bevar stikkerSeason, stikkerCount, equipment, group, osv.
        };
      });

      // skriv tilbake
      const payload = {
        version: window.APP_CFG?.APP_VER || '9.x',
        updated: Date.now(),
        by: (S.round?.driver?.name || 'admin'),
        season: S.season,
        addresses: next,
        // bevar hefter som serviceLogs/backups om de finnes
        serviceLogs: Array.isArray(cloud.serviceLogs) ? cloud.serviceLogs : [],
        backups: Array.isArray(cloud.backups) ? cloud.backups : []
      };
      await putPayload(payload);

      // lokalt oppdatere og re-tegne
      S.list = next.filter(a => a.active !== false).map(mapAddr);
      applyFilters();

      els.reset.textContent = 'Ferdig';
    } catch (e) {
      console.error(e);
      alert('Nullstilling feilet: ' + e.message);
      els.reset.textContent = 'Feil';
    } finally {
      els.reset.disabled = false;
      setTimeout(() => { els.reset.textContent = '🧹 Nullstill viste'; }, 1200);
    }
  }

  // events
  els.sync.addEventListener('click', sync);
  els.scope.addEventListener('change', applyFilters);
  els.search.addEventListener('input', applyFilters);
  els.reset.addEventListener('click', resetVisible);

  // boot
  (function boot(){
    // default scope = gjeldende runde
    const job = (S.round?.job === 'GRUS') ? 'GRUS' : 'SNO';
    els.scope.value = job;
    sync();
  })();
})();