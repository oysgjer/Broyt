// js/Admin.js — Admin med kolonne "Merknad", sticky header, flytt opp/ned
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  let ADDR = [];
  let DIRTY = false;
  let saveTimer = null;

  const markDirty = (on=true)=>{ DIRTY=!!on; };

  function ensureUI(){
    const host = $('#admin');
    if (!host || host.dataset.enhanced) return;

    host.innerHTML = `
      <h1>Admin</h1>

      <div class="card">
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <label class="field" style="min-width:260px">
            <span>JSONBin ID</span>
            <input id="adm_bin" class="input" placeholder="68e7..." />
          </label>
          <label class="field" style="min-width:320px">
            <span>Master Key</span>
            <input id="adm_key" class="input" placeholder="••••••" />
          </label>
          <button id="adm_save_cfg" class="btn">Lagre synk-oppsett</button>
        </div>
      </div>

      <div class="card">
        <input id="adm_filter" class="input" placeholder="Filtrer adresser..." />
      </div>

      <div class="card" style="overflow:auto">
        <table id="adm_table" style="width:100%; border-collapse:collapse">
          <thead style="position:sticky; top:0; background:var(--surface); z-index:2">
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:34%">Adresse</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:7%">Snø</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:7%">Grus</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:8%">Pinner</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:20%">Koordinater (lat, lon)</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:18%">Merknad</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:6%">Flytt</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--sep); width:6%">Slett</th>
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

    $('#adm_add')?.addEventListener('click', addRow);
    $('#adm_save')?.addEventListener('click', saveAllFromDOM);
    $('#adm_save_cfg')?.addEventListener('click', saveCfg);
    $('#adm_filter')?.addEventListener('input', render);

    const cfg = Sync.getConfig();
    $('#adm_bin') && ($('#adm_bin').value = cfg.binId || '');
    $('#adm_key') && ($('#adm_key').value = cfg.apiKey || '');
  }

  const nextId = ()=> String(Date.now() + Math.random());
  const sorted = ()=> [...ADDR].sort((a,b)=>(a.ord??0)-(b.ord??0));

  function addRow(){
    const ord = (ADDR.length ? Math.max(...ADDR.map(a=>a.ord??0))+1 : 0);
    ADDR.push({ id: nextId(), ord, name:'', tasks:{snow:false,grit:false}, pins:0, lat:null, lon:null, note:'' });
    markDirty(); render(); autoSave();
  }

  function fmtCoords(a){ if (a?.lat==null || a?.lon==null) return ''; return `${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`; }
  function parseCoords(txt){
    const m = String(txt||'').replace(/[()]/g,'').split(/[, ]+/).filter(Boolean);
    const lat = parseFloat(m[0]); const lon = parseFloat(m[1]);
    return { lat: isNaN(lat)?null:lat, lon: isNaN(lon)?null:lon };
  }

  function render(){
    const tb = $('#adm_table tbody'); if (!tb) return;
    const q = ($('#adm_filter')?.value || '').toLowerCase();
    const rows = sorted().filter(a => (a.name||'').toLowerCase().includes(q));

    tb.innerHTML = rows.map(a=>`
      <tr data-id="${a.id}">
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_name input" value="${a.name||''}" style="width:100%">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input type="checkbox" class="adm_snow" ${a.tasks?.snow?'checked':''}>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input type="checkbox" class="adm_grit" ${a.tasks?.grit?'checked':''}>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_pins input" type="number" min="0" value="${a.pins??0}" style="max-width:80px">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_coords input" placeholder="60.2661, 11.1962" value="${fmtCoords(a)}" style="width:100%">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <input class="adm_note input" placeholder="Merknad (vises når du trykker Start)" value="${(a.note||'').replace(/"/g,'&quot;')}" style="width:100%">
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep)">
          <div class="row" style="gap:8px; justify-content:center">
            <button class="btn-ghost adm_up">⬆️</button>
            <button class="btn-ghost adm_down">⬇️</button>
          </div>
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--sep); text-align:center">
          <button class="btn-ghost adm_del">🗑️</button>
        </td>
      </tr>
    `).join('');

    tb.querySelectorAll('tr').forEach(tr=>{
      const id = tr.dataset.id;
      const get = () => ADDR.find(x=>x.id===id);

      tr.querySelector('.adm_name')?.addEventListener('input', e=>{ const it=get(); if(!it) return; it.name=e.target.value; markDirty(); autoSaveSoon(); });
      tr.querySelector('.adm_snow')?.addEventListener('change', e=>{ const it=get(); if(!it) return; it.tasks=it.tasks||{}; it.tasks.snow=!!e.target.checked; markDirty(); autoSaveSoon(); });
      tr.querySelector('.adm_grit')?.addEventListener('change', e=>{ const it=get(); if(!it) return; it.tasks=it.tasks||{}; it.tasks.grit=!!e.target.checked; markDirty(); autoSaveSoon(); });
      tr.querySelector('.adm_pins')?.addEventListener('input', e=>{ const it=get(); if(!it) return; it.pins=Number(e.target.value||0); markDirty(); autoSaveSoon(); });
      tr.querySelector('.adm_coords')?.addEventListener('input', e=>{ const it=get(); if(!it) return; const {lat,lon}=parseCoords(e.target.value); it.lat=lat; it.lon=lon; markDirty(); autoSaveSoon(); });
      tr.querySelector('.adm_note')?.addEventListener('input', e=>{ const it=get(); if(!it) return; it.note = e.target.value || ''; markDirty(); autoSaveSoon(); });

      tr.querySelector('.adm_del')?.addEventListener('click', ()=>{ ADDR = ADDR.filter(a=>a.id!==id); renumberIfNeeded(); markDirty(); render(); autoSave(); });
      tr.querySelector('.adm_up')?.addEventListener('click', ()=>moveRow(id,-1));
      tr.querySelector('.adm_down')?.addEventListener('click', ()=>moveRow(id,+1));
    });
  }

  function moveRow(id, dir){
    const arr = sorted();
    const i = arr.findIndex(x=>x.id===id);
    if (i<0) return;
    const j = i + (dir<0 ? -1 : 1);
    if (j<0 || j>=arr.length) return;

    const a = arr[i], b = arr[j];
    const tmp = a.ord ?? i; a.ord = b.ord ?? j; b.ord = tmp;

    const A = ADDR.find(x=>x.id===a.id); if (A) A.ord=a.ord;
    const B = ADDR.find(x=>x.id===b.id); if (B) B.ord=b.ord;

    markDirty(); render(); autoSave();
  }
  function renumberIfNeeded(){ const arr=sorted(); arr.forEach((x,ix)=>{ x.ord=ix; const ref=ADDR.find(y=>y.id===x.id); if (ref) ref.ord=ix; }); }

  function autoSaveSoon(){ clearTimeout(saveTimer); saveTimer=setTimeout(autoSave, 400); }
  async function autoSave(){ try{ await Sync.saveAddresses(ADDR); markDirty(false); }catch(e){ console.error(e); alert('Kunne ikke lagre endringene.'); } }

  async function saveAllFromDOM(){
    const tb = $('#adm_table tbody'); if (!tb) return;
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
      it.note = tr.querySelector('.adm_note')?.value || '';
    });
    try{ await Sync.saveAddresses(ADDR); markDirty(false); alert('Lagret ✅'); }catch(e){ console.error(e); alert('Kunne ikke lagre: '+e.message); }
  }

  function saveCfg(){ const binId=$('#adm_bin')?.value.trim()||''; const apiKey=$('#adm_key')?.value.trim()||''; Sync.setConfig({binId,apiKey}); alert('Synk-oppsett lagret ✅'); }

  async function load(){
    try{
      const list = await Sync.loadAddresses({force:true});
      ADDR = (list||[]).map((a,ix)=>({ ...a, ord:(a.ord==null?ix:Number(a.ord)), note: (typeof a.note==='string'?a.note:'') }));
      render();
    }catch(e){ console.error(e); }
  }

  Sync.on?.('change', ()=>{
    if (DIRTY) return;
    const list = (Sync.getCache?.()||{}).addresses || [];
    ADDR = (list||[]).map((a,ix)=>({ ...a, ord:(a.ord==null?ix:Number(a.ord)), note:(typeof a.note==='string'?a.note:'') }));
    render();
  });

  function boot(){ ensureUI(); if (location.hash==='#admin') load(); }
  window.addEventListener('hashchange', ()=>{ if (location.hash==='#admin') boot(); });
  document.addEventListener('DOMContentLoaded', boot);
})();