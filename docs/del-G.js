<script>
/* ===== del-G.js — Adresse-register ===== */
(() => {
  if (!window.Core) { console.error("Core mangler (del-C.js må lastes først)"); return; }
  const C = window.Core;

  // ---------- Utils ----------
  const $  = C.$;
  const esc= C.esc;
  const seasonKey = C.seasonKey;

  // Sikre ny struktur for doble oppgaver per stopp
  function normalizeStop(s) {
    const out = Object.assign({
      n: "",               // name
      t: "Snø + brøytestikker",
      tasks: { snow: false, grit: false },
      p: [],               // photos
      twoDriverRec: false,
      pinsCount: 0,
      pinsLockedYear: null,
      started: null,
      finished: null,
      details: ""
    }, s || {});

    // Bakoverkomp: Hvis gammel f/b finnes → map til snow
    if (typeof s?.f === "boolean" && out.tasks) {
      out.tasks.snow = out.tasks.snow || !!s.f;
    }
    if (typeof s?.b === "boolean") {
      // ignorér gammel "block" i registeret (kun visning i Work)
    }

    // Tving oppgavetekst til å inneholde "brøytestikker"
    out.t = C.normalizeTask(out.t || out.task || "");

    // Sikre tasks-objekt
    if (!out.tasks || typeof out.tasks !== "object") {
      out.tasks = { snow: false, grit: false };
    } else {
      out.tasks.snow = !!out.tasks.snow;
      out.tasks.grit = !!out.tasks.grit;
    }
    // Pins defaults
    out.pinsCount = Number.isFinite(out.pinsCount) ? out.pinsCount : 0;
    out.pinsLockedYear = out.pinsLockedYear ?? null;

    return out;
  }

  function ensureStopsArray() {
    C.state.stops = Array.isArray(C.state.stops) ? C.state.stops : [];
    C.state.stops = C.state.stops.map(normalizeStop);
  }

  // ---------- UI skeleton bygges inn i <section id="addresses"> ----------
  function buildAddressesSection() {
    const host = document.getElementById("addresses");
    if (!host) return;

    host.innerHTML = `
      <div class="reg-card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:14px;padding:12px;margin-bottom:12px">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">
          <div style="font-weight:700">Adresse-register</div>
          <div id="regSummary" class="small" style="color:#b9c2cc">–</div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <button id="regBtnCatalog" class="btn" style="background:#0b66ff;color:#fff;border:none;border-radius:10px;padding:8px 12px">↘︎ Hent fra katalog</button>
          <div class="filters" style="display:flex;gap:6px">
            <button class="btn reg-filter" data-filter="all" style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Alle</button>
            <button class="btn reg-filter" data-filter="pending" style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Ikke fullført</button>
            <button class="btn reg-filter" data-filter="done" style="background:#2f3337;color:#fff;border:none;border-radius:999px;padding:6px 10px">Fullført</button>
          </div>
        </div>
      </div>

      <div id="regList"></div>

      <div class="reg-card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:14px;padding:12px;margin-top:12px">
        <div style="font-weight:700;margin-bottom:8px">Legg til ny adresse (lokalt)</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="regNewName" type="text" placeholder="Adresse / område" 
                 style="flex:2;min-width:220px;background:transparent;color:#fff;border:1px solid #2a2f36;border-radius:10px;padding:8px">
          <select id="regNewTask" style="flex:1;min-width:200px;background:transparent;color:#fff;border:1px solid #2a2f36;border-radius:10px;padding:8px">
            ${C.cfg.DEFAULT_TASKS.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}
          </select>
          <label class="small" style="display:flex;gap:6px;align-items:center;color:#b9c2cc">
            <input id="regTwoDriver" type="checkbox"> Anbefalt 2 sjåfører
          </label>
          <button id="regBtnAdd" class="btn" style="background:#0f9d58;color:#fff;border:none;border-radius:10px;padding:8px 12px">+ Legg til</button>
        </div>
        <div class="small" style="color:#b9c2cc;margin-top:6px">Tips: Enter i adressefeltet = legg til raskt.</div>
      </div>
    `;

    // Tema-vennlig knappestil (liten helper)
    host.querySelectorAll(".btn").forEach(b=>{
      b.style.cursor = "pointer";
      b.onmouseenter = () => b.style.filter = "brightness(1.05)";
      b.onmouseleave = () => b.style.filter = "";
    });
  }

  // ---------- Render liste ----------
  function renderList() {
    ensureStopsArray();
    const S = C.state;
    const filter = S.ui?.pinFilter || "all";

    // Filter: pending = minst én av (snow, grit) ikke fullført. done = begge fullført
    let rows = S.stops.slice();
    rows = rows.map(normalizeStop);

    const isDone = (s) => !!(s?.tasks?.snow) && !!(s?.tasks?.grit);
    if (filter === "pending") rows = rows.filter(s=> !isDone(s));
    if (filter === "done")    rows = rows.filter(isDone);

    // Stats / summary
    const total = S.stops.length;
    const doneCount = S.stops.filter(isDone).length;
    const pendingCount = total - doneCount;
    const summary = $("regSummary");
    if (summary) {
      const pct = total ? Math.round((doneCount/total)*100) : 0;
      summary.textContent = `Totalt ${total} — ${pct}% fullført (${doneCount}/${total})`;
    }

    const host = $("regList");
    if (!host) return;

    if (!rows.length) {
      host.innerHTML = `<div class="small" style="color:#b9c2cc">Ingen adresser å vise.</div>`;
      return;
    }

    host.innerHTML = rows.map((s, idxAll) => {
      const idx = C.state.stops.indexOf(s); // indeks i full liste
      const pinsBadge = s.pinsLockedYear ? `<span class="badge" style="border:1px solid #2a2f36;border-radius:999px;padding:2px 8px;font-size:12px">📍 ${s.pinsCount ?? 0}</span>` : "";
      const twoBadge  = s.twoDriverRec ? `<span class="badge" style="border:1px solid #2a2f36;border-radius:999px;padding:2px 8px;font-size:12px">👥</span>` : "";
      const snowOn    = !!s.tasks.snow;
      const gritOn    = !!s.tasks.grit;

      return `
      <div class="item" data-i="${idx}" style="padding:10px;border:1px solid #2a2f36;border-radius:12px;margin-bottom:8px;background:#181a1e">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
          <div style="font-weight:700">${esc(s.n)}</div>
          <div style="display:flex;gap:6px;align-items:center">${twoBadge}${pinsBadge}</div>
        </div>
        <div class="small" style="color:#b9c2cc;margin-top:4px">${esc(s.t)}</div>

        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <!-- Oppgavestatus -->
          <button class="btn btn-task" data-i="${idx}" data-task="snow"
                  style="border:none;border-radius:999px;padding:6px 10px;${snowOn?'background:#0ea5e9;color:#000':'background:#2f3337;color:#fff'}">
            ❄️ Snø ${snowOn ? '✅' : ''}
          </button>
          <button class="btn btn-task" data-i="${idx}" data-task="grit"
                  style="border:none;border-radius:999px;padding:6px 10px;${gritOn?'background:#f59e0b;color:#000':'background:#2f3337;color:#fff'}">
            🪨 Strø ${gritOn ? '✅' : ''}
          </button>

          <!-- Brøytestikker -->
          <button class="btn btn-pins" data-i="${idx}"
                  style="border:1px solid #2a2f36;border-radius:999px;padding:6px 10px;background:transparent;color:#fff">
            📍 Brøytestikker
          </button>

          <!-- Navigasjon -->
          <button class="btn btn-nav" data-i="${idx}"
                  style="border:none;border-radius:999px;padding:6px 10px;background:#0b66ff;color:#fff">
            🧭 Naviger
          </button>
        </div>
      </div>`;
    }).join("");

    // Hovereffekt for alle knapper
    host.querySelectorAll(".btn").forEach(b=>{
      b.style.cursor = "pointer";
      b.onmouseenter = () => b.style.filter = "brightness(1.05)";
      b.onmouseleave = () => b.style.filter = "";
    });

    // Delegér klikk
    host.onclick = (ev) => {
      const btn = ev.target.closest("button"); if (!btn) return;
      const i = +btn.dataset.i; if (!Number.isFinite(i)) return;
      const s = C.state.stops[i]; if (!s) return;

      // Toggle tasks
      if (btn.classList.contains("btn-task")) {
        const task = btn.dataset.task; // 'snow' | 'grit'
        s.tasks = s.tasks || { snow:false, grit:false };
        s.tasks[task] = !s.tasks[task];
        C.save();
        renderList();
        return;
      }

      // Brøytestikker (låses én gang per sesong)
      if (btn.classList.contains("btn-pins")) {
        const locked = s.pinsLockedYear && String(s.pinsLockedYear) === seasonKey();
        if (locked) {
          alert("Brøytestikker er allerede registrert for inneværende sesong og er låst.");
          return;
        }
        const curVal = Number.isFinite(s.pinsCount) ? s.pinsCount : 0;
        const v = prompt("Antall brøytestikker brukt (låses for sesongen):", String(curVal));
        if (v === null) return;
        const n = parseInt((v||"").trim() || "0", 10) || 0;
        s.pinsCount = n;
        s.pinsLockedYear = seasonKey();
        C.save();
        renderList();
        return;
      }

      // Navigasjon
      if (btn.classList.contains("btn-nav")) {
        const q = encodeURIComponent(s.n || "");
        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
        return;
      }
    };
  }

  // ---------- Filtre + Katalog + Legg til ----------
  function wireControls() {
    const wrapper = document.getElementById("addresses");
    if (!wrapper) return;

    // Filtre
    wrapper.querySelectorAll(".reg-filter").forEach(b=>{
      b.onclick = () => {
        const val = b.dataset.filter || "all";
        C.state.ui = C.state.ui || {};
        C.state.ui.pinFilter = val;
        C.save();
        // visual
        wrapper.querySelectorAll(".reg-filter").forEach(x=>{
          x.style.background = "#2f3337"; x.style.color="#fff";
        });
        b.style.background = "#0f9d58"; b.style.color="#fff";
        renderList();
      };
    });

    // Sett korrekt valgt filter ved initialisering
    const cur = C.state.ui?.pinFilter || "all";
    const curBtn = wrapper.querySelector(`.reg-filter[data-filter="${cur}"]`);
    if (curBtn) { curBtn.click(); } else { renderList(); }

    // Hent fra katalog
    const btnCat = wrapper.querySelector("#regBtnCatalog");
    if (btnCat) {
      btnCat.onclick = async ()=>{
        btnCat.disabled = true;
        btnCat.textContent = "Henter …";
        try{
          const rec = await C.fetchCatalog();
          const active = (rec.addresses || []).filter(a=> a?.active !== false);
          if (!active.length) { alert("Ingen (aktive) adresser i katalogen."); return; }
          const stops = active.map(a => normalizeStop({
            n: a.name || "",
            t: C.normalizeTask(a.task || C.cfg.DEFAULT_TASKS[0]),
            twoDriverRec: !!a.twoDriverRec
          }));
          C.state.stops = stops;
          C.save();
          renderList();
          alert(`Hentet ${stops.length} adresser fra katalog`);
        }catch(e){
          alert("Feil ved kataloghenting.");
        }finally{
          btnCat.disabled = false;
          btnCat.textContent = "↘︎ Hent fra katalog";
        }
      };
    }

    // Legg til lokalt
    const btnAdd = wrapper.querySelector("#regBtnAdd");
    const inpName = wrapper.querySelector("#regNewName");
    const selTask = wrapper.querySelector("#regNewTask");
    const chkTwo  = wrapper.querySelector("#regTwoDriver");

    function addNow(){
      const name = (inpName?.value || "").trim();
      if (!name) { inpName?.focus(); return; }
      const task = C.normalizeTask(selTask?.value || C.cfg.DEFAULT_TASKS[0]);
      const two  = !!(chkTwo?.checked);

      C.state.stops.push(normalizeStop({
        n: name,
        t: task,
        twoDriverRec: two
      }));
      C.save();
      renderList();

      if (inpName) inpName.value = "";
      if (chkTwo) chkTwo.checked = false;
      inpName?.focus();
    }

    if (btnAdd) btnAdd.onclick = addNow;
    if (inpName) {
      inpName.addEventListener("keydown", (e)=>{
        if (e.key === "Enter") { e.preventDefault(); addNow(); }
      });
    }
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    // Sikre state
    C.state = C.load() || C.makeDefaultState();
    ensureStopsArray();

    // Bygg seksjonen (erstatter placeholder-HTML)
    buildAddressesSection();

    // Wire knapper og render
    wireControls();
    renderList();

    console.log("del-G.js (adresse-register) klar");
  });
})();
</script>