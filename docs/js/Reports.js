// Reports.js — READ-ONLY logg med filter + CSV/PDF (kjør kun på rapportsiden)
(function(){
  if (!document.getElementById('tableWrap')) return; // <- viktig guard

  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

  function getMasterKey(){
    try{
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']) {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      const blobs=['BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'];
      const fields=['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of blobs){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k); if (!raw) continue;
        try{
          const o = JSON.parse(raw);
          for (const f of fields){ if (typeof o[f]==='string' && o[f].length>10) return o[f]; }
          const st=[o]; while(st.length){ const it=st.pop();
            if (typeof it==='string' && it.length>20) return it;
            if (it && typeof it==='object') Object.values(it).forEach(v=>st.push(v));
          }
        }catch{}
      }
    }catch{}
    return null;
  }

  const $ = s=>document.querySelector(s);
  function fmtTs(ts){ try{ return new Date(ts).toLocaleString(); }catch{ return ts; } }

  function renderTable(list){
    const wrap = $('#tableWrap');
    if (!Array.isArray(list) || !list.length){
      wrap.innerHTML = '<div style="padding:12px" class="muted">Ingen data.</div>'; return;
    }
    let html = '<table class="tbl"><thead><tr><th>Tid</th><th>Sjåfør</th><th>Hendelse</th><th>Adresse</th><th>Notat</th></tr></thead><tbody>';
    list.forEach(r=>{
      html += `<tr><td>${fmtTs(r.ts||r.date||'')}</td><td>${r.driver||''}</td><td>${(r.action||r.task||'').replace('_',' ')}</td><td>${r.address||r.addr||''}</td><td>${r.notes||r.note||''}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }
  function csvEscape(v){ if (v==null) return ''; const s=String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
  function exportCsv(list){
    const cols=['ts','driver','action','address','notes'];
    const rows=[cols.join(';')];
    list.forEach(r=> rows.push([r.ts||r.date||'', r.driver||'', r.action||r.task||'', r.address||r.addr||'', r.notes||r.note||''].map(csvEscape).join(';')));
    const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='rapporter.csv'; a.click();
    URL.revokeObjectURL(url);
  }
  function applyFilters(all){
    const from=$('#f_from').value ? new Date($('#f_from').value+'T00:00:00') : null;
    const to  =$('#f_to').value   ? new Date($('#f_to').value+'T23:59:59') : null;
    const drv =$('#f_driver').value.trim().toLowerCase();
    const addr=$('#f_addr').value.trim().toLowerCase();
    const act =$('#f_action').value;
    return all.filter(r=>{
      const t=new Date(r.ts || r.date || Date.now());
      if (from && t<from) return false;
      if (to   && t>to)   return false;
      if (drv && String(r.driver||'').toLowerCase()!==drv) return false;
      if (addr){
        const hay=(r.address||r.addr||'')+' '+(r.notes||r.note||'');
        if (hay.toLowerCase().indexOf(addr)===-1) return false;
      }
      if (act && (r.action||'')!==act && (r.task||'')!==act) return false;
      return true;
    });
  }
  function populateDrivers(all){
    const set = new Set(); all.forEach(r=>{ if (r.driver) set.add(String(r.driver)); });
    const sel=$('#f_driver'); const cur=sel.value;
    sel.innerHTML='<option value="">Alle</option>'+Array.from(set).sort().map(n=>`<option value="${n.toLowerCase()}">${n}</option>`).join('');
    sel.value=cur||'';
  }
  async function loadData(){
    const key = getMasterKey();
    if (!key){ $('#summary').textContent='Mangler X-Master-Key. Legg den inn i Admin og åpne siden på nytt.'; return []; }
    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if (!r.ok){ $('#summary').textContent='Feil fra JSONBin: '+r.status; return []; }
    const j = await r.json();
    const rec = j && j.record ? j.record : {};
    const reports = Array.isArray(rec.reports) ? rec.reports : [];
    const s = $('#summary'); if (s) s.innerHTML=`Totalt <b>${reports.length}</b> linjer.`;
    populateDrivers(reports);
    return reports;
  }

  async function init(){
    const all = await loadData();
    renderTable(applyFilters(all));
    $('#btnApply')?.addEventListener('click', ()=> renderTable(applyFilters(all)));
    $('#btnReset')?.addEventListener('click', ()=>{ ['f_from','f_to','f_driver','f_addr','f_action'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; }); renderTable(applyFilters(all)); });
    $('#btnExportCsv')?.addEventListener('click', ()=> exportCsv(applyFilters(all)));
    $('#btnPrint')?.addEventListener('click', ()=> {
      const v = applyFilters(all);
      const meta = $('#printMeta'); if (meta) meta.textContent = `Antall: ${v.length}`;
      const wrap = $('#printTable'); let html = '<table class="tbl"><thead><tr><th>Tid</th><th>Sjåfør</th><th>Hendelse</th><th>Adresse</th><th>Notat</th></tr></thead><tbody>';
      v.forEach(r=> html += `<tr><td>${fmtTs(r.ts||r.date||'')}</td><td>${r.driver||''}</td><td>${(r.action||r.task||'').replace('_',' ')}</td><td>${r.address||r.addr||''}</td><td>${r.notes||r.note||''}</td></tr>`);
      wrap.innerHTML = html + '</tbody></table>';
      window.print();
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
