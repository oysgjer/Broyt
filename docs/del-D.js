/* ===== del-D.js (UNDER ARBEID) ===== */
(()=>{
  const { $, qsa, getCatalog, state, save, cloneRoundFromCatalog, fmtTime, cfg } = window.Core;

  function progressPct(){
    const s = state.stops||[];
    if (!s.length) return 0;
    const done = s.filter(x=>x.status==="ferdig").length;
    return Math.round(done*100/s.length);
  }

  function renderHeader(){
    $("#workRole").textContent = state.customName || state.role || "Sjåfør";
    $("#workDir").textContent  = state.direction==="reverse" ? "Motsatt" : "Vanlig";
    $("#workBar").style.width  = progressPct()+"%";
  }

  function renderList(){
    const box = $("#workList");
    box.innerHTML = "";
    (state.stops||[]).forEach((st,idx)=>{
      const wrap = document.createElement("div");
      wrap.className="card";
      const head = document.createElement("div");
      head.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <div>
            <div style="font-weight:700">${st.n}</div>
            <div class="muted" style="font-size:12px">${st.t||""}</div>
            <div class="muted" style="font-size:12px">
              Status: ${st.status==="ferdig"?"Ferdig":"Ny"} ${
                st.startAt?` • Startet kl ${fmtTime(st.startAt)}`:""
              } ${st.endAt?` • Ferdig kl ${fmtTime(st.endAt)}`:""}
            </div>
          </div>
          <span class="pill">${idx+1}/${state.stops.length}</span>
      </div>`;
      const btns = document.createElement("div");
      btns.className="row";
      const bStart = mk("Start","gray",()=>{ if(!st.startAt){ st.startAt=Date.now(); st.status="gar"; save(); refresh(); } });
      const bDone  = mk("Ferdig","green",()=>{ if(!st.startAt) st.startAt=Date.now(); st.endAt=Date.now(); st.status="ferdig"; save(); refresh(); });
      const bCant  = mk("Ikke mulig","red",()=>{ st.status="umulig"; st.endAt=Date.now(); save(); refresh(); });
      const bPins  = mk("Brøytestikker","gray",()=>alert("Notat: brøytestikker – (lokal funksjon)"));
      const bNext  = mk("Neste","blue",()=>{ state.ui.cursor = Math.min(state.stops.length-1, idx+1); scrollIntoView(state.ui.cursor); save(); });
      btns.append(bStart,bDone,bCant,bPins,bNext);
      wrap.append(head,btns);
      box.append(wrap);
    });
  }

  function mk(txt,cls,fn){ const b=document.createElement("button"); b.className=`btn ${cls}`; b.textContent=txt; b.onclick=fn; return b; }
  function scrollIntoView(i){ const cards=qsa("#workList .card"); if(cards[i]) cards[i].scrollIntoView({behavior:"smooth",block:"center"}); }
  function refresh(){ renderHeader(); renderList(); $("#workBar").style.width=progressPct()+"%"; }

  // Expose til Home
  window.Core.startNewRound = ()=>{
    if (!window.confirm("Starte ny runde? Alle statuser nullstilles.")) return;
    cloneRoundFromCatalog();
    refresh();
  };

  document.addEventListener("DOMContentLoaded", ()=>{
    // hvis ingen stopp i state → hent fra katalog
    if (!Array.isArray(state.stops) || state.stops.length===0) cloneRoundFromCatalog();
    refresh();
  });
})();