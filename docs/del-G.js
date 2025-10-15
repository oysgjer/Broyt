/* ===== del-G.js (Service / ferdig-eksport) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del G."); return; }
  const Core = window.Core;
  const { $, qs } = Core;

  // Enkel DOM-builder for Service-fanen
  function renderService() {
    const host = $("servicePane");
    if (!host) return;
    const S = Core.state.service || {};

    host.innerHTML = `
      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:16px;padding:16px;margin:10px 0;">
        <h3>Service og vedlikehold</h3>
        <p class="muted">Velg hva som er utført etter runden:</p>

        <label><input type="checkbox" id="svc_plog" ${S.plog?"checked":""}/> Puss av plog</label><br>
        <label><input type="checkbox" id="svc_fres" ${S.fres?"checked":""}/> Rens fres</label><br>
        <label><input type="checkbox" id="svc_stro" ${S.stro?"checked":""}/> Etterfyll strø</label><br>
        <label><input type="checkbox" id="svc_oilFront" ${S.oilFront?"checked":""}/> Smurt front</label><br>
        <label><input type="checkbox" id="svc_oilBack" ${S.oilBack?"checked":""}/> Smurt bak</label><br>
        <label><input type="checkbox" id="svc_steering" ${S.steering?"checked":""}/> Kontrollert styring</label><br>
        <label><input type="checkbox" id="svc_other" ${S.other?"checked":""}/> Annet utført</label><br>

        <textarea id="svc_notes" placeholder="Notater..." style="width:100%;height:80px;margin-top:8px;">${S.notes||""}</textarea>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnSaveService" style="background:#22c55e;color:#fff;border:none;border-radius:10px;padding:8px 12px">💾 Lagre service</button>
          <button id="btnExportRound" style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:8px 12px">📦 Fullfør runde (ZIP)</button>
        </div>
      </div>
    `;

    $("btnSaveService").onclick = saveService;
    $("btnExportRound").onclick = exportRound;
  }

  // Lagre servicefelt til state
  function saveService() {
    const svc = Core.state.service = {
      plog: $("#svc_plog").checked,
      fres: $("#svc_fres").checked,
      stro: $("#svc_stro").checked,
      oilFront: $("#svc_oilFront").checked,
      oilBack: $("#svc_oilBack").checked,
      steering: $("#svc_steering").checked,
      other: $("#svc_other").checked,
      notes: $("#svc_notes").value.trim()
    };
    Core.save();
    alert("Service lagret ✅");
  }

  // Eksporter runde (foreløpig: last ned som JSON, senere ZIP+mail)
  function exportRound() {
    saveService();
    const roundNum = (Core.state.dayLog?.round || 1);
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
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `broeyting_dokumentasjon_runde${roundNum}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("Runde eksportert til JSON (ZIP/mail kommer i neste steg)");
  }

  // Knytt til Under arbeid: når siste er ferdig, hopp til Service
  Core.goServiceAfterDone = () => {
    const remaining = (Core.state.stops||[]).filter(s=>!s.f && !s.b).length;
    if (remaining===0) {
      if (typeof window.show === "function") window.show("service");
      renderService();
    }
  };

  document.addEventListener("DOMContentLoaded", renderService);
  console.log("del-G.js (service) lastet");
})();