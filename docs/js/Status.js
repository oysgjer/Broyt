// js/Status.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const K_RUN='BRYT_RUN';

  let DATA = [];

  function roundKey(a){
    const pick = a.snowStart || a.gritStart || a.snowEnd || a.gritEnd;
    if (!pick) return '—';
    const d = new Date(pick);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
    const t = (a.snowStart || a.snowEnd) ? 'SNØ' : 'GRUS';
    return `${y}-${m}-${dd} ${t}`;
    // senere kan vi gruppere på timevindu hvis ønskelig
  }

  function ensureUI(){
    const host = $('#status');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Status</h1>

      <div class="work-top" style="margin-bottom:14px">
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <button id="st_refresh" class="btn-ghost">Oppfrisk</button>
          <button id="st_reset_mine" class="btn-ghost">Nullstill min runde</button>
          <button id="st_reset_all" class="btn-ghost">Nullstill alt</button>
          <select id="st_round" class="input" style="max-width:220px"></select>
        </div>
      </div>

      <div class="card" style="overflow:auto">
        <table id="st_table" style="width:100%; border-collapse:collapse">
          <thead style="position:sticky; top:0; background:var(--surface);">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">#</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Adresse</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Startet snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Ferdig snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Startet grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Ferdig grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Sjåfør</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Runde</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    host.dataset.enhanced='1';

    $('#st_refresh')?.addEventListener('click', load);
    $('#st_reset_mine')?.addEventListener('click', resetMine);
    $('#st_reset_all')?.addEventListener('click', resetAll);
    $('#st_round')?.addEventListener('change', render);
  }

  function stamp(x){ return x ? new Date(x).toLocaleString() : ''; }

  function buildRoundOptions(){
    const sel = $('#st_round'); if (!sel) return;
    const keys = Array.from(new Set(DATA.map(roundKey)));
    sel.innerHTML = `<option value="">Alle runder</option>` + keys
      .filter(k=>k!=='—')
      .map(k=>`<option>${k}</option>`).join('');
  }

  function render(){
    const tb = $('#st_table tbody'); if (!tb) return;
    const chosen = $('#st_round')?.value || '';

    let rows = DATA.slice();
    if (chosen){
      rows = rows.filter(a => roundKey(a)===chosen);
    }

    tb.innerHTML = rows.map((a,i)=>`
      <tr>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${i+1}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${a.name}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${stamp(a.snowStart)}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${stamp(a.snowEnd)}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${stamp(a.gritStart)}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${stamp(a.gritEnd)}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${a.driver||''}</td>
        <td style="padding:8px;border-bottom:1px solid var(--sep)">${roundKey(a)}</td>
      </tr>
    `).join('');
  }

  async function resetMine(){
    const r = RJ(K_RUN, {driver:''});
    if (!r.driver){ alert('Ingen fører satt.'); return; }
    if (!confirm(`Nullstille dine markeringer (sjåfør: ${r.driver})?`)) return;

    const mine = DATA.filter(a => a.driver===r.driver);
    for (const a of mine){
      await Sync.setStatus(a.id, { snowStart:null, snowEnd:null, gritStart:null, gritEnd:null, skipped:false, blocked:false, driver:'' });
    }
    await load();
  }

  async function resetAll(){
    if (!confirm('Nullstille ALLE adresser for dagen?')) return;
    for (const a of DATA){
      await Sync.setStatus(a.id, { snowStart:null, snowEnd:null, gritStart:null, gritEnd:null, skipped:false, blocked:false, driver:'' });
    }
    await load();
  }

  async function load(){
    try{
      DATA = await Sync.loadAddresses({ force:true });
      buildRoundOptions();
      render();
    }catch(e){ console.error(e); alert('Kunne ikke laste status: '+e.message); }
  }

  function boot(){
    ensureUI();
    if (location.hash==='#status') load();
  }

  window.addEventListener('hashchange', ()=>{ if (location.hash==='#status') boot(); });
  document.addEventListener('DOMContentLoaded', boot);
})();