/* ===== del-E.js (Work UI – “v9.10-knapper”) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del E."); return; }
  const Core = window.Core;
  const $ = Core.$;

  // --- små helpers ---
  const idxList = () => {
    const S = Core.state;
    const remaining = (S.stops||[]).map((s,i)=>({i,s})).filter(x=>!x.s.f && !x.s.b).map(x=>x.i);
    return (S.direction==="reverse") ? remaining.slice().reverse() : remaining;
  };
  const curIndex = () => {
    const list = idxList();
    const c = Core.state.ui?.cursor ?? 0;
    if (!list.length) return -1;
    const pos = Math.min(c, list.length - 1);
    return list[pos];
  };
  const curStop = () => {
    const ci = curIndex();
    return ci>=0 ? Core.state.stops[ci] : null;
  };
  const nxtStop = () => {
    const list = idxList();
    const c = Core.state.ui?.cursor ?? 0;
    if (list.length <= c+1) return null;
    return Core.state.stops[list[c+1]];
  };
  const progress = () => {
    const total=(Core.state.stops||[]).length;
    const done = (Core.state.stops||[]).filter(s=>s.f).length;
    const blocked=(Core.state.stops||[]).filter(s=>s.b).length;
    const cleared=done+blocked;
    const pct = total ? Math.round(100*cleared/total) : 0;
    return {total,done,blocked,cleared,pct};
  };
  const seasonLocked = (s) => s?.pinsLockedYear && String(s.pinsLockedYear)===Core.seasonKey();

  // --- actions ---
  function markOngoing(){
    const c = curStop(); if(!c) return;
    c.started = c.started || Date.now();
    Core.save(); render();
  }
  function markDone(){
    const c = curStop(); if(!c) return;

    // Brøytestikker – lås én gang pr sesong
    if (/brøytestikker/i.test(c.t) && !seasonLocked(c)){
      const v = prompt("Antall brøytestikker brukt (låses for sesongen):","");
      if (v===null) return; // avbrutt
      const n = parseInt((v||"").trim()||"0",10) || 0;
      c.pinsCount = n;
      c.pinsLockedYear = Core.seasonKey();
    }

    c.f = true;
    c.finished = Date.now();
    Core.save();

    // hopp automatisk til neste
    nextOnly();
  }
  function markBlocked(){
    const c = curStop(); if(!c) return;
    const note = prompt("Hvorfor ikke mulig?","") || "";
    c.details = note;
    c.b = true;
    Core.save();
    render();
  }
  function nextOnly(){
    const list = idxList();
    const c = Core.state.ui?.cursor ?? 0;
    if (list.length && c < list.length-1){
      Core.state.ui = Core.state.ui || {};
      Core.state.ui.cursor = c+1;
      Core.save();
      render();
    }else{
      render(); // siste – bare re-render
    }
  }
  function editPins(){
    const c = curStop(); if(!c) return;
    if (seasonLocked(c)) { alert("Brøytestikker er allerede registrert for inneværende sesong og er låst."); return; }
    const curVal = Number.isFinite(c.pinsCount) ? c.pinsCount : 0;
    const v = prompt("Antall brøytestikker brukt (låses for sesongen):", String(curVal));
    if (v===null) return;
    const n = parseInt((v||"").trim()||"0",10)||0;
    c.pinsCount = n;
    c.pinsLockedYear = Core.seasonKey();
    Core.save(); render();
  }
  function addPhoto(file){
    const c = curStop(); if(!c || !file) return;
    const r = new FileReader();
    r.onload = () => { (c.p ||= []).push(r.result); Core.save(); render(); };
    r.readAsDataURL(file);
  }
  function incident(){
    const c = curStop();
    const msg = prompt("Uhell – kort beskrivelse:","") || "";
    (Core.state.dayLog.entries ||= []).push({type:"incident", at:Date.now(), stop:c?.n||"?", msg});
    Core.save(); alert("Uhell logget.");
  }
  function navTo(address){
    if(!address) return;
    location.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(address);
  }

  // --- DOM wiring once ---
  function ensureHiddenFile(){
    if (!$("#workFile")){
      const inp = document.createElement("input");
      inp.type = "file";
      inp.id = "workFile";
      inp.accept = "image/*";
      inp.style.display = "none";
      inp.addEventListener("change", (e)=> addPhoto(e.target.files?.[0]));
      document.body.appendChild(inp);
    }
  }

  // --- render ---
  function render(){
    ensureHiddenFile();
    const host = $("workList"); if(!host) return;

    // Tom?
    if (!(Core.state.stops||[]).length){
      host.innerHTML = `<div class="muted">Ingen adresser enda. Hent katalog i Admin-fanen.</div>`;
      return;
    }

    const c = curStop();
    const n = nxtStop();
    const p = progress();

    // top card + buttons
    host.innerHTML = `
      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:14px;margin:10px 0;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="badge" style="border:1px solid #2a2f36;border-radius:999px;padding:2px 8px">Rolle: ${Core.esc(Core.displayName())}</span>
          <span class="badge" style="border:1px solid #2a2f36;border-radius:999px;padding:2px 8px">Retning: ${Core.state.direction==="reverse"?"Baklengs":"Vanlig"}</span>
        </div>

        <h2 style="margin:10px 0 4px 0">${c?Core.esc(c.n):"—"}</h2>
        <div class="muted">Oppgave: ${c?Core.esc(c.t):"—"}</div>
        <div class="muted">Brøytestikker: ${c ? (c.pinsLockedYear ? (c.pinsCount ?? 0) : "—") : "—"}</div>
        <div class="muted">Neste: ${n?Core.esc(n.n):"—"}</div>

        <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
          <div class="muted">${p.pct}% fullført (${p.cleared}/${p.total})</div>
          <div style="flex:1;height:12px;border-radius:999px;background:#242830;border:1px solid #2a2f36;overflow:hidden">
            <div style="height:100%;width:${p.pct}%;background:linear-gradient(90deg,#0f9d58,#22c55e)"></div>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="btnOn"   class="btn-gray">▶️ Pågår</button>
          <button id="btnOk"   class="btn-green">✅ Ferdig</button>
          <button id="btnBlock"class="btn-red">⛔ Ikke mulig</button>
          <button id="btnPhoto"class="btn-gray">📷 Foto</button>
          <button id="btnNav"  class="btn-blue">🧭 Naviger</button>
          <button id="btnNext" class="btn-gray">🔁 Neste</button>
          <button id="btnPins" class="btn-gray">📍 Brøytestikker</button>
          <button id="btnInc"  class="btn-red">❗ Uhell</button>
        </div>

        <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="btnBase" class="btn-purple">🏠 Kjør til base</button>
          <button id="btnGrus" class="btn-blue">🪨 Fyll grus</button>
          <button id="btnFuel" class="btn-blue">⛽ Fyll drivstoff</button>
          <button id="btnCheap" class="btn-gray">💸 Finn billigste (søk)</button>
        </div>

        <div id="thumbs" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
    `;

    // thumbs
    const thumbs = $("#thumbs");
    if (thumbs && c?.p?.length){
      thumbs.innerHTML = c.p.map(src=>`<img src="${src}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #2a2f36">`).join("");
    }

    // wire buttons
    $("#btnOn").onclick    = markOngoing;
    $("#btnOk").onclick    = markDone;
    $("#btnBlock").onclick = markBlocked;
    $("#btnNext").onclick  = nextOnly;
    $("#btnPhoto").onclick = ()=> $("#workFile")?.click();
    $("#btnNav").onclick   = ()=> c && navTo(c.n);
    $("#btnPins").onclick  = editPins;
    $("#btnInc").onclick   = incident;

    $("#btnBase").onclick  = ()=> navTo("Hagavegen 8, 2072 Dal");
    $("#btnGrus").onclick  = ()=> navTo("Dal pukkverk");
    $("#btnFuel").onclick  = ()=>{
      const choice = prompt("Velg stasjon: 1) Driv Dal  2) Esso Energi Dal  3) Avbryt","1");
      if (choice==="1") location.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("Driv Dal avgiftsfri diesel");
      else if (choice==="2") location.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("Esso Energi Dal avgiftsfri diesel");
    };
    $("#btnCheap").onclick = ()=> location.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("avgiftsfri diesel Dal");
  }

  // eksporter en ren render-funksjon så andre kan trigge (Start ny runde etc.)
  window.WorkUI = { render };

  document.addEventListener("DOMContentLoaded", render);
  console.log("del-E.js lastet");
})();