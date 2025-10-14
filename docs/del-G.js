/* ===== del-G.js (ADMIN / Katalog-editor) ===== */
(() => {
  if (!window.Core) { console.error("Del C må lastes før Del G."); return; }

  const Core = window.Core;
  const { cfg } = Core;

  // ---- Lokal katalogmodell ----
  let CAT = { addresses: [], updated: 0, version: cfg.VERSION };

  // ---- Små helpers ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) => Core.esc(v);
  const normalizeTask = (t) => Core.normalizeTask(t);

  // ---- UI bygging ----
  function buildAdminUI() {
    const host = document.getElementById("adminCatalog");
    if (!host) return;

    host.innerHTML = `
      <div id="gAdminWrap" class="card stack" style="background:var(--card, #181a1e);border:1px solid var(--cardBorder,#2a2f36);border-radius:12px;padding:12px">
        <h2 style="margin:0 0 8px 0">Admin</h2>

        <!-- Synk-info linje -->
        <div id="adminSyncTxt" style="margin:8px 0 12px 0;font-size:12px;opacity:.8">Sist synk: —</div>

        <div class="row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
          <button id="gBtnLoad"     class="btn btn-gray">⟳ Last katalog</button>
          <button id="gBtnAdd"      class="btn btn-blue">➕ Legg til</button>
          <button id="gBtnSave"     class="btn btn-green">💾 Lagre (med backup)</button>
          <button id="gBtnPublish"  class="btn btn-blue">🚀 Publiser til MASTER</button>
          <button id="gBtnExport"   class="btn btn-gray">⬇︎ Eksporter CSV</button>
          <button id="gBtnRestore"  class="btn btn-red">⏪ Gjenopprett fra backup</button>
        </div>

        <div id="gMsg" class="small muted" style="margin-bottom:8px">—</div>
        <div id="gList"></div>
      </div>
    `;

    // Wire knapper
    $("#gBtnLoad").onclick = loadCatalog;
    $("#gBtnAdd").onclick = () => {
      CAT.addresses.push({ name:"", task: cfg.DEFAULT_TASKS[0], active:true, twoDriverRec:false, pinsCount:0 });
      renderList();
    };
    $("#gBtnSave").onclick = saveCatalogWithBackup;
    $("#gBtnPublish").onclick = publishCatalogToMaster;
    $("#gBtnExport").onclick = exportCatalogCsv;
    $("#gBtnRestore").onclick = restoreCatalogFromBackup;

    updateAdminSyncTxt();
  }

  function updateAdminSyncTxt(){
    try{
      const el = document.getElementById('adminSyncTxt');
      if(!el || !window.Core) return;
      const t  = window.Core.state?.lastSyncAt || null;
      const by = window.Core.state?.lastSyncBy || '';
      const nice = t ? new Date(t).toLocaleString('no-NO') : '—';
      el.textContent = `Sist synk: ${nice}${by ? ' • ' + by : ''}`;
    }catch(_){}
  }

  // ---- Render adresse-liste ----
  function renderList(){
    const host = $("#gList");
    if (!host) return;

    if (!CAT.addresses.length){
      host.innerHTML = `<div class="small muted">– tom katalog –</div>`;
      $("#gMsg").textContent = "—";
      return;
    }

    const taskOptions = cfg.DEFAULT_TASKS
      .map(t => `<option value="${esc(t)}">${esc(t)}</option>`)
      .join("");

    host.innerHTML = CAT.addresses.map((a, idx) => `
      <div class="item" style="padding:10px;border:1px solid var(--cardBorder,#2a2f36);border-radius:10px;margin-bottom:8px">
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input data-k="name" data-i="${idx}" value="${esc(a.name||'')}" placeholder="Navn/adresse" style="flex:2;min-width:220px">
          <select data-k="task" data-i="${idx}" style="flex:1;min-width:220px">
            ${taskOptions}
          </select>
          <label class="small" style="display:flex;align-items:center;gap:6px">
            <input type="checkbox" data-k="twoDriverRec" data-i="${idx}" ${a.twoDriverRec?'checked':''}>
            2 sjåfører
          </label>
          <label class="small" style="display:flex;align-items:center;gap:6px">
            <input type="checkbox" data-k="active" data-i="${idx}" ${a.active===false?'':'checked'}>
            Aktiv
          </label>
          <label class="small" style="display:flex;align-items:center;gap:6px">
            📍 <input type="number" data-k="pinsCount" data-i="${idx}" value="${Number.isFinite(a.pinsCount)?a.pinsCount:0}" min="0" style="width:70px"> stk
          </label>

          <div style="flex:1"></div>
          <button data-up="${idx}"   class="btn btn-gray small">⬆️</button>
          <button data-down="${idx}" class="btn btn-gray small">⬇️</button>
          <button data-del="${idx}"  class="btn btn-red small">Slett</button>
        </div>
      </div>
    `).join("");

    // Sett valgt task i selects
    $("#gList").querySelectorAll('select[data-k="task"]').forEach(sel=>{
      const i = +sel.dataset.i;
      sel.value = CAT.addresses[i].task || cfg.DEFAULT_TASKS[0];
      sel.onchange = () => {
        CAT.addresses[i].task = sel.value;
      };
    });

    // Inputs / checkboxer
    $("#gList").querySelectorAll('input[data-k]').forEach(el=>{
      el.oninput = ()=>{
        const i = +el.dataset.i, k = el.dataset.k;
        if (k === 'twoDriverRec' || k === 'active'){
          CAT.addresses[i][k] = el.checked;
          if (k==='active' && el.checked) CAT.addresses[i].active = true;
        } else if (k === 'pinsCount'){
          CAT.addresses[i][k] = parseInt(el.value || "0", 10) || 0;
        } else {
          CAT.addresses[i][k] = el.value;
        }
      };
      if (el.type === 'checkbox') el.onchange = el.oninput;
    });

    // Slett / Flytt
    $("#gList").querySelectorAll('button[data-del]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.del;
        CAT.addresses.splice(i,1);
        renderList();
      };
    });
    $("#gList").querySelectorAll('button[data-up]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.up;
        if (i <= 0) return;
        const tmp = CAT.addresses[i];
        CAT.addresses[i] = CAT.addresses[i-1];
        CAT.addresses[i-1] = tmp;
        renderList();
      };
    });
    $("#gList").querySelectorAll('button[data-down]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.down;
        if (i >= CAT.addresses.length - 1) return;
        const tmp = CAT.addresses[i];
        CAT.addresses[i] = CAT.addresses[i+1];
        CAT.addresses[i+1] = tmp;
        renderList();
      };
    });

    const msg = $("#gMsg");
    if (msg) msg.textContent = `Rader: ${CAT.addresses.length}`;
  }

  // ---- Nettkall ----
  async function loadCatalog(){
    try{
      $("#gMsg").textContent = "Laster katalog …";
      const js = await Core.fetchCatalog(); // fra del-C
      CAT = js?.record ? js.record : (js || {});
      // Sikre struktur
      if (!Array.isArray(CAT.addresses)) CAT.addresses = [];
      $("#gMsg").textContent = `Katalog hentet (${CAT.addresses.length})`;
      renderList();
    }catch(e){
      console.error(e);
      $("#gMsg").textContent = "Feil ved lasting (sjekk nøkkel).";
    }
  }

  async function saveCatalogWithBackup(){
    try{
      $("#gMsg").textContent = "Lagrer (med backup) …";
      // 1) Backup
      const backup = { version: cfg.VERSION, updated: Date.now(), by: Core.displayName(), snapshot: CAT };
      await fetch(`https://api.jsonbin.io/v3/b/${cfg.BINS.BACKUP}`, {
        method:'PUT', headers: Core.headers(), body: JSON.stringify(backup)
      });

      // 2) Lagre katalog
      const rec = { version: cfg.VERSION, updated: Date.now(), by: Core.displayName(), addresses: CAT.addresses };
      await fetch(`https://api.jsonbin.io/v3/b/${cfg.BINS.CATALOG}`, {
        method:'PUT', headers: Core.headers(), body: JSON.stringify(rec)
      });

      $("#gMsg").textContent = "Katalog lagret ✔︎";
      // (Valgfritt) oppdatér synk her også:
      // if (window.Core){ window.Core.state.lastSyncAt = Date.now(); window.Core.state.lastSyncBy = window.Core.displayName(); window.Core.save(); updateAdminSyncTxt(); }
    }catch(e){
      console.error(e);
      $("#gMsg").textContent = "Feil ved lagring (sjekk nøkkel).";
    }
  }

  async function publishCatalogToMaster(){
    try{
      $("#gMsg").textContent = "Publiserer til MASTER …";
      const active = (CAT.addresses||[]).filter(a => a?.active !== false);
      const nowSeason = Core.seasonKey();

      const stops = active.map(a => ({
        n: a.name || '',
        t: normalizeTask(a.task || cfg.DEFAULT_TASKS[0]),
        f: false, b: false, p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: Number.isFinite(a.pinsCount) ? a.pinsCount : 0,
        pinsLockedYear: (Number.isFinite(a.pinsCount) && a.pinsCount > 0) ? nowSeason : null
      }));

      const payload = {
        version: cfg.VERSION,
        updated: Date.now(),
        lastSyncAt: Date.now(),
        lastSyncBy: Core.displayName(),
        stops,
        meta: { from: 'catalog' }
      };

      const r = await fetch(`https://api.jsonbin.io/v3/b/${cfg.BINS.MASTER}`, {
        method:'PUT', headers: Core.headers(), body: JSON.stringify(payload)
      });
      if(!r.ok) throw new Error('Publisering feilet');

      // ✅ Oppdater synk-info globalt + på UI
      if (window.Core) {
        window.Core.state.lastSyncAt = payload.lastSyncAt;
        window.Core.state.lastSyncBy = payload.lastSyncBy;
        window.Core.save();
      }
      updateAdminSyncTxt();

      $("#gMsg").textContent = `Publisert ${stops.length} adresser til MASTER ✔︎`;
    }catch(e){
      console.error(e);
      $("#gMsg").textContent = "Feil ved publisering (sjekk nøkkel).";
    }
  }

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
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'katalog.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  async function restoreCatalogFromBackup(){
    try{
      $("#gMsg").textContent = "Henter backup …";
      const res = await fetch(`https://api.jsonbin.io/v3/b/${cfg.BINS.BACKUP}/latest`, { headers: Core.headers() });
      const js  = await res.json();
      const snap = js?.record?.snapshot;
      if (!snap || !Array.isArray(snap.addresses)) {
        $("#gMsg").textContent = "Ingen gyldig backup funnet.";
        return;
      }
      CAT = snap;
      $("#gMsg").textContent = `Backup lastet (${CAT.addresses.length}). Husk å lagre for å skrive tilbake.`;
      renderList();
    }catch(e){
      console.error(e);
      $("#gMsg").textContent = "Feil ved henting av backup.";
    }
  }

  // ---- Init ved DOM ready ----
  document.addEventListener("DOMContentLoaded", () => {
    buildAdminUI();
    // Last inn katalog automatisk ved åpning (kan kommenteres ut hvis ikke ønsket)
    // loadCatalog();
  });
})();