/* ===== del-G.js — ADMIN (hybrid, lokal katalog + status) v9.12h ===== */
(() => {
  if (!window.Core) return console.error("Del-C.js må lastes før del-G.js.");
  const Core = window.Core;

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));

  const LSK = "broyte_v912h_catalog";

  function readLocalCatalog(){
    try { return JSON.parse(localStorage.getItem(LSK) || "{}"); } catch { return {}; }
  }
  function writeLocalCatalog(obj){
    try { localStorage.setItem(LSK, JSON.stringify(obj||{})); } catch {}
  }

  function stateToCatalog(){
    const S = Core.state || Core.makeDefaultState();
    const addresses = (S.stops||[]).map(s => ({
      name: s.n, task: s.t || "", twoDriverRec: !!s.twoDriverRec,
      pinsCount: Number(s.pinsCount||0),
      pinsLockedYear: s.pinsLockedYear ?? null,
      active: s.active !== false
    }));
    return { version: Core.cfg.VERSION, updated: Date.now(), driver: S.role||"driver",
             addresses };
  }

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
      // bevar/initialiser arbeidsfelt
      f:false, b:false, started:null, finished:null,
      snow:false, sand:false, snowAt:null, sandAt:null
    }));
    Core.save();
  }

  function seasonYear(){ // f.eks. "2025/26"
    return Core.seasonKey();
  }

  function renderRow(r, idx){
    const wrap = CE("div", { className:"card", style:"margin-bottom:10px" });

    const name = CE("input", { value:r.name||"", placeholder:"Navn / adresse" });
    const selTask = CE("select");
    selTask.innerHTML = `
      <option>Snø + brøytestikker</option>
      <option>Snø og grus + brøytestikker</option>
    `;
    selTask.value = r.task || "Snø + brøytestikker";

    const cbTwo = CE("input", { type:"checkbox", checked: !!r.twoDriverRec });
    const pins = CE("input", { type:"number", value: Number(r.pinsCount||0), min:"0", step:"1", style:"width:90px" });
    const lockBtn = CE("button", { className:"btn " + (r.pinsLockedYear? "btn-blue":"btn-gray"),
                                   textContent: r.pinsLockedYear ? `Låst ${r.pinsLockedYear}` : "Lås" });

    const delBtn = CE("button", { className:"btn btn-red", textContent:"Slett" });

    lockBtn.onclick = () => {
      if (r.pinsLockedYear){
        if (!confirm("Fjern lås for pinner?")) return;
        r.pinsLockedYear = null;
      } else {
        r.pinsLockedYear = seasonYear();
      }
      lockBtn.className = "btn " + (r.pinsLockedYear? "btn-blue":"btn-gray");
      lockBtn.textContent = r.pinsLockedYear ? `Låst ${r.pinsLockedYear}` : "Lås";
      saveFromUI();
    };

    delBtn.onclick = () => {
      if (!confirm(`Slette "${r.name}"?`)) return;
      const list = currentRows();
      list.splice(idx,1);
      renderList(list);
      saveFromUI();
    };

    function currentRows(){
      return $$(".admin-row").map(box => JSON.parse(box.dataset.row));
    }

    function saveFromUI(){
      // bygg ny katalog fra UI
      const rows = $$(".admin-row").map(box=>{
        const nx = $("input[data-k='name']", box).value.trim();
        const tx = $("select[data-k='task']", box).value;
        const tw = $("input[data-k='two']", box).checked;
        const pc = Number($("input[data-k='pins']", box).value||0);
        const ly = box.dataset.lockyear || null;
        return { name:nx, task:tx, twoDriverRec:tw, pinsCount:pc, pinsLockedYear:ly, active:true };
      });
      const cat = { version: Core.cfg.VERSION, updated: Date.now(), addresses: rows };
      writeLocalCatalog(cat);
      catalogToState(cat);
    }

    // layout
    const row = CE("div", { className:"admin-row", style:"display:grid;grid-template-columns:1fr 240px auto 120px 90px auto;gap:8px;align-items:center" });
    row.dataset.row = JSON.stringify(r);
    row.dataset.lockyear = r.pinsLockedYear ?? "";
    const lblTwo = CE("label", { innerHTML:"&nbsp;2 sjåfører" });

    // merk feltene for saveFromUI()
    name.setAttribute("data-k","name");
    selTask.setAttribute("data-k","task");
    cbTwo.setAttribute("data-k","two");
    pins.setAttribute("data-k","pins");

    // change-handlers
    [name,selTask,cbTwo,pins].forEach(el => el.addEventListener("change", ()=> {
      row.dataset.lockyear = r.pinsLockedYear ?? "";
      saveFromUI();
    }));

    const pinsWrap = CE("div");
    pinsWrap.append(pins);

    const twoWrap = CE("div", { style:"display:flex;align-items:center" });
    twoWrap.append(cbTwo, lblTwo);

    row.append(name, selTask, twoWrap, pinsWrap, lockBtn, delBtn);
    wrap.append(row);
    return wrap;
  }

  function renderList(addresses){
    const cont = $("#adminList");
    cont.innerHTML = "";
    if (!addresses.length){
      cont.append(CE("div", { className:"muted", textContent:"Ingen adresser. Legg til eller hent fra lokal katalog." }));
      return;
    }
    addresses.forEach((r,i)=> cont.append(renderRow(r,i)));
  }

  function readUIToCatalog(){
    const rows = $$(".admin-row").map(box=>{
      return {
        name: $("input[data-k='name']", box).value.trim(),
        task: $("select[data-k='task']", box).value,
        twoDriverRec: $("input[data-k='two']", box).checked,
        pinsCount: Number($("input[data-k='pins']", box).value||0),
        pinsLockedYear: box.dataset.lockyear || null,
        active: true
      };
    });
    return { version: Core.cfg.VERSION, updated: Date.now(), addresses: rows };
  }

  function renderAdmin(){
    const host = $("#admin"); if (!host) return;

    host.innerHTML = `
      <div class="card" style="max-width:1000px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button id="btnLoadLocal"  class="btn">📥 Hent status (MASTER)</button>
          <button id="btnSaveLocal"  class="btn btn-green">💾 Lagre katalog</button>
          <button id="btnPublish"    class="btn btn-blue">🚀 Publiser til MASTER</button>
          <button id="btnBackup"     class="btn btn-gray">🇺🇸 Backup nå</button>
          <button id="btnLive"       class="btn">🛰 Vis live sjåførstatus</button>
        </div>
        <div id="masterInfo" class="small muted" style="margin-bottom:8px">Tomt svar fra MASTER.</div>

        <h3>Adresser (Admin)</h3>
        <div class="small muted" style="margin-bottom:10px">
          Rediger navn/oppgave, anbefaling 2 sjåfører, og brøytestikker. Admin kan overstyre og låse pinner for inneværende sesong.
        </div>

        <div style="display:flex;gap:8px;margin-bottom:10px">
          <input id="newName" placeholder="Navn / adresse" style="flex:1">
          <select id="newTask">
            <option>Snø + brøytestikker</option>
            <option>Snø og grus + brøytestikker</option>
          </select>
          <label class="small"><input id="newTwo" type="checkbox"> 2 sjåfører</label>
          <button id="btnAdd" class="btn">+ Legg til</button>
        </div>

        <div id="adminList"></div>
      </div>

      <dialog id="dlgLive" style="max-width:700px">
        <h3>Live sjåførstatus</h3>
        <div id="liveBody" class="small muted">Leser …</div>
        <div style="margin-top:10px;display:flex;justify-content:flex-end"><button id="liveClose" class="btn">Lukk</button></div>
      </dialog>
    `;

    // knapper
    $("#btnLoadLocal").onclick = () => {
      const cat = readLocalCatalog();
      const human = cat.updated ? new Date(cat.updated).toLocaleString("no-NO") : "—";
      $("#masterInfo").textContent = `Lest fra lokal katalog. Sist endret: ${human}. ${cat.addresses?`Antall: ${cat.addresses.length}`:""}`;
      renderList(cat.addresses||[]);
      catalogToState(cat);
    };

    $("#btnSaveLocal").onclick = () => {
      const cat = readUIToCatalog();
      writeLocalCatalog(cat);
      catalogToState(cat);
      alert("Katalog lagret lokalt ✔︎");
    };

    // Av-publisering (hybrid: deaktivert cloud)
    $("#btnPublish").onclick = () => alert("Publisering til MASTER er deaktivert i hybrid-modus.");

    $("#btnBackup").onclick  = () => alert("Backup til sky er deaktivert i hybrid-modus.");

    // Legg til
    $("#btnAdd").onclick = () => {
      const curr = readLocalCatalog();
      const list = curr.addresses || [];
      const r = {
        name: ($("#newName").value||"").trim(),
        task: $("#newTask").value,
        twoDriverRec: $("#newTwo").checked,
        pinsCount: 0,
        pinsLockedYear: null,
        active: true
      };
      if (!r.name){ alert("Skriv et navn først."); return; }
      list.push(r);
      const next = { ...curr, updated: Date.now(), addresses:list };
      writeLocalCatalog(next);
      catalogToState(next);
      renderList(list);
      $("#newName").value=""; $("#newTwo").checked=false; $("#newTask").value="Snø + brøytestikker";
    };

    // start med å vise det som finnes lokalt eller fra state
    const existing = readLocalCatalog().addresses;
    if (existing && existing.length){
      renderList(existing);
      $("#masterInfo").textContent = `Laster fra lokal katalog. Antall: ${existing.length}`;
    } else {
      // bygg fra state hvis vi ikke har lokal katalog enda
      const cat = stateToCatalog();
      writeLocalCatalog(cat);
      renderList(cat.addresses);
      $("#masterInfo").textContent = `Tok utgangspunkt i dagens runde (lokalt). Antall: ${cat.addresses.length}`;
    }

    // Live-status dialog
    const dlg = $("#dlgLive"), body = $("#liveBody");
    $("#btnLive").onclick = () => {
      try {
        body.textContent = "Leser …";
        dlg.showModal();
        if (Core.status && Core.status.startPolling){
          Core.status.startPolling(list => {
            if (!list?.length){ body.textContent = "Ingen status tilgjengelig."; return; }
            const now = Date.now();
            const html = list.map(x=>{
              const age = Math.round((now - (x.ts||0))/1000);
              return `<div style="padding:6px 0;border-bottom:1px solid #333">
                        <div><b>${esc(x.name||"Ukjent")}</b> • ${x.direction==="reverse"?"Motsatt":"Vanlig"}</div>
                        <div class="small muted">Utstyr: ${x.equipment?.skjaer?"Skjær ":""}${x.equipment?.fres?"Fres ":""}${x.equipment?.strokasse?"Strøkasse":""}</div>
                        <div class="small muted">Framdrift: ${x.progress||0}% • ${x.current?esc(x.current):"—"} • ${age}s siden</div>
                      </div>`;
            }).join("");
            body.innerHTML = html;
          });
        } else {
          body.textContent = "Live-status er ikke tilgjengelig i dette oppsettet.";
        }
      } catch(e){
        body.textContent = "Kunne ikke vise status nå.";
      }
    };
    $("#liveClose").onclick = ()=> dlg.close();
  }

  document.addEventListener("DOMContentLoaded", () => {
    try{ renderAdmin(); }catch(e){ console.error(e); }
    console.log("del-G.js (admin) lastet");
  });
})();