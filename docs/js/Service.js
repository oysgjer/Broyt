// js/Service.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_SVC_LOCAL = 'BRYT_SERVICE_LOCAL'; // lokal “inbox” hvis sky ikke virker

  function driverName(){
    const st = RJ(K_SETTINGS, {});
    return (st && st.driver) ? st.driver : '';
  }

  function ensureUI(){
    const host = $('#service');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Service</h1>

      <div class="card" id="svc_card">
        <div class="field">
          <span class="muted-strong">Smøring</span>
          <div class="checkbox-col" style="margin-top:6px">
            <label><input type="checkbox" id="svc_blade"> Skjær smurt</label>
            <label><input type="checkbox" id="svc_fres"> Fres smurt</label>
            <label><input type="checkbox" id="svc_front"> Forstilling smurt</label>
          </div>
        </div>

        <div class="field">
          <span class="muted-strong">Olje</span>
          <div class="checkbox-col" style="margin-top:6px">
            <label><input type="checkbox" id="svc_oil_front"> Olje sjekket foran</label>
            <label><input type="checkbox" id="svc_oil_back"> Olje sjekket bak</label>
            <label><input type="checkbox" id="svc_oil_fill"> Olje etterfylt</label>
          </div>
        </div>

        <div class="field">
          <span class="muted-strong">Drivstoff & grus</span>
          <div class="checkbox-col" style="margin-top:6px">
            <label><input type="checkbox" id="svc_diesel"> Diesel fylt</label>
          </div>
        </div>

        <div class="field">
          <span class="muted-strong">Antall kasser grus</span>
          <input id="svc_grit_boxes" class="input" inputmode="numeric" placeholder="0" />
        </div>

        <div class="field">
          <span class="muted-strong">Annet?</span>
          <textarea id="svc_other" class="input" rows="4" placeholder="Notater, avvik, småreparasjoner..."></textarea>
        </div>

        <div class="row" style="justify-content:space-between; gap:10px; margin-top:10px">
          <button id="svc_save" class="btn">Lagre service</button>
          <span id="svc_msg" class="muted"></span>
        </div>
      </div>
    `;
    host.dataset.enhanced = '1';

    $('#svc_save')?.addEventListener('click', saveService);
  }

  function collect(){
    return {
      at: new Date().toISOString(),
      by: driverName(),
      blade: !!$('#svc_blade')?.checked,
      fres: !!$('#svc_fres')?.checked,
      front: !!$('#svc_front')?.checked,
      oil_front: !!$('#svc_oil_front')?.checked,
      oil_back:  !!$('#svc_oil_back')?.checked,
      oil_fill:  !!$('#svc_oil_fill')?.checked,
      diesel: !!$('#svc_diesel')?.checked,
      grit_boxes: ($('#svc_grit_boxes')?.value || '').trim(),
      other: ($('#svc_other')?.value || '').trim()
    };
  }

  async function tryCloudSave(payload){
    // Prøv flere “navn” i Sync for best kompatibilitet.
    const S = window.Sync || {};
    if (typeof S.saveService === 'function')   return await S.saveService(payload);
    if (typeof S.addServiceLog === 'function') return await S.addServiceLog(payload);
    if (typeof S.submitService === 'function') return await S.submitService(payload);
    // Hvis Sync ikke tilbyr spesifikk funksjon, fall tilbake til en generell patch hvis mulig
    if (typeof S.setServicePatch === 'function') {
      return await S.setServicePatch({ append: true, item: payload });
    }
    // Ingen sky-metode tilgjengelig
    throw new Error('Ingen skyfunksjon for service funnet.');
  }

  function saveLocal(payload){
    const bag = RJ(K_SVC_LOCAL, []);
    bag.push(payload);
    WJ(K_SVC_LOCAL, bag);
  }

  async function saveService(){
    const msg = $('#svc_msg');
    msg && (msg.textContent = 'Lagrer…');

    const data = collect();

    try{
      // lagre i sky hvis mulig
      await tryCloudSave(data);
      msg && (msg.textContent = 'Lagret ✅');
    }catch(e){
      // fallback: lagre lokalt
      saveLocal(data);
      msg && (msg.textContent = 'Lagret lokalt (offline) ✅');
      console.warn('Service sky-lagring feilet:', e);
    }

    // (Valgfritt) Tilbakestill feltene lett
    // Behold gjerne tekstfelt, men ta vekk bukser:
    ['svc_blade','svc_fres','svc_front','svc_oil_front','svc_oil_back','svc_oil_fill','svc_diesel'].forEach(id=>{
      const el = $('#'+id); if (el) el.checked = false;
    });
  }

  function boot(){
    ensureUI();
  }

  // Vis når du kommer til #service
  window.addEventListener('hashchange', ()=>{
    if ((location.hash||'').toLowerCase() === '#service'){
      boot();
    }
  });

  document.addEventListener('DOMContentLoaded', ()=>{
    if ((location.hash||'').toLowerCase() === '#service'){
      boot();
    }
  });
})();