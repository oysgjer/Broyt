// docs/js/Work.js
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const S = {
    driver: "",
    taskKind: "snow", // "snow" | "grit"
    autoNav: false,
    direction: "Normal"
  };

  function loadSession() {
    try {
      const raw = localStorage.getItem("BRYT_SESSION") || "{}";
      const j = JSON.parse(raw);
      Object.assign(S, j);
    } catch {}
  }
  function saveSession() {
    localStorage.setItem("BRYT_SESSION", JSON.stringify(S));
  }

  function addresses()  { return window.Sync?.getAddresses() || []; }
  function statusMap()  { return window.Sync?.getStatusMap() || {}; }

  function idFor(a, idx) {
    return a.id ?? a.ID ?? a.Id ?? a.name ?? String(a.index ?? idx);
  }

  function translateState(s) {
    switch ((s||"").toLowerCase()) {
      case "venter": return "Venter";
      case "pågår": return "Pågår";
      case "ferdig": return "Ferdig";
      case "hoppet": 
      case "hoppet over": return "Hoppet over";
      case "ikkemulig":
      case "ikke mulig": return "Ikke mulig";
      default: return "—";
    }
  }

  function describeTask() {
    return S.taskKind === "grit" ? "Strø grus" : "Fjerne snø";
  }

  function computeNowNext() {
    const arr = addresses();
    const map = statusMap();
    if (!arr.length) return { now: null, next: null, total: 0 };

    // Finn første som ikke er "ferdig"
    let idxNow = arr.findIndex((a, i) => {
      const st = map[idFor(a, i)];
      return !st || (st.state !== "ferdig");
    });
    if (idxNow < 0) idxNow = arr.length; // alt ferdig

    const now  = arr[idxNow] || null;
    const next = arr[idxNow + 1] || null;

    return { now, next, total: arr.length };
  }

  function updateProgressBars() {
    const arr = addresses();
    const map = statusMap();
    const total = arr.length || 1;

    let me = 0, other = 0;
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i], id = idFor(a, i);
      const st = map[id];
      if (!st) continue;
      if (st.state === "ferdig") {
        if (st.driver && st.driver === S.driver) me++; else other++;
      }
    }
    const mePct = Math.round(100*me/total);
    const otPct = Math.round(100*other/total);

    const bm = $("#b_prog_me"), bo = $("#b_prog_other");
    if (bm) bm.style.width = mePct + "%";
    if (bo) bo.style.width = otPct + "%";

    $("#b_prog_me_count")    && ($("#b_prog_me_count").textContent = `${me}/${total}`);
    $("#b_prog_other_count") && ($("#b_prog_other_count").textContent = `${other}/${total}`);
    $("#b_prog_summary")     && ($("#b_prog_summary").textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  function renderWork() {
    const sec = $("#work");
    if (!sec || sec.hasAttribute("hidden")) return;

    const { now, next } = computeNowNext();

    $("#b_now")  && ($("#b_now").textContent  = now  ? (now.name || now.adresse || now.Address || JSON.stringify(now)) : "—");
    $("#b_next") && ($("#b_next").textContent = next ? (next.name || next.adresse || next.Address || JSON.stringify(next)) : "—");

    $("#b_task")   && ($("#b_task").textContent   = describeTask());
    $("#b_status") && ($("#b_status").textContent = now ? translateState(statusMap()[idFor(now, 0)]?.state) : "—");

    updateProgressBars();
  }

  async function setState(addr, newState) {
    if (!addr) return;
    const id = idFor(addr, 0);
    const payload = {
      state: newState,
      driver: S.driver || ""
    };
    await window.Sync.setStatus(id, payload);
  }

  function navTo(lat, lon, text) {
    const base = "https://www.google.com/maps/dir/?api=1";
    const dest = lat && lon ? `${lat},${lon}` : encodeURIComponent(text || "");
    const url = `${base}&destination=${dest}`;
    window.open(url, "_blank");
  }

  function wireWorkButtons() {
    $("#act_start")?.addEventListener("click", async () => {
      const { now } = computeNowNext();
      if (!now) return;
      await setState(now, "pågår");
      renderWork();
    });

    $("#act_done")?.addEventListener("click", async () => {
      const { now, next, total } = computeNowNext();
      if (!now) return;
      await setState(now, "ferdig");
      renderWork();

      // Sjekk om alt ferdig
      const arr = addresses(); const map = statusMap();
      const left = arr.find(a => (map[idFor(a,0)]?.state !== "ferdig"));
      if (!left && total > 0) {
        // Spør hva vi gjør videre
        const choice = window.prompt("Runden er ferdig. Velg: 'snø' = ny runde (snø), 'grus' = ny runde med grus, 'ferdig' = gå til service.", "ferdig");
        if (!choice) return;
        if (choice.toLowerCase().startsWith("sn")) {
          S.taskKind = "snow"; saveSession();
          location.hash = "#work";
        } else if (choice.toLowerCase().startsWith("gr")) {
          S.taskKind = "grit"; saveSession();
          location.hash = "#work";
        } else {
          location.hash = "#service";
        }
      }
    });

    $("#act_skip")?.addEventListener("click", async () => {
      const { now } = computeNowNext(); if (!now) return;
      await setState(now, "hoppet over");
      renderWork();
    });

    $("#act_next")?.addEventListener("click", () => {
      // UI-messig “neste” = gjør ingenting i status, bare hopp i visning.
      // Vi markerer ikke “hoppet”, da det er egen knapp.
      // Trigges ved at vi midlertidig setter en markør i session
      const arr = addresses();
      const map = statusMap();
      const idx = arr.findIndex((a, i) => !map[idFor(a,i)] || map[idFor(a,i)].state !== "ferdig");
      if (idx >= 0 && idx + 1 < arr.length) {
        // midlertidig: sett “venter” på nå, og “pågår” på neste? vi lar bare rendering gå på polling
        renderWork();
      }
    });

    $("#act_nav")?.addEventListener("click", () => {
      const { now } = computeNowNext(); if (!now) return;
      const lat = now.lat ?? now.latitude, lon = now.lon ?? now.longitude;
      navTo(lat, lon, now.name || now.adresse || "");
    });

    $("#act_block")?.addEventListener("click", async () => {
      const { now } = computeNowNext(); if (!now) return;
      const why = prompt("Hvorfor er det ikke mulig?", "");
      await setState(now, "ikke mulig");
      // (Evt. legg på kommentar/why i status senere)
      renderWork();
    });
  }

  function wireQuickShortcuts() {
    function mapsFromKey(k) {
      try {
        const cfg = window.Sync?.readCfg() || JSON.parse(localStorage.getItem("BRYT_SETTINGS")||"{}");
        const val = (cfg && cfg[k]) || "";
        if (!val) return null;
        // "60.xxxxx,11.xxxxx"
        const [lat, lon] = String(val).split(",").map(s => s.trim());
        return { lat, lon };
      } catch { return null; }
    }
    $("#qk_grus")?.addEventListener("click", () => {
      const p = mapsFromKey("grus"); if (p) navTo(p.lat, p.lon); else navTo(null, null, "Grus");
    });
    $("#qk_diesel")?.addEventListener("click", () => {
      const p = mapsFromKey("diesel"); if (p) navTo(p.lat, p.lon); else navTo(null, null, "Diesel");
    });
    $("#qk_base")?.addEventListener("click", () => {
      const p = mapsFromKey("base"); if (p) navTo(p.lat, p.lon); else navTo(null, null, "Base");
    });
  }

  function onSyncUpdate() { renderWork(); }

  function init() {
    loadSession();
    wireWorkButtons();
    wireQuickShortcuts();
    renderWork();
    window.Sync?.on(onSyncUpdate);
    // Oppdater hvis vi kommer inn hit etter “Start runde”
    window.addEventListener("hashchange", renderWork);
  }

  document.addEventListener("DOMContentLoaded", init);
})();