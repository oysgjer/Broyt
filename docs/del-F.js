/* ===== del-F.js — ADRESSE-REGISTER (hybrid v9.12h) ===== */
(() => {
  if (!window.Core) return console.error("Del-C.js må lastes før del-F.js.");
  const Core = window.Core;

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);

  const LSK = "broyte_v912h_catalog";

  /* ---------- Lokal katalog ---------- */
  function readLocalCatalog(){
    try { return JSON.parse(localStorage.getItem(LSK) || "{}"); } catch { return {}; }
  }
  function writeLocalCatalog(obj){
    try { localStorage.setItem(LSK, JSON.stringify(obj||{})); } catch {}
  }

  /* ---------- Importer fra katalog -> Core.state.stops ---------- */
  function catalogToState(catalog){
    const S = Core.state || Core.makeDefaultState();
    const arr = Array.isArray(catalog?.addresses) ? catalog.addresses : [];
    S.stops = arr.map(r => ({
      n: r.name || "",
      t: r.task || "Snø + brøytestikker",
      twoDriverRec: !!r.twoDriverRec,
      pinsCount: Number(r.pinsCount||0),
      pinsLockedYear: r.pinsLockedYear ?? null,
      active: r.active !== false,

      // arbeidsfelt
      f:false, b:false, started:null, finished:null,
      snow:false, sand:false, snowAt:null, sandAt:null
    }));
    Core.save();
  }

  /* ---------- Nullstill lokal status (arbeidsfelt, ikke katalog) ---------- */
  function resetLocalStatus(){
    const S = Core.state || Core.makeDefaultState();
    (S.stops||[]).forEach(s=>{
      s.f=false; s.b=false; s.started=null; s.finished=null;
      s.snow=false; s.sand=false; s.snowAt=null; s.sandAt=null;
    });
    Core.save();
  }

  /* ---------- Render liste ---------- */
  function renderList(){
    const host = $("#addresses"); if (!host) return;
    const S = Core.state || Core.makeDefaultState();
    const list = Array.isArray(S.stops) ? S.stops : [];
    const cnt = list.length;

    const body = $("#addrList");
    const counter = $("#addrCount");
    if (counter) counter.textContent = `Adresser i runde: ${cnt}`;

    body.innerHTML = "";
    if (!cnt){
      body.innerHTML = `<div class="muted">Ingen adresser enda. Hent katalog i Admin-fanen, eller legg til under.</div>`;
      return;
    }

    list.forEach(s => {
      const row = CE("div", { className:"card", style:"margin-bottom:10px" });
      row.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div>
            <div><b>${Core.esc(s.n)}</b></div>
            <div class="small muted">${Core.esc(s.t)}${s.twoDriverRec ? " • 2 sjåfører" : ""}</div>
          </div>
          <div class="small muted">📍 ${Number(s.pinsCount||0)}${s.pinsLockedYear ? ` • Låst ${Core.esc(s.pinsLockedYear)}`:""}</div>
        </div>
      `;
      body.append(row);
    });
  }

  /* ---------- Legg til én lokalt (oppdaterer både katalog + state) ---------- */
  function addLocal(name, task, two){
    const cat = readLocalCatalog();
    const list = Array.isArray(cat.addresses) ? cat.addresses : [];
    list.push({
      name: name.trim(),
      task,
      twoDriverRec: !!two,
      pinsCount: 0,
      pinsLockedYear: null,
      active: true
    });
    const next = { ...cat, updated: Date.now(), addresses: list };
    writeLocalCatalog(next);
    catalogToState(next);
  }

  /* ---------- Bygg UI ---------- */
  function renderUI(){
    const host = $("#addresses"); if (!host) return;

    host.innerHTML = `
      <div class="card" style="max-width:1000px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button id="btnImport" class="btn btn-blue">🚀 Hent fra katalog</button>
          <button id="btnReset"  class="btn">🧹 Nullstill lokal status</button>
        </div>

        <div id="addrCount" class="small muted" style="margin-bottom:10px">Adresser i runde: 0</div>

        <h3>Legg til ny adresse (lokalt)</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <input id="newName" placeholder="Navn / adresse" style="flex:1;min-width:220px">
          <select id="newTask">
            <option>Snø + brøytestikker</option>
            <option>Snø og grus + brøytestikker</option>
          </select>
          <label class="small"><input id="newTwo" type="checkbox"> 2 sjåfører</label>
          <button id="btnAdd" class="btn">+ Legg til</button>
        </div>

        <div id="addrList"></div>
      </div>
    `;

    // Knapper
    $("#btnImport").onclick = () => {
      const cat = readLocalCatalog();
      const has = Array.isArray(cat.addresses) && cat.addresses.length;
      if (!has){
        alert("Ingen adresser funnet i katalogen.");
        return;
      }
      catalogToState(cat);
      renderList();
    };

    $("#btnReset").onclick = () => {
      if (!confirm("Nullstille lokal status? (pågår/ferdig, tider, snø/grus osv.)")) return;
      resetLocalStatus();
      renderList();
    };

    $("#btnAdd").onclick = () => {
      const name = ($("#newName").value||"").trim();
      const task = $("#newTask").value;
      const two  = $("#newTwo").checked;
      if (!name){ alert("Skriv et navn først."); return; }
      addLocal(name, task, two);
      $("#newName").value=""; $("#newTwo").checked=false; $("#newTask").value="Snø + brøytestikker";
      renderList();
    };

    // Første visning
    renderList();
  }

  document.addEventListener("DOMContentLoaded", () => {
    try { renderUI(); } catch(e){ console.error(e); }
    console.log("del-F.js (adresse-register) lastet");
  });
})();