// Status – tydelig UI + robust nullstilling (viste / hele runden)
(function(){
  const $ = (s)=>document.querySelector(s);

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const els = {
    sync:   $('#c_sync'),
    scope:  $('#c_scope'),
    search: $('#c_search'),
    counts: $('#c_counts'),
    tbody:  $('#c_tbody'),
    reset:  $('#c_reset'),
    resetRound: $('#c_reset_round'),
  };

  const S = {
    round: loadRound(),
    season: window.BroytState?.getSeason?.() || '',
    list: [],
    filtered: []
  };

  function loadRound(){
    try{ return JSON.parse(localStorage.getItem('broyt:round')||'null'); }catch{ return null; }
  }

  // ---- Nett ----
  async function getLatest(){
    const r = await fetch(`${API}b/${BIN}/latest`, {cache:'no-store'});
    if(!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    const d = (data && data.record) ? data.record : data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.addresses)) return d.addresses;
    if (d.snapshot && Array.isArray(d.snapshot.addresses)) return d.snapshot.addresses;
    return [];
  }

  async function putAddresses(nextAddresses){
    // behold ekstra felter fra latest (serviceLogs/backups)
    const r0 = await fetch(`${API}b/${BIN}/latest`, {cache:'no-store'});
    const raw = await r0.json();
    const cloud = (raw && raw.record) ? raw.record : raw;

    const payload = {
      version: window.APP_CFG?.APP_VER || '9.x',
      updated: Date.now(),
      by: (S.round?.driver?.name || 'admin'),
      season: S.season,
      addresses: nextAddresses,
      serviceLogs: Array.isArray(cloud?.serviceLogs) ? cloud.serviceLogs : [],
      backups: Array.isArray(cloud?.backups) ? cloud.backups : []
    };

    const r = await fetch(`${API}b/${BIN}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error(`PUT ${r.status}`);
    return (await r.json());
  }

  // ---- Map/visning ----
  function mapAddr(a){
    const status = a.status || (a.done ? 'done' : 'idle');
    const doneBy = Array.isArray(a.doneBy) ? [...new Set(a.doneBy)] : (a.done ? ['ukjent'] : []);
    const st = (a.stikkerSeason && a.stikkerSeason.season === S.season)
      ? a.stikkerSeason : {season:S.season, done:false, doneAt:null};
    return {
      name: (a.name||'').trim(),
      group: a.group||'',
      equipment: Array.isArray(a.equipment)?a.equipment:[],
      status,
      startedAt: a.startedAt||null,
      finishedAt: a.finishedAt||null,
      doneBy,
      stikkerCount: Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0,
      stikkerSeason: st,
      active: a.active !== false
    };
  }

  function fmtTime(t){
    if(!t) return '—';
    const d = new Date(t);
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }

  function applyFilters(){
    const text = (els.search.value||'').toLowerCase().trim();
    const scope = els.scope.value; // ALLE | SNO | GRUS
    let arr = S.list.filter(a => a.active !== false);

    if (scope === 'GRUS') arr = arr.filter(a => a.equipment?.includes('stro'));
    // SNO = alle aktive

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

  function renderCounts(){
    const n = S.filtered.length;
    const c = { idle:0, started:0, skipped:0, blocked:0, done:0 };
    S.filtered.forEach(a => { c[a.status] = (c[a.status]||0)+1; });
    els.counts.textContent = `${n} adresser • Ikke påbegynt: ${c.idle||0} • Pågår: ${c.started||0} • Ferdig: ${c.done||0} • Hoppet over: ${c.skipped||0} • Ikke mulig: ${c.blocked||0}`;
  }

  function badge(s){
    const map = {
      idle:['badge badge-idle','Ikke påbegynt'],
      started:['badge badge-started','Pågår'],
      skipped:['badge badge-skip','Hoppet over'],
      blocked:['badge badge-block','Ikke mulig'],
      done:['badge badge-done','Ferdig']
    }[s] || ['badge','—'];
    return `<span class="${map[0]}">${map[1]}</span>`;
  }

  function renderTable(){
    const me = S.round?.driver?.name || '';
    const rows = S.filtered.map((a,i)=>{
      const who = (a.doneBy && a.doneBy.length)
        ? a.doneBy.map(n=>`<span class="tag ${n===me?'tag-me':'tag-other'}">${n}</span>`).join(' ')
        : '<span class="muted">—</span>';
      const stikkerTxt = (a.stikkerCount>0)
        ? `${a.stikkerSeason?.done ? '✅' : '⬜️'} ${a.stikkerCount} stk`
        : '—';

      return `
        <tr>
          <td>${i+1}</td>
          <td>${a.name}</td>
          <td>${a.group || '—'}</td>
          <td>${badge(a.status)}</td>
          <td>${fmtTime(a.startedAt)}</td>
          <td>${fmtTime(a.finishedAt)}</td>
          <td>${who}</td>
          <td>${stikkerTxt}</td>
        </tr>
      `;
    }).join('');
    $('#c_tbody').innerHTML = rows;
  }

  async function sync(){
    try{
      els.sync.disabled = true;
      const latest = await getLatest();
      S.list = latest.map(mapAddr);
      applyFilters();
    } catch(e){
      alert('Kunne ikke hente status: '+e.message);
    } finally {
      els.sync.disabled = false;
    }
  }

  // ---- Nullstilling ----
  function namesSetFrom(arr){ return new Set(arr.map(a => (a.name||'').trim())); }

  async function resetVisible(){
    if (!S.filtered.length) return alert('Ingen adresser i visning å nullstille.');
    const ok = confirm(`Nullstille ${S.filtered.length} viste adresser?\nDette fjerner status/tider/"Utført av". Stikker beholdes.`);
    if(!ok) return;
    await doReset(namesSetFrom(S.filtered));
  }

  async function resetRound(){
    const scope = els.scope.value;
    const base = (scope==='GRUS') ? S.list.filter(a=>a.equipment?.includes('stro')) : S.list;
    if (!base.length) return alert('Ingen adresser å nullstille.');
    const ok = confirm(`Nullstille hele runden (${base.length} adresser)?\nDette fjerner status/tider/"Utført av". Stikker beholdes.`);
    if(!ok) return;
    await doReset(namesSetFrom(base));
  }

  async function doReset(namesSet){
    try{
      els.reset.disabled = true; els.resetRound.disabled = true;

      const current = await getLatest();
      const next = current.map(a=>{
        const nm = (a.name||'').trim();
        if(!namesSet.has(nm)) return a;
        return {
          ...a,
          status:'idle',
          done:false,
          startedAt:null,
          finishedAt:null,
          doneBy:[]
        };
      });

      await putAddresses(next);
      // lokal refresh
      S.list = next.map(mapAddr);
      applyFilters();
      alert('Nullstilling fullført.');
    } catch(e){
      console.error(e);
      alert('Nullstilling feilet: '+e.message);
    } finally {
      els.reset.disabled = false; els.resetRound.disabled = false;
    }
  }

  // events
  els.sync.addEventListener('click', sync);
  els.scope.addEventListener('change', applyFilters);
  els.search.addEventListener('input', applyFilters);
  els.reset.addEventListener('click', resetVisible);
  els.resetRound.addEventListener('click', resetRound);

  // boot
  (function boot(){
    const job = (S.round?.job === 'GRUS') ? 'GRUS' : 'SNO';
    if ($('#c_scope')) $('#c_scope').value = job;
    sync();
  })();
})();