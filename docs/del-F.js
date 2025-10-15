/* ===== del-F.js (Hjem: førstegangsnavn + utstyr/retning + start) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del F."); return; }
  const Core = window.Core;
  const $    = Core.$;

  function renderHome(){
    const host = document.getElementById("home");
    if (!host) return;

    const S = Core.state;
    const eq = S.equipment || {};

    host.innerHTML = `
      <h2>Velkommen til Brøyterute</h2>
      <p>Versjon ${Core.esc(Core.cfg.VERSION)} – Romerike Trefelling</p>

      <div class="card" style="background:#181a1e;border:1px solid #2a2f36;border-radius:14px;padding:14px;margin:12px 0;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <label class="badge">Sjåfør</label>
          <input id="homeName" type="text" placeholder="Navn" value="${Core.esc(S.customName||"")}"
                 style="min-width:200px;background:transparent;color:#fff;border:1px solid #2a2f36;border-radius:10px;padding:8px">
          <label class="small" style="display:flex;gap:6px;align-items:center">
            <input id="homeUseName" type="checkbox" ${S.useCustomName?'checked':''}>
            Bruk eget navn
          </label>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0">
          <label>Retning</label>
          <select id="homeDir" style="background:transparent;color:#fff;border:1px solid #2a2f36;border-radius:10px;padding:8px">
            <option value="forward" ${S.direction!=="reverse"?'selected':''}>Vanlig</option>
            <option value="reverse" ${S.direction==="reverse"?'selected':''}>Baklengs</option>
          </select>
        </div>

        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0">
          <label style="display:flex;gap:6px;align-items:center">
            <input id="eq_plog" type="checkbox" ${eq.plog?'checked':''}> Plog
          </label>
          <label style="display:flex;gap:6px;align-items:center">
            <input id="eq_fres" type="checkbox" ${eq.fres?'checked':''}> Fres
          </label>
          <label style="display:flex;gap:6px;align-items:center">
            <input id="eq_stro" type="checkbox" ${eq.stro?'checked':''}> Strø
          </label>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          <button id="startBtn" class="btn-green" style="border:none;border-radius:10px;padding:10px 14px;font-weight:700">Start runde</button>
          <button id="resetBtn" class="btn-red" style="border:none;border-radius:10px;padding:10px 14px;font-weight:700">Nullstill alle</button>
        </div>
      </div>
    `;

    // Handlers
    $("#homeName").addEventListener("input", e=>{
      Core.state.customName = e.target.value.trim();
      Core.save();
    });
    $("#homeUseName").addEventListener("change", e=>{
      Core.state.useCustomName = !!e.target.checked;
      Core.save();
    });
    $("#homeDir").addEventListener("change", e=>{
      Core.state.direction = e.target.value;
      Core.state.ui = Core.state.ui || {};
      Core.state.ui.cursor = 0;                  // hopp til start når retning endres
      Core.save();
      window.WorkUI?.render?.();
    });
    $("#eq_plog").addEventListener("change", e=>{
      Core.state.equipment.plog = !!e.target.checked; Core.save();
    });
    $("#eq_fres").addEventListener("change", e=>{
      Core.state.equipment.fres = !!e.target.checked; Core.save();
    });
    $("#eq_stro").addEventListener("change", e=>{
      Core.state.equipment.stro = !!e.target.checked; Core.save();
    });

    $("#startBtn").addEventListener("click", ()=>{
      // Gå til Under arbeid + render
      document.querySelector('nav button[onclick="show(\'work\')"]')?.click();
      window.WorkUI?.render?.();
    });

    $("#resetBtn").addEventListener("click", ()=>{
      if (!confirm("Nullstille status for ALLE adresser?")) return;
      (Core.state.stops||[]).forEach(s=>{
        s.f=false; s.b=false; s.started=null; s.finished=null; s.details="";
      });
      Core.state.ui = Core.state.ui || {};
      Core.state.ui.cursor = 0;
      Core.save();
      window.WorkUI?.render?.();
      alert("Alle adresser nullstilt.");
    });
  }

  // Førstegang: be om navn (en gang) hvis tomt
  function firstRunNamePrompt(){
    const S = Core.state;
    if (!S.useCustomName || !S.customName){
      const v = prompt("Skriv sjåførnavn (du kan endre senere på Hjem):", S.customName||"");
      if (v !== null){
        S.customName = (v||"").trim();
        S.useCustomName = !!S.customName;
        Core.save();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    firstRunNamePrompt();
    renderHome();
  });

  // eksporter om vi trenger å rerendere fra andre deler
  window.HomeUI = { render: renderHome };
  console.log("del-F.js lastet (Hjem med navn + utstyr + retning)");
})();