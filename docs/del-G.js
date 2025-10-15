/* ===== del-G.js (admin) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del G."); return; }
  const { $, qs, qsa, save, state, cfg } = Core;

  function initAdmin() {
    const box = $("#adminCatalog");
    if (!box) return;

    box.innerHTML = `
      <div class="row" style="gap:8px;margin-bottom:10px">
        <button id="btnLoadCat" class="btn">Last katalog</button>
        <button id="btnExport" class="btn">Eksporter CSV</button>
      </div>
      <div class="small muted" id="adminHint">Sist synk: —</div>
      <div id="adminList" style="margin-top:10px"></div>
    `;

    $("#btnLoadCat").onclick = loadCatalog;
    $("#btnExport").onclick = exportCsv;

    renderList();
  }

  async function loadCatalog() {
    $("#adminHint").textContent = "Laster inn katalog fra JSONBin…";
    const js = await Core.fetchCatalog();
    const arr = js.addresses || [];
    if (arr.length) {
      // importer til local state hvis ønskelig – her bare lagrer som stops hvis tomt
      if (!Array.isArray(Core.state.stops) || Core.state.stops.length === 0) {
        Core.state.stops = arr.map(a => ({
          n: a.n, t: a.t || Core.cfg.DEFAULT_TASKS[0],
          f:false, b:false, p:[], twoDriverRec:!!a.twoDriverRec,
          pinsCount: a.pinsCount || 0,
          pinsLockedYear: a.pinsLockedYear ?? null
        }));
        save();
      }
      $("#adminHint").textContent = `Katalog hentet ✔ (${arr.length})`;
    } else {
      $("#adminHint").textContent = "Ingen adresser funnet i katalog";
    }
    renderList();
  }

  function exportCsv() {
    const rows = [["Adresse","Oppgave","Pinner","Låst år"]];
    (Core.state.stops||[]).forEach(s=>{
      rows.push([s.n, s.t, s.pinsCount||0, s.pinsLockedYear ?? ""]);
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "katalog.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function renderList() {
    const box = $("#adminList");
    if (!box) return;
    const S = Core.state;
    const yNow = new Date().getFullYear();

    box.innerHTML = (S.stops||[]).map((st, i) => {
      const locked = st.pinsLockedYear === yNow;
      const dis = locked ? "disabled" : "";
      return `
        <div class="card">
          <div class="title-lg">${Core.esc(st.n)}</div>
          <div class="muted small">${Core.esc(st.t)}</div>

          <div class="row" style="margin-top:8px">
            <label>Brøytepinner (i år):</label>
            <input type="number" min="0" id="pin_${i}" value="${st.pinsCount||0}" ${dis} style="width:90px" />
            <label class="small">
              <input type="checkbox" id="lock_${i}" ${locked ? "checked" : ""}/>
              Lås for ${yNow}
            </label>
            <span class="spacer"></span>
            <button class="btn" data-act="save" data-i="${i}">Lagre</button>
            <button class="btn btn-red" data-act="override" data-i="${i}">Overstyr pinner</button>
          </div>
        </div>`;
    }).join("");

    box.onclick = (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const i = +b.dataset.i;
      const st = Core.state.stops[i];
      if (!st) return;

      if (b.dataset.act === "save") {
        const y = new Date().getFullYear();
        const v = +($("#pin_"+i).value || 0);
        const lock = $("#lock_"+i).checked;
        st.pinsCount = Math.max(0, v|0);
        st.pinsLockedYear = lock ? y : null;
        Core.touchActivity(); save(); renderList();
      } else if (b.dataset.act === "override") {
        // ADMIN-OVERRIDE: lås opp og gjør feltet redigerbart
        st.pinsLockedYear = null;
        Core.touchActivity(); save(); renderList();
        alert("🔓 Pinner låst opp for denne adressen.");
      }
    };
  }

  document.addEventListener("DOMContentLoaded", initAdmin);
})();