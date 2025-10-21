// js/Status.js
(() => {
  'use strict';

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const K_ADDRS   = 'BRYT_ADDRS';
  const K_SETTINGS= 'BRYT_SETTINGS';

  function stateLabel(code){
    const L = {
      not_started: 'Venter',
      in_progress: 'Pågår',
      done:        'Ferdig',
      skipped:     'Hoppet over',
      blocked:     'Ikke mulig',
      accident:    'Uhell'
    };
    return L[code] || '—';
  }
  function getDriver(){ return (readJSON(K_SETTINGS,{driver:''}).driver||'').trim(); }

  function buildModeRoundPicker(root, mode, round, maxRound){
    const modes = [
      { id:'snow', txt:'Snø' },
      { id:'grit', txt:'Grus' }
    ];
    let html = `<div class="row" style="gap:10px; align-items:center; margin-bottom:12px;">
      <label>Modus:</label>
      <select id="st_mode">`;
    for (const m of modes){
      html += `<option value="${m.id}" ${mode===m.id?'selected':''}>${m.txt}</option>`;
    }
    html += `</select>
      <label>Runde:</label>
      <select id="st_round">`;
    for (let r=1;r<=maxRound;r++){
      html += `<option ${r===round?'selected':''}>${r}</option>`;
    }
    html += `</select>
      <button id="st_reload" class="btn-ghost">Oppdater</button>
      <button id="btn_reset_mine" class="btn">Nullstill mine</button>
      <button id="btn_reset_all" class="btn-ghost">Nullstill alt</button>
    </div>`;
    root.insertAdjacentHTML('beforeend', html);
  }

  function renderTable(root, mode, round){
    const addrs = readJSON(K_ADDRS, []);
    const s = window.Sync.getStatus();

    let html = `<table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left">Adresse</th>
          <th>Startet</th>
          <th>Ferdig</th>
          <th>Status</th>
          <th>Fører</th>
        </tr>
      </thead>
      <tbody>`;

    for (const a of addrs){
      const rec = window.Sync.getAddressStatus(a.name, mode, round) || {};
      html += `<tr>
        <td>${a.name}</td>
        <td>${rec.startedAt || ''}</td>
        <td>${rec.finishedAt || ''}</td>
        <td>${stateLabel(rec.state || 'not_started')}</td>
        <td>${rec.driver || ''}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    root.insertAdjacentHTML('beforeend', html);
  }

  function render(){
    if (location.hash !== '#status') return;
    const root = $('#status');
    if (!root) return;
    root.innerHTML = `<h1>Status</h1>`;

    const modeDefault  = 'snow';
    const roundsInfo   = window.Sync.readRounds();
    const roundDefault = roundsInfo.snow?.n || 1;
    const maxSnow = roundsInfo.snow?.n || 1;
    const maxGrit = roundsInfo.grit?.n || 1;

    // les valgt modus/runde fra select hvis finnes
    const curMode  = $('#st_mode')?.value || modeDefault;
    const curRound = Number($('#st_round')?.value || (curMode==='grit' ? (roundsInfo.grit?.n || 1) : roundDefault));

    // maks runde for valgt modus
    const maxR = (curMode==='grit') ? maxGrit : maxSnow;

    buildModeRoundPicker(root, curMode, curRound, maxR);
    renderTable(root, curMode, curRound);

    // wiring
    $('#st_reload')?.addEventListener('click', render);
    $('#st_mode')  ?.addEventListener('change', ()=> {
      // når modus endres, hopp til siste runde for den modusen
      const m = $('#st_mode').value;
      const rr = window.Sync.readRounds();
      const r = (m==='grit') ? (rr.grit?.n || 1) : (rr.snow?.n || 1);
      window.Sync.setRound(m, r); // bare for at state holdes konsistent
      render();
    });
    $('#st_round') ?.addEventListener('change', ()=>{
      // Bare rerender – vi lagrer ikke “current round” globalt fra status
      render();
    });

    $('#btn_reset_mine')?.addEventListener('click', ()=>{
      const m = $('#st_mode').value;
      const r = Number($('#st_round').value);
      window.Sync.resetMine(m, r, getDriver());
      render();
    });
    $('#btn_reset_all')?.addEventListener('click', ()=>{
      const m = $('#st_mode').value;
      const r = Number($('#st_round').value);
      if (!confirm('Nullstille alt for valgt modus og runde?')) return;
      window.Sync.resetAll(m, r);
      render();
    });
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();