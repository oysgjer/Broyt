/* ===== del-H.js (HJEM) ===== */
(()=>{
  const { $, state, save, startNewRound } = window.Core;

  function syncFromState(){
    $("#ver").textContent = window.Core.cfg.VERSION;
    $("#homeName").value = state.customName || "";
    $("#homeDir").value  = state.direction || "forward";
    $("#eqSkjaer").checked    = !!state.equipment?.skjaer;
    $("#eqFres").checked      = !!state.equipment?.fres;
    $("#eqStrokasse").checked = !!state.equipment?.strokasse;
    $("#hanske").checked      = !!state.hanske;
    renderSummary();
    renderProgress();
  }
  function renderProgress(){
    const stops = state.stops||[];
    const done = stops.filter(x=>x.status==="ferdig").length;
    const pct = stops.length? Math.round(done*100/stops.length):0;
    $("#homeProgress").style.width = pct + "%";
    $("#homeProgressTxt").textContent = `${pct}% fullført (${done}/${stops.length})`;
  }
  function renderSummary(){
    const e=state.equipment||{};
    const txt = `Valgt utstyr: ${e.skjaer?"Skjær":""}${e.fres?", Fres":""}${e.strokasse?", Strøkasse":""} — Retning: ${state.direction==="reverse"?"Motsatt":"Vanlig"}`;
    $("#homeSummary").textContent = txt;
  }

  function persist(){
    state.customName = $("#homeName").value.trim();
    state.direction  = $("#homeDir").value;
    state.equipment = {
      skjaer: $("#eqSkjaer").checked,
      fres: $("#eqFres").checked,
      strokasse: $("#eqStrokasse").checked
    };
    state.hanske = $("#hanske").checked;
    save(); renderSummary();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    syncFromState();
    $("#homeStart").onclick = ()=>{ persist(); startNewRound(); alert("Ny runde startet ✅"); renderProgress(); };
    $("#homeReset").onclick = ()=>{ if(confirm("Nullstille runde?")){ (state.stops||[]).forEach(s=>{s.startAt=s.endAt=null; s.status="ny"}); save(); renderProgress(); } };
    $("#homeSync").onclick  = ()=>{ persist(); alert("Synk OK (lokal drift)"); };
    ["homeName","homeDir","eqSkjaer","eqFres","eqStrokasse","hanske"].forEach(id=>{
      const el=$(id); if(el) el.addEventListener("change", persist);
    });
  });
})();