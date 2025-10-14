/* ===== del-D.js (Under arbeid / Rutevisning) ===== */
(() => {
  if (!window.Core) return console.error("Del C må lastes før Del D.");
  const D = {};
  Core.D = D;

  /* ---------- Hjelpefunksjoner ---------- */
  D.renderList = () => {
    const wrap = Core.$("workList");
    if (!wrap) return;

    const S = Core.state;
    const stops = S.stops || [];
    if (stops.length === 0) {
      wrap.innerHTML = `<p style="opacity:.8">Ingen adresser i aktiv runde. Last katalogen i Admin først.</p>`;
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
          <div style="font-size:13px;opacity:.8;margin-bottom:6px;">${task}</div>

          <div class="btnRow">
            <button class="btn btn-gray small" data-action="task" data-type="Brøyte" ${disabled}>Brøyte</button>
            <button class="btn btn-gray small" data-action="task" data-type="Frese" ${disabled}>Frese</button>
            <button class="btn btn-gray small" data-action="task" data-type="Strø" ${disabled}>Strø</button>
            <button class="btn btn-green small" data-action="done" data-idx="${i}" ${disabled}>${statusText}</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    wrap.innerHTML = html;

    wrap.querySelectorAll("[data-action='done']").forEach(btn => {
      btn.onclick = (e) => {
        const idx = +e.target.dataset.idx;
        D.toggleDone(idx);
      };
    });

    wrap.querySelectorAll("[data-action='task']").forEach(btn => {
      btn.onclick = (e) => {
        const idx = e.target.closest(".card").dataset.idx;
        const type = e.target.dataset.type;
        D.logTask(+idx, type);
      };
    });
  };

  /* ---------- Loggfør handling ---------- */
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

  /* ---------- Marker som ferdig ---------- */
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

  /* ---------- Start ny runde ---------- */
  D.startNewRound = () => {
    const S = Core.state;
    if (!confirm("Start ny runde?\nAlle statusfelt nullstilles.")) return;

    S.roundNumber = (S.roundNumber || 0) + 1;
    S.stops.forEach(s => { s.f = false; s.doneAt = null; });
    S.dayLog = { dateKey: Core.dateKey(), entries: [] };

    Core.save();
    D.renderList();
    alert(`Ny runde #${S.roundNumber} startet`);
  };

  /* ---------- Init ved lasting ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const btn = Core.$("startBtn");
    if (btn) btn.onclick = D.startNewRound;

    Core.log("del-D.js lastet");
    D.renderList();
  });
})();