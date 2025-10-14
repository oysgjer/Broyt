/* ===== del-D.js (Under arbeid / Rutevisning) ===== */
(() => {
  if (!window.Core) return console.error("Del C må lastes før Del D.");
  const D = {};
  Core.D = D;

  /* ---------- Hjelp ---------- */
  const toStops = (addresses=[]) => {
    const T = Core.cfg.DEFAULT_TASKS;
    return addresses
      .filter(a => a && a.name && a.active !== false)
      .map(a => ({
        n: a.name || "",
        t: Core.normalizeTask(a.task || T[0]),
        f: false, b: false, p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: Number.isFinite(a.pinsCount) ? a.pinsCount : 0,
        pinsLockedYear: (Number.isFinite(a.pinsCount) && a.pinsCount > 0) ? Core.seasonKey() : null
      }));
  };

  async function ensureStopsLoaded() {
    const S = Core.state;
    if (Array.isArray(S.stops) && S.stops.length > 0) return true;

    // Prøv hente katalog
    const cat = await Core.fetchCatalog?.();
    if (cat && Array.isArray(cat.addresses) && cat.addresses.length) {
      S.stops = toStops(cat.addresses);
      Core.save();
      return S.stops.length > 0;
    }

    // Fallback: legg inn noen demo-adresser hvis katalog er tom/feil
    S.stops = [
      { n:"AMFI Eidsvoll (Råholt)", t:Core.normalizeTask(Core.cfg.DEFAULT_TASKS[0]), f:false, b:false, p:[], twoDriverRec:false, pinsCount:0, pinsLockedYear:null },
      { n:"Råholt barneskole",      t:Core.normalizeTask(Core.cfg.DEFAULT_TASKS[1]), f:false, b:false, p:[], twoDriverRec:true,  pinsCount:0, pinsLockedYear:null },
      { n:"Råholt ungdomsskole",    t:Core.normalizeTask(Core.cfg.DEFAULT_TASKS[0]), f:false, b:false, p:[], twoDriverRec:false, pinsCount:0, pinsLockedYear:null }
    ];
    Core.save();
    return true;
  }

  /* ---------- UI-render ---------- */
  D.renderList = () => {
    const wrap = Core.$("workList");
    if (!wrap) return;

    const S = Core.state;
    const stops = S.stops || [];
    if (stops.length === 0) {
      wrap.innerHTML = `
        <div class="card">
          <p style="opacity:.8;margin:0 0 .5rem;">Ingen adresser i aktiv runde.</p>
          <p style="opacity:.8;margin:0;">Gå til <b>Admin</b> og last katalog – eller trykk <i>Start ny runde</i> på Hjem.</p>
        </div>`;
      return;
    }

    let html = `<div class="stack">`;
    stops.forEach((s, i) => {
      const done = s.f ? "done" : "";
      const statusText = s.f ? "✔ Ferdig" : "Marker som ferdig";
      const disabled = s.f ? "disabled" : "";
      const task = Core.esc(s.t || "Ukjent oppgave");

      html += `
        <div class="card ${done}" data-idx="${i}">
          <div class="title-sm"><strong>${Core.esc(s.n)}</strong></div>
          <div style="font-size:13px;opacity:.8;margin-bottom:8px;">${task}</div>

          <div class="btnRow" style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-gray small" data-action="task" data-type="Brøyte" ${disabled}>Brøyte</button>
            <button class="btn btn-gray small" data-action="task" data-type="Frese" ${disabled}>Frese</button>
            <button class="btn btn-gray small" data-action="task" data-type="Strø" ${disabled}>Strø</button>
            <button class="btn btn-green small" data-action="done" data-idx="${i}" ${disabled}>${statusText}</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    wrap.innerHTML = html;

    // Handlers
    wrap.querySelectorAll("[data-action='done']").forEach(btn => {
      btn.onclick = (e) => {
        const idx = +e.target.dataset.idx;
        D.toggleDone(idx);
      };
    });

    wrap.querySelectorAll("[data-action='task']").forEach(btn => {
      btn.onclick = (e) => {
        const idx = +e.target.closest(".card").dataset.idx;
        const type = e.target.dataset.type;
        D.logTask(idx, type);
      };
    });
  };

  /* ---------- Logging ---------- */
  D.logTask = (idx, type) => {
    const S = Core.state;
    const stop = S.stops[idx];
    if (!stop) return;
    const now = Date.now();

    S.dayLog.entries.push({
      stop: stop.n,
      task: type,
      ts: now,
      round: S.roundNumber || 1
    });

    Core.save();
    Core.touchActivity();
    console.log(`Loggført ${type} ved ${stop.n}`);
  };

  /* ---------- Ferdig-toggle ---------- */
  D.toggleDone = (idx) => {
    const S = Core.state;
    const stop = S.stops[idx];
    if (!stop) return;
    stop.f = !stop.f;
    stop.doneAt = Date.now();

    S.dayLog.entries.push({
      stop: stop.n,
      task: stop.f ? "Ferdig" : "Tilbakeført",
      ts: Date.now(),
      round: S.roundNumber || 1
    });

    Core.save();
    D.renderList();
  };

  /* ---------- Ny runde ---------- */
  D.startNewRound = async () => {
    const S = Core.state;
    if (!confirm("Start ny runde?\nAlle statusfelt nullstilles.")) return;

    // Sikre at vi faktisk har stopp (prøv å hente katalog)
    await ensureStopsLoaded();

    S.roundNumber = (S.roundNumber || 0) + 1;
    (S.stops||[]).forEach(s => { s.f = false; s.b = false; s.started = null; s.finished = null; s.doneAt = null; });
    S.dayLog = { dateKey: Core.dateKey(), entries: [] };

    Core.save();
    D.renderList();

    // Naviger til "Under arbeid" hvis show(id) finnes
    try { if (typeof window.show === "function") window.show("work"); } catch(_) {}
    alert(`Ny runde #${S.roundNumber} startet`);
  };

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    // Koble “Start ny runde”-knappen
    const btn = Core.$("startBtn");
    if (btn) btn.onclick = D.startNewRound;

    // Last inn adresser om tomt (automatisk)
    await ensureStopsLoaded();

    Core.log("del-D.js lastet");
    D.renderList();
  });
})();