// Del-C (Status) – oversikt over alle adresser med filter, søk og Nå/Neste-markering
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
    table:  $('#c_table')
  };

  const S = {
    round:  window.BroytState?.getRound?.() || null,
    season: window.BroytState?.getSeason?.() || '',
    list:   [],
    filtered: [],
    iNow:    0,
  };

  async function getLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache:'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
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

  function applyFilters() {
    const text = (els.search.value || '').toLowerCase().trim();
    const scope = els.scope.value; // 'ALLE' | 'SNO' | 'GRUS'

    let arr = S.list.slice();
    if (scope === 'GRUS') {
      arr = arr.filter(a => a.equipment?.includes('stro'));
    } else if (scope === 'SNO') {
      // snø = alle aktive
      arr = arr;
    }

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

  els.sync.addEventListener('click', sync);
  els.scope.addEventListener('change', applyFilters);
  els.search.addEventListener('input', applyFilters);

  (function boot(){
    const job = (S.round?.job === 'GRUS') ? 'GRUS' : 'SNO';
    els.scope.value = job;
    sync();
  })();
})();