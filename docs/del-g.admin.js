/* === Del G: Admin (statistikk, filter, knapper) ======================= */
(function () {
  const H  = window.BroyteHelpers;
  const SY = window.BroyteSync || {};   // fra Del D (sync/inbox osv)

  if (!H) { console.error("Del C må lastes før Del G."); return; }

  const { $, esc, save, loadState, seasonKey, fmtTime } = H;

  function hasPinsThisSeason(s){
    return !!(s && s.pinsLockedYear && String(s.pinsLockedYear) === seasonKey());
  }

  /* ----------------- RENDER ----------------- */
  function renderAdmin(){
    const st = loadState();
    const af = st.ui?.adminPinFilter || "all";

    // Marker aktivt filter
    document.querySelectorAll("#pinFiltersAdmin .btn").forEach(b=>{
      b.classList.toggle("btn-green", b.dataset.pfa === af);
    });

    // Filtrér rader
    let rows = (st.stops || []).slice();
    if (af === "pending") rows = rows.filter(s=>!hasPinsThisSeason(s));
    if (af === "done")    rows = rows.filter(hasPinsThisSeason);

    // Stats
    const total   = st.stops.length;
    const cleared = st.stops.filter(s=>s.f || s.b).length;
    const pct     = total ? Math.round(100 * cleared / total) : 0;
    const pend    = st.stops.filter(s=>!hasPinsThisSeason(s)).length;
    const done    = total - pend;

    $("#adminStats") && ($("#adminStats").textContent = `Totalt ${total} – ${pct}% fullført`);

    const infoA = $("#pinFilterInfoAdmin");
    if (infoA){
      infoA.textContent =
        af==="all"     ? `Alle: ${total}` :
        af==="pending" ? `Uten brøytestikker i år: ${pend}` :
                         `Med brøytestikker i år: ${done}`;
    }

    // Liste
    const host = $("#adminList");
    if (host){
      host.innerHTML = rows.map(s=>`
        <div class="item" style="padding:8px 0;border-bottom:1px solid var(--cardBorder)">
          <b>${esc(s.n)}</b>
          ${s.twoDriverRec?`<span class="badge">👥</span>`:""}
          ${s.pinsLockedYear?`<span class="badge">📍${s.pinsCount ?? 0}</span>`:""}
          <br><span class="muted">${esc(s.t)}</span>
        </div>
      `).join("");
    }

    // Sist synk under admin-knappen (om felt finnes)
    const lbl = $("#adminSyncTxt");
    if (lbl){
      lbl.textContent = `Sist synk: ${fmtTime(st.lastSyncAt)} (${st.lastSyncBy || "—"})`;
    }
  }

  /* ----------------- HANDLERS ----------------- */
  function onAdminSync(){
    // Prøv å hente status (pull), deretter render + vis tid/bruker
    const doRender = ()=> { try{ renderAdmin(); }catch(_){} };
    if (typeof SY.syncPull === "function"){
      SY.syncPull().then(doRender).catch(doRender);
    } else {
      doRender();
    }
  }

  function onAdminInbox(){
    if (typeof SY.loadInbox === "function"){
      SY.loadInbox();
    } else {
      const lbl = $("#adminInboxTxt");
      if (lbl) lbl.textContent = "INBOX ikke tilgjengelig (mangler Del D).";
    }
  }

  // Katalog-knapper (delegerer til Del H hvis/ når den finnes)
  function onCatLoad(){  (window.loadCatalog && window.loadCatalog()) || msgNotReady(); }
  function onCatAdd(){   (window.editCatalogRow && window.editCatalogRow()) || msgNotReady(); }
  function onCatSave(){  (window.saveCatalogWithBackup && window.saveCatalogWithBackup()) || msgNotReady(); }
  function onCatPublish(){ (window.publishCatalogToMaster && window.publishCatalogToMaster()) || msgNotReady(); }
  function onCatExport(){ (window.exportCatalogCsv && window.exportCatalogCsv()) || msgNotReady(); }
  function onCatRestore(){
    if (window.restoreCatalogFromBackup) window.restoreCatalogFromBackup();
    else msgNotReady();
  }
  function msgNotReady(){
    const m = $("#catMsg");
    if (m) m.textContent = "Katalog-editor kommer i neste del. (Knappen er ikke aktiv enda.)";
    else alert("Katalog-editor kommer i neste del. (Knappen er ikke aktiv enda.)");
  }

  function wireAdminUI(){
    // Hovedknapper
    $("#adminSync")    && ($("#adminSync").onclick    = onAdminSync);
    $("#adminInbox")   && ($("#adminInbox").onclick   = onAdminInbox);

    // Katalog-knapper
    $("#catLoad")      && ($("#catLoad").onclick      = onCatLoad);
    $("#catAdd")       && ($("#catAdd").onclick       = onCatAdd);
    $("#catSave")      && ($("#catSave").onclick      = onCatSave);
    $("#catPublish")   && ($("#catPublish").onclick   = onCatPublish);
    $("#catExportCsv") && ($("#catExportCsv").onclick = onCatExport);
    $("#catRestore")   && ($("#catRestore").onclick   = onCatRestore);

    // Filter-knapper
    document.querySelectorAll("#pinFiltersAdmin .btn").forEach(btn=>{
      btn.onclick = ()=>{
        const st = loadState();
        st.ui = st.ui || {};
        st.ui.adminPinFilter = btn.dataset.pfa || "all";
        save();
        renderAdmin();
      };
    });

    // Første render
    renderAdmin();
  }

  document.addEventListener("DOMContentLoaded", wireAdminUI);

  // Eksponér for tab-bytt (Del C forventer BroyteWork.renderAdmin)
  window.BroyteWork = Object.assign(window.BroyteWork || {}, { renderAdmin });

})();