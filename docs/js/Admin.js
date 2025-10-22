// js/Admin.js
(() => {
  'use strict';

  const $  = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SEASON = 'BRYT_SEASON'; // f.eks. "2025-26"

  let ADDR = []; // lokal arbeidsliste

  /* ------------------ Sesong ------------------ */
  function guessSeason(){
    const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    // sesong skifter i juli
    return (m>=7) ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
  }
  function seasonGet(){ return RJ(K_SEASON, guessSeason()); }
  function seasonSet(v){ WJ(K_SEASON,v); renderSeason(); }
  function renderSeason(){
    const s = seasonGet();
    $('#adm_season')   && ($('#adm_season').textContent = s);
    $('#adm_seas_hdr') && ($('#adm_seas_hdr').textContent = s);
  }

  /* ------------------ UI skeleton ------------------ */
  function ensureUI(){
    const host = $('#admin');
    if (!host || host.dataset.enhanced) return;

    // Hvis Sync mangler, vis kort beskjed men la resten laste når Sync kommer
    const syncMissing = !(window.Sync && typeof window.Sync.getCache === 'function');

    host.innerHTML = `
      <h1>Admin</h1>

      <div class="card">
        <div class="row" style="gap:10px; align-items:end; flex-wrap:wrap">
          <div>
            <div class="label-muted">Aktiv sesong</div>
            <div id="adm_season" style="font-weight:700; padding:4px 0"></div>
          </div>
          <button id="adm_copy_pins" class="btn-ghost">Kopier pinner fra forrige sesong</button>
          <button id="adm_new_season" class="btn">Start ny sesong</button>
        </div>
      </div>

      <div class="card">
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <label class="field" style="min-width:260px">
            <span>JSONBin ID</span>
            <input id="adm_bin" class="input" placeholder="68e7b4d2ae596e708f0bde7d" />
          </label>
          <label class="field" style="min-width:320px">
            <span>Master Key</span>
            <input id="adm_key" class="input" placeholder="••••••" />
          </label>
          <button id="adm_save_cfg" class="btn">Lagre synk-oppsett</button>
        </div>
        ${syncMissing ? `<p class="muted" style="margin-top:8px">Merk: Sync-modulen er ikke lastet ennå. Feltene over blir aktive når Sync er klar.</p>` : ``}
      </div>

      <div class="card">
        <input id="adm_filter" class="input" placeholder="Filtrer adresser..." />
      </div>

      <div class="card" style="overflow:auto">
        <table id="adm_table" style="width:100%; border-collapse:collapse">
          <thead style="position:sticky; top:0; background:var(--surface);">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Adresse</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Brøytepinner <span id="adm_seas_hdr"></span></th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Lat</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Lon</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep)">Slett</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="row" style="gap:10px">
        <button id="adm_add" class="btn">Legg til adresse</button>
        <button id="adm_save" class="btn-ghost">Lagre</button>
      </div>
    `;
    host.dataset.enhanced='1';

    // Knapp wiring
    $('#adm_add')       ?.addEventListener('click', addRow);
    $('#adm_save')      ?.addEventListener('click', saveAll);
    $('#adm_save_cfg')  ?.addEventListener('click', saveCfg);
    $('#adm_new_season')?.addEventListener('click', newSeason);
    $('#adm_copy_pins') ?.addEventListener('click', copyPins);
    $('#adm_filter')    ?.addEventListener('input', render);

    // Init cfg-felter fra Sync (hvis tilgjengelig)
    if (window.Sync && typeof window.Sync.getConfig === 'function'){
      const cfg = window.Sync.getConfig();
      $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
      $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
    }

    renderSeason();
  }

  /* ------------------ CRUD i tabell ------------------ */
  function addRow(){
    const id = 'addr_' + Date.now();
    ADDR.push({
      id,
      name: '',
      active: true,
      tasks: { snow: true, grit: false },
      pins:  {},        // per sesong: { "2025-26": 3 }
      lat: null,
      lon: null
    });
    render();
  }

  function render(){
    const tb = $('#adm_table tbody'); if (!tb) return;
    const q  = ($('#adm_filter')?.value || '').toLowerCase();
    const s  = seasonGet();

    const rows = ADDR.filter(a => (a.name||'').toLowerCase().includes(q));

    tb.innerHTML = rows.map(a => {
      const pins = (a.pins && typeof a.pins==='object') ? (a.pins[s] ?? 0) : 0;
      return `
        <tr data-id="${a.id}">
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_name input" value="${a.name||''}" />
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input type="checkbox" class="adm_snow" ${a.tasks?.snow ? 'checked' : ''} />
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input type="checkbox" class="adm_grit" ${a.tasks?.grit ? 'checked' : ''} />
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_pins input" type="number" min="0" value="${pins}">
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_lat input" type="number" step="any" value="${a.lat ?? ''}">
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <input class="adm_lon input" type="number" step="any" value="${a.lon ?? ''}">
          </td>
          <td style="padding:6px;border-bottom:1px solid var(--sep)">
            <button class="btn-ghost adm_del">Slett</button>
          </td>
        </tr>
      `;
    }).join('');

    // wire rad-hendelser
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector('.adm_del')?.addEventListener('click', ()=>{
        ADDR = ADDR.filter(a => a.id !== id);
        render();
      });
    });
  }

  function pullFromDOM(){
    const tb = $('#adm_table tbody'); if (!tb) return [];
    const s  = seasonGet();
    const out = [];
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;
      const old = ADDR.find(a => a.id === id) || {};
      const pinsVal = Number(tr.querySelector('.adm_pins')?.value || 0);
      const pinsObj = (old.pins && typeof old.pins==='object') ? {...old.pins} : {};
      pinsObj[s] = isNaN(pinsVal) ? 0 : pinsVal;

      out.push({
        id,
        name: tr.querySelector('.adm_name')?.value.trim() || '',
        active: old.active !== false, // default true
        tasks: {
          snow: !!tr.querySelector('.adm_snow')?.checked,
          grit: !!tr.querySelector('.adm_grit')?.checked
        },
        pins: pinsObj,
        lat:  parseFloat(tr.querySelector('.adm_lat')?.value || 'NaN'),
        lon:  parseFloat(tr.querySelector('.adm_lon')?.value || 'NaN')
      });
    });

    // normalize lat/lon NaN -> null
    return out.map(a => ({
      ...a,
      lat: isNaN(a.lat) ? null : a.lat,
      lon: isNaN(a.lon) ? null : a.lon
    }));
  }

  /* ------------------ Persist / Sync ------------------ */
  async function saveAll(){
    if (!(window.Sync && typeof window.Sync.saveAddresses==='function')){
      alert('Sync ikke klar – kan ikke lagre ennå.');
      return;
    }
    try{
      const prepared = pullFromDOM();
      ADDR = await window.Sync.saveAddresses(prepared);
      alert('Lagret ✅');
      render();
    }catch(e){
      console.error(e);
      alert('Kunne ikke lagre: ' + (e.message || e));
    }
  }

  function saveCfg(){
    if (!(window.Sync && typeof window.Sync.setConfig==='function')){
      alert('Sync ikke klar ennå – prøv igjen om et øyeblikk.');
      return;
    }
    const binId = $('#adm_bin')?.value.trim() || '';
    const apiKey= $('#adm_key')?.value.trim() || '';
    window.Sync.setConfig({ binId, apiKey });
    if (typeof window.Sync.startPolling === 'function'){
      window.Sync.startPolling(15000);
    }
    alert('Synk-oppsett lagret ✅');
  }

  async function load(){
    if (!(window.Sync && typeof window.Sync.loadAddresses==='function')){
      return; // prøv igjen senere via hashchange/DOMContentLoaded
    }
    try{
      ADDR = await window.Sync.loadAddresses({ force:true });
      render();
    }catch(e){
      console.error(e);
    }
  }

  /* ------------------ Sesongverktøy ------------------ */
  function newSeason(){
    const cur = seasonGet();
    if (!confirm(`Start ny sesong? (nåværende: ${cur})`)) return;
    // enkel årsrulling (bytter ved juli)
    const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    const next = (m>=7) ? `${y+1}-${String(y+2).slice(-2)}` : `${y}-${String(y+1).slice(-2)}`;
    seasonSet(next);
    // vis samme adresser – men pins-kolonnen peker nå på ny sesong
    render();
  }

  function copyPins(){
    const cur = seasonGet();
    // finn forrige sesongstreng
    const parts = cur.split('-');
    if (parts.length!==2){ alert('Ugyldig sesongstreng.'); return; }
    const yA = parseInt(parts[0],10);
    const yB = parseInt('20'+parts[1],10);
    const prev = `${yA-1}-${String((yA).toString().slice(-2))}`; // (yA-1)-(yA)

    let copied=0;
    for (const a of ADDR){
      if (!a.pins) a.pins = {};
      const had = a.pins[cur];
      const prevVal = a.pins[prev];
      if ((had==null || had===0) && (prevVal!=null)){
        a.pins[cur] = prevVal;
        copied++;
      }
    }
    render();
    alert(copied ? `Kopierte pinner fra ${prev} til ${cur} på ${copied} adresser.` : 'Fant ingenting å kopiere.');
  }

  /* ------------------ Boot ------------------ */
  function boot(){
    ensureUI();
    renderSeason();

    // prepopuler lokalt fra cache hvis tilstede – raskere opplevd last
    if (window.Sync && typeof window.Sync.getCache==='function'){
      const c = window.Sync.getCache();
      if (Array.isArray(c.addresses)) ADDR = c.addresses.map(normalizeAddr);
    }
    render();

    // last fra sky når admin åpnes
    if (location.hash==='#admin') load();
  }

  function normalizeAddr(a){
    // sørg for at adressen følger forventet form
    return {
      id: a.id || ('addr_'+Date.now()),
      name: a.name || '',
      active: (a.active!==false),
      tasks: {
        snow: !!(a.tasks ? a.tasks.snow : (a.flags ? a.flags.snow!==false : true)),
        grit: !!(a.tasks ? a.tasks.grit : (a.flags ? !!a.flags.grit : false))
      },
      pins: (a.pins && typeof a.pins==='object') ? a.pins : {},
      lat: (a.lat!=null) ? a.lat : null,
      lon: (a.lon!=null) ? a.lon : null
    };
  }

  window.addEventListener('hashchange', ()=>{ if (location.hash==='#admin') boot(); });
  document.addEventListener('DOMContentLoaded', boot);

})();