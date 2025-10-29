// Reports.js — READ-ONLY log (filters + CSV/PDF)
(function(){
  const $ = s=>document.querySelector(s);
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

  function getMasterKey(){
    try{
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']) {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      const candidates = ['BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'];
      const fields = ['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of candidates){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) continue;
        try{
          const obj = JSON.parse(raw);
          for (const f of fields){ if (typeof obj[f] === 'string' && obj[f].length > 10) return obj[f]; }
          const stack=[obj];
          while (stack.length){
            const it = stack.pop();
            if (typeof it === 'string' && it.length > 20) return it;
            if (it && typeof it === 'object'){ for (const v of Object.values(it)) stack.push(v); }
          }
        }catch{}
      }
    }catch{}
    return null;
  }

  function fmtTs(ts){ try{ return new Date(ts).toLocaleString(); }catch{ return ts; } }

  function renderTable(list){
    const wrap = document.getElementById('tableWrap');
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
    const cols = ['ts','driver','action','address','notes'];
    const rows = [cols.join(';')];
    list.forEach(r=> rows.push([r.ts||r.date||'', r.driver||'', r.action||r.task||'', r.address||r.addr||'', r.notes||r.note||''].map(csvEscape).join(';')) );
    const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='rapporter.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function applyFilters(all){
    const from = document.getElementById('f_from').value ? new Date(document.getElementById('f_from').value+'T00:00:00') : null;
    const to   = document.getElementById('f_to').value   ? new Date(document.getElementById('f_to').value+'T23:59:59') : null;
    const drv  = document.getElementById('f_driver').value.trim().toLowerCase();
    const addr = document.getElementById('f_addr').value.trim().toLowerCase();
    const act  = document.getElementById('f_action').value;
    return all.filter(r=>{
      const t = new Date(r.ts || r.date || Date.now());
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (drv && String(r.driver||'').toLowerCase() !== drv) return false;
      if (addr){
        const hay = (r.address||r.addr||'') + ' ' + (r.notes||r.note||'');
        if (hay.toLowerCase().indexOf(addr) === -1) return false;
      }
      if (act && (r.action||'') !== act && (r.task||'') !== act) return false;
      return true;
    });
  }

  function populateDrivers(all){
    const set = new Set();
    all.forEach(r=>{ if (r.driver) set.add(String(r.driver)); });
    const sel = document.getElementById('f_driver');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Alle</option>' + Array.from(set).sort().map(n=>`<option value="${n.toLowerCase()}">${n}</option>`).join('');
    sel.value = cur || '';
  }

  async function loadData(){
    const key = getMasterKey();
    if (!key){ document.getElementById('summary').textContent = 'Mangler X-Master-Key. Legg den inn i Admin og åpne siden på nytt.'; return []; }
    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if (!r.ok){ document.getElementById('summary').textContent = 'Feil fra JSONBin: '+r.status; return []; }
    const j = await r.json();
    const rec = j && j.record ? j.record : {};
    const reports = Array.isArray(rec.reports) ? rec.reports : [];
    document.getElementById('summary').innerHTML = `Totalt <b>${reports.length}</b> linjer.`;
    populateDrivers(reports);
    return reports;
  }

  function printView(list){
    document.getElementById('printMeta').textContent = `Antall: ${list.length}`;
    const wrap = document.getElementById('printTable');
    let html = '<table class="tbl"><thead><tr><th>Tid</th><th>Sjåfør</th><th>Hendelse</th><th>Adresse</th><th>Notat</th></tr></thead><tbody>';
    list.forEach(r=>{
      html += `<tr><td>${fmtTs(r.ts||r.date||'')}</td><td>${r.driver||''}</td><td>${(r.action||r.task||'').replace('_',' ')}</td><td>${r.address||r.addr||''}</td><td>${r.notes||r.note||''}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    window.print();
  }

  async function init(){
    const all = await loadData();
    renderTable(applyFilters(all));
    document.getElementById('btnApply')?.addEventListener('click', ()=> renderTable(applyFilters(all)));
    document.getElementById('btnReset')?.addEventListener('click', ()=>{
      ['f_from','f_to','f_driver','f_addr','f_action'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      renderTable(applyFilters(all));
    });
    document.getElementById('btnExportCsv')?.addEventListener('click', ()=> exportCsv(applyFilters(all)));
    document.getElementById('btnPrint')?.addEventListener('click', ()=> {
      const v = applyFilters(all);
      document.getElementById('printMeta').textContent = `Antall: ${v.length}`;
      const wrap = document.getElementById('printTable');
      let html = '<table class="tbl"><thead><tr><th>Tid</th><th>Sjåfør</th><th>Hendelse</th><th>Adresse</th><th>Notat</th></tr></thead><tbody>';
      v.forEach(r=>{ html += `<tr><td>${fmtTs(r.ts||r.date||'')}</td><td>${r.driver||''}</td><td>${(r.action||r.task||'').replace('_',' ')}</td><td>${r.address||r.addr||''}</td><td>${r.notes||r.note||''}</td></tr>`; });
      html += '</tbody></table>';
      wrap.innerHTML = html;
      window.print();
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
