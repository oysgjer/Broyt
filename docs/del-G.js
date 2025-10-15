/* ===== del-G.js (Service / ferdig-eksport) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del G."); return; }
  const Core = window.Core;
  const $ = Core.$;

  // Bygg hele service-UI i #servicePane
  function renderService() {
    const host = $("servicePane");
    if (!host) return;

    const S = Core.state.service || {};
    host.innerHTML = `
      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:16px;margin:10px 0;">
        <h2 style="margin:0 0 6px 0">Service</h2>
        <div class="muted" style="margin-bottom:10px">Huk av det som ble gjort etter runden.</div>

        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_fres" ${S.fres?"checked":""}/> Smurt fres
        </label>
        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_plog" ${S.plog?"checked":""}/> Smurt plog
        </label>
        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_steering" ${S.steering?"checked":""}/> Smurt forstilling
        </label>

        <hr style="margin:10px 0;border-color:#333">

        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_oilFront" ${S.oilFront?"checked":""}/> Sjekket olje foran
        </label>
        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_oilBack" ${S.oilBack?"checked":""}/> Sjekket olje bak
        </label>
        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_oilFill" ${S.oilFill?"checked":""}/> Etterfylt olje
        </label>
        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_diesel" ${S.diesel?"checked":""}/> Diesel fylt
        </label>

        <hr style="margin:10px 0;border-color:#333">

        <label style="display:block;margin:4px 0">
          <input type="checkbox" id="svc_other" ${S.other?"checked":""}/> Annet utført
        </label>

        <textarea id="svc_notes" placeholder="Notater …"
          style="width:100%;height:90px;margin-top:8px;background:transparent;color:#fff;border:1px solid #2a2f36;border-radius:10px;padding:8px;">${S.notes||""}</textarea>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnSaveService"
            style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:700">💾 Lagre service</button>
          <button id="btnExportRound"
            style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:700">📦 Fullfør runde (JSON)</button>
        </div>
      </div>
    `;

    $("btnSaveService").onclick = saveService;
    $("btnExportRound").onclick = exportRound;
  }

  // Lagre feltene til state
  function saveService() {
    Core.state.service = {
      fres:       $("#svc_fres").checked,
      plog:       $("#svc_plog").checked,
      steering:   $("#svc_steering").checked,
      oilFront:   $("#svc_oilFront").checked,
      oilBack:    $("#svc_oilBack").checked,
      oilFill:    $("#svc_oilFill").checked,
      diesel:     $("#svc_diesel").checked,
      other:      $("#svc_other").checked,
      notes:      $("#svc_notes").value.trim()
    };
    Core.save();
    alert("Service lagret ✅");
  }

  // Eksporter runden (foreløpig som JSON-fil)
  function exportRound() {
    saveService();
    const data = {
      version: Core.cfg.VERSION,
      season: Core.seasonKey(),
      finishedAt: new Date().toISOString(),
      driver: Core.displayName(),
      service: Core.state.service,
      stops: Core.state.stops,
      lastSyncAt: Core.state.lastSyncAt,
      lastSyncBy: Core.state.lastSyncBy
    };
    const blob = new Blob([JSON.stringify(data,null,2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `broeyting_runde_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("Runde eksportert (JSON). ZIP/e-post kan vi legge på i neste steg.");
  }

  // Når alt er ferdig, gå til Service
  Core.goServiceAfterDone = () => {
    const remaining = (Core.state.stops||[]).filter(s=>!s.f && !s.b).length;
    if (remaining === 0 && typeof window.show === "function") {
      window.show("service");
      renderService();
    }
  };

  document.addEventListener("DOMContentLoaded", renderService);
  console.log("del-G.js (service) lastet");
})();