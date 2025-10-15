/* ===== del-E.js — Admin (status + brøytestikker override) v9.12h ===== */
(() => {
  if (!window.Core) return console.error("Del-C.js må lastes før del-E.js.");
  const Core = window.Core;

  const $  = (sel, root=document) => root.querySelector(sel);
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));

  function adminHost() { return $("#admin"); }

  /* ---------- FELLES STATUS (poll JSONBin) ---------- */
  function renderStatusCard(host) {
    const card = CE("div", { className:"card", style:"padding:12px;margin-bottom:12px" });
    const title = CE("div", { innerHTML:"<h3 style='margin:0 0 8px'>Status (sjåfører)</h3>" });
    const list  = CE("div");

    card.append(title, list);
    host.appendChild(card);

    // Start heartbeat (oppdater egen status hvert 30s) + polling (hent alle hver 20s)
    try { Core.status.startHeartbeat(); } catch(_){}

    function renderList(arr){
      if (!Array.isArray(arr) || arr.length===0) {
        list.innerHTML = `<div class="small muted">Ingen aktive hjerteslag enda.</div>`;
        return;
      }
      list.innerHTML = arr.map(d=>{
        const agoMs = Date.now() - (d.ts||0);
        const agoMin = Math.max(0, Math.round(agoMs/60000));
        const dir = (d.direction==="reverse") ? "Motsatt" : "Normal";
        const eq = d.equipment||{};
        const eqList = [
          eq.skjaer ? "skjær" : null,
          eq.fres ? "fres" : null,
          eq.strokasse ? "strøkasse" : null
        ].filter(Boolean).join(", ") || "—";
        const pct = Math.max(0, Math.min(100, d.progress||0));

        return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #2a2f36">
            <div style="flex:1">
              <b>${esc(d.name||"Sjåfør")}</b>
              <div class="small muted">Retning: ${esc(dir)} • Utstyr: ${esc(eqList)} • Sist sett: ${agoMin} min</div>
              <div class="progress" style="margin-top:6px"><div class="bar" style="width:${pct}%"></div></div>
            </div>
            <div class="badge">${pct}%</div>
          </div>`;
      }).join("");
    }

    try {
      Core.status.startPolling(renderList);
    } catch(_){
      list.innerHTML = `<div class="small muted">Kunne ikke starte status-polling.</div>`;
    }
  }

  /* ---------- BRØYTESTIKKER OVERRIDE ---------- */
  function renderPinsCard(host) {
    const card = CE("div", { className:"card", style:"padding:12px" });
    const head = CE("div", { innerHTML:"<h3 style='margin:0 0 8px'>Overstyr brøytestikker</h3><div class='small muted'>Sett/rydde antall for inneværende sesong per adresse.</div>" });

    const toolbar = CE("div", { style:"display:flex;gap:8px;flex-wrap:wrap;margin:10px 0" });
    const inpFind = CE("input", { placeholder:"Søk adresse…", style:"flex:1;min-width:200px" });
    const btnPublish = CE("button", { className:"btn btn-blue", textContent:"🚀 Publiser til felles (JSONBin)" });
    toolbar.append(inpFind, btnPublish);

    const list = CE("div");

    card.append(head, toolbar, list);
    host.appendChild(card);

    function seasonKey(){ return Core.seasonKey(); }

    function rows(filter="") {
      const q = (filter||"").toLowerCase().trim();
      const stops = (Core.state?.stops||[]).slice();
      return stops
        .map((s, i)=>({s, i}))
        .filter(x => !q || (x.s.n||"").toLowerCase().includes(q));
    }

    function render(filter="") {
      const items = rows(filter);
      if (items.length===0) {
        list.innerHTML = `<div class="small muted">Ingen adresser.</div>`;
        return;
      }
      list.innerHTML = items.map(({s, i})=>{
        const locked = s.pinsLockedYear && String(s.pinsLockedYear)===seasonKey();
        const badge  = locked ? `<span class="badge">📍 ${s.pinsCount ?? 0} (${esc(s.pinsLockedYear)})</span>` : `<span class="badge">—</span>`;
        const status = (s.f ? "✅" : (s.b ? "⛔" : ""));
        return `
          <div style="padding:8px 0;border-bottom:1px solid #2a2f36;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <b>${esc(s.n)}</b> ${badge} <span class="small muted">${esc(s.t||"")}</span> ${status}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-gray" data-edit="${i}">Overstyr…</button>
              <button class="btn btn-red" data-clear="${i}">Rydd lås</button>
            </div>
          </div>`;
      }).join("");

      // Wire knapper
      list.querySelectorAll("button[data-edit]").forEach(btn=>{
        btn.onclick = ()=>{
          const i = +btn.dataset.edit;
          const s = Core.state.stops[i];
          const cur = Number.isFinite(s.pinsCount) ? s.pinsCount : 0;
          const v = prompt(`Antall brøytestikker brukt (låses ${seasonKey()}):`, String(cur));
          if (v === null) return;
          const n = parseInt((v||"").trim() || "0", 10);
          if (!Number.isFinite(n) || n < 0) return alert("Ugyldig tall.");
          s.pinsCount = n;
          s.pinsLockedYear = seasonKey();
          Core.save();
          render(inpFind.value);
        };
      });
      list.querySelectorAll("button[data-clear]").forEach(btn=>{
        btn.onclick = ()=>{
          const i = +btn.dataset.clear;
          const s = Core.state.stops[i];
          if (!confirm(`Fjerne sesong-lås for «${s.n}»?`)) return;
          s.pinsCount = 0;
          s.pinsLockedYear = null;
          Core.save();
          render(inpFind.value);
        };
      });
    }

    inpFind.addEventListener("input", ()=> render(inpFind.value));
    render("");

    // Publiser til felles (MASTER) — valgfritt (krever API-key)
    btnPublish.onclick = async ()=>{
      try{
        const stops = (Core.state?.stops||[]).map(s=>({
          n:s.n, t:s.t, f:!!s.f, b:!!s.b, p:Array.isArray(s.p)?s.p:[],
          twoDriverRec: !!s.twoDriverRec,
          pinsCount: Number.isFinite(s.pinsCount) ? s.pinsCount : 0,
          pinsLockedYear: s.pinsLockedYear || null,
          started: s.started||null, finished: s.finished||null, details: s.details||""
        }));
        const payload = {
          version: Core.cfg.VERSION,
          updated: Date.now(),
          lastSyncAt: Date.now(),
          lastSyncBy: Core.displayName(),
          stops,
          meta:{ from:"admin-override" }
        };
        const r = await fetch(`https://api.jsonbin.io/v3/b/${Core.cfg.BINS.MASTER}`, {
          method:"PUT",
          headers: Core.headers(),
          body: JSON.stringify(payload)
        });
        if (!r.ok) throw 0;
        alert("Publisert til felles (MASTER) ✔︎");
      }catch(_){
        alert("Kunne ikke publisere (sjekk nett/JSONBin-nøkkel).");
      }
    };
  }

  /* ---------- HOVED RENDER ---------- */
  function renderAdmin() {
    const host = adminHost();
    if (!host) return;
    host.innerHTML = "";

    host.appendChild(CE("h2", { textContent:"Admin" }));

    renderStatusCard(host);
    renderPinsCard(host);
  }

  document.addEventListener("DOMContentLoaded", renderAdmin);
  console.log("del-E.js (Admin) lastet");
})();