/* ===== del-F.js (Hjem + “Start ny runde”) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del F."); return; }
  const Core = window.Core;
  const $ = Core.$;

  // --- nullstill ALLE stopp (standard) ---
  function resetRoundAll() {
    const S = Core.state;
    if (!Array.isArray(S.stops) || !S.stops.length) return 0;

    let changed = 0;
    S.stops.forEach(s => {
      if (s.f || s.b || s.started || s.finished) {
        s.f = false; s.b = false;
        s.started = null; s.finished = null;
        changed++;
      }
    });
    S.ui = S.ui || {};
    S.ui.cursor = 0;
    Core.save();
    console.log(`Runde nullstilt – ${changed} adresser reset`);
    return changed;
  }

  // --- (valgfritt) nullstill etter utstyr – kan aktiveres senere ---
  function resetRoundByEquipment() {
    const S = Core.state;
    if (!Array.isArray(S.stops) || !S.stops.length) return 0;

    const eq = S.equipment || {plog:true,fres:false,stro:false};
    let changed = 0;
    S.stops.forEach(s => {
      const t = String(s.t || "");
      const needSnow = /Snø/i.test(t);
      const needGrus = /grus/i.test(t);
      const okSnow   = (!needSnow) || eq.plog || eq.fres;
      const okGrus   = (!needGrus) || eq.stro;

      if (okSnow && okGrus) {
        if (s.f || s.b || s.started || s.finished) {
          s.f = false; s.b = false;
          s.started = null; s.finished = null;
          changed++;
        }
      }
    });
    S.ui = S.ui || {};
    S.ui.cursor = 0;
    Core.save();
    console.log(`Runde (etter utstyr) nullstilt – ${changed} adresser reset`);
    return changed;
  }

  // --- naviger til faner (bruker show() fra index.html) ---
  function go(tabId){ try{ window.show && window.show(tabId); }catch(_){} }

  // --- wire Hjem-knappen(e) ---
  function wireHome() {
    const start = $("startBtn");
    if (start) {
      start.onclick = () => {
        // Nullstill ALT som default (enkel og forutsigbar oppførsel)
        resetRoundAll();
        // Gå til “Under arbeid” og vis knappene/lista
        go("work");
        window.WorkUI?.render?.();
      };
    }

    // Om du senere legger inn en egen knapp for “etter utstyr”, kan den peke hit:
    const startEquip = $("startEquipBtn");
    if (startEquip) {
      startEquip.onclick = () => {
        resetRoundByEquipment();
        go("work");
        window.WorkUI?.render?.();
      };
    }
  }

  document.addEventListener("DOMContentLoaded", wireHome);

  // Eksponer litt (kan være nyttig i konsoll/testing)
  window.__StartRound = { resetRoundAll, resetRoundByEquipment };
  console.log("del-F.js lastet");
})();