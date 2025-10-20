// Service.js — komplett side (logg av grus, diesel, base, annet)
// Avhengigheter som brukes fra del-d.js: window.JSONBIN (getLatest/putRecord)

(function(){
  // ---- små utiler (IKKE redefiner global $/$$ for å unngå konflikter)
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const fmtTime = ts => {
    try{
      return new Date(ts).toLocaleString('no-NO', { hour: '2-digit', minute: '2-digit', day:'2-digit', month:'2-digit' });
    }catch{ return '—'; }
  };

  // ---- bygg Service-UI inn i #service
  function ensureServiceShell(){
    const sec = document.getElementById('service');
    if(!sec) return;

    // Bygg bare én gang
    if(qs('.svc-wrap', sec)) return;

    sec.innerHTML = `
      <h1>Service</h1>

      <div class="svc-wrap">
        <div class="svc-card">
          <div class="svc-card-title">Hurtiglogging</div>
          <div class="svc-quick-row">
            <button class="btn btn-ghost svc-q" data-type="grus">🏗️ Hent grus</button>
            <button class="btn btn-ghost svc-q" data-type="diesel">🛢️ Diesel</button>
            <button class="btn btn-ghost svc-q" data-type="base">🏠 Base</button>
            <button class="btn btn-ghost svc-q" data-type="annet">📝 Annet</button>
          </div>
          <p class="muted">Trykk en snarvei for å forhåndsfylle skjemaet under.</p>
        </div>

        <div class="svc-card">
          <div class="svc-card-title">Ny registrering</div>
          <form id="svc_form" class="svc-form">
            <div class="field">
              <span>Type</span>
              <select id="svc_type" class="input-like">
                <option value="grus">Hent grus</option>
                <option value="diesel">Fylle diesel</option>
                <option value="base">Besøk base</option>
                <option value="annet">Annet</option>
              </select>
            </div>

            <div class="svc-grid">
              <label class="field">
                <span>Mengde (valgfritt)</span>
                <input id="svc_amount" class="input" inputmode="decimal" placeholder="f.eks. 12">
              </label>
              <label class="field">
                <span>Enhet</span>
                <select id="svc_unit" class="input-like">
                  <option value="">—</option>
                  <option value="L">L</option>
                  <option value="m³">m³</option>
                  <option value="tonn">tonn</option>
                  <option value="stk">stk</option>
                </select>
              </label>
            </div>

            <label class="field">
              <span>Notat (valgfritt)</span>
              <input id="svc_note" class="input" placeholder="skriv et kort notat…">
            </label>

            <div class="svc-actions">
              <button type="submit" class="btn">Lagre</button>
              <button type="button" id="svc_reset" class="btn btn-ghost">Nullstill</button>
            </div>
          </form>
        </div>

        <div class="svc-card">
          <div class="svc-card-title">Logg</div>
          <div class="svc-toolbar">
            <button class="btn btn-ghost" id="svc_export">Eksporter CSV</button>
            <button class="btn btn-ghost" id="svc_refresh">Oppfrisk</button>
          </div>
          <div class="svc-table-wrap">
            <table class="svc-table">
              <thead>
                <tr>
                  <th>Tid</th>
                  <th>Type</th>
                  <th>Mengde</th>
                  <th>Notat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="svc_tbody">
                <tr><td colspan="5" class="muted">Ingen registreringer ennå.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // hendelser
    qsa('.svc-q', sec).forEach(b=>{
      b.addEventListener('click', ()=>{
        const t = b.getAttribute('data-type');
        const typeSel = qs('#svc_type', sec);
        typeSel.value = t;
        // Sett fornuftig enhet
        const unit = qs('#svc_unit', sec);
        if(t==='diesel') unit.value='L';
        else if(t==='grus') unit.value='tonn';
        else unit.value='';
        qs('#svc_amount', sec).value='';
        qs('#svc_note', sec).focus();
      });
    });

    qs('#svc_form', sec)?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      await saveEntry(sec);
    });
    qs('#svc_reset', sec)?.addEventListener('click', ()=>{
      qs('#svc_amount', sec).value='';
      qs('#svc_unit', sec).value='';
      qs('#svc_note', sec).value='';
    });
    qs('#svc_export', sec)?.addEventListener('click', exportCsv);
    qs('#svc_refresh', sec)?.addEventListener('click', async ()=>{
      await renderLogs(sec);
    });
  }

  // ---- data I/O mot JSONBin
  async function getCloud(){
    // JSONBIN er eksponert globalt av del-d.js
    const cloud = await window.JSONBIN.getLatest();
    if(!cloud.serviceLogs) cloud.serviceLogs = [];
    return cloud;
  }
  async function putCloud(cloud){
    cloud.updated = Date.now();
    try{
      await window.JSONBIN.putRecord(cloud);
    }catch(e){
      // faller tilbake til lokal (JSONBIN håndterer det internt),
      // men vi lar ikke dette stoppe UI
      console.warn('Service: putRecord failed -> fallback local', e);
    }
  }

  // ---- lagre ny rad
  async function saveEntry(scope){
    const type  = qs('#svc_type', scope)?.value || 'annet';
    const amt   = (qs('#svc_amount', scope)?.value || '').trim();
    const unit  = (qs('#svc_unit', scope)?.value || '').trim();
    const note  = (qs('#svc_note', scope)?.value || '').trim();

    const row = {
      id: 'L'+Math.random().toString(36).slice(2,9),
      ts: Date.now(),
      type, amount: amt, unit, note
    };

    try{
      const cloud = await getCloud();
      cloud.serviceLogs.unshift(row);   // nyeste først
      await putCloud(cloud);
      await renderLogs(scope);
      // rensk
      qs('#svc_amount', scope).value='';
      qs('#svc_unit', scope).value='';
      qs('#svc_note', scope).value='';
    }catch(e){
      alert('Kunne ikke lagre: '+(e.message||e));
    }
  }

  // ---- slette rad
  async function deleteEntry(id, scope){
    if(!confirm('Slette denne registreringen?')) return;
    const cloud = await getCloud();
    cloud.serviceLogs = (cloud.serviceLogs||[]).filter(r=>r.id!==id);
    await putCloud(cloud);
    await renderLogs(scope);
  }

  // ---- vis tabell
  async function renderLogs(scope){
    const tb = qs('#svc_tbody', scope);
    if(!tb) return;
    tb.innerHTML = `<tr><td colspan="5" class="muted">Laster…</td></tr>`;

    try{
      const cloud = await getCloud();
      const rows = cloud.serviceLogs || [];
      if(rows.length===0){
        tb.innerHTML = `<tr><td colspan="5" class="muted">Ingen registreringer ennå.</td></tr>`;
        return;
      }
      tb.innerHTML = '';
      rows.forEach(r=>{
        const tr = document.createElement('tr');
        const typeTxt = r.type==='grus' ? 'Hent grus'
                     : r.type==='diesel' ? 'Fylle diesel'
                     : r.type==='base' ? 'Besøk base'
                     : 'Annet';
        const amount = (r.amount ? r.amount : '') + (r.unit ? ' '+r.unit : '');
        tr.innerHTML = `
          <td>${fmtTime(r.ts)}</td>
          <td>${typeTxt}</td>
          <td>${amount || '—'}</td>
          <td>${(r.note||'').replace(/\s+/g,' ').trim() || '—'}</td>
          <td class="svc-actions-cell">
            <button class="btn btn-ghost svc-del" data-id="${r.id}">Slett</button>
          </td>
        `;
        tb.appendChild(tr);
      });

      // koble delete-knapper
      qsa('.svc-del', tb).forEach(b=>{
        b.addEventListener('click', ()=>deleteEntry(b.getAttribute('data-id'), scope));
      });
    }catch(e){
      tb.innerHTML = `<tr><td colspan="5">Feil ved lasting: ${(e.message||e)}</td></tr>`;
    }
  }

  // ---- CSV
  async function exportCsv(){
    try{
      const cloud = await getCloud();
      const rows = cloud.serviceLogs || [];
      const head = ['Tid','Type','Mengde','Enhet','Notat'];
      const out = [head];
      rows.forEach(r=>{
        const typeTxt = r.type==='grus' ? 'Hent grus'
                       : r.type==='diesel' ? 'Fylle diesel'
                       : r.type==='base' ? 'Besøk base'
                       : 'Annet';
        out.push([
          new Date(r.ts).toISOString(),
          typeTxt,
          r.amount || '',
          r.unit || '',
          (r.note||'').replace(/"/g,'""')
        ]);
      });
      const csv = out.map(line => line.map(x=>`"${String(x)}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'service_logg.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }catch(e){
      alert('CSV-feil: '+(e.message||e));
    }
  }

  // ---- init når man åpner siden
  async function bootIfService(){
    const hash = (location.hash||'#home').replace('#','');
    if(hash!=='service') return;
    ensureServiceShell();
    await renderLogs(document.getElementById('service'));
  }

  // førstegang
  document.addEventListener('DOMContentLoaded', bootIfService);
  // når man navigerer via hash
  window.addEventListener('hashchange', bootIfService);
})();