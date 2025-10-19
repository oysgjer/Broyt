// STATUS
(function(){
  const {fmtDate,fmtTime,STATE_LABEL,ensureAddressesSeeded,JSONBIN,$}=window._shared;

  function summarize(addrs,bag){
    const c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
    addrs.forEach(a=>{
      const st=(bag[a.name]||{state:'not_started'}).state;
      if(st==='not_started') c.not++;
      else if(st==='in_progress') c.prog++;
      else if(st==='done') c.done++;
      else if(st==='skipped') c.skip++;
      else if(st==='blocked') c.blk++;
      else if(st==='accident') c.acc++;
    }); return c;
  }
  function makeRow(i,a,s){
    const hasCoord = !!(a.coords && /,/.test(a.coords));
    const mapLink = hasCoord ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coords.replace(/\s+/g,''))}" target="_blank" rel="noopener">🧭</a>` : '—';
    const oppdrag = (a.flags && a.flags.snow && a.flags.grit) ? 'Snø + Grus' : ((a.flags && a.flags.grit) ? 'Grus' : 'Snø');
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${a.name||''}</td><td>${oppdrag}</td>
      <td>${(a.stakes!==''&&a.stakes!=null)?a.stakes:'—'}</td>
      <td style="text-align:center">${mapLink}</td>
      <td>${STATE_LABEL[(s&&s.state)||'not_started']}</td>
      <td>${fmtTime(s&&s.startedAt)}</td>
      <td>${fmtTime(s&&s.finishedAt)}</td>
      <td>${(s&&s.driver)||'—'}</td>
      <td>${(s&&s.photo)?'🖼️':''}</td>`;
    return tr;
  }

  async function loadStatus(){
    try{
      await ensureAddressesSeeded();
      const modeSel=$('#st_mode') ? $('#st_mode').value : 'snow';
      const cloud=await JSONBIN.getLatest();
      if(cloud && !cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;

      const addrs=Array.isArray(cloud && cloud.snapshot && cloud.snapshot.addresses) ? cloud.snapshot.addresses : [];
      const bag=(modeSel==='snow')?(cloud.statusSnow||{}):(cloud.statusGrit||{});
      const filter=$('#st_filter') ? $('#st_filter').value : 'alle';
      const tbody=$('#st_tbody'); if(tbody) tbody.innerHTML='';

      const badge=$('#st_season_badge'); if(badge) badge.textContent='Sesong: '+((cloud.settings&&cloud.settings.seasonLabel)||'—');
      const lockBtn=$('#st_lock_toggle');
      if(lockBtn){
        const lk=!!(cloud.settings&&cloud.settings.stakesLocked);
        lockBtn.textContent=lk?'🔒 Stikker låst':'🔓 Lås stikker (sesong)';
        lockBtn.dataset.locked=String(lk);
      }

      addrs.forEach((a,i)=>{
        const s=bag[a.name]||{state:'not_started'};
        let ok=true;
        if(filter==='ikke'  && s.state!=='not_started') ok=false;
        if(filter==='pågår' && s.state!=='in_progress') ok=false;
        if(filter==='ferdig'&& s.state!=='done') ok=false;
        if(filter==='hoppet'&& s.state!=='skipped') ok=false;
        if(filter==='umulig'&& s.state!=='blocked') ok=false;
        if(filter==='uhell' && s.state!=='accident') ok=false;
        if(ok && tbody) tbody.appendChild(makeRow(i,a,s));
      });

      const c=summarize(addrs,bag);
      const label=(modeSel==='snow')?'Snø':'Grus';
      const sum=$('#st_summary'); if(sum) sum.textContent=`${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
    }catch(e){ alert('Kunne ikke hente status: '+(e.message||e)); }
  }

  window.exportCsv = async function(){
    try{
      const cloud=await JSONBIN.getLatest(); if(!cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;
      const addrs=Array.isArray(cloud?.snapshot?.addresses)?cloud.snapshot.addresses:[];
      const bagSnow=cloud.statusSnow||{}, bagGrit=cloud.statusGrit||{};
      const rows=[['#','Adresse','Oppdrag','Stikker (sesong)','Koordinater','Status','Start','Ferdig','Utført av','Notat']];
      addrs.forEach((a,i)=>{
        const coord=a.coords||'';
        if(!(a.flags && a.flags.snow===false)){
          const s=bagSnow[a.name]||{};
          rows.push([String(i+1),a.name,'Snø',(a.stakes!==''?a.stakes:''),coord,STATE_LABEL[s.state||'not_started'],fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'',(s.note||'').replace(/\s+/g,' ').trim()]);
        }
        if(a.flags && a.flags.grit){
          const s=bagGrit[a.name]||{};
          rows.push([String(i+1),a.name,'Grus',(a.stakes!==''?a.stakes:''),coord,STATE_LABEL[s.state||'not_started'],fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'',(s.note||'').replace(/\s+/g,' ').trim()]);
        }
      });
      const csv=`Brøyterapport,${fmtDate()}\n`+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=`Broeyterapport_${fmtDate()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch(e){ alert('CSV-feil: '+(e.message||e)); }
  };

  window.Status={ onShow(){ $('#rp_date')?.textContent=fmtDate(); loadStatus();
    $('#st_reload')?.addEventListener('click',loadStatus);
    $('#st_filter')?.addEventListener('change',loadStatus);
    $('#st_mode')  ?.addEventListener('change',loadStatus);
    $('#st_lock_toggle')?.addEventListener('click', async ()=>{
      try{ const {refreshCloud,saveCloud}=window._shared; await refreshCloud(); const cl=window._shared.S.cloud; cl.settings ||= {}; cl.settings.stakesLocked=!cl.settings.stakesLocked; await saveCloud(); loadStatus(); }
      catch(e){ alert('Feil: '+(e.message||e)); }
    });
  }};
})();