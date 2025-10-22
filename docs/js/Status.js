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

  function firstStart(laneObj){
    // finn første start i rounds
    if (!laneObj?.rounds?.length) return '';
    const sorted = [...laneObj.rounds].filter(r=>r.start).sort((a,b)=>(a.start>b.start?1:-1));
    return sorted[0]?.start || '';
  }
  function lastDone(laneObj){
    if (!laneObj?.rounds?.length) return '';
    const done = [...laneObj.rounds].filter(r=>r.done).sort((a,b)=>(a.done>b.done?1:-1));
    return done.length ? done[done.length-1].done : '';
  }
  function fmt(ts){
    if (!ts) return '—';
    try{
      const d=new Date(ts);
      return d.toLocaleString('no-NO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    }catch{ return '—'; }
  }

  function renderTable(){
    if (!$('#status')) return;

    const { addresses, status } = window.Sync.getCache();
    const tbody = $('#st_tbody'); if (!tbody) return;
    tbody.innerHTML = '';

    for (const a of (addresses||[])){
      const stA = status?.[a.id] || {};
      const snow = stA.snow || { state:'venter', by:null, rounds:[] };
      const grit = stA.grit || { state:'venter', by:null, rounds:[] };

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.name||''}</td>
        <td>${fmt(firstStart(snow))}</td>
        <td>${fmt(lastDone(snow))}</td>
        <td>${fmt(firstStart(grit))}</td>
        <td>${fmt(lastDone(grit))}</td>
        <td>${snow.by || grit.by || '—'}</td>
      `;
      tbody.appendChild(tr);
    }

    // summering over
    const sums = summarize();
    $('#st_summary') && ($('#st_summary').textContent =
      `Totalt: ${sums.total} adresser • Snø ferdig: ${sums.snowDone} • Grus ferdig: ${sums.gritDone}`);
  }

  function summarize(){
    const { addresses, status } = window.Sync.getCache();
    let snowDone=0, gritDone=0, total=(addresses||[]).length;
    for(const a of (addresses||[])){
      const s = status?.[a.id] || {};
      if (s.snow?.state==='ferdig') snowDone++;
      if (s.grit?.state==='ferdig') gritDone++;
    }
    return { total, snowDone, gritDone };
  }

  async function reset(scope){
    // scope: 'mine' | 'all'
    const my = driverName();
    const cache = window.Sync.getCache();
    const st = cache.status || {};
    const patch = { status:{} };

    for(const a of (cache.addresses||[])){
      const cur = st[a.id] || {};
      const lanes = ['snow','grit'];
      let any = false;
      const out = {...cur};

      for (const lane of lanes){
        if (!cur[lane]) continue;
        if (scope==='mine' && cur[lane].by !== my) continue;

        // nullstill
        out[lane] = { state:'venter', by:null, rounds:[] };
        any = true;
      }
      if (any) patch.status[a.id] = out;
    }

    if (Object.keys(patch.status).length===0){
      alert(scope==='mine' ? 'Ingen poster å nullstille for deg.' : 'Ingenting å nullstille.');
      return;
    }
    await window.Sync.setStatusPatch(patch);
    renderTable();
  }

  function wire(){
    if (!$('#status')) return;

    $('#st_reset_mine')?.addEventListener('click', async ()=>{
      if(!confirm('Nullstille min status (snø+grus) for alle adresser?')) return;
      await reset('mine');
    });
    $('#st_reset_all')?.addEventListener('click', async ()=>{
      if(!confirm('Nullstille ALL status (snø+grus) for alle adresser?')) return;
      await reset('all');
    });

    renderTable();
    window.Sync.on('change', () => renderTable());
  }

  document.addEventListener('DOMContentLoaded', wire);
})();