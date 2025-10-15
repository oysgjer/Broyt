/* ===== del-H.js — Adresse-register (hybrid v9.12h) ===== */
(() => {
  const NS = "broyte_v912h_catalog";

  // ----- Trygge helpers -----
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));
  const log = (...a) => console.log("[del-H]", ...a);

  // ----- Lokal katalog -----
  function loadLocalCatalog() {
    try {
      const raw = localStorage.getItem(NS);
      if (!raw) return { version: (window.Core?.cfg?.VERSION || "9.12h"), updated: Date.now(), addresses: [] };
      const js = JSON.parse(raw);
      if (!Array.isArray(js.addresses)) js.addresses = [];
      return js;
    } catch {
      return { version: (window.Core?.cfg?.VERSION || "9.12h"), updated: Date.now(), addresses: [] };
    }
  }
  function saveLocalCatalog(cat) {
    try {
      cat.version = window.Core?.cfg?.VERSION || "9.12h";
      cat.updated = Date.now();
      localStorage.setItem(NS, JSON.stringify(cat));
    } catch(_) {}
  }

  // ----- Synk state <-> katalog -----
  function catalogToStops(cat) {
    const Core = window.Core;
    if (!Core) return;
    const arr = (cat.addresses || []).map(a => ({
      n: a.name,
      t: a.task || (Core.cfg?.DEFAULT_TASKS?.[0] || "Snø + brøytestikker"),
      f: false,           // ferdig
      b: false,           // blokkert / ikke mulig
      p: [],              // pins-historikk lokalt
      twoDriverRec: !!a.twoDriverRec,
      pinsCount: a.pinsCount || 0,
      pinsLockedYear: a.pinsLockedYear ?? null,
      active: a.active !== false
    }));
    Core.state.stops = arr;
    Core.save();
  }

  // Hent synlig antall (aktive) fra state
  function activeCountFromState() {
    const Core = window.Core;
    if (!Core?.state?.stops) return 0;
    return Core.state.stops.filter(s => s.active !== false).length;
  }

  // ----- Hent fra JSONBin (hybrid) -----
  async function tryImportFromJSONBin() {
    const Core = window.Core;
    if (!Core || typeof Core.fetchCatalog !== "function") {
      alert("Del-C (core) mangler. Kan ikke hente katalog.");
      return;
    }
    log("Laster inn katalog fra JSONBin …");
    const remote = await Core.fetchCatalog(); // { record:{…} } håndteres i del-C
    const rec = remote?.record || remote;     // noen ganger får vi ren record
    const addresses = Array.isArray(rec?.addresses) ? rec.addresses : [];
    if (addresses.length === 0) {
      alert("Ingen adresser funnet i katalogen.");
      return;
    }
    const cat = loadLocalCatalog();
    cat.addresses = addresses.map(a => ({
      name: a.name || a.n || "Uten navn",
      task: Core.normalizeTask(a.task || a.t || ""),
      twoDriverRec: !!a.twoDriverRec,
      pinsCount: a.pinsCount || 0,
      pinsLockedYear: a.pinsLockedYear ?? null,
      active: a.active !== false
    }));
    saveLocalCatalog(cat);
    catalogToStops(cat);
    render(); // oppdater UI
    alert(`Importerte fra KATALOG: ${cat.addresses.length}`);
  }

  // ----- Nullstill LOKAL status (ikke katalog) -----
  function resetLocalStatusOnly() {
    const Core = window.Core;
    if (!Core?.state?.stops) return;
    Core.state.stops.forEach(s => { s.f = false; s.b = false; });
    Core.save();
    render();
  }

  // ----- Legg til ny adresse lokalt -----
  function addLocalAddress(name, task, twoDriver=false) {
    const Core = window.Core;
    const cat = loadLocalCatalog();
    cat.addresses.push({
      name: name.trim(),
      task: Core.normalizeTask(task),
      twoDriverRec: !!twoDriver,
      pinsCount: 0,
      pinsLockedYear: null,
      active: true
    });
    saveLocalCatalog(cat);
    // legg også inn i state-stoppene (på slutten)
    Core.state.stops.push({
      n: name.trim(),
      t: Core.normalizeTask(task),
      f:false, b:false, p:[],
      twoDriverRec: !!twoDriver,
      pinsCount: 0,
      pinsLockedYear: null,
      active: true
    });
    Core.save();
    render();
  }

  // ----- Slett / toggles -----
  function toggleActive(idx) {
    const cat = loadLocalCatalog();
    if (!cat.addresses[idx]) return;
    cat.addresses[idx].active = !cat.addresses[idx].active;
    saveLocalCatalog(cat);

    // speil til state (ved navn-match)
    const Core = window.Core;
    const name = cat.addresses[idx].name;
    const stop = Core?.state?.stops?.find(s => s.n === name);
    if (stop) { stop.active = cat.addresses[idx].active; Core.save(); }
    render();
  }

  function deleteAddress(idx) {
    const cat = loadLocalCatalog();
    const row = cat.addresses[idx];
    if (!row) return;
    if (!confirm(`Slette "${row.name}" fra lokal katalog?`)) return;
    cat.addresses.splice(idx, 1);
    saveLocalCatalog(cat);

    const Core = window.Core;
    if (Core?.state?.stops) {
      Core.state.stops = Core.state.stops.filter(s => s.n !== row.name);
      Core.save();
    }
    render();
  }

  // ----- UI-render -----
  function render() {
    const root = $("#addresses");
    if (!root) return;

    // Rydd og bygg container
    root.innerHTML = "";
    const title = CE("h2", { textContent: "Adresse-register" });
    const info  = CE("div", { className:"muted", style:"margin:-6px 0 10px 0;", textContent:"Hybridmodus: lokalt først, JSONBin ved import." });

    // Topp-knapper
    const topBar = CE("div", { style:"display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;" });
    const btnFetch = CE("button", { className:"btn btn-blue", textContent:"🚀 Hent fra katalog" });
    const btnReset = CE("button", { className:"btn", textContent:"🧹 Nullstill lokal status" });

    btnFetch.addEventListener("click", tryImportFromJSONBin);
    btnReset.addEventListener("click", () => {
      if (confirm("Nullstille status for alle stopp LOKALT?")) resetLocalStatusOnly();
    });

    // Teller
    const count = CE("div", { style:"margin:8px 0 2px 0;" });
    count.textContent = `Adresser i runde: ${activeCountFromState()}`;

    // Legg til ny (lokalt)
    const addCard = CE("div", { className:"card", style:"padding:10px;margin:10px 0;" });
    const addTitle = CE("div", { className:"muted", textContent:"Legg til ny adresse (lokalt)" });

    const addRow = CE("div", { style:"display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;" });
    const inpName = CE("input", { className:"input", placeholder:"Navn / adresse", style:"min-width:220px;" });
    const selTask  = CE("select", { className:"input" });
    const tasks = (window.Core?.cfg?.DEFAULT_TASKS || ["Snø + brøytestikker","Snø og grus + brøytestikker"]);
    tasks.forEach(t => selTask.appendChild( CE("option", { value:t, textContent:t }) ));
    const chkTwo = CE("label", { style:"display:flex;align-items:center;gap:6px;" });
    chkTwo.appendChild( CE("input", { type:"checkbox" }) );
    chkTwo.appendChild( CE("span", { textContent:"2 sjåfører" }) );

    const btnAdd = CE("button", { className:"btn btn-green", textContent:"➕ Legg til" });
    btnAdd.addEventListener("click", () => {
      const name = inpName.value.trim();
      if (!name) return alert("Skriv inn navn/adresse først.");
      addLocalAddress(name, selTask.value, chkTwo.querySelector("input").checked);
      inpName.value = "";
      inpName.focus();
    });

    addRow.append(inpName, selTask, chkTwo, btnAdd);
    addCard.append(addTitle, addRow);

    // Liste av lokal katalog
    const listWrap = CE("div", { style:"margin-top:14px;" });
    const cat = loadLocalCatalog();

    if (cat.addresses.length === 0) {
      listWrap.appendChild( CE("div", { className:"muted", textContent:"Ingen adresser enda. Hent katalog i Admin-fanen eller legg til her." }) );
    } else {
      cat.addresses.forEach((a, i) => {
        const row = CE("div", { className:"card", style:"padding:10px;margin:8px 0;" });

        const head = CE("div", { style:"display:flex;justify-content:space-between;gap:8px;align-items:center;" });
        head.appendChild( CE("div", { innerHTML:`<strong>${esc(a.name)}</strong><div class="muted" style="margin-top:2px">${esc(a.task||"")}${a.twoDriverRec?" • 2 sjåfører":""}</div>` }) );

        const right = CE("div", { style:"display:flex;gap:6px;align-items:center;" });
        const toggle = CE("button", { className:"btn", textContent: a.active!==false ? "Deaktiver" : "Aktiver" });
        const del    = CE("button", { className:"btn btn-red", textContent:"Slett" });

        toggle.addEventListener("click", () => toggleActive(i));
        del.addEventListener("click", () => deleteAddress(i));

        right.append(toggle, del);
        head.appendChild(right);
        row.appendChild(head);
        listWrap.appendChild(row);
      });
    }

    topBar.append(btnFetch, btnReset);
    root.append(title, info, topBar, count, addCard, listWrap);
  }

  // ----- Kjør ved DOM ready -----
  document.addEventListener("DOMContentLoaded", render);

  // I tilfelle brukeren navigerer uten reload (SPA-aktig), re-render enkelt
  document.addEventListener("click", (e) => {
    // hvis de klikker på en nav-knapp til Adresse-register
    const t = e.target;
    if (t && t.tagName === "BUTTON" && /Adresse/.test(t.textContent || "")) {
      setTimeout(render, 50);
    }
  });

  log("del-H.js (katalog) lastet");
})();