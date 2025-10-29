// Reports.js — auto-read X-Master-Key from Admin (no prompts), BIN fixed
(function(){
  const $ = s=>document.querySelector(s);

  // --- Config ---
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const API_PUT    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

  // Try our best to read a master key that was saved in Admin
  function getMasterKey(){
    try{
      // Common keys/shape used in earlier versions
      const candidates = [
        'BRYT_SYNC_CFG', 'SYNC_CFG', 'APP_CFG', 'CONFIG', 'BRØYT_CFG', 'BROYT_CFG',
        'JSONBIN_CFG', 'JSONBIN'
      ];
      const fields = ['apiKey', 'reportsKey', 'masterKey', 'jsonbinKey', 'key'];
      // Direct single-value keys first
      for (const k of ['X_MASTER_KEY', 'JSONBIN_MASTER_KEY']) {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      // JSON blobs
      for (const k of candidates){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) continue;
        try{
          const obj = JSON.parse(raw);
          // Exact fields
          for (const f of fields){
            if (typeof obj[f] === 'string' && obj[f].length > 10) return obj[f];
          }
          // Deep scan for any plausible key-looking string
          const stack = [obj];
          while (stack.length){
            const it = stack.pop();
            if (typeof it === 'string' && it.length > 20) return it;
            if (it && typeof it === 'object'){
              for (const v of Object.values(it)) stack.push(v);
            }
          }
        }catch{}
      }
    }catch{}
    return null;
  }

  function nowLocalISO(){
    const d=new Date();
    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
    return d.toISOString().slice(0,16);
  }

  function renderFunfacts(){
    const ul = $('#funfacts'); if(!ul) return;
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
    const r = await fetch(API_PUT, {
      method:'PUT',
      headers:{'Content-Type':'application/json','X-Master-Key': key},
      body: JSON.stringify(body)
    });
    if(!r.ok) throw new Error('JSONBin feil '+r.status);
    return r.json();
  }

  function exportPdf(){
    $('#p_date').textContent   = 'Dato/tid: ' + ($('#r_date').value || new Date().toISOString());
    $('#p_driver').textContent = 'Sjåfør: '   + (($('#r_driver').value||'').trim() || 'Ukjent');
    $('#p_round').textContent  = 'Runde: '    + ($('#r_round').value || '1');
    $('#p_task').textContent   = 'Oppgave: '  + ($('#r_task').value);
    $('#p_notes').textContent  = 'Notat: '    + (($('#r_notes').value||'').trim() || '-');
    window.print();
  }

  function renderTable(list){
    const wrap = $('#tableWrap');
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
      date: $('#r_date').value || new Date().toISOString(),
      driver: ($('#r_driver').value||'').trim() || 'Ukjent',
      round: parseInt($('#r_round').value||'1',10),
      task: $('#r_task').value,
      notes: ($('#r_notes').value||'').trim()
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
    $('#summary').textContent = `Rapporter i JSONBin: ${list.length}`;
    renderTable(list);
  }

  function init(){
    const dt = $('#r_date');
    if (dt){ dt.value = nowLocalISO(); }
    renderFunfacts();

    const key = getMasterKey();
    const saveBtn = $('#btnSaveReport');

    if (!key){
      // Graceful UX if key is missing
      const msg = 'Mangler X-Master-Key. Legg den inn én gang i Admin, åpne så Rapporter på nytt.';
      const sum = $('#summary');
      if (sum) sum.textContent = msg;
      if (saveBtn){
        saveBtn.disabled = true;
        saveBtn.title = msg;
      }
      return; // don’t bind anything else
    }

    // Bind actions with the discovered key
    saveBtn?.addEventListener('click', () => {
      saveReport(key).catch(e=>alert('Feil ved lagring: '+e.message));
    });
    $('#btnPdfReport')?.addEventListener('click', exportPdf);

    // Load existing quietly
    loadExisting(key).catch(e=>{
      const sum = $('#summary');
      if (sum) sum.textContent = 'Feil ved henting: ' + e.message;
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
