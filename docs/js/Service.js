// Service.js — Enkelt service-skjema med avkryssingsbokser og tekstfelt
(function(){
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  
  function ensureServiceShell(){
    const sec = document.getElementById('service');
    if(!sec) return;
    if(qs('.service-form', sec)) return;

    sec.innerHTML = `
      <h1>Service</h1>
      <form id="serviceForm" class="service-form">
        <fieldset>
          <legend>Smøring</legend>
          <label><input type="checkbox" name="skjaer"> Skjær smurt</label>
          <label><input type="checkbox" name="fres"> Fres smurt</label>
          <label><input type="checkbox" name="forstilling"> Forstilling smurt</label>
        </fieldset>

        <fieldset>
          <legend>Olje</legend>
          <label><input type="checkbox" name="oljeForan"> Olje sjekket foran</label>
          <label><input type="checkbox" name="oljeBak"> Olje sjekket bak</label>
          <label><input type="checkbox" name="oljeEtterfylt"> Olje etterfylt</label>
        </fieldset>

        <fieldset>
          <legend>Diesel og grus</legend>
          <label><input type="checkbox" name="diesel"> Diesel fylt</label>
          <label>Antall kasser grus:
            <input type="text" name="grusKasser" class="input" placeholder="f.eks. 2 kasser">
          </label>
        </fieldset>

        <fieldset>
          <legend>Annet</legend>
          <textarea name="annet" rows="3" class="input" placeholder="Skriv eventuelle kommentarer..."></textarea>
        </fieldset>

        <div class="service-actions">
          <button type="submit" class="btn">Lagre</button>
          <button type="reset" class="btn btn-ghost">Nullstill</button>
        </div>
      </form>

      <div class="svc-log">
        <h3>Tidligere service</h3>
        <ul id="svcLogList" class="svc-list">
          <li class="muted">Ingen registreringer ennå.</li>
        </ul>
      </div>
    `;
    
    // Event-handlere
    qs('#serviceForm', sec).addEventListener('submit', async (e)=>{
      e.preventDefault();
      await saveService(sec);
    });
  }

  async function getCloud(){
    const cloud = await window.JSONBIN.getLatest();
    if(!cloud.serviceReports) cloud.serviceReports = [];
    return cloud;
  }
  async function putCloud(cloud){
    cloud.updated = Date.now();
    try{ await window.JSONBIN.putRecord(cloud); }
    catch(e){ console.warn('Feil ved lagring til sky:', e); }
  }

  async function saveService(scope){
    const form = qs('#serviceForm', scope);
    const data = Object.fromEntries(new FormData(form).entries());
    data.ts = Date.now();

    const cloud = await getCloud();
    cloud.serviceReports.unshift(data);
    await putCloud(cloud);
    renderLogs(scope, cloud.serviceReports);
    form.reset();
  }

  function renderLogs(scope, rows){
    const ul = qs('#svcLogList', scope);
    if(!rows || rows.length === 0){
      ul.innerHTML = `<li class="muted">Ingen registreringer ennå.</li>`;
      return;
    }
    ul.innerHTML = rows.slice(0,10).map(r=>{
      const d = new Date(r.ts).toLocaleString('no-NO');
      const txt = [
        r.skjaer?'Skjær smurt':'',
        r.fres?'Fres smurt':'',
        r.forstilling?'Forstilling smurt':'',
        r.oljeForan?'Olje foran':'',
        r.oljeBak?'Olje bak':'',
        r.oljeEtterfylt?'Olje etterfylt':'',
        r.diesel?'Diesel fylt':'',
        r.grusKasser?`Grus: ${r.grusKasser}`:'',
        r.annet?`Annet: ${r.annet}`:''
      ].filter(Boolean).join(', ');
      return `<li><strong>${d}</strong><br>${txt}</li>`;
    }).join('');
  }

  async function bootIfService(){
    const hash = (location.hash||'#home').replace('#','');
    if(hash!=='service') return;
    ensureServiceShell();
    const cloud = await getCloud();
    renderLogs(document.getElementById('service'), cloud.serviceReports);
  }

  document.addEventListener('DOMContentLoaded', bootIfService);
  window.addEventListener('hashchange', bootIfService);
})();