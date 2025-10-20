/* Status.js – selvstendig statusvisning med filtrering + summer.
   Leser adresser fra S.cloud.snapshot.addresses, S.addresses
   eller fallback BRYT_ADDR (localStorage). Leser status fra BRYT_STATUS.
*/
(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const SEC = $('#status');
  if (!SEC) return;

  // ---------- Datakilder ----------
  function loadAddresses(){
    const fromS = (window.S?.cloud?.snapshot?.addresses) || window.S?.addresses;
    if (Array.isArray(fromS) && fromS.length) return fromS;
    try {
      const ls = JSON.parse(localStorage.getItem('BRYT_ADDR')||'[]');
      if (Array.isArray(ls) && ls.length) return ls;
    } catch {}
    return []; // ingen
  }
  function loadStatusMap(){
    try{ return JSON.parse(localStorage.getItem('BRYT_STATUS')||'{}'); }
    catch { return {}; }
  }

  // ---------- View state ----------
  let filter = 'alle'; // 'alle' | 'none' | 'started' | 'done' | 'skipped' | 'impossible' | 'incident'
  function labelForState(s){
    return s==='none'?'Ikke påbegynt':
           s==='started'?'Pågår':
           s==='done'?'Ferdig':
           s==='skipped'?'Hoppet over':
           s==='impossible'?'Ikke mulig':
           s==='incident'?'Uhell':'—';
  }

  // ---------- Render ----------
  function render(){
    const addrs = loadAddresses();
    const map   = loadStatusMap();

    // summer
    const counts = { none:0, started:0, done:0, skipped:0, impossible:0, incident:0 };
    addrs.forEach(a=>{
      const st = map[a.id]?.state || 'none';
      if (counts[st]!==undefined) counts[st]++; else counts.none++;
    });
    const total = addrs.length;
    const done  = counts.done;
    const ongo  = counts.started;

    // filter liste
    const filtered = addrs.filter(a=>{
      const st = map[a.id]?.state || 'none';
      if (filter==='alle') return true;
      return st === filter;
    });

    SEC.innerHTML = `
      <h1>Status</h1>

      <div class="work-top" style="margin-bottom:16px">
        <div class="work-prog" aria-label="Fremdrift">
          <div class="me"    style="width:${Math.round(100*done/Math.max(total,1))}%"></div>
          <div class="other" style="width:${Math.round(100*ongo/Math.max(total,1))}%"></div>
        </div>
        <div class="work-caption">
          <span><strong>${done}/${total}</strong> ferdig • <strong>${ongo}</strong> pågår</span>
          <span>${total ? `${done+ongo} av ${total} adresser registrert` : 'Ingen adresser'}</span>
        </div>
      </div>

      <div class="row" style="gap:8px; flex-wrap:wrap; margin:4px 0 14px">
        ${chip('alle','Alle')}
        ${chip('none','Ikke påbegynt')}
        ${chip('started','Pågår')}
        ${chip('done','Ferdig')}
        ${chip('skipped','Hoppet over')}
        ${chip('impossible','Ikke mulig')}
        ${chip('incident','Uhell')}
        <button id="st_refresh" class="btn btn-ghost">Oppfrisk</button>
        <button id="st_export"  class="btn btn-ghost">Eksporter CSV</button>
      </div>

      ${total===0 ? emptyHint() : tableHtml(filtered, map)}
    `;

    // koble knapper
    $$('#status .chip').forEach(c=>{
      c.addEventListener('click', ()=>{ filter = c.getAttribute('data-f'); render(); });
    });
    $('#st_refresh')?.addEventListener('click', ()=>render());
    $('#st_export') ?.addEventListener('click', ()=>exportCsv(addrs, map));
  }

  function chip(value, text){
    const active = (filter===value) ? 'style="background:var(--primary);color:#fff;border-color:transparent"' : '';
    return `<button class="btn btn-ghost chip" data-f="${value}" ${active}>${text}</button>`;
  }

  function emptyHint(){
    return `
      <div class="card">
        <p>Ingen adresser å vise ennå. Start en runde fra <em>Hjem</em>, eller gå til <em>Admin</em> og velg «Seed demo-adresser».</p>
      </div>
    `;
  }

  function tableHtml(rows, map){
    return `
      <div class="card" style="padding:0">
        <table style="width:100%; border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left; padding:12px">#</th>
              <th style="text-align:left">Adresse</th>
              <th style="text-align:left">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((a,i)=>{
              const st = map[a.id]?.state || 'none';
              return `<tr style="border-top:1px solid var(--sep)">
                <td style="padding:10px 12px">${i+1}</td>
                <td style="padding:10px 12px">${escapeHtml(a.name||a.id)}</td>
                <td style="padding:10px 12px">${labelForState(st)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function exportCsv(addrs, map){
    const lines = [['id','navn','status']].concat(
      addrs.map(a=>[a.id, a.name||'', map[a.id]?.state||'none'])
    );
    const csv = lines.map(r=>r.map(cell=>{
      const s = String(cell??'');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(';')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'status.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function escapeHtml(s){ return s.replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }

  // første render
  render();
})();