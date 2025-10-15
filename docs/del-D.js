/* ===== del-D.js — Hjem + Under arbeid (hybrid) v9.12h-2 ===== */
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
    const host = $("#home"); if (!host) return;
    const S = Core.state || Core.makeDefaultState();

    host.innerHTML = "";
    const panel = CE("div", { className:"card", style:"max-width:780px" });

    // Navn
    const fNavn = CE("div", { style:"display:flex;gap:12px;align-items:center;flex-wrap:wrap" });
    const lblNavn = CE("label", { textContent:"Navn", className:"small muted" });
    const inpNavn = CE("input", { value:S.customName||"", placeholder:"Ditt navn…" });

    // Retning
    const fRet = CE("div", { style:"display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px" });
    const lblRet = CE("label", { textContent:"Retning", className:"small muted" });
    const selRet = CE("select");
    selRet.innerHTML = `<option value="forward">Vanlig</option><option value="reverse">Motsatt</option>`;
    selRet.value = S.direction || "forward";

    // Utstyr (NB: nå side-om-side; senere kan vi stable vertikalt slik du ønsker)
    const fEq = CE("div", { style:"display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px" });
    const lblEq = CE("span", { className:"small muted", textContent:"Utstyr" });
    const cbSkj = CE("input", { type:"checkbox", checked: !!S.equipment?.skjaer || !!S.equipment?.plog });
    const lbSkj = CE("label", { innerHTML:"&nbsp;Skjær" });
    const cbFr  = CE("input", { type:"checkbox", checked: !!S.equipment?.fres });
    const lbFr  = CE("label", { innerHTML:"&nbsp;Fres" });
    const cbStr = CE("input", { type:"checkbox", checked: !!S.equipment?.strokasse || !!S.equipment?.stro });
    const lbStr = CE("label", { innerHTML:"&nbsp;Strøkasse" });

    // Hanskemodus
    const fHan = CE("div", { style:"display:flex;gap:10px;align-items:center;margin-top:10px" });
    const cbHan = CE("input", { type:"checkbox", checked: !!S.hanske });
    const lbHan = CE("label", { innerHTML:"&nbsp;Hanskemodus (større knapper)" });

    // Knapper
    const fBtn = CE("div", { style:"display:flex;gap:10px;flex-wrap:wrap;margin-top:14px" });
    const btnStart = CE("button", { className:"btn btn-green", textContent:"Start runde →" });
    const btnReset = CE("button", { className:"btn btn-red", textContent:"Nullstill runde" });
    const btnSync  = CE("button", { className:"btn btn-blue", textContent:"Synk/status nå" });

    const summary = CE("div", { className:"small muted", style:"margin-top:10px" });

    // Mount
    fNavn.append(lblNavn, inpNavn);
    fRet.append(lblRet, selRet);
    fEq.append(lblEq, cbSkj, lbSkj, cbFr, lbFr, cbStr, lbStr);
    fHan.append(cbHan, lbHan);
    fBtn.append(btnStart, btnReset, btnSync);
    panel.append(fNavn, fRet, fEq, fHan, fBtn, summary);
    host.append(panel);

    function writeState(){
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
    [inpNavn, selRet, cbHan, cbSkj, cbFr, cbStr].forEach(el=> el.addEventListener("change", writeState));
    renderSummary();

    btnStart.onclick = ()=>{ Core.touchActivity(); try{ Core.status.updateSelf({progress: calcProgress(Core.state)});}catch{} show("work"); renderWork(); };
    btnReset.onclick = ()=>{
      if (!confirm("Nullstille runde lokalt?")) return;
      (Core.state.stops||[]).forEach(s=>{
        s.f=false; s.b=false;
        s.started=null; s.finished=null;
        s.snow=false; s.sand=false;
        s.snowAt=null; s.sandAt=null;
      });
      Core.state.ui = Core.state.ui || {}; Core.state.ui.cursor=0;
      Core.save(); alert("Lokalt nullstilt ✔︎");
    };
    btnSync.onclick = async()=>{ try{ await Core.status.updateSelf({progress: calcProgress(Core.state)}); alert("Status oppdatert ✔︎"); }catch{ alert("Kunne ikke oppdatere status nå."); } };
  }

  /* ========== UNDER ARBEID ========== */
  function calcProgress(state){
    const stops = state?.stops||[];
    if (!stops.length) return 0;
    const done = stops.filter(s=> (s.snow || s.sand || s.f || s.b)).length;
    return Math.round((done*100)/stops.length);
  }

  function renderWork(){
    const host = $("#work"); if (!host) return;
    const S = Core.state || Core.makeDefaultState();
    const stops = S.stops||[];

    host.innerHTML = "";
    const head = CE("div", { className:"small muted", style:"margin-bottom:8px" });
    head.textContent = `Rolle: ${Core.displayName()} • Retning: ${(S.direction==="reverse")?"Motsatt":"Vanlig"}`;
    const prog = CE("div", { className:"progress", style:"margin-bottom:12px;position:relative;overflow:hidden" });
    const bar = CE("div", { className:"bar" });
    const pct = calcProgress(S);
    bar.style.width = pct + "%";
    bar.style.float = (S.direction==="reverse") ? "right" : "left"; // visuelt “fyll fra høyre” når motsatt
    prog.append(bar);
    host.append(head, prog);

    if (!stops.length){
      host.append(CE("div", { className:"muted", textContent:"Ingen adresser i listen." }));
      return;
    }

    stops.forEach((s, i)=>{
      // sikre nye felt
      if (s.snow===undefined) s.snow = !!s.f;
      if (s.sand===undefined) s.sand = false;
      const row = CE("div", { className:"card", style:"margin-bottom:10px" });
      const snowTxt = s.snowAt ? `❄️ ${Core.fmtTime(s.snowAt)}` : "❄️ —";
      const sandTxt = s.sandAt ? `🪨 ${Core.fmtTime(s.sandAt)}` : "🪨 —";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-weight:600">${esc(s.n)}</div>
            <div class="small muted">${esc(s.t||"")}</div>
            <div class="small muted" id="t-${i}">
              ${s.started?`Startet kl ${Core.fmtTime(s.started)}`:""} ${s.finished?` • Ferdig kl ${Core.fmtTime(s.finished)}`:""}
            </div>
            <div class="small muted" id="ops-${i}">${snowTxt}  •  ${sandTxt}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-gray"  data-act="start" data-i="${i}">Start</button>
            <button class="btn btn-green" data-act="snow"  data-i="${i}">❄️ Brøyt ferdig</button>
            <button class="btn btn-purple" data-act="sand" data-i="${i}">🪨 Strø ferdig</button>
            <button class="btn btn-red"   data-act="block" data-i="${i}">Ikke mulig</button>
          </div>
        </div>
      `;
      host.append(row);
    });

    host.querySelectorAll("button[data-act]").forEach(btn=>{
      btn.onclick = ()=>{
        const i = +btn.dataset.i, a = btn.dataset.act;
        const s = Core.state.stops[i]; if (!s) return;

        if (a==="start"){
          if (!s.started) s.started = Date.now();
          s.finished=null; // åpne igjen
        } else if (a==="snow"){
          if (!s.started) s.started = Date.now();
          s.snow = true; s.snowAt = Date.now();
          s.f = true; // bakover-kompabilitet
          // marker ferdig hvis minst én operasjon gjort
          s.finished = s.finished || Date.now();
        } else if (a==="sand"){
          if (!s.started) s.started = Date.now();
          s.sand = true; s.sandAt = Date.now();
          s.finished = s.finished || Date.now();
        } else if (a==="block"){
          s.b = true; s.finished = Date.now();
        }

        Core.save();

        // oppdater små tekster
        const t = $(`#t-${i}`, host);
        if (t) t.textContent = `${s.started?`Startet kl ${Core.fmtTime(s.started)}`:""} ${s.finished?` • Ferdig kl ${Core.fmtTime(s.finished)}`:""}`;
        const ops = $(`#ops-${i}`, host);
        if (ops) ops.textContent = `${s.snowAt?`❄️ ${Core.fmtTime(s.snowAt)}`:"❄️ —"}  •  ${s.sandAt?`🪨 ${Core.fmtTime(s.sandAt)}`:"🪨 —"}`;

        // progress + heartbeat
        const pct = calcProgress(Core.state);
        const bar = host.querySelector(".progress .bar");
        if (bar){
          bar.style.width = pct + "%";
          bar.style.float = (Core.state.direction==="reverse") ? "right" : "left";
        }
        try { Core.status.updateSelf({ progress:pct, current:s.n }); } catch(_){}
      };
    });
  }

  /* ========== Navigasjonshjelper (fallback) ========== */
  window.show = window.show || function show(id){
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  };

  /* ========== Init ========== */
  document.addEventListener("DOMContentLoaded", () => {
    try{ renderHome(); }catch(e){ console.error(e); }
    try{ renderWork(); }catch(e){ console.error(e); }
    console.log("del-D.js (hybrid) lastet");
  });
})();