// js/Status.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const STATE_LABEL = {
    venter:   'Venter',
    'pågår':  'Pågår',
    ferdig:   'Ferdig',
    hoppet:   'Hoppet over',
    blokkert: 'Ikke mulig'
  };

  function driverName(){
    try { return (JSON.parse(localStorage.getItem('BRYT_SETTINGS'))||{}).driver || ''; }
    catch { return ''; }
  }

  function safeDate(ts){ try { return ts ? new Date(ts) : null; } catch { return null; } }

  function firstStart(laneObj){
    const rounds = Array.isArray(laneObj?.rounds) ? laneObj.rounds : [];
    const onlyStart = rounds.filter(r => r?.start);
    if (!onlyStart.length) return '';
    onlyStart.sort((a,b) => {
      const da = safeDate(a.start)?.getTime() ?? 0;
      const db = safeDate(b.start)?.getTime() ?? 0;
      return da - db;
    });
    return onlyStart[0].start || '';
  }

  function lastDone(laneObj){
    const rounds = Array.isArray(laneObj?.rounds) ? laneObj.rounds : [];
    const onlyDone = rounds.filter(r => r?.done);
    if (!onlyDone.length) return '';
    onlyDone.sort((a,b) => {
      const da = safeDate(a.done)?.getTime() ?? 0;
      const db = safeDate(b.done)?.getTime() ?? 0;
      return da - db;
    });
    return onlyDone[onlyDone.length - 1].done || '';
  }

  function fmt(ts){
    if (!ts) return '—';
    const d = safeDate(ts);
    if (!d) return '—';
    return d.toLocaleString('no-NO', {
      day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
    });
  }

  function getCacheSafe(){
    const c = (window.Sync && window.Sync.getCache) ? window.Sync.getCache() : {};
    return {
      addresses: Array.isArray(c.addresses) ? c.addresses : [],
      status:    c.status || {}
    };
  }

  function summarize(){
    const { addresses, status } = getCacheSafe();
    let snowDone = 0, gritDone = 0, total = addresses.length;
    for(const a of addresses){
      const s = status[a.id] || {};
      if (s.snow?.state === 'ferdig') snowDone++;
      if (s.grit?.state === 'ferdig') gritDone++;
    }
    return { total, snowDone, gritDone };
  }

  function renderTable(){
    if (!$('#status')) return;
    const tbody = $('#st_tbody'); if (!tbody) return;

    const { addresses, status } = getCacheSafe();
    tbody.innerHTML = '';

    for (const a of addresses){
      const stA  = status[a.id] || {};
      const snow = stA.snow || { state:'venter', by:null, rounds:[] };
      const grit = stA.grit || { state:'venter', by:null, rounds:[] };

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.name || ''}</td>
        <td>${fmt(firstStart(snow))}</td>
        <td>${fmt(lastDone(snow))}</td>
        <td>${fmt(firstStart(grit))}</td>
        <td>${fmt(lastDone(grit))}</td>
        <td>${snow.by || grit.by || '—'}</td>
      `;
      tbody.appendChild(tr);
    }

    const sums = summarize();
    if ($('#st_summary')){
      $('#st_summary').textContent =
        `Totalt: ${sums.total} adresser • Snø ferdig: ${sums.snowDone} • Grus ferdig: ${sums.gritDone}`;
    }
  }

  async function reset(scope){
    // scope: 'mine' | 'all'
    const my    = driverName();
    const cache = getCacheSafe();
    const st    = cache.status;
    const patch = { status:{} };

    for (const a of cache.addresses){
      const cur = st[a.id] || {};
      const out = { ...cur };
      let any = false;

      for (const lane of ['snow','grit']){
        const laneObj = cur[lane];

        if (scope === 'mine'){
          if (!laneObj || laneObj.by !== my) continue;
          out[lane] = { state:'venter', by:null, rounds:[] };
          any = true;
        } else {
          // 'all' – nullstill uansett (også hvis laneObj ikke fantes fra før)
          out[lane] = { state:'venter', by:null, rounds:[] };
          any = true;
        }
      }

      if (any) patch.status[a.id] = out;
    }

    if (Object.keys(patch.status).length === 0){
      alert(scope==='mine' ? 'Ingen poster å nullstille for deg.' : 'Ingenting å nullstille.');
      return;
    }

    await window.Sync.setStatusPatch(patch);
    renderTable();
  }

  function wire(){
    if (!$('#status')) return;

    $('#st_reset_mine')?.addEventListener('click', async ()=>{
      if (!confirm('Nullstille min status (snø+grus) for alle adresser?')) return;
      await reset('mine');
    });

    $('#st_reset_all')?.addEventListener('click', async ()=>{
      if (!confirm('Nullstille ALL status (snø+grus) for alle adresser?')) return;
      await reset('all');
    });

    renderTable();

    // Lytt på endringer hvis Sync eksponerer on()
    if (window.Sync && typeof window.Sync.on === 'function'){
      window.Sync.on('change', renderTable);
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();