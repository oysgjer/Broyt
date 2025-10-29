// Reports.js — auto-read X-Master-Key from Admin (no prompts), BIN fixed
(function(){
  const $ = s=>document.querySelector(s);

  // --- Config ---
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const API_PUT    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

  function getMasterKey(){
    try{
      const candidates = [
        'BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'
      ];
      const fields = ['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']) {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      for (const k of candidates){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) continue;
        try{
          const obj = JSON.parse(raw);
          for (const f of fields){
            if (typeof obj[f] === 'string' && obj[f].length > 10) return obj[f];
          }
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
    document.getElementById('p_date').textContent   = 'Dato/tid: ' + (document.getElementById('r_date').value || new Date().toISOString());
    document.getElementById('p_driver').textContent = 'Sjåfør: '   + ((document.getElementById('r_driver').value||'').trim() || 'Ukjent');
    document.getElementById('p_round').textContent  = 'Runde: '    + (document.getElementById('r_round').value || '1');
    document.getElementById('p_task').textContent   = 'Oppgave: '  + (document.getElementById('r_task').value);
    document.getElementById('p_notes').textContent  = 'Notat: '    + ((document.getElementById('r_notes').value||'').trim() || '-');
    window.print();
  }
  function renderTable(list){
    const wrap = document.getElementById('tableWrap');
    if (!Array.isArray(list) || !list.length){
      wrap.innerHTML = '<div style="padding:12px" class="muted">Ingen data.</div>';
      return;
    }
    let html = '<table class="tbl"><thead><tr><th>Dato</th><th>Sjåfør</th><th>Runde</th><th>Oppgave</th><th>Notat</th></tr></thead><tbody>';
    list.slice().reverse().forEach(r=>{
      html += `<tr><td>${r.date||''}</td><td>${r.driver||''}</td><td>${r.round||''}</td><td>${r.task||''}</td><td>${r.notes||''}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }
  async function saveReport(key){
    const rec = {
      date: document.getElementById('r_date').value || new Date().toISOString(),
      driver: (document.getElementById('r_driver').value||'').trim() || 'Ukjent',
      round: parseInt(document.getElementById('r_round').value||'1',10),
      task: document.getElementById('r_task').value,
      notes: (document.getElementById('r_notes').value||'').trim()
    };
    const cur = await fetchRecord(key);
    const body = cur && cur.record ? cur.record : {};
    body.reports = Array.isArray(body.reports) ? body.reports : [];
    body.reports.push(rec);
    await putRecord(key, body);
    renderTable(body.reports);
    alert('Lagret i JSONBin.');
  }
  async function loadExisting(key){
    const cur = await fetchRecord(key);
    const list = (cur && cur.record && Array.isArray(cur.record.reports)) ? cur.record.reports : [];
    document.getElementById('summary').textContent = `Rapporter i JSONBin: ${list.length}`;
    renderTable(list);
  }
  function init(){
    const dt = document.getElementById('r_date');
    if (dt){ dt.value = nowLocalISO(); }
    renderFunfacts();
    const key = getMasterKey();
    const saveBtn = document.getElementById('btnSaveReport');
    if (!key){
      const msg = 'Mangler X-Master-Key. Legg den inn én gang i Admin, åpne så Rapporter på nytt.';
      const sum = document.getElementById('summary'); if (sum) sum.textContent = msg;
      if (saveBtn){ saveBtn.disabled = true; saveBtn.title = msg; }
      return;
    }
    saveBtn?.addEventListener('click', () => { saveReport(key).catch(e=>alert('Feil ved lagring: '+e.message)); });
    document.getElementById('btnPdfReport')?.addEventListener('click', exportPdf);
    loadExisting(key).catch(e=>{ const sum = document.getElementById('summary'); if (sum) sum.textContent='Feil ved henting: '+e.message; });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
