// js/Admin.js
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Små utils
  const readJSON  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SYNC_CFG = 'BRYT_SYNC_CFG';

  function ensureUI(){
    const root = $('#admin');
    if (!root) return;

    // Øverst: "Aktiv sesong" seksjonen ligger allerede; vi legger inn Sync-boksen etter den
    let syncBox = root.querySelector('#ad_sync_box');
    if (!syncBox){
      syncBox = document.createElement('div');
      syncBox.id = 'ad_sync_box';
      syncBox.className = 'card';
      syncBox.style.marginTop = '14px';
      syncBox.innerHTML = `
        <div class="label-muted" style="margin-bottom:8px">Sky (JSONBin)</div>
        <div class="grid2">
          <label class="field">
            <span>Bin ID</span>
            <input id="ad_bin" class="input" placeholder="68e7b4d2ae596e708f0bde7d" />
          </label>
          <label class="field">
            <span>API-nøkkel</span>
            <input id="ad_key" class="input" placeholder="X-Master-Key" />
          </label>
        </div>
        <div class="row" style="gap:10px; margin-top:10px">
          <button id="ad_save_sync" class="btn">Lagre sky-oppsett</button>
          <button id="ad_test_sync" class="btn-ghost">Test tilkobling</button>
        </div>
        <p id="ad_sync_msg" class="muted" style="margin-top:8px"></p>
      `;
      root.insertBefore(syncBox, root.querySelector('h1')?.nextSibling ?? root.firstChild);
    }

    // Sett felter fra lagret config
    const cfg = readJSON(K_SYNC_CFG, {binId:'', apiKey:''});
    $('#ad_bin').value = cfg.binId || '';
    $('#ad_key').value = cfg.apiKey || '';

    // Wire knapper
    $('#ad_save_sync').onclick = onSaveSync;
    $('#ad_test_sync').onclick = onTestSync;
  }

  function onSaveSync(){
    const binId  = $('#ad_bin')?.value.trim();
    const apiKey = $('#ad_key')?.value.trim();
    if (!binId || !apiKey){
      return showMsg('Vennligst fyll ut både Bin ID og API-nøkkel.', true);
    }

    writeJSON(K_SYNC_CFG, { binId, apiKey });
    if (window.Sync) window.Sync.setConfig({ binId, apiKey });
    showMsg('Sky-oppsett lagret. ✅');
  }

  async function onTestSync(){
    try{
      $('#ad_sync_msg').textContent = 'Tester...';
      const addrs = await window.Sync.loadAddresses({ force:true });
      showMsg(`Tilkobling OK. Fant ${addrs.length} adresser. ✅`);
    } catch(e){
      showMsg('Kunne ikke koble til: ' + e.message, true);
    }
  }

  function showMsg(txt, isErr=false){
    const el = $('#ad_sync_msg');
    if (!el) return;
    el.textContent = txt;
    el.style.color = isErr ? '#ef4444' : 'var(--muted)';
  }

  function init(){
    if (location.hash !== '#admin') return;
    ensureUI();
  }

  window.addEventListener('hashchange', init);
  document.addEventListener('DOMContentLoaded', init);
})();