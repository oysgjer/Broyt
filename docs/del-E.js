<script>
/* ===== del-E.js — Admin (lokal-first + overstyring) ===== */
(() => {
  if (!window.Core) { console.error("Core mangler (del-C.js må lastes først)"); return; }
  const C = window.Core;

  const $   = C.$;
  const esc = C.esc;
  const seasonKey = C.seasonKey;

  function ensureStopsArray() {
    C.state.stops = Array.isArray(C.state.stops) ? C.state.stops : [];
    C.state.stops = C.state.stops.map((s)=>Object.assign({
      n:"", t:"Snø + brøytestikker",
      tasks:{ snow:false, grit:false },
      p:[], twoDriverRec:false,
      pinsCount:0, pinsLockedYear:null,
      started:null, finished:null, details:""
    }, s, {
      t: C.normalizeTask(s?.t || s?.task || "Snø + brøytestikker"),
      tasks: (s && s.tasks) ? { snow:!!s.tasks.snow, grit:!!s.tasks.grit } : { snow:!!s.f, grit:false },
      pinsCount: Number.isFinite(s?.pinsCount) ? s.pinsCount : 0,
      pinsLockedYear: s?.pinsLockedYear ?? null
    }));
  }

  /* ---------- Bygg Admin-seksjon ---------- */
  function buildAdminSection(){
    const host = document.getElementById("admin");
    if (!host) return;

    host.innerHTML = `
      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:14px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
          <div style="font-weight:800">Admin</div>
          <div id="admSummary" class="small" style="color:#b9c2cc">–</div>
        </div>
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <div class="filters" style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn adm-filter" data-filter="all"     style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Alle</button>
            <button class="btn adm-filter" data-filter="pending" style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Ikke fullført</button>
            <button class="btn adm-filter" data-filter="done"    style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Fullført</button>
            <button class="btn adm-filter" data-filter="pins"    style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Med brøytestikker</button>
            <button class="btn adm-filter" data-filter="nopins"  style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Uten brøytestikker</button>
          </div>
          <div style="flex:1"></div>
          <button id="admRefresh" class="btn" style="background:#0b66ff;color:#fff;border:none;border-radius:10px;padding:6px 12px">⟳ Oppfrisk</button>
        </div>
      </div>

      <div id="admList"></div>

      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:14px;padding:12px;margin-top:12px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <div style="font-weight:700">Felles status (eksperimentelt)</div>
          <div class="small" style="color:#b9c2cc">Oppdateres ca. hver 20. sekund</div>
        </div>
        <div id="fleetList" class="small" style="margin-top:8px;color:#b9c2cc">—</div>
      </div>
    `;

    // knapp-hover
    host.querySelectorAll(".btn").forEach(b=>{
      b.style.cursor="pointer";
      b.onmouseenter = ()=> b.style.filter="brightness(1.05)";
      b.onmouseleave = ()=> b.style.filter="";
    });

    // wire filtere
    host.querySelectorAll(".adm-filter").forEach(btn=>{
      btn.onclick = ()=>{
        const v = btn.dataset.filter || "all";
        C.state.ui = C.state.ui || {};
        C.state.ui.adminPinFilter = v;
        C.save();
        host.querySelectorAll(".adm-filter").forEach(x=>{ x.style.background="#2f3337"; x.style.color="#fff"; });
        btn.style.background = "#0f9d58"; btn.style.color="#fff";
        renderAdminList();
      };
    });

    // sett valgt filter visualt
    const cur = C.state.ui?.adminPinFilter || "all";
    const curBtn = host.querySelector(`.adm-filter[data-filter="${cur}"]`);
    if (curBtn) curBtn.click();

    // refresh-knapp
    const ref = $("#admRefresh");
    if (ref) ref.onclick = ()=> renderAdminList();

    // start felles status polling (ikke farlig om denne kalles flere ganger)
    try{
      if (C.status && typeof C.status.startPolling === "function"){
        C.status.startPolling(renderFleet);
      }
    }catch(_){}
  }

  /* ---------- Liste & handling ---------- */
  function isDone(s){ return !!(s?.tasks?.snow) && !!(s?.tasks?.grit); }

  function renderAdminList(){
    ensureStopsArray();
    const S = C.state;
    const filter = S.ui?.adminPinFilter || "all";

    // stats
    const total = S.stops.length;
    const snowDone = S.stops.filter(s=>s?.tasks?.snow).length;
    const gritDone = S.stops.filter(s=>s?.tasks?.grit).length;
    const bothDone = S.stops.filter(isDone).length;
    const pct = total ? Math.round(100 * bothDone / total) : 0;
    const sum = $("#admSummary");
    if (sum) sum.textContent = `Totalt ${total} — ${pct}% fullført (begge). ❄️ ${snowDone}/${total}, 🪨 ${gritDone}/${total}`;

    // filtrer
    let rows = S.stops.slice();
    if (filter==="pending") rows = rows.filter(s=>!isDone(s));
    if (filter==="done")    rows = rows.filter(isDone);
    if (filter==="pins")    rows = rows.filter(s=> !!s.pinsLockedYear);
    if (filter==="nopins")  rows = rows.filter(s=> !s.pinsLockedYear);

    const host = $("#admList");
    if (!host) return;

    if (!rows.length){
      host.innerHTML = `<div class="small" style="color:#b9c2cc">Ingen rader i dette filteret.</div>`;
      return;
    }

    host.innerHTML = rows.map((s, idxAll)=>{
      const idx = C.state.stops.indexOf(s);
      const pins = s.pinsLockedYear ? `📍 ${s.pinsCount ?? 0}` : "—";
      const two  = s.twoDriverRec ? "👥" : "";
      const snow = s.tasks?.snow ? "✅" : "⏳";
      const grit = s.tasks?.grit ? "✅" : "⏳";

      return `
      <div class="row" data-i="${idx}" style="padding:10px;border:1px solid #2a2f36;border-radius:12px;margin-bottom:8px;background:#181a1e">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
          <div style="font-weight:700">${esc(s.n)}</div>
          <div class="small" style="color:#b9c2cc">${esc(s.t)}</div>
        </div>

        <div class="small" style="margin-top:4px;color:#b9c2cc">
          ❄️ Snø: ${snow} &nbsp; | &nbsp; 🪨 Strø: ${grit} &nbsp; | &nbsp; ${two} &nbsp; | &nbsp; ${pins}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <button class="btn btn-snow" data-i="${idx}" style="border:none;border-radius:999px;padding:6px 10px;${s.tasks?.snow?'background:#16a34a;color:#fff':'background:#2f3337;color:#fff'}">
            ${s.tasks?.snow ? '❄️ Angre snø' : '❄️ Sett snø fullført'}
          </button>
          <button class="btn btn-grit" data-i="${idx}" style="border:none;border-radius:999px;padding:6px 10px;${s.tasks?.grit?'background:#f59e0b;color:#000':'background:#2f3337;color:#fff'}">
            ${s.tasks?.grit ? '🪨 Angre strø' : '🪨 Sett strø fullført'}
          </button>

          <button class="btn btn-pins" data-i="${idx}" style="border:1px solid #2a2f36;border-radius:999px;padding:6px 10px;background:transparent;color:#fff">
            📍 Overstyr brøytestikker
          </button>
          <button class="btn btn-unlock" data-i="${idx}" style="border:1px solid #2a2f36;border-radius:999px;padding:6px 10px;background:transparent;color:#fff">
            🔓 Lås opp brøytestikker
          </button>

          <label class="small" style="display:flex;gap:6px;align-items:center;color:#b9c2cc;margin-left:auto">
            <input type="checkbox" class="adm-two" data-i="${idx}" ${s.twoDriverRec?'checked':''}> Anbefal 2 sjåfører
          </label>
        </div>
      </div>`;
    }).join("");

    // hover
    host.querySelectorAll(".btn").forEach(b=>{
      b.style.cursor="pointer";
      b.onmouseenter = ()=> b.style.filter="brightness(1.05)";
      b.onmouseleave = ()=> b.style.filter="";
    });

    // delegér
    host.onclick = (ev)=>{
      const btn = ev.target.closest("button"); if (!btn) return;
      const i = +btn.dataset.i; if (!Number.isFinite(i)) return;
      const s = C.state.stops[i]; if (!s) return;

      if (btn.classList.contains("btn-snow")){
        s.tasks = s.tasks || {snow:false,grit:false};
        s.tasks.snow = !s.tasks.snow;
        C.save(); renderAdminList(); return;
      }
      if (btn.classList.contains("btn-grit")){
        s.tasks = s.tasks || {snow:false,grit:false};
        s.tasks.grit = !s.tasks.grit;
        C.save(); renderAdminList(); return;
      }
      if (btn.classList.contains("btn-pins")){
        const current = Number.isFinite(s.pinsCount) ? s.pinsCount : 0;
        const v = prompt("Antall brøytestikker (låses for inneværende sesong):", String(current));
        if (v === null) return;
        const n = parseInt((v||"").trim() || "0", 10) || 0;
        s.pinsCount = n;
        s.pinsLockedYear = seasonKey();
        C.save(); renderAdminList(); return;
      }
      if (btn.classList.contains("btn-unlock")){
        if (!confirm("Låse opp brøytestikker for denne adressen?")) return;
        s.pinsLockedYear = null;
        C.save(); renderAdminList(); return;
      }
    };

    // twoDriver toggle
    host.querySelectorAll(".adm-two").forEach(chk=>{
      chk.onchange = ()=>{
        const i = +chk.dataset.i; if (!Number.isFinite(i)) return;
        const s = C.state.stops[i]; if (!s) return;
        s.twoDriverRec = !!chk.checked;
        C.save();
      };
    });
  }

  /* ---------- Felles status-render ---------- */
  function renderFleet(list){
    const host = $("#fleetList");
    if (!host){ return; }
    if (!Array.isArray(list) || !list.length){
      host.innerHTML = `<div class="small" style="color:#b9c2cc">Ingen aktive sjåfører sett nylig.</div>`;
      return;
    }
    host.innerHTML = list.map(d=>{
      const when = d.ts ? new Date(d.ts).toLocaleTimeString("no-NO",{hour:"2-digit",minute:"2-digit"}) : "—";
      const eq = d.equipment || {};
      const eqText = [
        eq.plog || eq.skjaer ? "skjær" : null,
        eq.fres ? "fres" : null,
        eq.stro || eq.strokasse ? "strøkasse" : null
      ].filter(Boolean).join(", ");
      return `
        <div style="padding:8px 0;border-bottom:1px solid #2a2f36">
          <b>${esc(d.name||"Sjåfør")}</b> — ${esc(d.direction||"forward")} — ${esc(eqText||"–")}
          <div class="small" style="color:#b9c2cc">Sist sett: ${when}</div>
        </div>`;
    }).join("");
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", ()=>{
    C.state = C.load() || C.makeDefaultState();
    ensureStopsArray();
    buildAdminSection();
    renderAdminList();

    // Kick i gang heartbeat for egen status (ufarlig å kalle flere ganger)
    try{
      if (C.status && typeof C.status.startHeartbeat === "function"){
        C.status.startHeartbeat();
      }
    }catch(_){}
    console.log("del-E.js (admin) klar");
  });
})();
</script>