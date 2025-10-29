// Reports.js – BIN fixed + save/print + funfacts + table
(function(){
  const $ = s=>document.querySelector(s);
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const API_PUT    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

  function nowLocalISO(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); }
  function renderFunfacts(){
    const ul = document.getElementById('funfacts'); if(!ul) return;
    const facts = [
      'Salt virker best rundt -5 °C til +5 °C.',
      'Strøing før snøfall kan redusere behovet for fresing.',
      'Lavere fart ved brøyting sparer skjær.',
      'Loggfør uhell umiddelbart for rask oppfølging.',
      'Sjekk vindretning – snø driver raskere i åpne felt.'
    ];
    ul.innerHTML = facts.map(f=>`<li>${f}</li>`).join('');
  }
  async function fetchRecord(key){
    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }
  async function putRecord(key, body){
    const r = await fetch(API_PUT, { method:'PUT', headers:{'Content-Type':'application/json','X-Master-Key': key}, body: JSON.stringify(body) });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }
  function exportPdf(){
    document.getElementById('p_date').textContent = 'Dato/tid: ' + ($('#r_date').value || new Date().toISOString());
    document.getElementById('p_driver').textContent = 'Sjåfør: ' + (($('#r_driver').value||'').trim() || 'Ukjent');
    document.getElementById('p_round').textContent  = 'Runde: ' + ($('#r_round').value || '1');
    document.getElementById('p_task').textContent   = 'Oppgave: ' + ($('#r_task').value);
    document.getElementById('p_notes').textContent  = 'Notat: ' + (($('#r_notes').value||'').trim() || '-');
    window.print();
  }
  function renderTable(list){
    const wrap = document.getElementById('tableWrap');
    if (!Array.isArray(list) || !list.length){ wrap.innerHTML = '<div style="padding:12px" class="muted">Ingen data.</div>'; return; }
    let html = '<table class="tbl"><thead><tr><th>Dato</th><th>Sjåfør</th><th>Runde</th><th>Oppgave</th><th>Notat</th></tr></thead><tbody>';
    list.slice().reverse().forEach(r=>{
      html += `<tr><td>${r.date||''}</td><td>${r.driver||''}</td><td>${r.round||''}</td><td>${r.task||''}</td><td>${r.notes||''}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  async function saveReport(){
    const key = prompt('X-Master-Key for Rapporter (lagres ikke):') || '';
    if(!key){ alert('Avbrutt.'); return; }
    const rec = {
      date: document.getElementById('r_date').value || new Date().toISOString(),
      driver: (document.getElementById('r_driver').value||'').trim() || 'Ukjent',
      round: parseInt(document.getElementById('r_round').value||'1',10),
      task: document.getElementById('r_task').value,
      notes: (document.getElementById('r_notes').value||'').trim()
    };
    try{
      const cur = await fetchRecord(key);
      const body = cur && cur.record ? cur.record : {};
      body.reports = Array.isArray(body.reports) ? body.reports : [];
      body.reports.push(rec);
      await putRecord(key, body);
      alert('Lagret i JSONBin.');
      // refresh table
      renderTable(body.reports);
    }catch(e){
      alert('Feil ved lagring: '+e.message);
      document.getElementById('offlineBadge').style.display = 'inline';
    }
  }

  async function loadExisting(){
    const key = prompt('X-Master-Key for å hente (valgfritt – Enter for å hoppe over):') || '';
    if(!key){ document.getElementById('summary').textContent='Henter hoppet over.'; return; }
    try{
      const cur = await fetchRecord(key);
      const list = (cur && cur.record && Array.isArray(cur.record.reports)) ? cur.record.reports : [];
      document.getElementById('summary').textContent = `Rapporter i JSONBin: ${list.length}`;
      renderTable(list);
    }catch(e){
      document.getElementById('summary').textContent = 'Feil: '+e.message;
    }
  }

  function init(){
    const dt = document.getElementById('r_date');
    if (dt){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); dt.value=d.toISOString().slice(0,16); }
    renderFunfacts();
    document.getElementById('btnSaveReport')?.addEventListener('click', saveReport);
    document.getElementById('btnPdfReport')?.addEventListener('click', exportPdf);
    // Auto-load table (optional)
    setTimeout(loadExisting, 300);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
