<!-- del-E.js -->
<script>
/* ===== del-E.js (Under arbeid – status + 2 sjåfører) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del E."); return; }
  const Core = window.Core;
  const { $, esc } = Core;

  // ---- state for filter ----
  const UI_KEY = "workFilter";
  const getFilter = () => (Core.state?.ui?.[UI_KEY] || "alle");
  const setFilter = (v) => {
    Core.state.ui = Core.state.ui || {};
    Core.state.ui[UI_KEY] = v;
    Core.save();
    render();
  };

  // ---- små helpers ----
  const statusBadge = (s) => {
    if (s.f) return `<span class="badge" style="background:#16a34a;color:#fff;border:0;">Ferdig</span>`;
    if (s.b) return `<span class="badge" style="background:#b91c1c;color:#fff;border:0;">Blokkert</span>`;
    if (s.started) return `<span class="badge" style="background:#334155;color:#fff;border:0;">Pågår</span>`;
    return `<span class="badge" style="background:#374151;color:#cbd5e1;border:0;">Ikke startet</span>`;
  };
  const twoDriver = (s) =>
    s.twoDriverRec ? `<span class="badge" title="Anbefalt 2 sjåfører" style="background:#6d28d9;color:#fff;border:0;">👥 2 sjåfører</span>` : "";

  // ---- actions ----
  function markOngoing(idx){
    const s = Core.state.stops[idx]; if (!s) return;
    if (!s.started) s.started = Date.now();
    s.b = false; // tar bort blokkert hvis den var satt
    Core.save(); render();
  }
  function markDone(idx){
    const s = Core.state.stops[idx]; if (!s) return;
    s.f = true; s.b = false; s.finished = Date.now();
    if (!s.started) s.started = s.finished;
    Core.save(); render();
  }
  function markBlocked(idx){
    const s = Core.state.stops[idx]; if (!s) return;
    s.b = true; s.f = false;
    Core.save(); render();
  }
  function undo(idx){
    const s = Core.state.stops[idx]; if (!s) return;
    s.f = false; s.b = false; s.started = null; s.finished = null;
    Core.save(); render();
  }

  // ---- filter + liste ----
  function filteredStops(){
    const f = getFilter();
    const arr = Core.state?.stops || [];
    if (f === "aktive")   return arr.filter(s => !s.f && !s.b);
    if (f === "ferdige")  return arr.filter(s =>  s.f);
    if (f === "blokkerte")return arr.filter(s =>  s.b);
    return arr;
  }

  function render(){
    const host = $("work");         // <section id="work">
    const listHostId = "workList";  // <div id="workList"> (ligger i index.html)
    const listHost = $(listHostId);
    if (!host || !listHost) return;

    // filterrad
    const f = getFilter();
    const btn = (val, label)=>`
      <button data-filter="${val}" class="btn"
        style="border:none;border-radius:10px;padding:8px 10px;margin-right:6px;
               ${f===val?'background:#0f9d58;color:#fff;':'background:#2a2f36;color:#e5e7eb;'}">
        ${label}
      </button>`;
    const toolbarHtml = `
      <div style="margin:8px 0 12px 0">
        ${btn("alle","Alle")}
        ${btn("aktive","Aktive")}
        ${btn("ferdige","Ferdige")}
        ${btn("blokkerte","Blokkert")}
      </div>`;

    // rader
    const rows = filteredStops();
    if (!rows.length){
      listHost.innerHTML = toolbarHtml + `<div class="muted">Ingen adresser tilgjengelig.</div>`;
      hookToolbar();
      return;
    }

    const rowHtml = rows.map((s, i) => {
      const idx = Core.state.stops.indexOf(s); // stabil indeks i hoved-array
      return `
      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:12px;margin:10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:800">${esc(s.n)}</div>
            <div class="muted" style="font-size:13px;opacity:.85">${esc(s.t || "")}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${twoDriver(s)}
            ${statusBadge(s)}
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button data-act="ongo"  data-i="${idx}" style="background:#334155;color:#fff;border:none;border-radius:10px;padding:8px 12px">▶️ Pågår</button>
          <button data-act="done"  data-i="${idx}" style="background:#16a34a;color:#fff;border:none;border-radius:10px;padding:8px 12px">✅ Ferdig</button>
          <button data-act="block" data-i="${idx}" style="background:#b91c1c;color:#fff;border:none;border-radius:10px;padding:8px 12px">⛔ Blokkert</button>
          <button data-act="undo"  data-i="${idx}" style="background:#374151;color:#e5e7eb;border:none;border-radius:10px;padding:8px 12px">↩︎ Angre</button>
        </div>

        ${(s.finished||s.started) ? `
          <div class="small muted" style="margin-top:6px">
            ${s.started  ? `Startet: ${Core.fmtDT(s.started)}` : ``}
            ${s.finished ? ` &nbsp;–&nbsp; Ferdig: ${Core.fmtDT(s.finished)}` : ``}
          </div>` : ``}
      </div>`;
    }).join("");

    listHost.innerHTML = toolbarHtml + rowHtml;

    // hook knapper
    hookToolbar();
    listHost.querySelectorAll("[data-act]").forEach(btn=>{
      const idx = +btn.dataset.i;
      const act = btn.dataset.act;
      btn.onclick = () => {
        if      (act==="ongo")  markOngoing(idx);
        else if (act==="done")  markDone(idx);
        else if (act==="block") markBlocked(idx);
        else if (act==="undo")  undo(idx);
      };
    });
  }

  function hookToolbar(){
    const listHost = $("workList");
    if (!listHost) return;
    listHost.querySelectorAll("button[data-filter]").forEach(b=>{
      b.onclick = ()=> setFilter(b.dataset.filter);
    });
  }

  // Start-knappen på Hjem -> gå til Under arbeid
  document.addEventListener("DOMContentLoaded", ()=>{
    $("startBtn") && ($("startBtn").onclick = ()=> {
      if (typeof window.show === "function") window.show("work");
      render();
    });
    // første render ved last
    render();
  });

  // Eksponer manuelt for debugging hvis ønskelig
  Core.renderWork = render;
})();
</script>