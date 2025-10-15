/* ===== del-D.js — Hjem + Under arbeid (grunnvisning) v9.12h ===== */
(() => {
  if (!window.Core) return console.error("Del-C.js må lastes før del-D.js.");
  const Core = window.Core;

  const $  = (sel, root=document) => root.querySelector(sel);
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));

  /* ========== HJEM ========== */
  function renderHome() {
    const host = $("#home");
    if (!host) return;
    const S = Core.state || Core.makeDefaultState();

    host.innerHTML = "";
    const wrap = CE("div");

    // Tittel/versjon (behold det som er i index)
    const panel = CE("div", { className: "card", style: "max-width:780px" });

    // NAVN
    const fNavn = CE("div", { style:"display:flex;gap:12px;align-items:center;flex-wrap:wrap" });
    const lblNavn = CE("label", { textContent: "Navn", className:"small muted" });
    const inpNavn = CE("input", { value: S.customName || "", placeholder:"Ditt navn…" });

    // RETNING
    const fRet = CE("div", { style:"display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px" });
    const lblRet = CE("label", { textContent: "Retning", className:"small muted" });
    const selRet = CE("select");
    selRet.innerHTML = `
      <option value="forward">Vanlig</option>
      <option value="reverse">Motsatt</option>
    `;
    selRet.value = S.direction || "forward";

    // UTSYR
    const fEq = CE("div", { style:"display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px" });
    const lblEq = CE("span", { className:"small muted", textContent:"Utstyr" });
    const cbSkj = CE("input", { type:"checkbox", checked: !!S.equipment?.skjaer || !!S.equipment?.plog });
    const lbSkj = CE("label", { innerHTML:"&nbsp;Skjær" });
    const cbFr  = CE("input", { type:"checkbox", checked: !!S.equipment?.fres });
    const lbFr  = CE("label", { innerHTML:"&nbsp;Fres" });
    const cbStr = CE("input", { type:"checkbox", checked: !!S.equipment?.strokasse || !!S.equipment?.stro });
    const lbStr = CE("label", { innerHTML:"&nbsp;Strøkasse" });

    // HANSKEMODUS
    const fHan = CE("div", { style:"display:flex;gap:10px;align-items:center;margin-top:10px" });
    const cbHan = CE("input", { type:"checkbox", checked: !!S.hanske });
    const lbHan = CE("label", { innerHTML:"&nbsp;Hanskemodus (større knapper)" });

    // KNAPPER
    const fBtn = CE("div", { style:"display:flex;gap:10px;flex-wrap:wrap;margin-top:14px" });
    const btnStart = CE("button", { className:"btn btn-green", textContent:"Start runde →" });
    const btnReset = CE("button", { className:"btn btn-red", textContent:"Nullstill runde" });
    const btnSync  = CE("button", { className:"btn btn-blue", textContent:"Synk/status nå" });

    // Oppsummeringslinje
    const summary = CE("div", { className:"small muted", style:"margin-top:10px" });

    // Sett sammen
    fNavn.append(lblNavn, inpNavn);
    fRet.append(lblRet, selRet);
    fEq.append(lblEq, cbSkj, lbSkj, cbFr, lbFr, cbStr, lbStr);
    fHan.append(cbHan, lbHan);
    fBtn.append(btnStart, btnReset, btnSync);
    panel.append(fNavn, fRet, fEq, fHan, fBtn, summary);
    wrap.append(panel);
    host.append(wrap);

    // helpers
    function writeState() {
      Core.state.customName = (inpNavn.value||"").trim();
      Core.state.useCustomName = !!Core.state.customName;
      Core.state.direction = selRet.value;
      Core.state.hanske = cbHan.checked;
      Core.state.equipment = {
        skjaer: !!cbSkj.checked,
        fres: !!cbFr.checked,
        strokasse: !!cbStr.checked
      };
      Core.save();
      renderSummary();
    }
    function renderSummary(){
      const eq = Core.state.equipment||{};
      const list = [
        eq.skjaer ? "Skjær" : null,
        eq.fres ? "Fres" : null,
        eq.strokasse ? "Strøkasse" : null
      ].filter(Boolean).join(", ") || "—";
      const dir = (Core.state.direction==="reverse") ? "Motsatt" : "Vanlig";
      summary.textContent = `Valgt utstyr: ${list}. Retning: ${dir}.`;
    }

    // wire input
    [inpNavn, selRet, cbHan].forEach(el => el.addEventListener("change", writeState));
    [cbSkj, cbFr, cbStr].forEach(el => el.addEventListener("change", writeState));
    renderSummary();

    // knapper
    btnStart.onclick = () => {
      // Ikke rydde gjennomføringer her – bare markér start
      Core.touchActivity();
      // liten heartbeat så status dukker opp
      try { Core.status.updateSelf({ progress: calcProgress(Core.state) }); } catch(_){}
      // hopp til Under arbeid
      show("work");
      renderWork(); // første tegning
    };
    btnReset.onclick = ()=>{
      if (!confirm("Nullstille runde lokalt? Dette fjerner status/klokkeslett, men påvirker ikke felles lagring.")) return;
      (Core.state.stops||[]).forEach(s=>{
        s.f = false; s.b = false;
        s.started = null; s.finished = null; s.details = "";
      });
      Core.state.ui = Core.state.ui || {};
      Core.state.ui.cursor = 0;
      Core.save();
      alert("Lokalt nullstilt ✔︎");
    };
    btnSync.onclick = async ()=>{
      try {
        await Core.status.updateSelf({ progress: calcProgress(Core.state) });
        alert("Status oppdatert ✔︎");
      } catch(_){ alert("Kunne ikke oppdatere status nå."); }
    };
  }

  /* ========== UNDER ARBEID (enkel) ========== */
  function calcProgress(state){
    const stops = state?.stops||[];
    if (!stops.length) return 0;
    const done = stops.filter(s=> s.f || s.b).length;
    return Math.round((done*100)/stops.length);
  }

  function renderWork() {
    const host = $("#work");
    if (!host) return;
    const S = Core.state || Core.makeDefaultState();
    const stops = S.stops||[];

    host.innerHTML = "";
    const titleBar = CE("div", { className:"small muted", style:"margin-bottom:8px" });
    titleBar.textContent = `Rolle: ${Core.displayName()}  •  Retning: ${(S.direction==="reverse")?"Motsatt":"Vanlig"}`;
    const prog = CE("div", { className:"progress", style:"margin-bottom:12px" });
    const bar = CE("div", { className:"bar", style:`width:${calcProgress(S)}%` });
    prog.append(bar);

    host.append(titleBar, prog);

    if (!stops.length){
      host.append(CE("div", { className:"muted", textContent:"Ingen adresser i listen." }));
      return;
    }

    stops.forEach((s, idx)=>{
      const row = CE("div", { className:"card", style:"margin-bottom:10px" });
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-weight:600">${esc(s.n)}</div>
            <div class="small muted">${esc(s.t||"")}</div>
            <div class="small muted" id="t-${idx}">
              ${s.started?`Startet kl ${Core.fmtTime(s.started)}`:""} ${s.finished?` • Ferdig kl ${Core.fmtTime(s.finished)}`:""}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-gray"   data-act="start"  data-i="${idx}">Start</button>
            <button class="btn btn-green"  data-act="done"   data-i="${idx}">Ferdig</button>
            <button class="btn btn-red"    data-act="block"  data-i="${idx}">Ikke mulig</button>
          </div>
        </div>
      `;
      host.append(row);
    });

    // wire handling
    host.querySelectorAll("button[data-act]").forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.i;
        const a = btn.dataset.act;
        const s = Core.state.stops[i];
        if (!s) return;

        if (a==="start") {
          if (!s.started) s.started = Date.now();
          s.f = false; s.b = false; s.finished = null;
        } else if (a==="done") {
          if (!s.started) s.started = Date.now();
          s.f = true; s.b = false; s.finished = Date.now();
        } else if (a==="block") {
          s.b = true; s.f = false; s.finished = Date.now();
        }
        Core.save();
        // oppdater små tekster
        const t = $(`#t-${i}`, host);
        if (t) t.textContent =
          `${s.started?`Startet kl ${Core.fmtTime(s.started)}`:""} ${s.finished?` • Ferdig kl ${Core.fmtTime(s.finished)}`:""}`;
        // oppdater progress + felles status
        const pct = calcProgress(Core.state);
        const bar = host.querySelector(".progress .bar");
        if (bar) bar.style.width = pct + "%";
        try { Core.status.updateSelf({ progress: pct, current: s.n }); } catch(_){}
      };
    });
  }

  /* ========== Navigasjonshjelper ========== */
  window.show = window.show || function show(id){
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  };

  /* ========== Init ========== */
  document.addEventListener("DOMContentLoaded", () => {
    try { renderHome(); } catch(e){ console.error(e); }
    try { renderWork(); } catch(e){ console.error(e); }
    console.log("del-D.js lastet");
  });
})();