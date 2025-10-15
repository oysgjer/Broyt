/* ===== del-F.js (HJEM / INNSTILLINGER) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før del F."); return; }
  const { Core } = window;

  /* ---------- Små DOM helpers ---------- */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k === "for") el.setAttribute("for", v);
      else el[k] = v;
    }
    kids.flat().forEach(k => {
      if (k == null) return;
      el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    });
    return el;
  };

  /* ---------- Styles (kun litt polish) ---------- */
  function ensureStyles() {
    if (document.getElementById("home-settings-css")) return;
    const css = `
      #homeCard{background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:14px;margin:10px 0}
      #homeCard .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      #homeCard label{font-size:14px;color:#cfd3d8}
      #homeCard input[type="text"]{background:#0d0d0d;border:1px solid #2a2a2a;border-radius:10px;padding:8px 10px;color:#fff;min-width:220px}
      #homeCard select{background:#0d0d0d;border:1px solid #2a2a2a;border-radius:10px;padding:8px 10px;color:#fff;min-width:160px}
      #homeCard .checkbox{display:flex;gap:6px;align-items:center}
      #homeBtns{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
      .btn{cursor:pointer;border:none;border-radius:10px;padding:10px 14px;font-weight:700}
      .btn-green{background:#0f9d58;color:#fff}
      .btn-blue{background:#0b66ff;color:#fff}
      .btn-red{background:#c21d03;color:#fff}
      .muted{color:#a0a7b0;font-size:12px;margin-top:6px}
      .pill{display:inline-block;border:1px solid #2a2a2a;border-radius:999px;padding:6px 10px;margin-left:6px;font-size:12px}
    `;
    const el = document.createElement("style");
    el.id = "home-settings-css";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ---------- Render Hjem-siden ---------- */
  function renderHome() {
    const host = Core.qs("#home");
    if (!host) return;
    ensureStyles();

    // Bygg innhold hvis tomt eller vi skal oppdatere
    host.innerHTML = "";
    host.appendChild(h("h2", {}, "Hjem"));
    host.appendChild(h("div", { class: "muted" }, `Versjon ${Core.cfg.VERSION} – Romerike Trefelling`));

    const card = h("div", { id: "homeCard" });

    // Navn
    const rowName = h(
      "div",
      { class: "row", style: "margin-top:8px" },
      h("label", { for: "inpName" }, "Navn"),
      h("input", { id: "inpName", type: "text", placeholder: "Skriv navnet ditt" })
    );

    // Retning
    const rowDir = h(
      "div",
      { class: "row" },
      h("label", { for: "selDir" }, "Retning"),
      h(
        "select",
        { id: "selDir" },
        h("option", { value: "forward" }, "Vanlig"),
        h("option", { value: "reverse" }, "Motsatt")
      )
    );

    // Utstyr – merkenavn
    const rowEquip = h(
      "div",
      { class: "row" },
      h("label", {}, "Utstyr"),
      h(
        "label",
        { class: "checkbox" },
        h("input", { id: "eq_skjaer", type: "checkbox" }),
        "Skjær"
      ),
      h(
        "label",
        { class: "checkbox" },
        h("input", { id: "eq_fres", type: "checkbox" }),
        "Fres"
      ),
      h(
        "label",
        { class: "checkbox" },
        h("input", { id: "eq_strokasse", type: "checkbox" }),
        "Strøkasse"
      )
    );

    // Hanskemodus
    const rowHanske = h(
      "div",
      { class: "row" },
      h(
        "label",
        { class: "checkbox" },
        h("input", { id: "inpHanske", type: "checkbox" }),
        "Hanskemodus (større knapper)"
      )
    );

    // Knapper
    const btns = h(
      "div",
      { id: "homeBtns" },
      h("button", { id: "btnStartRound", class: "btn btn-green" }, "Start runde →"),
      h("button", { id: "btnReset", class: "btn btn-red" }, "Nullstill runde"),
      h("button", { id: "btnSync", class: "btn btn-blue" }, "Synk/status nå")
    );

    // Info-stripe
    const info = h("div", { id: "homeInfo", class: "muted" }, "—");

    // Sammendrag
    const summary = h(
      "div",
      { class: "muted" },
      "Valgt utstyr:",
      h("span", { id: "equipSummary", class: "pill" }, "—"),
      " Retning:",
      h("span", { id: "dirSummary", class: "pill" }, "—")
    );

    card.appendChild(rowName);
    card.appendChild(rowDir);
    card.appendChild(rowEquip);
    card.appendChild(rowHanske);
    card.appendChild(btns);
    card.appendChild(summary);
    card.appendChild(info);
    host.appendChild(card);

    // Fyll med state
    hydrateInputsFromState();
    // Wire events
    wireEvents();
    // Oppdater visuell oppsummering
    updateSummary();
  }

  /* ---------- Hjelpere for state <-> inputs ---------- */
  function hydrateInputsFromState() {
    const S = Core.state || Core.makeDefaultState();
    Core.$("inpName").value = S.customName || "";
    Core.$("selDir").value = S.direction || "forward";
    Core.$("eq_skjaer").checked    = !!S.equipment?.plog; // plog == Skjær
    Core.$("eq_fres").checked      = !!S.equipment?.fres;
    Core.$("eq_strokasse").checked = !!S.equipment?.stro; // strøkasse
    Core.$("inpHanske").checked    = !!S.hanske;
    document.body.classList.toggle("hanske", !!S.hanske);
  }

  function saveInputsToState() {
    const S = Core.state || Core.makeDefaultState();
    S.customName = (Core.$("inpName").value || "").trim();
    S.useCustomName = true; // vi bruker navnet direkte
    S.direction = Core.$("selDir").value || "forward";
    S.equipment = {
      plog: Core.$("eq_skjaer").checked,
      fres: Core.$("eq_fres").checked,
      stro: Core.$("eq_strokasse").checked
    };
    S.hanske = Core.$("inpHanske").checked;
    Core.state = S;
    Core.save();
  }

  function updateSummary() {
    const S = Core.state || Core.makeDefaultState();
    const equip = []
    if (S.equipment?.plog) equip.push("Skjær");
    if (S.equipment?.fres) equip.push("Fres");
    if (S.equipment?.stro) equip.push("Strøkasse");
    Core.$("equipSummary").textContent = equip.length ? equip.join(", ") : "—";
    Core.$("dirSummary").textContent = S.direction === "forward" ? "Vanlig" : "Motsatt";
  }

  /* ---------- Knapper & endringshandlere ---------- */
  function wireEvents() {
    // endringer
    ["inpName","selDir","eq_skjaer","eq_fres","eq_strokasse","inpHanske"].forEach(id=>{
      Core.$(id)?.addEventListener("change", () => {
        saveInputsToState();
        document.body.classList.toggle("hanske", !!Core.state.hanske);
        updateSummary();
      });
    });

    // Start runde → bytt til Under arbeid
    Core.$("btnStartRound")?.addEventListener("click", () => {
      saveInputsToState();
      // nullstill «cursor» til første ikke-fullførte i valgt retning
      const S = Core.state;
      if (!Array.isArray(S.stops)) S.stops = [];
      // plasser cursor på første «ikke f/b»
      const indices = S.stops
        .map((s,i)=>({i,s}))
        .filter(x=>!x.s.f && !x.s.b)
        .map(x=>x.i);
      const list = (S.direction === "reverse") ? indices.slice().reverse() : indices;
      S.ui = S.ui || {};
      S.ui.cursor = 0;
      // hvis helt tomt: hold 0
      Core.save();

      // små status-oppdateringer til felles status
      try { Core.status.updateSelf({ progress: calcProgressPct(S), current: currentName(S) }); } catch(_){}

      // vis «Under arbeid»
      const workBtn = Array.from(document.querySelectorAll("nav button"))
        .find(b => (b.textContent || "").toLowerCase().includes("under arbeid"));
      if (workBtn) workBtn.click();
      // Hvis Under arbeid-modulen har egen renderer, kall den:
      if (window.Work && typeof window.Work.render === "function") {
        window.Work.render();
      }
    });

    // Nullstill runde (fjerner f/b + tider)
    Core.$("btnReset")?.addEventListener("click", () => {
      if (!confirm("Nullstille status (utført/ikke mulig) for alle adresser?")) return;
      const S = Core.state;
      (S.stops || []).forEach(s => {
        s.f = false; s.b = false; s.started = null; s.finished = null;
      });
      S.ui = S.ui || {};
      S.ui.cursor = 0;
      Core.save();
      Core.$("homeInfo").textContent = "Runde nullstilt.";
      try { Core.status.updateSelf({ progress: calcProgressPct(S), current: currentName(S) }); } catch(_){}
      // oppfrisk ev. «Under arbeid»
      if (window.Work?.render) window.Work.render();
    });

    // Synk/status nå (kun status-oppdatering via del-C heartbeat)
    Core.$("btnSync")?.addEventListener("click", async () => {
      try {
        await Core.status.updateSelf({ progress: calcProgressPct(Core.state), current: currentName(Core.state) });
        Core.$("homeInfo").textContent = "Status oppdatert.";
      } catch {
        Core.$("homeInfo").textContent = "Kunne ikke oppdatere status nå.";
      }
    });
  }

  /* ---------- Små beregnere ---------- */
  function calcProgressPct(S) {
    const total = (S.stops || []).length;
    const cleared = (S.stops || []).filter(x => x.f || x.b).length;
    if (!total) return 0;
    return Math.round((100 * cleared) / total);
  }
  function currentName(S) {
    const idxs = (S.stops || []).map((s,i)=>({i,s})).filter(x => !x.s.f && !x.s.b).map(x=>x.i);
    const list = S.direction === "reverse" ? idxs.slice().reverse() : idxs;
    if (!list.length) return "";
    const cursor = Math.min(S.ui?.cursor || 0, list.length - 1);
    return S.stops[list[cursor]]?.n || "";
  }

  /* ---------- Mount ---------- */
  document.addEventListener("DOMContentLoaded", renderHome);

  // Fallback: hvis man klikker «Hjem» i nav etter første last
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t && t.matches("nav button") && (t.textContent || "").trim().toLowerCase() === "hjem") {
      setTimeout(renderHome, 0);
    }
  });
})();