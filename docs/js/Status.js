/* =========================================================
   Status – oversikt og rapport
   - Teller (tot / ikke / pågår / ferdig / hoppet / umulig / uhell)
   - Filter-knapper
   - Tabell med kart-lenke
   - Oppfrisk / CSV-eksport
   Forutsetter at del-d.js har eksportert:
     JSONBIN, ensureAddressesSeeded, refreshCloud, statusStore, STATE_LABEL
   ========================================================= */

(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  /* ---------- Små helpers ---------- */
  const fmtTime = t => !t ? '—' : new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
  const fmtDate = () => new Date().toLocaleDateString('no-NO');

  const STATES = [
    {key:'alle',       label:'Alle'},
    {key:'ikke',       label:'Ikke påbegynt',  match: s => (s?.state||'not_started')==='not_started'},
    {key:'pågår',      label:'Pågår',          match: s => (s?.state)==='in_progress'},
    {key:'ferdig',     label:'Ferdig',         match: s => (s?.state)==='done'},
    {key:'hoppet',     label:'Hoppet over',    match: s => (s?.state)==='skipped'},
    {key:'umulig',     label:'Ikke mulig',     match: s => (s?.state)==='blocked'},
    {key:'uhell',      label:'Uhell',          match: s => (s?.state)==='accident'},
  ];

  function mapsLink(a){
    if(a.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(a.coords)){
      const q=a.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((a.name||'')+', Norge');
  }

  /* ---------- UI skeleton (genereres her, så index trenger ikke endres) ---------- */
  function ensureStatusSkeleton(){
    const host = $('#status');
    if(!host) return;

    host.innerHTML = `
      <h1>Status</h1>

      <div class="work-top" style="margin-bottom:16px">
        <div id="st_counts" class="work-caption" style="gap:8px; flex-wrap:wrap">
          <span id="st_count_tot">—</span>
          <span>•</span>
          <span id="st_count_ikke">Ikke påbegynt: —</span>
          <span id="st_count_pågår">Pågår: —</span>
          <span id="st_count_ferdig">Ferdig: —</span>
          <span id="st_count_hoppet">Hoppet: —</span>
          <span id="st_count_umulig">Ikke mulig: —</span>
          <span id="st_count_uhell">Uhell: —</span>
        </div>
      </div>

      <div class="row" style="gap:8px; margin:10px 0 14px" id="st_filters"></div>

      <div class="row" style="gap:8px; margin:0 0 12px">
        <button id="st_reload" class="btn-ghost">Oppfrisk</button>
        <button id="st_export" class="btn-ghost">Eksporter CSV</button>
        <span id="st_season_badge" class="badge" style="margin-left:auto; opacity:.9">Sesong: —</span>
      </div>

      <div class="card" style="padding:0">
        <div style="overflow:auto">
          <table id="st_table" style="width:100%; border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left; padding:12px;">#</th>
                <th style="text-align:left; padding:12px;">Adresse</th>
                <th style="text-align:left; padding:12px;">Oppdrag</th>
                <th style="text-align:left; padding:12px;">Stikker</th>
                <th style="text-align:center; padding:12px;">Kart</th>
                <th style="text-align:left; padding:12px;">Status</th>
                <th style="text-align:left; padding:12px;">Start</th>
                <th style="text-align:left; padding:12px;">Ferdig</th>
                <th style="text-align:left; padding:12px;">Utført av</th>
              </tr>
            </thead>
            <tbody id="st_tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    // build filter buttons
    const filterRow = $('#st_filters');
    STATES.forEach(s=>{
      const b = document.createElement('button');
      b.className = 'btn-ghost';
      b.dataset.key = s.key;
      b.textContent = s.label;
      b.addEventListener('click', ()=>applyFilter(s.key));
      filterRow.appendChild(b);
    });

    $('#st_reload')?.addEventListener('click', loadStatus);
    $('#st_export')?.addEventListener('click', exportCsv);
  }

  /* ---------- Data + rendering ---------- */
  let DATA = { addrs:[], bagSnow:{}, bagGrit:{}, mode:'snow', settings:{} };
  let activeFilter = 'alle';

  async function loadStatus(){
    try{
      ensureStatusSkeleton();
      await ensureAddressesSeeded();
      await refreshCloud();

      const cloud = await JSONBIN.getLatest();
      if(cloud && !cloud.statusSnow && cloud.status) cloud.statusSnow = cloud.status;

      const addrs = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
      const bagSnow = cloud.statusSnow || {};
      const bagGrit = cloud.statusGrit || {};
      const mode = 'snow'; // vis standard snø-status her; kan evt. styres senere fra UI
      const settings = cloud.settings || {};

      DATA = { addrs, bagSnow, bagGrit, mode, settings };

      // Oppdater topp-informasjon
      $('#st_season_badge') && ($('#st_season_badge').textContent = 'Sesong: ' + (settings.seasonLabel || '—'));

      computeAndPaintCounts();
      paintTable(); // bruker aktivt filter
      markActiveFilter();
    }catch(e){
      alert('Kunne ikke hente status: ' + (e.message||e));
    }
  }

  function bagForMode(){
    return (DATA.mode === 'snow') ? DATA.bagSnow : DATA.bagGrit;
  }

  function computeAndPaintCounts(){
    const bag = bagForMode();
    const counts = {
      tot: DATA.addrs.length, ikke:0, pågår:0, ferdig:0, hoppet:0, umulig:0, uhell:0
    };
    DATA.addrs.forEach(a=>{
      const s = bag[a.name] || {state:'not_started'};
      const st = s.state || 'not_started';
      if(st==='not_started') counts.ikke++;
      else if(st==='in_progress') counts.pågår++;
      else if(st==='done') counts.ferdig++;
      else if(st==='skipped') counts.hoppet++;
      else if(st==='blocked') counts.umulig++;
      else if(st==='accident') counts.uhell++;
    });

    $('#st_count_tot')    && ($('#st_count_tot').textContent    = `Totalt: ${counts.tot}`);
    $('#st_count_ikke')   && ($('#st_count_ikke').textContent   = `Ikke påbegynt: ${counts.ikke}`);
    $('#st_count_pågår')  && ($('#st_count_pågår').textContent  = `Pågår: ${counts.pågår}`);
    $('#st_count_ferdig') && ($('#st_count_ferdig').textContent = `Ferdig: ${counts.ferdig}`);
    $('#st_count_hoppet') && ($('#st_count_hoppet').textContent = `Hoppet: ${counts.hoppet}`);
    $('#st_count_umulig') && ($('#st_count_umulig').textContent = `Ikke mulig: ${counts.umulig}`);
    $('#st_count_uhell')  && ($('#st_count_uhell').textContent  = `Uhell: ${counts.uhell}`);
  }

  function paintTable(){
    const tb = $('#st_tbody'); if(!tb) return;
    tb.innerHTML = '';

    const bag = bagForMode();
    const stateDef = STATES.find(s=>s.key===activeFilter);
    const match = stateDef?.match;

    DATA.addrs.forEach((a,i)=>{
      const s = bag[a.name] || {state:'not_started'};
      if(activeFilter !== 'alle' && match && !match(s)) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${i+1}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${a.name||''}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${(a.flags?.snow && a.flags?.grit)?'Snø + Grus':(a.flags?.grit?'Grus':'Snø')}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${(a.stakes!=='' && a.stakes!=null)?a.stakes:'—'}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep); text-align:center;">
          <a href="${mapsLink(a)}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 10px">🧭</a>
        </td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${STATE_LABEL[s.state||'not_started']}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${fmtTime(s.startedAt)}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${fmtTime(s.finishedAt)}</td>
        <td style="padding:10px 12px; border-top:1px solid var(--sep)">${s.driver||'—'}</td>
      `;
      tb.appendChild(tr);
    });
  }

  function applyFilter(key){
    activeFilter = key;
    markActiveFilter();
    paintTable();
  }

  function markActiveFilter(){
    $$('#st_filters .btn-ghost').forEach(b=>{
      if(b.dataset.key===activeFilter){
        b.style.background = 'var(--sep)';
      }else{
        b.style.background = 'transparent';
      }
    });
  }

  /* ---------- CSV ---------- */
  async function exportCsv(){
    try{
      // Sikre ferske data før eksport
      await refreshCloud();
      const cloud = await JSONBIN.getLatest();
      if(cloud && !cloud.statusSnow && cloud.status) cloud.statusSnow = cloud.status;

      const addrs = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
      const bagSnow = cloud.statusSnow || {};
      const bagGrit = cloud.statusGrit || {};

      const rows=[['#','Adresse','Oppdrag','Stikker (sesong)','Koordinater','Status','Start','Ferdig','Utført av','Notat']];
      addrs.forEach((a,i)=>{
        // Snø
        if(!(a.flags && a.flags.snow===false)){
          const s=bagSnow[a.name]||{};
          rows.push([
            String(i+1), a.name, 'Snø',
            (a.stakes!==''?a.stakes:''), (a.coords||''),
            STATE_LABEL[s.state||'not_started'],
            fmtTime(s.startedAt), fmtTime(s.finishedAt), (s.driver||''), (s.note||'').replace(/\s+/g,' ').trim()
          ]);
        }
        // Grus
        if(a.flags && a.flags.grit){
          const s=bagGrit[a.name]||{};
          rows.push([
            String(i+1), a.name, 'Grus',
            (a.stakes!==''?a.stakes:''), (a.coords||''),
            STATE_LABEL[s.state||'not_started'],
            fmtTime(s.startedAt), fmtTime(s.finishedAt), (s.driver||''), (s.note||'').replace(/\s+/g,' ').trim()
          ]);
        }
      });

      const csv=`Brøyterapport,${fmtDate()}\n`+
        rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');

      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download=`Broeyterapport_${fmtDate()}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch(e){
      alert('CSV-feil: '+(e.message||e));
    }
  }

  /* ---------- Hook på navigasjon ---------- */
  // Kalles fra routeren i del-d.js når #status vises
  window.__enterStatusPage = function(){
    ensureStatusSkeleton();
    loadStatus();
  };

  // Hvis vi allerede står på #status ved first load
  if (location.hash === '#status'){
    ensureStatusSkeleton();
    loadStatus();
  }
})();