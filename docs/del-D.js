/* ===== del-D.js (work + home glue) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del D."); return; }
  const { $, qs, qsa, state, save, cfg, status } = Core;

  /* ---------- HOME: bind felter ---------- */
  function initHome() {
    $("#verHome").textContent = Core.cfg.VERSION;

    const S = Core.state;
    $("#homeName").value = S.customName || "";
    $("#homeDirection").value = S.direction || "forward";
    $("#homeHanske").checked = !!S.hanske;
    $("#equipPlog").checked = !!S.equipment.plog;
    $("#equipFres").checked = !!S.equipment.fres;
    $("#equipStro").checked = !!S.equipment.stro;

    $("#saveHome").onclick = saveHomeOnly;
    $("#saveAndStart").onclick = () => { saveHomeOnly(); startNewRound(); };

    // start polling status og vis liste
    status.startHeartbeat();
    status.startPolling(renderTeamStatus);
  }

  function saveHomeOnly() {
    const S = Core.state;
    S.useCustomName = true;
    S.customName = ($("#homeName").value || "").trim();
    S.direction = $("#homeDirection").value;
    S.hanske = $("#homeHanske").checked;
    S.equipment = {
      plog: $("#equipPlog").checked,
      fres: $("#equipFres").checked,
      stro: $("#equipStro").checked
    };
    Core.touchActivity();
    save();
    alert("✅ Lagret!");
  }

  function startNewRound() {
    // nullstill rundedata
    const S = Core.state;
    S.dayLog = S.dayLog || { dateKey: Core.dateKey(new Date()), entries: [] };
    S.stops.forEach(st => { st.f = false; st.b = false; st.startedAt = null; st.finishedAt = null; });
    save();
    // gå til Under arbeid
    show("work");
    renderWork();
  }

  /* ---------- WORK: liste og knapper ---------- */
  function renderWork() {
    const wrap = $("#workList");
    if (!wrap) return;
    const S = Core.state;
    let idx = 0;

    const done = S.stops.filter(s => s.f).length;
    const tot = S.stops.length || 0;
    const pct = tot ? Math.round((done / tot) * 100) : 0;

    let html = `
      <div class="row muted small" style="margin-bottom:8px">
        <div>Rolle: ${Core.displayName()}</div>
        <div>Retning: ${S.direction === "reverse" ? "Motsatt" : "Vanlig"}</div>
      </div>
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
    `;

    S.stops.forEach((st, i) => {
      const statusTxt = st.f ? "Ferdig" : (st.startedAt ? "Startet" : "Ny");
      const started = Core.fmtTime(st.startedAt);
      const finished = Core.fmtTime(st.finishedAt);

      html += `
      <div class="card">
        <div class="title-lg">${Core.esc(st.n)}</div>
        <div class="muted small">${Core.esc(Core.normalizeTask(st.t))}</div>
        <div class="small" style="margin:6px 0">Status: ${statusTxt}
          ${st.startedAt ? ` • Startet kl ${started}` : ""}
          ${st.finishedAt ? ` • Ferdig kl ${finished}` : ""}
        </div>
        <div class="row">
          <button class="btn" data-act="start" data-i="${i}">Start</button>
          <button class="btn btn-green" data-act="done" data-i="${i}">Ferdig</button>
          <button class="btn btn-red" data-act="impossible" data-i="${i}">Ikke mulig</button>
          <span class="spacer"></span>
          <button class="btn" data-act="pins" data-i="${i}">Brøytestikker</button>
          <button class="btn btn-purple" data-act="nav" data-i="${i}">Naviger</button>
          <button class="btn" data-act="next" data-i="${i}">Neste</button>
        </div>
      </div>`;
      idx++;
    });

    wrap.innerHTML = html;

    // events
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const i = +btn.dataset.i;
      const act = btn.dataset.act;
      const st = Core.state.stops[i];
      if (!st) return;

      if (act === "start") {
        if (!st.startedAt) st.startedAt = Date.now();
      } else if (act === "done") {
        if (!st.startedAt) st.startedAt = Date.now();
        st.f = true; st.finishedAt = Date.now();
      } else if (act === "impossible") {
        st.b = true; st.finishedAt = Date.now();
      } else if (act === "next") {
        // no-op: kunne scrolle til neste, men vi bare rerendrer
      } else if (act === "nav") {
        const q = encodeURIComponent(st.n + " , Norge");
        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
      } else if (act === "pins") {
        alert("Her kan vi koble inn pinne-teller senere 👍");
      }
      save();
      Core.touchActivity();
      // publiser posisjon/progress
      Core.status.updateSelf({ progress: getProgress() , current: st.n });
      renderWork();
    });

    // rename «Pågår» -> «Start» fallback (hvis noe gammel markup finnes)
    qsa("button").forEach(b => { if (b.textContent.trim() === "Pågår") b.textContent = "Start"; });
  }

  function getProgress() {
    const S = Core.state;
    const d = S.stops.filter(s => s.f).length;
    const t = S.stops.length || 0;
    return t ? Math.round((d/t)*100) : 0;
  }

  /* ---------- TEAM STATUS UI ---------- */
  function renderTeamStatus(list) {
    const wrap = $("#teamStatusList");
    if (!wrap) return;
    if (!list || !list.length) {
      wrap.textContent = "Ingen data enda…";
      return;
    }
    wrap.innerHTML = list.map(row => {
      const me = (row.name || "") === (Core.state.customName || "");
      const tag = me ? " (deg)" : "";
      const when = Core.fmtTime(row.ts);
      const cur = row.current || "—";
      const pr = (row.progress ?? 0) + "%";
      return `<div class="row"><div>${Core.esc(row.name || "Ukjent")}${tag}</div><div class="muted small">${when}</div></div>
              <div class="small">Adresse: ${Core.esc(cur)} • Fremdrift: ${pr}</div>
              <hr/>`;
    }).join("");
  }

  /* ---------- NAV-helpers ---------- */
  window.show = function(id) {
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
    Core.qs(`#${id}`)?.classList.add("active");
    if (id === "work") renderWork();
    if (id === "home") initHome();
  };

  // auto-init på DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    initHome(); // første gang på hjem
  });
})();