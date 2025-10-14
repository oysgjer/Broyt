/* ===== del-D.js (Under arbeid / Rutevisning) ===== */
(() => {
  if (!window.Core) return console.error("Del C må lastes før Del D.");
  const D = {};
  Core.D = D;

  /* ---------- Hjelp ---------- */
  const toStopsFromAddresses = (addresses = []) => {
    const T = Core.cfg.DEFAULT_TASKS;
    return addresses
      .filter(a => a && a.name && a.active !== false)
      .map(a => ({
        n: a.name || "",
        t: Core.normalizeTask(a.task || T[0]),
        f: false, b: false, p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: Number.isFinite(a.pinsCount) ? a.pinsCount : 0,
        pinsLockedYear:
          (Number.isFinite(a.pinsCount) && a.pinsCount > 0)
            ? Core.seasonKey()
            : null
      }));
  };

  const toStopsFromMaster = (stops = []) =>
    (stops || []).map(s => ({
      n: s.n || "",
      t: Core.normalizeTask(s.t || Core.cfg.DEFAULT_TASKS[0]),
      f: false, b: false, p: [],
      twoDriverRec: !!s.twoDriverRec,
      pinsCount: Number.isFinite(s.pinsCount) ? s.pinsCount : 0,
      pinsLockedYear: s.pinsLockedYear || null
    }));

  async function fetchMasterStops() {
    try {
      const { MASTER } = Core.cfg.BINS;
      const res = await fetch(`https://api.jsonbin.io/v3/b/${MASTER}/latest`, {
        headers: Core.headers()
      });
      if (!res.ok) throw 0;
      const js = await res.json();
      const stops = Array.isArray(js?.record?.stops) ? js.record.stops : [];
      console.log("MASTER hentet:", stops.length);
      return stops;
    } catch (_) {
      console.warn("Klarte ikke å hente MASTER.");
      return [];
    }
  }

  async function ensureStopsLoaded() {
    const S = Core.state;

    // allerede lastet?
    if (Array.isArray(S.stops) && S.stops.length > 0) {
      console.log("Stops allerede i state:", S.stops.length);
      return true;
    }

    // 1) prøv KATALOG (Core.fetchCatalog returnerer record)
    const rec = await Core.fetchCatalog?.();
    let list = [];
    if (rec) {
      list =
        Array.isArray(rec.addresses) ? rec.addresses :
        Array.isArray(rec.catalog?.addresses) ? rec.catalog.addresses :
        Array.isArray(rec.catalog) ? rec.catalog : [];
    }
    console.log("KATALOG adresser funnet:", list.length);

    if (list.length > 0) {
      S.stops = toStopsFromAddresses(list);
      Core.save();
      console.log("Importerte fra KATALOG:", S.stops.length);
      return true;
    }

    // 2) fallback: prøv MASTER
    const mStops = await fetchMasterStops();
    if (mStops.length > 0) {
      S.stops = toStopsFromMaster(mStops);
      Core.save();
      console.log("Importerte fra MASTER:", S.stops.length);
      return true;
    }

    // 3) siste fallback: demo-data
    console.warn("Fant ingen adresser i verken KATALOG eller MASTER – bruker demo.");
    S.stops = [
      { n: "AMFI Eidsvoll (Råholt)", t: Core.normalizeTask(Core.cfg.DEFAULT_TASKS[0]), f: false, b: false, p: [], twoDriverRec: false, pinsCount: 0, pinsLockedYear: null },
      { n: "Råholt barneskole",      t: Core.normalizeTask(Core.cfg.DEFAULT_TASKS[1]), f: false, b: false, p: [], twoDriverRec: true,  pinsCount: 0, pinsLockedYear: null },
      { n: "Råholt ungdomsskole",    t: Core.normalizeTask(Core.cfg.DEFAULT_TASKS[0]), f: false, b: false, p: [], twoDriverRec: false, pinsCount: 0, pinsLockedYear: null }
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
          <p style="opacity:.8;margin:0;">Gå til <b>Admin</b> og last katalog, eller trykk <i>Start ny runde</i> på Hjem.</p>
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

    await ensureStopsLoaded();
    S.roundNumber = (S.roundNumber || 0) + 1;
    (S.stops || []).forEach(s => { s.f = false; s.b = false; s.doneAt = null; });
    S.dayLog = { dateKey: Core.dateKey(), entries: [] };

    Core.save();
    D.renderList();

    try { if (typeof window.show === "function") window.show("work"); } catch (_) {}
    alert(`Ny runde #${S.roundNumber} startet`);
  };

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    const btn = Core.$("startBtn");
    if (btn) btn.onclick = D.startNewRound;

    await ensureStopsLoaded();
    Core.log("del-D.js lastet");
    D.renderList();
  });
})();