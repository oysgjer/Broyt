/* === Del H: Katalog-editor (last, rediger, lagre, backup, publish, restore, CSV) === */
(function () {
  const CFG = window.BROYTE_CFG;
  const H   = window.BroyteHelpers;

  if (!CFG || !H) { console.error("Del C må lastes før Del H."); return; }

  const { $, headers, esc, displayName, seasonKey } = H;

  // Lokal helper – sørg for at "brøytestikker" alltid er med
  function normalizeTask(t){
    t = String(t || "").trim();
    return /brøytestikker/i.test(t) ? t : (t ? `${t} + brøytestikker` : "Snø + brøytestikker");
  }

  // Katalog i minne
  let CAT = { addresses: [], updated: 0, version: CFG.VERSION };

  /* ----------------- RENDER ----------------- */
  function renderCatList(){
    const host = $("#catList");
    if (!host) return;

    if (!Array.isArray(CAT.addresses) || CAT.addresses.length === 0){
      host.innerHTML = '<div class="small muted">– tom katalog –</div>';
      setMsg(`Rader: 0`);
      return;
    }

    const taskSelect = (val, idx) =>
      `<select data-k="task" data-i="${idx}" style="flex:1">
        ${CFG.DEFAULT_TASKS.map(t => `<option value="${esc(t)}" ${val===t?'selected':''}>${esc(t)}</option>`).join('')}
      </select>`;

    host.innerHTML = CAT.addresses.map((a,idx)=>`
      <div class="item" style="padding:8px 0;border-bottom:1px solid var(--cardBorder)">
        <div class="row" style="align-items:center">
          <input data-k="name"  data-i="${idx}" value="${esc(a.name||'')}" placeholder="Navn/adresse" style="flex:2">
          ${taskSelect(a.task || CFG.DEFAULT_TASKS[0], idx)}
          <label class="small"><input data-k="twoDriverRec" data-i="${idx}" type="checkbox" ${a.twoDriverRec?'checked':''}> 2 sjåfører</label>
          <label class="small"><input data-k="active" data-i="${idx}" type="checkbox" ${a.active===false?'':'checked'}> Aktiv</label>
          <label class="small">
            📍 <input data-k="pinsCount" data-i="${idx}" type="number" value="${(a.pinsCount ?? 0)}" min="0" style="width:70px"> stk
          </label>
          <button data-up="${idx}"   class="btn btn-gray small">⬆️</button>
          <button data-down="${idx}" class="btn btn-gray small">⬇️</button>
          <button data-del="${idx}"  class="btn btn-red small">Slett</button>
        </div>
      </div>
    `).join('');

    // Inputs/checkboxer
    host.querySelectorAll('input[data-k]').forEach(el=>{
      el.oninput = ()=>{
        const i = +el.dataset.i, k = el.dataset.k;
        if (!CAT.addresses[i]) return;
        if (k === 'twoDriverRec' || k === 'active'){
          CAT.addresses[i][k] = (k==='active') ? !!el.checked : !!el.checked;
          if (k==='active' && el.checked) CAT.addresses[i].active = true;
        } else if (k === 'pinsCount'){
          CAT.addresses[i][k] = parseInt(el.value || "0", 10) || 0;
        } else {
          CAT.addresses[i][k] = el.value;
        }
      };
      if (el.type === 'checkbox') el.onchange = el.oninput;
    });

    // Select (task)
    host.querySelectorAll('select[data-k="task"]').forEach(sel=>{
      sel.onchange = ()=>{
        const i = +sel.dataset.i;
        if (!CAT.addresses[i]) return;
        CAT.addresses[i].task = sel.value;
      };
    });

    // Delete
    host.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.del;
        CAT.addresses.splice(i,1);
        renderCatList();
      };
    });

    // Flytt opp / ned
    host.querySelectorAll('button[data-up]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.up;
        if (i <= 0) return;
        const tmp = CAT.addresses[i];
        CAT.addresses[i] = CAT.addresses[i-1];
        CAT.addresses[i-1] = tmp;
        renderCatList();
      };
    });
    host.querySelectorAll('button[data-down]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.down;
        if (i >= CAT.addresses.length - 1) return;
        const tmp = CAT.addresses[i];
        CAT.addresses[i] = CAT.addresses[i+1];
        CAT.addresses[i+1] = tmp;
        renderCatList();
      };
    });

    setMsg(`Rader: ${CAT.addresses.length}`);
  }

  function setMsg(txt){
    const m = $("#catMsg");
    if (m) m.textContent = txt;
  }

  /* ----------------- OPERASJONER ----------------- */

  // Last katalog
  async function loadCatalog(){
    try{
      setMsg("Laster katalog …");
      const r = await fetch(`https://api.jsonbin.io/v3/b/${CFG.BINS.CATALOG}/latest`, { headers: headers() });
      const js = await r.json();
      CAT = js?.record || { addresses: [], version: CFG.VERSION, updated: 0 };
      CAT.addresses = Array.isArray(CAT.addresses) ? CAT.addresses : [];
      setMsg(`Lastet ${CAT.addresses.length} adresser`);
      renderCatList();
    }catch(e){
      console.error(e);
      setMsg("Feil ved lasting (sjekk nøkkel).");
    }
  }

  // Legg til tom rad
  function editCatalogRow(){
    CAT.addresses.push({ name:'', task: CFG.DEFAULT_TASKS[0], active:true, twoDriverRec:false, pinsCount:0 });
    renderCatList();
  }

  // Lagre + backup
  async function saveCatalogWithBackup(){
    try{
      setMsg("Lagrer (med backup) …");

      // 1) Backup
      const backup = { version: CFG.VERSION, updated: Date.now(), by: displayName(), snapshot: CAT };
      await fetch(`https://api.jsonbin.io/v3/b/${CFG.BINS.BACKUP}`, {
        method:'PUT', headers: headers(), body: JSON.stringify(backup)
      });

      // 2) Lagre katalog
      const rec = { version: CFG.VERSION, updated: Date.now(), by: displayName(), addresses: CAT.addresses };
      await fetch(`https://api.jsonbin.io/v3/b/${CFG.BINS.CATALOG}`, {
        method:'PUT', headers: headers(), body: JSON.stringify(rec)
      });

      setMsg("Katalog lagret ✔︎");
    }catch(e){
      console.error(e);
      setMsg("Feil ved lagring (sjekk nøkkel).");
    }
  }

  // Publiser til MASTER (lager stops-array)
  async function publishCatalogToMaster(){
    try{
      setMsg("Publiserer til MASTER …");
      const active = (CAT.addresses || []).filter(a=>a?.active!==false);
      const nowSeason = seasonKey();

      const stops = active.map(a=>({
        n: a.name || '',
        t: normalizeTask(a.task || CFG.DEFAULT_TASKS[0]),
        f: false, b: false, p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: Number.isFinite(a.pinsCount) ? a.pinsCount : 0,
        pinsLockedYear: (Number.isFinite(a.pinsCount) && a.pinsCount > 0) ? nowSeason : null
      }));

      const payload = {
        version: CFG.VERSION,
        updated: Date.now(),
        lastSyncAt: Date.now(),
        lastSyncBy: displayName(),
        stops,
        meta: { from: 'catalog' }
      };

      await fetch(`https://api.jsonbin.io/v3/b/${CFG.BINS.MASTER}`, {
        method:'PUT', headers: headers(), body: JSON.stringify(payload)
      });

      setMsg(`Publisert ${stops.length} adresser til MASTER ✔︎`);
    }catch(e){
      console.error(e);
      setMsg("Feil ved publisering (sjekk nøkkel).");
    }
  }

  // Eksporter CSV
  function exportCatalogCsv(){
    const rows = [['name','task','active','twoDriverRec','pinsCount']].concat(
      (CAT.addresses||[]).map(a=>[
        (a.name||'').replaceAll('"','""'),
        (a.task||'').replaceAll('"','""'),
        (a.active===false?0:1),
        (a.twoDriverRec?1:0),
        (Number.isFinite(a.pinsCount)?a.pinsCount:0)
      ])
    );
    const csv = rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'katalog.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
    setMsg("CSV eksportert ✔︎");
  }

  // Gjenopprett fra backup (snapshot->catalog)
  async function restoreCatalogFromBackup(){
    try{
      setMsg("Henter backup …");
      const r = await fetch(`https://api.jsonbin.io/v3/b/${CFG.BINS.BACKUP}/latest`, { headers: headers() });
      const js = await r.json();
      const snap = js?.record?.snapshot;
      if (!snap || !Array.isArray(snap.addresses)){
        setMsg("Fant ingen gyldig backup.");
        return;
      }
      // lagre snapshot til CATALOG
      const rec = { version: CFG.VERSION, updated: Date.now(), by: displayName(), addresses: snap.addresses };
      await fetch(`https://api.jsonbin.io/v3/b/${CFG.BINS.CATALOG}`, {
        method:'PUT', headers: headers(), body: JSON.stringify(rec)
      });
      // last til minne og render
      CAT = { addresses: snap.addresses, version: CFG.VERSION, updated: Date.now() };
      renderCatList();
      setMsg("Gjenopprettet fra backup ✔︎");
    }catch(e){
      console.error(e);
      setMsg("Feil ved gjenoppretting (sjekk nøkkel).");
    }
  }

  /* ----------------- Eksponer til Admin (Del G) ----------------- */
  window.loadCatalog              = loadCatalog;
  window.editCatalogRow           = editCatalogRow;
  window.saveCatalogWithBackup    = saveCatalogWithBackup;
  window.publishCatalogToMaster   = publishCatalogToMaster;
  window.exportCatalogCsv         = exportCatalogCsv;
  window.restoreCatalogFromBackup = restoreCatalogFromBackup;

  // Auto-render tom liste (gir litt feedback selv før første load)
  document.addEventListener("DOMContentLoaded", renderCatList);
})();