/* ===== del-D.js (arbeidsvisning og oppgavelogikk) ===== */
(() => {
  if (!window.Core) {
    console.error("Del C må lastes før Del D.");
    return;
  }
  const core = window.Core;

  // --- Hent stops fra JSONBin (tvinger hvis ønsket) ---
  async function ensureStopsLoaded(forceReload = false) {
    const s = core.state;

    if (!forceReload && Array.isArray(s.stops) && s.stops.length > 0) {
      console.log("stops allerede i state:", s.stops.length);
      return;
    }

    console.log("🔄 Laster inn katalog fra JSONBin ...");
    const data = await core.fetchCatalog();               // <- returnerer record
    const rec  = data && data.record ? data.record : data; // støtt begge former
    const addresses = Array.isArray(rec?.addresses) ? rec.addresses : [];

    if (addresses.length) {
      s.stops = addresses.map(a => ({
        n: a.name || a.n || "",
        t: core.normalizeTask(a.task || a.t),
        f: false, b: false, p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: 0, pinsLockedYear: null
      }));
      core.save();
      console.log(`✅ Importerte fra KATALOG: ${s.stops.length}`);
    } else {
      console.warn("⚠️ Ingen adresser funnet i katalog");
      s.stops = [];
      core.save();
    }
  }

  // --- Render “Under arbeid” ---
  async function renderWorkList() {
    const list = document.getElementById("workList");
    if (!list) return;

    const stops = core.state?.stops || [];
    if (stops.length === 0) {
      list.innerHTML = `<p>Ingen adresser tilgjengelig.</p>`;
      return;
    }

    list.innerHTML = stops.map((stop, i) => `
      <div class="stopRow" style="margin:10px 0;padding:10px;border:1px solid #333;border-radius:8px">
        <b>${core.esc(stop.n)}</b><br>
        <small>${core.esc(stop.t)}</small><br>
        <button onclick="Core.toggleDone(${i})"
                style="margin-top:6px;padding:6px 10px;border:0;border-radius:6px;background:#0f9d58;color:#fff">
          ${stop.f ? "Angre" : "Ferdig"}
        </button>
      </div>
    `).join("");
  }

  // enkel toggle for demo
  core.toggleDone = (i) => {
    const s = core.state.stops[i];
    s.f = !s.f;
    core.save();
    renderWorkList();
  };

  // --- Oppstart / knapper ---
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("del-D.js lastet");

    await ensureStopsLoaded(true);   // tving første gang
    renderWorkList();

    document.getElementById("startBtn")?.addEventListener("click", async () => {
      await ensureStopsLoaded(true); // tving når man starter runde
      renderWorkList();
      document.querySelector("section.active")?.classList.remove("active");
      document.getElementById("work")?.classList.add("active");
    });
  });
})();