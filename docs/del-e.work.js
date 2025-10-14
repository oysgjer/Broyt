/* === Del E: Work-fanen (Under arbeid) ================================= */
(function () {
  const H  = window.BroyteHelpers;
  const SY = window.BroyteSync;

  if (!H || !SY) { console.error("Del C og Del D må lastes før Del E."); return; }

  const { $, esc, fmtTime, seasonKey,
          idxList, cur, curIndex, nxt, prog,
          navTo, mapsSearch, save } = H;

  /* ------- RENDER ------- */
  function renderWork(){
    const c = cur(), n = nxt(), p = prog();

    $("#driverLbl")         && ($("#driverLbl").textContent = "Rolle: " + H.displayName());
    $("#directionLbl")      && ($("#directionLbl").textContent = "Retning: " + (H.loadState().direction==="reverse"?"Baklengs":"Vanlig"));

    $("#curName")           && ($("#curName").textContent = c ? esc(c.n) : "—");
    $("#curTask")           && ($("#curTask").textContent = c ? esc(c.t) : "—");
    $("#curNext")           && ($("#curNext").textContent = n ? esc(n.n) : "—");

    const pinTxt = (c && c.pinsLockedYear) ? (c.pinsCount ?? 0) : "—";
    $("#curPins")           && ($("#curPins").textContent = pinTxt);

    // progresjon
    $("#progBar")           && ($("#progBar").style.width = p.pct + "%");
    $("#progTxt")           && ($("#progTxt").textContent = `${p.pct}% fullført (${p.cleared}/${p.total})`);

    // sist synk
    $("#lastSyncTextWork")  && ($("#lastSyncTextWork").textContent = `Sist synk: ${fmtTime(H.loadState().lastSyncAt)} (${H.loadState().lastSyncBy||"—"})`);

    // bilder
    const thumbs = $("#thumbs");
    if (thumbs){
      thumbs.innerHTML = (c?.p||[]).map(src=>`<img src="${src}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;margin-right:6px">`).join("");
    }

    // oppdatér vær
    SY.updateWeather?.();
  }

  /* ------- HANDLERS ------- */
  function ongoHandler(){
    const c = cur(); if(!c) return;
    c.started = c.started || Date.now();
    save(); renderWork(); SY.syncNow?.();
  }

  // Lås brøytestikker for sesongen første gang det registreres på denne adressen
  function pinsPromptIfNeeded(stop){
    if (!stop) return;
    const hasPinsInTask = /brøytestikker/i.test(stop.t || "");
    const alreadyThisSeason = stop.pinsLockedYear && String(stop.pinsLockedYear) === seasonKey();
    if (hasPinsInTask && !alreadyThisSeason){
      const v = prompt("Antall brøytestikker brukt (låses for sesongen):", String(Number.isFinite(stop.pinsCount)?stop.pinsCount:0));
      if (v === null) return false; // avbrutt
      const n = parseInt((v||"0").trim(),10) || 0;
      stop.pinsCount = n;
      stop.pinsLockedYear = seasonKey();
    }
    return true;
  }

  function doneHandler(){
    const c = cur(); if(!c) return;
    if (pinsPromptIfNeeded(c) === false) return;

    c.f = true;
    c.finished = Date.now();
    save(); renderWork(); SY.syncNow?.();

    const nx = nxt();
    if (nx) navTo(nx.n);
  }

  function blockHandler(){
    const c = cur(); if(!c) return;
    const reason = prompt("Hvorfor ikke mulig?", c.details||"") || "";
    c.details = reason;
    c.b = true;
    save(); renderWork(); SY.syncNow?.();
  }

  function nextHandler(){
    const l = idxList();
    const curPos = H.loadState().ui?.cursor ?? 0;
    if (!l.length) return;
    if (curPos < l.length - 1){
      H.loadState().ui = H.loadState().ui || {};
      H.loadState().ui.cursor = curPos + 1;
      save(); renderWork();
      const now = cur();
      if (now) navTo(now.n);
    }else{
      alert("Ingen flere adresser.");
    }
  }

  function incidentHandler(){
    const c = cur();
    const note = prompt(`Uhell ved ${c?.n || "ukjent"}. Kort beskrivelse:`, "");
    if (note != null){
      SY.logAction?.("incident", (c?.n?`${c.n}: `:"") + note);
      alert("Uhell logget.");
    }
  }

  function editPinsHandler(){
    const c = cur(); if(!c) return;
    const locked = c.pinsLockedYear && String(c.pinsLockedYear) === seasonKey();
    if (locked){ alert("Brøytestikker er allerede registrert for inneværende sesong og er låst."); return; }
    const v = prompt("Antall brøytestikker brukt (låses for sesongen):", String(Number.isFinite(c.pinsCount)?c.pinsCount:0));
    if (v === null) return;
    c.pinsCount = parseInt((v||"0").trim(),10) || 0;
    c.pinsLockedYear = seasonKey();
    save(); renderWork(); SY.syncNow?.();
  }

  async function photoHandler(){
    const file = await SY.takePhoto?.();
    if (!file) return;
    const r = new FileReader();
    r.onload = ()=>{ const c = cur(); if(!c) return; (c.p||(c.p=[])).push(r.result); save(); renderWork(); SY.syncNow?.(); };
    r.readAsDataURL(file);
  }

  /* ------- WIRING (én gang) ------- */
  let wired = false;
  function wireWorkUI(){
    if (wired) return; wired = true;

    $("#ongo")    && ($("#ongo").onclick    = ongoHandler);
    $("#done")    && ($("#done").onclick    = doneHandler);
    $("#block")   && ($("#block").onclick   = blockHandler);
    $("#next")    && ($("#next").onclick    = nextHandler);
    $("#incident")&& ($("#incident").onclick= incidentHandler);
    $("#editPins")&& ($("#editPins").onclick= editPinsHandler);

    $("#photo")   && ($("#photo").onclick   = photoHandler);
    $("#nav")     && ($("#nav").onclick     = ()=>{ const c = cur(); if (c) navTo(c.n); });

    // hurtigvalg
    const CFG = window.BROYTE_CFG || {};
    $("#goBase")      && ($("#goBase").onclick      = ()=> navTo(CFG.BASE_ADDR));
    $("#fillGravel")  && ($("#fillGravel").onclick  = ()=> navTo(CFG.GRAVEL_ADDR));
    $("#fillFuel")    && ($("#fillFuel").onclick    = ()=>{
      const ch = prompt("Velg stasjon: 1) Driv Dal  2) Esso Energi Dal  (3: Avbryt)","1");
      if (ch==="1") mapsSearch(CFG.FUEL_CHOICES?.[0]?.q || "avgiftsfri diesel Dal");
      else if (ch==="2") mapsSearch(CFG.FUEL_CHOICES?.[1]?.q || "avgiftsfri diesel Dal");
    });
    $("#cheapestFuel")&& ($("#cheapestFuel").onclick= ()=> mapsSearch("avgiftsfri diesel Dal"));

    // første render nå
    renderWork();
  }

  // Init når DOM er klar
  document.addEventListener("DOMContentLoaded", wireWorkUI);

  // Eksporter API for andre deler (f.eks. Del F som kaller renderWork ved tab-bytt)
  window.BroyteWork = Object.assign(window.BroyteWork || {}, {
    renderWork, nextHandler, doneHandler, blockHandler, incidentHandler
  });
})();