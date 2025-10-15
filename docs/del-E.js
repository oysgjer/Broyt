/* ===== del-E.js (Hjem / Oppsett & status) – v9.12h ===== */
(() => {
  if (!window.Core) {
    console.error("Del C må lastes før del E.");
    return;
  }
  const Core = window.Core;

  // ---- små hjelpere ----
  const $   = (sel, root = document) => root.querySelector(sel);
  const el  = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  // ---- påfør tema til dokumentet ----
  function applyTheme(theme) {
    const t = theme || "auto";
    document.documentElement.setAttribute("data-theme", t);
  }

  // ---- nullstill runde (beholder katalog og oppsett) ----
  function resetRound(keepTimes = false) {
    const S = Core.state;
    if (!Array.isArray(S.stops)) S.stops = [];

    for (const r of S.stops) {
      // status-felt vi kjenner til i 9.12h
      r.f = false;       // ferdig
      r.b = false;       // ikke mulig/ blokkert
      r.g = false;       // grus/strø utført (hybrid-felt)
      r.s = false;       // snø/ brøyting utført (hybrid-felt)
      if (!keepTimes) {
        delete r.st;     // starttid
        delete r.et;     // sluttid
      }
    }
    S.ui.cursor = 0;
    Core.save();

    // “start ny runde” = sender null-progresjon til heartbeat
    if (Core.status && Core.status.updateSelf) {
      Core.status.updateSelf({ progress: 0, current: "" });
      Core.status.startHeartbeat?.();
    }
  }

  // ---- lag UI til Hjem-seksjonen ----
  function renderHome() {
    const host = document.getElementById("home");
    if (!host) return;

    // tøm seksjonen (men la tittel beholdes hvis du bruker overskrift i HTML)
    host.innerHTML = "";

    const wrap = el("div", "home-wrap");
    host.appendChild(wrap);

    // overskrift
    wrap.appendChild(el("h2", "", "Hjem"));

    // versjonstekst
    const ver = el("div", "muted", `Versjon v${Core.cfg.VERSION} – Romerike Trefelling`);
    ver.style.marginBottom = "10px";
    wrap.appendChild(ver);

    // --- innstillinger card ---
    const card = el("div", "card");
    wrap.appendChild(card);

    // Navn
    const rowName = el("div", "row");
    const lblName = el("label", "", "Navn");
    lblName.style.minWidth = "80px";
    const inpName = el("input");
    inpName.type = "text";
    inpName.placeholder = "Sjåførnavn";
    inpName.value = Core.state.customName || "";
    inpName.id = "homeName";
    inpName.addEventListener("input", () => {
      Core.state.customName = inpName.value.trim();
      Core.save();
      Core.status?.updateSelf?.({});
      updateSummary();
    });
    rowName.append(lblName, inpName);
    card.appendChild(rowName);

    // Retning
    const rowDir = el("div", "row");
    const lblDir = el("label", "", "Retning");
    lblDir.style.minWidth = "80px";
    const selDir = el("select");
    ["forward:Vanlig", "reverse:Motsatt"].forEach(opt => {
      const [val, txt] = opt.split(":");
      const o = el("option");
      o.value = val;
      o.textContent = txt;
      selDir.appendChild(o);
    });
    selDir.value = Core.state.direction || "forward";
    selDir.id = "homeDirection";
    selDir.addEventListener("change", () => {
      Core.state.direction = selDir.value;
      Core.save();
      Core.status?.updateSelf?.({});
      updateSummary();
    });
    rowDir.append(lblDir, selDir);
    card.appendChild(rowDir);

    // Utstyr
    const rowEq = el("div", "row");
    const lblEq = el("label", "", "Utstyr");
    lblEq.style.minWidth = "80px";

    const eqWrap = el("div", "equip");
    const mkChk = (key, t) => {
      const box = el("label", "chk");
      const i = el("input");
      i.type = "checkbox";
      i.checked = !!Core.state.equipment?.[key];
      i.addEventListener("change", () => {
        Core.state.equipment = Core.state.equipment || {};
        Core.state.equipment[key] = i.checked;
        Core.save();
        Core.status?.updateSelf?.({});
        updateSummary();
      });
      box.append(i, el("span", "", t));
      return box;
    };
    eqWrap.append(
      mkChk("plog", "Skjær"),
      mkChk("fres", "Fres"),
      mkChk("stro", "Strøkasse")
    );
    rowEq.append(lblEq, eqWrap);
    card.appendChild(rowEq);

    // Hanskemodus
    const rowGlove = el("div", "row");
    const lblGlove = el("label", "", "Hanske");
    lblGlove.style.minWidth = "80px";
    const chkGlove = el("input");
    chkGlove.type = "checkbox";
    chkGlove.checked = !!Core.state.hanske;
    chkGlove.addEventListener("change", () => {
      Core.state.hanske = chkGlove.checked;
      document.documentElement.toggleAttribute("data-glove", chkGlove.checked);
      Core.save();
      updateSummary();
    });
    rowGlove.append(lblGlove, chkGlove);
    card.appendChild(rowGlove);

    // Tema
    const rowTheme = el("div", "row");
    const lblTheme = el("label", "", "Tema");
    lblTheme.style.minWidth = "80px";
    const selTheme = el("select");
    [["auto","Auto"],["dark","Mørk"],["light","Lys"]].forEach(([v,t])=>{
      const o = el("option"); o.value=v; o.textContent=t; selTheme.appendChild(o);
    });
    selTheme.value = Core.state.theme || "auto";
    selTheme.addEventListener("change", ()=>{
      Core.state.theme = selTheme.value;
      Core.save();
      applyTheme(Core.state.theme);
    });
    rowTheme.append(lblTheme, selTheme);
    card.appendChild(rowTheme);

    // Knapper
    const rowBtn = el("div", "row");
    rowBtn.style.gap = "8px";

    const btnStart = el("button", "btn btn-green", "Start runde →");
    btnStart.addEventListener("click", () => {
      resetRound(false);
      Core.touchActivity();
      alert("Ny runde startet.\nAlle adresser er satt til ubehandlet.");
    });

    const btnReset = el("button", "btn btn-red", "Nullstill runde");
    btnReset.addEventListener("click", () => {
      if (!confirm("Nullstille runde lokalt?\n(Dette sletter ikke katalogen)")) return;
      resetRound(false);
      Core.touchActivity();
    });

    const btnSync = el("button", "btn btn-blue", "Synk/status nå");
    btnSync.addEventListener("click", async () => {
      btnSync.disabled = true;
      try {
        await Core.status?.updateSelf?.({});
        Core.status?.startHeartbeat?.();
      } finally {
        setTimeout(()=> btnSync.disabled=false, 600);
      }
    });

    rowBtn.append(btnStart, btnReset, btnSync);
    card.appendChild(rowBtn);

    // Oppsummering
    const summary = el("div", "muted");
    summary.style.marginTop = "10px";
    summary.id = "homeSummary";
    card.appendChild(summary);

    function updateSummary() {
      const s = Core.state;
      const nm = (s.customName || "—").trim() || "—";
      const dir = (s.direction === "reverse") ? "Motsatt" : "Vanlig";
      const ut = [
        s.equipment?.plog ? "Skjær" : null,
        s.equipment?.fres ? "Fres" : null,
        s.equipment?.stro ? "Strøkasse" : null
      ].filter(Boolean).join(", ") || "—";
      const hanske = s.hanske ? "På" : "Av";
      summary.textContent =
        `Valgt oppsett → Sjåfør: ${nm} · Utstyr: ${ut} · Retning: ${dir} · Hanskemodus: ${hanske}`;
    }
    updateSummary();
  }

  // ---- init ved DOMContentLoaded ----
  document.addEventListener("DOMContentLoaded", () => {
    // sørg for state
    Core.state = Core.load() || Core.makeDefaultState();

    // start heartbeat (hybrid)
    Core.status?.startHeartbeat?.();

    // påfør tema og hanskemodus-attributt
    applyTheme(Core.state.theme);
    if (Core.state.hanske) {
      document.documentElement.setAttribute("data-glove", "true");
    } else {
      document.documentElement.removeAttribute("data-glove");
    }

    // tegn UI
    renderHome();

    console.log("del-E.js (v9.12h – Hjem) lastet");
  });

  /* --- enkel stil for hjem-rader (brukes oppå din CSS) --- */
  const css = `
  #home .card{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:14px;margin-top:8px}
  #home .row{display:flex;align-items:center;gap:12px;margin:8px 0;flex-wrap:wrap}
  #home label{opacity:.9}
  #home input[type="text"]{flex:1;min-width:220px;background:#111;color:#fff;border:1px solid #444;border-radius:6px;padding:8px}
  #home select{background:#111;color:#fff;border:1px solid #444;border-radius:6px;padding:8px}
  #home .equip{display:flex;gap:14px;flex-wrap:wrap}
  #home .equip .chk{display:flex;align-items:center;gap:6px}
  #home .btn{border:0;border-radius:8px;padding:8px 12px;cursor:pointer}
  #home .btn-green{background:#198754;color:#fff}
  #home .btn-blue{background:#0d6efd;color:#fff}
  #home .btn-red{background:#dc3545;color:#fff}
  [data-glove="true"] #home .btn{padding:14px 18px;font-size:18px}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();