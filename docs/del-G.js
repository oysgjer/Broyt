/* ===== del-G.js (ADMIN) ===== */
(() => {
  if (!window.Core) {
    console.error("del-G.js: Core mangler (del-C.js må lastes først)");
    return;
  }
  const Core = window.Core;

  /* ---------- Små helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = Core.esc;

  /* ---------- Admin DOM-stub ---------- */
  function ensureAdminScaffold() {
    const host = $("#admin");
    if (!host) return null;

    // Bygg en komplett admin-layout inni #admin (uavhengig av tidligere innhold)
    host.innerHTML = `
      <div class="card stack" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:14px">
        <div class="row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <button id="admRefreshMaster" class="btn btn-gray">🔄 Hent status (MASTER)</button>
          <button id="admSaveCatalog" class="btn btn-green">💾 Lagre katalog</button>
          <button id="admPublishMaster" class="btn btn-blue">🚀 Publiser til MASTER</button>
          <button id="admBackup" class="btn btn-gray">🧰 Backup nå</button>
          <button id="admShowLive" class="btn btn-gray">🛰 Vis live sjåførstatus</button>
          <span id="admMsg" class="small muted" style="margin-left:auto">—</span>
        </div>
      </div>

      <div class="card stack" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:14px;margin-top:10px">
        <h3 style="margin:0 0 8px 0">Adresser (Admin)</h3>
        <div class="small muted" style="margin-bottom:8px">
          Rediger navn/oppgave, anbefaling 2 sjåfører, og brøytestikker. Admin kan overstyre og låse pinner for inneværende sesong.
        </div>
        <div id="admList" class="adm-table" style="display:flex;flex-direction:column;gap:8px"></div>
      </div>

      <div class="card stack" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:14px;margin-top:10px">
        <h3 style="margin:0 0 8px 0">Live sjåførstatus</h3>
        <div id="admLive" class="small muted">Ikke aktiv. Klikk «Vis live sjåførstatus».</div>
      </div>
    `;

    // Litt enkel stil for "rader"
    const styleId = "admin-extra-css";
    if (!document.getElementById(styleId)) {
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = `
        .adm-row{
          display:flex; flex-wrap:wrap; gap:8px; align-items:center;
          border:1px solid var(--cardBorder,#2a2f36); padding:8px; border-radius:12px;
          background:#14161a;
        }
        .adm-row input[type="text"], .adm-row select, .adm-row input[type="number"]{
          background:transparent; color:inherit; border:1px solid #2a2f36; border-radius:8px; padding:6px;
        }
        .adm-row .name{ flex:2; min-width:240px; }
        .adm-row .task{ flex:1; min-width:200px; }
        .adm-row .badges{ display:flex; gap:6px; align-items:center; }
        .adm-row .btn{ border:none; border-radius:10px; padding:8px 12px; font-weight:700; }
        .btn-blue{ background:#0b66ff; color:#fff; }
        .btn-red{ background:#c21d03; color:#fff; }
        .btn-gray{ background:#2f3337; color:#111; }
        .btn-green{ background:#0f9d58; color:#fff; }
        .badge{ display:inline-block; border:1px solid #2a2f36; border-radius:999px; padding:2px 8px; font-size:12px; color:#b9c2cc; }
        .muted{ color:#b9c2cc; }
        .small{ font-size:12px; }
      `;
      document.head.appendChild(st);
    }
    return host;
  }

  /* ---------- Render adresser-liste ---------- */
  function renderAdminList() {
    const host = $("#admList");
    if (!host) return;

    const stops = Core.state?.stops || [];
    if (!stops.length) {
      host.innerHTML = `<div class="small muted">– Ingen adresser. Hent fra katalog eller legg til i Adresse-registeret (fanen «Adresse-register»).</div>`;
      return;
    }

    host.innerHTML = stops.map((s, idx) => {
      const t1 = Core.cfg.DEFAULT_TASKS?.[0] || "Snø + brøytestikker";
      const t2 = Core.cfg.DEFAULT_TASKS?.[1] || "Snø og grus + brøytestikker";
      const locked = s.pinsLockedYear && String(s.pinsLockedYear) === Core.seasonKey();
      const pins = Number.isFinite(s.pinsCount) ? s.pinsCount : 0;
      const done = s.f ? "✅" : (s.b ? "⛔" : "");

      return `
        <div class="adm-row" data-i="${idx}">
          <input class="name" type="text" data-k="n" value="${esc(s.n || "")}" placeholder="Navn / adresse">
          <select class="task" data-k="t">
            <option ${s.t===t1?"selected":""}>${esc(t1)}</option>
            <option ${s.t===t2?"selected":""}>${esc(t2)}</option>
            <option ${(![t1,t2].includes(s.t))?"selected":""}>${esc(s.t || t1)}</option>
          </select>

          <label class="small"><input type="checkbox" data-k="twoDriverRec" ${s.twoDriverRec?"checked":""}> 2 sjåfører</label>

          <div class="badges">
            <span class="badge">Status: ${done || "—"}</span>
            ${locked ? `<span class="badge">📍 Låst ${esc(Core.seasonKey())} (${pins})</span>`
                     : `<span class="badge">📍 ${pins}</span>`}
          </div>

          <div style="display:flex; gap:6px; align-items:center; margin-left:auto">
            <input type="number" min="0" style="width:80px" data-k="pinsCount" value="${pins}" title="Antall brøytestikker">
            ${locked
              ? `<button class="btn btn-red" data-act="unlock">Lås opp</button>`
              : `<button class="btn btn-blue" data-act="lock">Lås</button>`
            }
          </div>
        </div>
      `;
    }).join("");

    // Wire inputs
    $$("#admList .adm-row input[data-k], #admList .adm-row select[data-k]").forEach(el => {
      el.addEventListener("change", onFieldChange);
      el.addEventListener("input",  onFieldChange);
    });

    // Wire lock/unlock
    $$("#admList .adm-row button[data-act]").forEach(btn => {
      btn.addEventListener("click", onLockAction);
    });
  }

  function onFieldChange(e) {
    const row = e.target.closest(".adm-row");
    if (!row) return;
    const i = +row.dataset.i;
    const k = e.target.dataset.k;
    const s = Core.state.stops[i];
    if (!s) return;

    if (k === "twoDriverRec") {
      s.twoDriverRec = e.target.checked;
    } else if (k === "pinsCount") {
      const n = parseInt(e.target.value || "0", 10) || 0;
      s.pinsCount = n;
    } else if (k === "n") {
      s.n = e.target.value || "";
    } else if (k === "t") {
      s.t = e.target.value || Core.normalizeTask(Core.cfg.DEFAULT_TASKS[0]);
    }
    Core.save();
    // Ikke re-render hele lista for hvert tastetrykk – bare når det trengs.
  }

  function onLockAction(e) {
    const row = e.target.closest(".adm-row");
    if (!row) return;
    const i = +row.dataset.i;
    const s = Core.state.stops[i];
    if (!s) return;

    const season = Core.seasonKey();

    if (e.target.dataset.act === "lock") {
      // Sett pinsLockedYear til inneværende sesong og sørg for at pinsCount er tall
      s.pinsCount = Number.isFinite(s.pinsCount) ? s.pinsCount : 0;
      s.pinsLockedYear = season;
    } else {
      // Lås opp (fjerner sesong-lås)
      s.pinsLockedYear = null;
    }
    Core.save();
    renderAdminList();
  }

  /* ---------- Knapper: Hent/lagre/publiser/backup ---------- */
  async function refreshMaster() {
    const msg = $("#admMsg");
    try {
      msg && (msg.textContent = "Henter fra MASTER …");
      const res = await fetch(`https://api.jsonbin.io/v3/b/${Core.cfg.BINS.MASTER}/latest`, {
        headers: Core.headers()
      });
      const js = await res.json();
      const stops = js?.record?.stops || [];
      if (stops.length) {
        Core.state.stops = stops.map(s => ({
          n: s.n || "",
          t: s.t || Core.cfg.DEFAULT_TASKS[0],
          f: !!s.f, b: !!s.b,
          p: Array.isArray(s.p) ? s.p : [],
          started: s.started || null,
          finished: s.finished || null,
          details: s.details || "",
          twoDriverRec: !!s.twoDriverRec,
          pinsCount: Number.isFinite(s.pinsCount) ? s.pinsCount : 0,
          pinsLockedYear: s.pinsLockedYear || null
        }));
        Core.state.lastSyncAt = Date.now();
        Core.state.lastSyncBy = Core.displayName();
        Core.save();
        renderAdminList();
        msg && (msg.textContent = `Hentet ${stops.length} adresser fra MASTER ✔︎`);
      } else {
        msg && (msg.textContent = "Tomt svar fra MASTER.");
      }
    } catch (err) {
      msg && (msg.textContent = "Feil ved henting fra MASTER (sjekk nøkkel).");
    }
  }

  async function saveCatalog() {
    const msg = $("#admMsg");
    try {
      msg && (msg.textContent = "Lagrer katalog …");
      const rec = {
        version: Core.cfg.VERSION,
        updated: Date.now(),
        by: Core.displayName(),
        addresses: (Core.state.stops || []).map(s => ({
          name: s.n || "",
          task: s.t || Core.cfg.DEFAULT_TASKS[0],
          active: true,
          twoDriverRec: !!s.twoDriverRec,
          pinsCount: Number.isFinite(s.pinsCount) ? s.pinsCount : 0
        }))
      };
      await fetch(`https://api.jsonbin.io/v3/b/${Core.cfg.BINS.CATALOG}`, {
        method: "PUT",
        headers: Core.headers(),
        body: JSON.stringify(rec)
      });
      msg && (msg.textContent = "Katalog lagret ✔︎");
    } catch (err) {
      msg && (msg.textContent = "Feil ved lagring av katalog (sjekk nøkkel).");
    }
  }

  async function publishToMaster() {
    const msg = $("#admMsg");
    try {
      msg && (msg.textContent = "Publiserer til MASTER …");
      const nowSeason = Core.seasonKey();
      const payload = {
        version: Core.cfg.VERSION,
        updated: Date.now(),
        lastSyncAt: Date.now(),
        lastSyncBy: Core.displayName(),
        stops: (Core.state.stops || []).map(s => ({
          n: s.n || "",
          t: Core.normalizeTask(s.t || Core.cfg.DEFAULT_TASKS[0]),
          f: !!s.f, b: !!s.b, p: Array.isArray(s.p) ? s.p : [],
          started: s.started || null, finished: s.finished || null,
          details: s.details || "",
          twoDriverRec: !!s.twoDriverRec,
          pinsCount: Number.isFinite(s.pinsCount) ? s.pinsCount : 0,
          pinsLockedYear: s.pinsLockedYear ? String(s.pinsLockedYear) : null
        })),
        meta: { from: "admin" }
      };
      await fetch(`https://api.jsonbin.io/v3/b/${Core.cfg.BINS.MASTER}`, {
        method: "PUT",
        headers: Core.headers(),
        body: JSON.stringify(payload)
      });
      msg && (msg.textContent = "Publisert til MASTER ✔︎");
    } catch (err) {
      msg && (msg.textContent = "Feil ved publisering til MASTER (sjekk nøkkel).");
    }
  }

  async function doBackup() {
    const msg = $("#admMsg");
    try {
      msg && (msg.textContent = "Tar backup …");
      const backup = {
        version: Core.cfg.VERSION,
        updated: Date.now(),
        by: Core.displayName(),
        snapshot: { stops: Core.state.stops || [] }
      };
      await fetch(`https://api.jsonbin.io/v3/b/${Core.cfg.BINS.BACKUP}`, {
        method: "PUT",
        headers: Core.headers(),
        body: JSON.stringify(backup)
      });
      msg && (msg.textContent = "Backup lagret ✔︎");
    } catch (err) {
      msg && (msg.textContent = "Feil ved backup (sjekk nøkkel).");
    }
  }

  /* ---------- Live sjåførstatus ---------- */
  let liveOn = false;
  function startLiveStatus() {
    if (liveOn) return; // ikke start to ganger
    liveOn = true;
    const box = $("#admLive");
    if (box) box.textContent = "Henter live-data …";
    Core.status.startPolling((list) => {
      // list: [{name, ts, progress, current, direction, equipment}, ...]
      if (!list || !list.length) {
        if (box) box.textContent = "Ingen live-data enda.";
        return;
      }
      const rows = list.map(x => {
        const when = x.ts ? new Date(x.ts).toLocaleTimeString("no-NO", {hour:"2-digit",minute:"2-digit"}) : "—";
        const eq = x.equipment ? Object.entries(x.equipment)
            .filter(([k,v]) => !!v)
            .map(([k]) => k).join(", ") : "";
        return `
          <div class="adm-row">
            <div style="min-width:160px"><b>${esc(x.name || "Ukjent")}</b></div>
            <div class="small muted">Sist: ${when}</div>
            <div class="badge">Prog: ${x.progress ?? 0}%</div>
            <div class="badge">Retning: ${x.direction || "?"}</div>
            ${eq ? `<div class="badge">Utstyr: ${esc(eq)}</div>` : ""}
            ${x.current ? `<div class="small muted">Nå: ${esc(x.current)}</div>` : ""}
          </div>
        `;
      }).join("");
      if (box) box.innerHTML = rows;
    });
  }

  /* ---------- Wire knapper ---------- */
  function wireAdminButtons() {
    $("#admRefreshMaster") && ($("#admRefreshMaster").onclick = refreshMaster);
    $("#admSaveCatalog")   && ($("#admSaveCatalog").onclick   = saveCatalog);
    $("#admPublishMaster") && ($("#admPublishMaster").onclick = publishToMaster);
    $("#admBackup")        && ($("#admBackup").onclick        = doBackup);
    $("#admShowLive")      && ($("#admShowLive").onclick      = startLiveStatus);
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    if (!ensureAdminScaffold()) return;
    renderAdminList();
    wireAdminButtons();
    // Lite hint i konsoll
    console.log("del-G.js (Admin) lastet");
  });

})();