/* === Del F: Adresse-register (Register-fanen) ========================= */
(function () {
  const H  = window.BroyteHelpers;
  const SY = window.BroyteSync || {};

  if (!H) { console.error("Del C må lastes før Del F."); return; }

  const { $, save, seasonKey } = H;

  // Lokal helper – sørger for at "brøytestikker" alltid er med i oppgaven
  function normalizeTask(t){
    t = String(t || "").trim();
    return /brøytestikker/i.test(t) ? t : (t ? `${t} + brøytestikker` : "Snø + brøytestikker");
  }
  function hasPinsThisSeason(s){
    return !!(s && s.pinsLockedYear && String(s.pinsLockedYear) === seasonKey());
  }

  /* ---------------- RENDER ---------------- */
  function renderRegister(){
    const st = H.loadState();
    const pf = st.ui?.pinFilter || "all";

    // Marker aktivt filter
    document.querySelectorAll("#pinFilters .btn").forEach(b=>{
      b.classList.toggle("btn-green", b.dataset.pf === pf);
    });

    // Filtrer
    let rows = (st.stops || []).slice();
    if (pf === "pending") rows = rows.filter(s => !hasPinsThisSeason(s));
    if (pf === "done")    rows = rows.filter(hasPinsThisSeason);

    // Tellekanter
    const all  = st.stops.length;
    const pend = st.stops.filter(s=>!hasPinsThisSeason(s)).length;
    const done = all - pend;

    const infoEl = $("#pinFilterInfo");
    if (infoEl){
      infoEl.textContent =
        pf==="all"     ? `Alle: ${all}` :
        pf==="pending" ? `Uten brøytestikker i år: ${pend}` :
                         `Med brøytestikker i år: ${done}`;
    }

    // Render liste
    const host = $("#list");
    if (host){
      host.innerHTML = rows.map(s=>`
        <div class="item" style="padding:8px 0;border-bottom:1px solid var(--cardBorder)">
          <b>${H.esc(s.n)}</b>
          ${s.twoDriverRec?`<span class="badge">👥 2 sjåfører</span>`:""}
          ${s.pinsLockedYear?`<span class="badge">📍${s.pinsCount ?? 0}</span>`:""}
          <br><span class="muted">${H.esc(s.t)}</span> ${s.f?"✅":""}${s.b?"⛔":""}
        </div>
      `).join("");
    }
  }

  /* ---------------- HANDLERS ---------------- */
  async function onCatalogPull(){
    // delegér til Del D hvis tilgjengelig
    if (typeof SY.catalogPull === "function") {
      try { await SY.catalogPull(); } catch(_) {}
    }
    renderRegister();
  }

  async function onPropose(){
    const name = prompt("Navn (adresse/område):");
    if (!name) return;
    const task = (prompt("Oppgave:", (window.BROYTE_CFG?.DEFAULT_TASKS?.[0]||"Snø + brøytestikker")) ||
                 (window.BROYTE_CFG?.DEFAULT_TASKS?.[0]||"Snø + brøytestikker"));
    if (typeof SY.sendProposal === "function"){
      try { await SY.sendProposal({type:"add", name, task, group:""}); } catch(_){}
    } else {
      alert("Forslag-funksjon ikke tilgjengelig.");
    }
  }

  function onAddLocal(){
    const addr = $("#addr")?.value.trim(); if (!addr) return;
    const task = normalizeTask($("#taskSel")?.value || (window.BROYTE_CFG?.DEFAULT_TASKS?.[0]||"Snø + brøytestikker"));
    const twoDriver = $("#twoDriverRec")?.checked || false;

    const st = H.loadState();
    (st.stops ||= []).push({
      n: addr, t: task,
      f:false, b:false, p:[],
      started:null, finished:null, details:"",
      twoDriverRec: twoDriver,
      pinsCount: 0, pinsLockedYear: null
    });
    save();

    // rydd felter
    if ($("#addr")) $("#addr").value = "";
    if ($("#twoDriverRec")) $("#twoDriverRec").checked = false;

    renderRegister();
    // synk om mulig
    if (typeof SY.syncNow === "function") SY.syncNow();
    else if (typeof SY.syncPush === "function") SY.syncPush();
  }

  function onAddrEnter(e){
    if (e.key === "Enter"){
      e.preventDefault();
      onAddLocal();
    }
  }

  function wireRegisterUI(){
    // Knapper
    $("#btnCatalogPull") && ($("#btnCatalogPull").onclick = onCatalogPull);
    $("#btnPropose")     && ($("#btnPropose").onclick     = onPropose);
    $("#add")           && ($("#add").onclick             = onAddLocal);

    // Enter for raskt legg-til
    $("#addr") && ($("#addr").addEventListener("keydown", onAddrEnter));

    // Filterknapper
    document.querySelectorAll("#pinFilters .btn").forEach(btn=>{
      btn.onclick = ()=>{
        const st = H.loadState();
        st.ui = st.ui || {};
        st.ui.pinFilter = btn.dataset.pf || "all";
        save();
        renderRegister();
      };
    });

    // Fyll oppgave-select (hvis ikke Del C allerede gjorde det)
    const sel = $("#taskSel");
    if (sel && !sel.options.length) {
      const T = window.BROYTE_CFG?.DEFAULT_TASKS || ["Snø + brøytestikker","Snø og grus + brøytestikker"];
      sel.innerHTML = T.map(t=>`<option>${H.esc(t)}</option>`).join("");
    }

    // Første render
    renderRegister();
  }

  document.addEventListener("DOMContentLoaded", wireRegisterUI);

  // Eksponer render for tab-bytt (Del C/F forventer BroyteWork.renderRegister)
  window.BroyteWork = Object.assign(window.BroyteWork || {}, { renderRegister });

})();