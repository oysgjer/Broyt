/* ===== del-D.js (arbeidsrute / førervisning) ===== */
(() => {
  if (!window.Core) return console.error("Del C må lastes før Del D.");

  const D = {};
  Core.D = D;

  /* ---------- Opprett visning ---------- */
  D.renderWorkList = () => {
    const wrap = Core.$("workList");
    if (!wrap) return;

    const S = Core.state;
    if (!S?.stops?.length) {
      wrap.innerHTML = `<p>Ingen adresser i listen.</p>`;
      return;
    }

    let html = `<div class="stack">`;
    S.stops.forEach((s, i) => {
      const doneCls = s.f ? "done" : "";
      const btnTxt = s.f ? "✔ Ferdig" : "Marker som ferdig";
      html += `
        <div class="card ${doneCls}" data-idx="${i}">
          <div><strong>${Core.esc(s.n)}</strong></div>
          <div style="font-size:13px;opacity:.8">${Core.esc(s.t)}</div>
          <div style="margin-top:6px">
            <button class="btn btn-green small" data-action="done" data-idx="${i}">${btnTxt}</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    wrap.innerHTML = html;

    // Koble knapper
    wrap.querySelectorAll("[data-action='done']").forEach(btn => {
      btn.onclick = (e) => {
        const idx = +e.target.dataset.idx;
        D.toggleDone(idx);
      };
    });
  };

  /* ---------- Marker som ferdig ---------- */
  D.toggleDone = (idx) => {
    const S = Core.state;
    if (!S?.stops[idx]) return;
    const stop = S.stops[idx];
    stop.f = !stop.f;
    stop.b = true;
    stop.doneAt = Date.now();
    Core.save();
    Core.touchActivity();
    D.renderWorkList();
  };

  /* ---------- Start ny runde ---------- */
  D.startNewRound = () => {
    const S = Core.state;
    if (!confirm("Start ny runde?\nAlle statusfelt nullstilles.")) return;

    S.roundNumber = (S.roundNumber || 0) + 1;
    S.stops.forEach(s => { s.f = false; s.b = false; s.doneAt = null; });
    Core.save();
    D.renderWorkList();

    alert(`Ny runde #${S.roundNumber} startet`);
  };

  /* ---------- Init ved lasting ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const btn = Core.$("startBtn");
    if (btn) btn.onclick = D.startNewRound;

    Core.log("del-D.js lastet");
    D.renderWorkList();
  });
})();