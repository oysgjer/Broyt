// js/Admin.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SEASON = 'BRYT_SEASON';   // f.eks. "2025-26"

  let ADDR = [];
  let DIRTY = false;
  let saveTimer = null;

  function markDirty(on=true){ DIRTY = !!on; }

  function nextId(){ return String(Date.now() + Math.random()); }
  function sorted(){ return [...ADDR].sort((a,b)=>(a.ord??0)-(b.ord??0)); }

  function ensureUI(){
    const host = $('#admin');
    if (!host || host.dataset.enhanced) return;

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
      </div>

      <!-- Dagsrapport -->
      <div class="card" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
        <div>
          <div class="label-muted">Dagsrapport</div>
          <div style="font-weight:700">Generer / Eksporter</div>
        </div>
        <div style="flex:1; min-width:220px">
          <input id="adm_report_driver" class="input" placeholder="Fører (valgfritt)" />
        </div>
        <div style="min-width:160px">
          <input id="adm_report_date" class="input" placeholder="Dato YYYY-MM-DD (valgfri)" />
        </div>
        <button id="adm_report_btn" class="btn">Vis rapport</button>
        <button id="adm_report_csv" class="btn-ghost">Last ned CSV</button>
      </div>

      <div class="card">
        <input id="adm_filter" class="input" placeholder="Filtrer adresser..." />
      </div>

      <div class="card" style="overflow:auto">
        <table id="adm_table" style="width:100%; border-collapse:collapse">
          <thead style="position:sticky; top:0; background:var(--surface); z-index:2">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:42%">Adresse</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:7%">Snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:7%">Grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:10%">Pinner</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:24%">Koordinater (lat, lon)</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:10%">Flytt</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:5%">Slett</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="row" style="gap:10px">
        <button id="adm_add" class="btn">Legg til adresse</button>
        <button id="adm_save" class="btn-ghost">Lagre</button>
      </div>

      <pre id="adm_report_out" style="white-space:pre-wrap; margin-top:10px; max-height:240px; overflow:auto; background:var(--surface); padding:10px; border-radius:8px;"></pre>
    `;
    host.dataset.enhanced='1';

    $('#adm_add')?.addEventListener('click', addRow);
    $('#adm_save')?.addEventListener('click', saveAllFromDOM);
    $('#adm_save_cfg')?.addEventListener('click', saveCfg);
    $('#adm_new_season')?.addEventListener('click', newSeason);
    $('#adm_copy_pins')?.addEventListener('click', copyPins);
    $('#adm_filter')?.addEventListener('input', render);

    // report
    $('#adm_report_btn')?.addEventListener('click', showReport);
    $('#adm_report_csv')?.addEventListener('click', downloadReportCsv);

    // init cfg-felt
    const cfg = Sync.getConfig();
    $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
    $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
    renderSeason();
  }

  function seasonGet(){ return RJ(K_SEASON, guessSeason()); }
  function seasonSet(v){ WJ(K_SEASON, v); renderSeason(); }
  function guessSeason(){
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    return (m>=7) ? `${y}-${(y+1).toString().slice(-2)}` : `${y-1}-${y.toString().slice(-2)}`;
  }
  function renderSeason(){
    $('#adm_season') && ($('#adm_season').textContent = seasonGet());
  }

  function addRow(){
    const ord = (ADDR.length ? Math.max(...ADDR.map(a=>a.ord??0))+1 : 0);
    ADDR.push({ id: nextId(), ord, name:'', tasks:{snow:false,grit:false}, pins:0, lat:null, lon:null });
    markDirty();
    render();
    autoSaveSoon();
  }

  function render(){
    const tb = $('#adm_table tbody'); if (!tb) return;
    const q = ($('#adm_filter')?.value || '').toLowerCase();

    const rows = sorted().filter(a => (a.name||'').toLowerCase().includes(q));

    tb.innerHTML = rows.map((a,ix)=>`
      <tr data-id="${a.id}">
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_name input" value="${(a.name||'').replace(/"/g,'&quot;')}" style="width:100%">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:center">
          <input type="checkbox" class="adm_snow" ${a.tasks?.snow?'checked':''}>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:center">
          <input type="checkbox" class="adm_grit" ${a.tasks?.grit?'checked':''}>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_pins input" type="number" min="0" value="${a.pins??0}" style="max-width:80px">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_coords input" placeholder="60.2661, 11.1962" value="${fmtCoords(a)}" style="width:100%">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <div class="row" style="gap:8px">
            <button class="btn-ghost adm_up">⬆️</button>
            <button class="btn-ghost adm_down">⬇️</button>
          </div>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <button class="btn-ghost adm_del">🗑️</button>
        </td>
      </tr>
    `).join('');

    // wire rad-hendelser
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;

      tr.querySelector('.adm_name')?.addEventListener('input', e=>{
        const it = ADDR.find(x=>x.id===id); if(!it) return;
        it.name = e.target.value;
        markDirty(); autoSaveSoon();
      });

      tr.querySelector('.adm_snow')?.addEventListener('change', e=>{
        const it = ADDR.find(x=>x.id===id); if(!it) return;
        it.tasks = it.tasks || {}; it.tasks.snow = !!e.target.checked;
        markDirty(); autoSaveSoon();
      });

      tr.querySelector('.adm_grit')?.addEventListener('change', e=>{
        const it = ADDR.find(x=>x.id===id); if(!it) return;
        it.tasks = it.tasks || {}; it.tasks.grit = !!e.target.checked;
        markDirty(); autoSaveSoon();
      });

      tr.querySelector('.adm_pins')?.addEventListener('input', e=>{
        const it = ADDR.find(x=>x.id===id); if(!it) return;
        it.pins = Number(e.target.value||0);
        markDirty(); autoSaveSoon();
      });

      tr.querySelector('.adm_coords')?.addEventListener('input', e=>{
        const it = ADDR.find(x=>x.id===id); if(!it) return;
        const {lat,lon} = parseCoords(e.target.value);
        it.lat = lat; it.lon = lon;
        markDirty(); autoSaveSoon();
      });

      tr.querySelector('.adm_del')?.addEventListener('click', ()=>{
        ADDR = ADDR.filter(a=>a.id!==id);
        renumberIfNeeded();
        markDirty(); render(); autoSave();
      });

      tr.querySelector('.adm_up')?.addEventListener('click', ()=>moveRow(id, -1));
      tr.querySelector('.adm_down')?.addEventListener('click', ()=>moveRow(id, +1));
    });
  }

  function fmtCoords(a){
    if (a?.lat==null || a?.lon==null) return '';
    return `${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`;
  }
  function parseCoords(txt){
    const m = String(txt||'').replace(/[()]/g,'').split(/[, ]+/).filter(Boolean);
    const lat = parseFloat(m[0]); const lon = parseFloat(m[1]);
    return { lat: isNaN(lat)?null:lat, lon: isNaN(lon)?null:lon };
  }

  // ---- flytting (bytt ord, behold alt annet) ----
  function moveRow(id, dir){
    const arr = sorted();
    const i = arr.findIndex(x=>x.id===id);
    if (i<0) return;

    const j = i + (dir<0 ? -1 : 1);
    if (j<0 || j>=arr.length) return;

    // bytt ord
    const a = arr[i], b = arr[j];
    const tmp = a.ord ?? i;
    a.ord = b.ord ?? j;
    b.ord = tmp;

    // skriv ord tilbake i ADDR by id
    const A = ADDR.find(x=>x.id===a.id); if (A) A.ord = a.ord;
    const B = ADDR.find(x=>x.id===b.id); if (B) B.ord = b.ord;

    markDirty(); render(); autoSave();
  }

  function renumberIfNeeded(){
    // sørg for sekvensielle ord-verdier (0..n-1)
    const arr = sorted();
    arr.forEach((x,ix)=>{ x.ord = ix; const ref = ADDR.find(y=>y.id===x.id); if (ref) ref.ord = ix; });
  }

  // ---------- Lagring ----------
  function autoSaveSoon(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autoSave, 400);
  }
  async function autoSave(){
    try{
      await Sync.saveAddresses(ADDR); // bevarer ord
      markDirty(false);
    }catch(e){
      console.error(e);
      alert('Kunne ikke lagre endringene.');
    }
  }

  async function saveAllFromDOM(){
    // trekk dagens verdier fra DOM (inkludert rekkefølge som ligger i ADDR.ord)
    const tb = $('#adm_table tbody');
    if (!tb){ return; }

    const map = Object.fromEntries(ADDR.map(a=>[a.id,a]));
    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id; const it = map[id]; if(!it) return;
      it.name = tr.querySelector('.adm_name')?.value || '';
      it.tasks = it.tasks || {};
      it.tasks.snow = !!tr.querySelector('.adm_snow')?.checked;
      it.tasks.grit = !!tr.querySelector('.adm_grit')?.checked;
      it.pins = Number(tr.querySelector('.adm_pins')?.value || 0);
      const {lat,lon} = parseCoords(tr.querySelector('.adm_coords')?.value);
      it.lat = lat; it.lon = lon;
    });

    try{
      await Sync.saveAddresses(ADDR);
      markDirty(false);
      alert('Lagret ✅');
    }catch(e){
      console.error(e); alert('Kunne ikke lagre: '+e.message);
    }
  }

  function saveCfg(){
    const binId = $('#adm_bin')?.value.trim() || '';
    const apiKey = $('#adm_key')?.value.trim() || '';
    Sync.setConfig({binId, apiKey});
    Sync.startPolling(15000);
    alert('Synk-oppsett lagret ✅');
  }

  function newSeason(){
    const cur = seasonGet();
    if (!confirm(`Start ny sesong? (nåværende: ${cur})`)) return;
    const d = new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    const next = (m>=7) ? `${y+1}-${(y+2).toString().slice(-2)}` : `${y}-${(y+1).toString().slice(-2)}`;
    seasonSet(next);
  }

  function copyPins(){
    alert('Kopiering av pinner fra forrige sesong er notert – vi kan senere koble mot historikk hvis ønskelig.');
  }

  async function load(){
    try{
      const list = await Sync.loadAddresses({force:true});
      // sørg for at alle har ord
      ADDR = (list||[]).map((a,ix)=>({ ...a, ord: (a.ord==null? ix : Number(a.ord)) }));
      render();
    }catch(e){ console.error(e); }
  }

  // Oppdater fra Sync – men ikke mens vi har lokale, ulagrede endringer
  Sync.on?.('change', ()=>{
    if (DIRTY) return;
    const cache = Sync.getCache?.() || {};
    const list = cache.addresses || [];
    ADDR = (list||[]).map((a,ix)=>({ ...a, ord: (a.ord==null? ix : Number(a.ord)) }));
    render();
  });

  // --- rapport visning
  function showReport(){
    const d = $('#adm_report_driver')?.value.trim() || '';
    const date = $('#adm_report_date')?.value.trim() || '';
    const rows = Sync.generateDailyReport({ driver: d || undefined, date: date || undefined });
    const out = rows.map(it => `${it.date}\t${it.roundId}\t${it.driver}\t${it.address}\t${it.type}\t${it.started}\t${it.finished}`).join('\n');
    $('#adm_report_out').textContent = 'Dato\tRoundId\tFører\tAdresse\tType\tStartet\tFerdig\n' + out;
  }

  function downloadReportCsv(){
    const d = $('#adm_report_driver')?.value.trim() || '';
    const date = $('#adm_report_date')?.value.trim() || '';
    const rows = Sync.generateDailyReport({ driver: d || undefined, date: date || undefined });
    const csv = ['Dato;RoundId;Fører;Adresse;Type;Startet;Ferdig']
      .concat(rows.map(r => `${r.date};${r.roundId};${r.driver};"${(r.address||'').replace(/"/g,'""')}";${r.type};${r.started};${r.finished}`))
      .join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dagsrapport_${date||'all'}_${Date.now()}.csv`; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function boot(){
    ensureUI();
    if (location.hash==='#admin') load();
  }
  window.addEventListener('hashchange', ()=>{ if (location.hash==='#admin') boot(); });
  document.addEventListener('DOMContentLoaded', boot);
})();