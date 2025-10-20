/* =========================================================
   Status.js — oversikt & tabell
   • Leser fra Cloud (JSONBin) og viser oppsummert status
   • Oppdaterer seg med polling
   ========================================================= */

(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  function fmtTime(t){ return !t ? '—' : new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}); }
  const LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

  function summarize(addrs, bag){
    const c = {tot:addrs.length, not:0, prog:0, done:0, skip:0, blk:0, acc:0};
    addrs.forEach(a=>{
      const st = (bag[a.name]||{state:'not_started'}).state;
      if(st==='not_started') c.not++;
      else if(st==='in_progress') c.prog++;
      else if(st==='done') c.done++;
      else if(st==='skipped') c.skip++;
      else if(st==='blocked') c.blk++;
      else if(st==='accident') c.acc++;
    });
    return c;
  }

  function makeRow(i,a,s){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${a.name||''}</td>
      <td>${LABEL[s?.state||'not_started']}</td>
      <td>${fmtTime(s?.startedAt)}</td>
      <td>${fmtTime(s?.finishedAt)}</td>
      <td>${s?.driver||'—'}</td>
    `;
    return tr;
  }

  async function renderStatus(){
    const cloud = await Cloud.getLatest();
    const modeSel = $('#st_mode')?.value || 'snow';
    const addrs = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
    const bag   = (modeSel==='snow') ? (cloud.statusSnow||{}) : (cloud.statusGrit||{});

    const tb = $('#st_tbody');
    if(tb) tb.innerHTML = '';
    addrs.forEach((a,i)=>{
      tb?.appendChild(makeRow(i,a, bag[a.name]||{state:'not_started'}));
    });

    const c = summarize(addrs, bag);
    const label = (modeSel==='snow')?'Snø':'Grus';
    const sum = $('#st_summary');
    if(sum) sum.textContent = `${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;

    const badge = $('#st_season_badge');
    if(badge) badge.textContent = 'Sesong: '+((cloud.settings&&cloud.settings.seasonLabel)||'—');
  }

  $('#st_mode')?.addEventListener('change', renderStatus);
  $('#st_reload')?.addEventListener('click', renderStatus);

  document.addEventListener('DOMContentLoaded', ()=>{
    renderStatus();
    Cloud.subscribe(()=>{ renderStatus(); }, 30000);
  });

  // Eksponer for debugging
  window.__STATUS__ = { reload:renderStatus };
})();