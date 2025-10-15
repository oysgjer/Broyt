/* ===== del-E.js (Work UI – avansert med start/slutt + utstyr + sjåfør) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del E."); return; }
  const Core = window.Core;
  const $ = Core.$;

  // --- helpers ---
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

  // --- markeringer ---
  function markOngoing(){
    const c = curStop(); if(!c) return;
    c.started = c.started || Date.now();
    c.driver = Core.displayName();
    Core.save(); render();
  }
  function markDone(){
    const c = curStop(); if(!c) return;

    // registrer sluttid
    c.f = true;
    c.finished = Date.now();
    if (!c.started) c.started = c.finished;
    c.driver = Core.displayName();

    Core.save();
    nextOnly();
  }
  function markBlocked(){
    const c = curStop(); if(!c) return;
    const note = prompt("Hvorfor ikke mulig?","") || "";
    c.details = note;
    c.b = true;
    c.driver = Core.displayName();
    c.finished = Date.now();
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
    } else render();
  }

  // --- vis utstyrstekst ---
  function equipmentString(){
    const eq = Core.state.equipment || {};
    const parts = [];
    if (eq.plog) parts.push("Plog");
    if (eq.fres) parts.push("Fres");
    if (eq.stro) parts.push("Strø");
    return parts.length ? parts.join(" + ") : "Ingen valgt";
  }

  // --- render ---
  function render(){
    const host = $("workList"); if(!host) return;

    if (!(Core.state.stops||[]).length){
      host.innerHTML = `<div class="muted">Ingen adresser enda. Hent katalog i Admin-fanen.</div>`;
      return;
    }

    const c = curStop();
    const n = nxtStop();
    const p = progress();
    const drv = Core.displayName();

    // format tid
    const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString("no-NO",{hour:"2-digit",minute:"2-digit"}) : "—";

    host.innerHTML = `
      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:14px;margin:10px 0;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <span class="badge">Sjåfør: ${Core.esc(drv)}</span>
          <span class="badge">Utstyr: ${Core.esc(equipmentString())}</span>
          <span class="badge">Retning: ${Core.state.direction==="reverse"?"Baklengs":"Vanlig"}</span>
        </div>

        <h2 style="margin:10px 0 4px 0">${c?Core.esc(c.n):"—"}</h2>
        <div class="muted">Oppgave: ${c?Core.esc(c.t):"—"}</div>
        <div class="muted">Startet: ${fmt(c?.started)} — Ferdig: ${fmt(c?.finished)}</div>

        <div class="muted" style="margin-top:4px">Neste: ${n?Core.esc(n.n):"—"}</div>

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
          <button id="btnNext" class="btn-gray">🔁 Neste</button>
        </div>

        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="btnPhoto"class="btn-gray">📷 Foto</button>
          <button id="btnPins" class="btn-gray">📍 Brøytestikker</button>
          <button id="btnInc"  class="btn-red">❗ Uhell</button>
        </div>

        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button id="btnBase" class="btn-purple">🏠 Kjør til base</button>
          <button id="btnGrus" class="btn-blue">🪨 Fyll grus</button>
          <button id="btnFuel" class="btn-blue">⛽ Fyll drivstoff</button>
        </div>

        <div id="thumbs" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
    `;

    // wire opp knapper
    $("#btnOn").onclick = markOngoing;
    $("#btnOk").onclick = markDone;
    $("#btnBlock").onclick = markBlocked;
    $("#btnNext").onclick = nextOnly;

    $("#btnPhoto").onclick = ()=>$("#workFile")?.click();
    $("#btnPins").onclick  = ()=>alert("Brøytestikker funksjon – under arbeid");
    $("#btnInc").onclick   = ()=>alert("Uhell logges senere");
    $("#btnBase").onclick  = ()=>location.href="https://www.google.com/maps/search/?api=1&query=Hagavegen 8, 2072 Dal";
    $("#btnGrus").onclick  = ()=>location.href="https://www.google.com/maps/search/?api=1&query=Dal pukkverk";
    $("#btnFuel").onclick  = ()=>location.href="https://www.google.com/maps/search/?api=1&query=avgiftsfri diesel Dal";

    // thumbnails
    const thumbs = $("#thumbs");
    if (thumbs && c?.p?.length){
      thumbs.innerHTML = c.p.map(src=>`<img src="${src}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #2a2f36">`).join("");
    }
  }

  // fileinput
  function ensureHiddenFile(){
    if (!$("#workFile")){
      const inp = document.createElement("input");
      inp.type="file"; inp.id="workFile"; inp.accept="image/*"; inp.style.display="none";
      inp.addEventListener("change",e=>addPhoto(e.target.files?.[0]));
      document.body.appendChild(inp);
    }
  }
  function addPhoto(file){
    const c = curStop(); if(!c||!file)return;
    const r = new FileReader();
    r.onload = ()=>{(c.p ||= []).push(r.result);Core.save();render();};
    r.readAsDataURL(file);
  }

  document.addEventListener("DOMContentLoaded", ()=>{ensureHiddenFile();render();});
  window.WorkUI = { render };
  console.log("del-E.js (v9.11-advanced) lastet");
})();