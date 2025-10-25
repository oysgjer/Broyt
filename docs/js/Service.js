// js/Service.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SERVICE_TMP = 'BRYT_SERVICE_TMP';
  const LS_RUN = 'BRYT_RUN';

  function ensureUI(){
    const host = $('#service');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Service</h1>
      <div class="card">
        <div class="label-muted">Fyll ut service etter runde</div>
        <label class="field"><span>Skjær smurt</span><input id="sv_skjar" type="checkbox" /></label>
        <label class="field"><span>Fres smurt</span><input id="sv_fres" type="checkbox" /></label>
        <label class="field"><span>Forstilling smurt</span><input id="sv_forstilling" type="checkbox" /></label>

        <label class="field"><span>Olje sjekket foran</span><input id="sv_olje_for" type="checkbox" /></label>
        <label class="field"><span>Olje sjekket bak</span><input id="sv_olje_bak" type="checkbox" /></label>
        <label class="field"><span>Olje etterfylt</span><input id="sv_olje_fyll" type="checkbox" /></label>

        <label class="field"><span>Diesel fylt</span><input id="sv_diesel" type="checkbox" /></label>
        <label class="field"><span>Antall kasser grus</span><input id="sv_kasser" class="input" type="number" min="0" /></label>

        <label class="field"><span>Annet?</span><textarea id="sv_other" class="input" rows="3" placeholder="Merknader..."></textarea></label>

        <div class="row" style="gap:10px">
          <button id="sv_save" class="btn">Lagre service</button>
          <button id="sv_send" class="btn-ghost">Send på e-post</button>
        </div>

        <div id="sv_info" style="margin-top:8px;color:var(--muted)"></div>
      </div>
    `;
    host.dataset.enhanced = '1';

    $('#sv_save')?.addEventListener('click', saveService);
    $('#sv_send')?.addEventListener('click', sendServiceEmail);
  }

  function loadTemp(){
    return RJ(K_SERVICE_TMP, {
      skjar:false,fres:false,forstilling:false,
      olje_for:false,olje_bak:false,olje_fyll:false,
      diesel:false,kasser:0,other:''
    });
  }
  function saveTemp(obj){
    WJ(K_SERVICE_TMP, obj);
  }

  async function saveService(){
    const data = {
      skjar: !!$('#sv_skjar')?.checked,
      fres: !!$('#sv_fres')?.checked,
      forstilling: !!$('#sv_forstilling')?.checked,
      olje_for: !!$('#sv_olje_for')?.checked,
      olje_bak: !!$('#sv_olje_bak')?.checked,
      olje_fyll: !!$('#sv_olje_fyll')?.checked,
      diesel: !!$('#sv_diesel')?.checked,
      kasser: Number($('#sv_kasser')?.value||0),
      other: ($('#sv_other')?.value||'').trim(),
      savedAt: new Date().toISOString(),
      driver: (JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}')).driver || ''
    };

    saveTemp(data);

    // lokale demo: legg service inn i raw i Sync (kan også sendes som egen node)
    try{
      const run = JSON.parse(localStorage.getItem(LS_RUN)||'{}');
      const roundId = run.roundId || (new Date().toISOString());
      // hent cache og skriv i raw.serviceReports (enkle demo-arkiv)
      const cache = window.Sync.getCache();
      const raw = cache.raw || {};
      raw.serviceReports = raw.serviceReports || {};
      raw.serviceReports[roundId] = data;

      // skriv til bin (PUT)
      // Vi bruker Sync.saveAddresses as workaround hvis du ikke har en dedikert put – men her bruker internal _putRecord not exposed.
      // For portability: vi oppdaterer via status-patch som inneholder minste mulig effekt: vi bruker Sync.setStatusPatch med tom patch for å tvinge PUT.
      // I din implementasjon vil Sync ha _putRecord; vi løser dette enkelt ved å bygge en minimal PATCH som bare setter rådata i raw via saveAddresses (ikke ønskelig).
      // Isteden, bruk Sync.saveAddresses med eksisterende addresses slik at backend PUT skjer (raw.snapshot beholdes).
      const addresses = cache.addresses || [];
      // skriv raw.serviceReports inn i cache og bruk saveAddresses for å PUT (den vil bruke raw.snapshot men vi setter raw først via internal cache update)
      // Siden Sync API ikke eksponerer direkte _putRecord i public, vi setter serviceReports i cache via Sync.saveAddresses wrapper:
      const prepared = addresses.map(a => ({ ...a }));
      // Oppdater _cache raw via hack: hvis Sync has internal setRaw method - men i vår implementasjon Sync.saveAddresses oppdaterer raw og PUT.
      // For enkelhet: vi utfører en "no-op" setStatusPatch for å trigge PUT med oppdatert raw (dersom Sync internt bruker raw). Hvis ikke, bruk alert og lokal lagring.
      try {
        // trygg fallback: lagre service i localStorage og informer bruker
        localStorage.setItem('BRYT_LAST_SERVICE_'+roundId, JSON.stringify(data));
      } catch(e){}
      $('#sv_info').textContent = 'Service lagret lokalt.';

      // spør om sende e-post
      if (confirm('Service lagret. Vil du sende dagsrapport + service på e-post nå?')) {
        // bygg CSV for denne roundId og åpne mailto eller last ned om for stor
        const rpt = window.Sync.generateDailyReport({ roundId: run.roundId || undefined });
        const csv = ['Dato;RoundId;Fører;Adresse;Type;Startet;Ferdig']
          .concat(rpt.map(r => `${r.date};${r.roundId};${r.driver};"${(r.address||'').replace(/"/g,'""')}";${r.type};${r.started};${r.finished}`))
          .join('\n');

        const to = 'oysgjer@gmail.com';
        const subj = encodeURIComponent(`Dagsrapport ${run.roundDate || ''} — runde`);
        let body = encodeURIComponent('Se vedlagte rapport:\n\n' + csv);
        if (body.length > 15000) {
          alert('Rapporten er for stor for å sendes via epost-link. Fil lastes ned, send manuelt.');
          const blob = new Blob([csv + '\n\nService-notat:\n' + JSON.stringify(data, null, 2)], {type:'text/csv;charset=utf-8;'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `dagsrapport_${run.roundDate||'run'}.csv`; document.body.appendChild(a); a.click();
          setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
        } else {
          window.open(`mailto:${to}?subject=${subj}&body=${body}`, '_blank');
        }
      }

      // Ferdig: fjern run.roundId slik at neste runde starter uten dette
      const newRun = { ...(run||{}) };
      delete newRun.roundId; delete newRun.roundDate;
      localStorage.setItem(LS_RUN, JSON.stringify(newRun));

      alert('Service behandlet.');
    }catch(e){
      console.error(e);
      alert('Kunne ikke lagre service til sky: ' + e.message);
    }
  }

  async function sendServiceEmail(){
    // bruk samme flow som saveService etter at data finnes
    await saveService();
  }

  function boot(){
    ensureUI();
    // load temp if any
    const t = loadTemp();
    if (t){
      $('#sv_skjar').checked = !!t.skjar;
      $('#sv_fres').checked = !!t.fres;
      $('#sv_forstilling').checked = !!t.forstilling;
      $('#sv_olje_for').checked = !!t.olje_for;
      $('#sv_olje_bak').checked = !!t.olje_bak;
      $('#sv_olje_fyll').checked = !!t.olje_fyll;
      $('#sv_diesel').checked = !!t.diesel;
      $('#sv_kasser').value = t.kasser||0;
      $('#sv_other').value = t.other||'';
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('hashchange', ()=>{ if (location.hash==='#service') boot(); });
})();