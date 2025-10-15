/* ===== del-D.js (arbeidsvisning og oppgavelogikk) ===== */
(() => {
  if (!window.Core) {
    console.error("Del C må lastes før Del D.");
    return;
  }

  const core = window.Core;

  async function ensureStopsLoaded(forceReload = false) {
    const s = core.state;
    if (!forceReload && Array.isArray(s.stops) && s.stops.length > 0) {
      console.log("stops allerede i state:", s.stops.length);
      return;
    }

    console.log("🔄 Laster inn katalog fra JSONBin ...");
    const data = await core.fetchCatalog();
    if (data && data.record && Array.isArray(data.record.addresses)) {
      const addresses = data.record.addresses;
      s.stops = addresses.map((a) => ({
        n: a.name || a.n || "",
        t: core.normalizeTask(a.task || a.t),
        f: false,
        b: false,
        p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: 0,
        pinsLockedYear: null,
      }));
      core.save();
      console.log(`✅ Importerte fra KATALOG: ${s.stops.length}`);
    } else {
      console.warn("⚠️ Ingen adresser funnet i katalog");
      s.stops = [];
    }
  }

  async function renderWorkList() {
    const list = document.getElementById("workList");
    if (!list) return;

    const stops = core.state?.stops || [];
    if (stops.length === 0) {
      list.innerHTML = `<p>Ingen adresser tilgjengelig.</p>`;
      return;
    }

    list.innerHTML = stops
      .map(
        (stop, i) => `
        <div class="stopRow">
          <b>${core.esc(stop.n)}</b><br>
          <small>${core.esc(stop.t)}</small><br>
          <button onclick="Core.toggleDone(${i})">Ferdig</button>
        </div>`
      )
      .join("");
  }

  core.toggleDone = (i) => {
    const s = core.state.stops[i];
    s.f = !s.f;
    core.save();
    renderWorkList();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    console.log("del-D.js lastet");

    await ensureStopsLoaded(true); // 🔥 Tving henting hver gang
    renderWorkList();

    document
      .getElementById("startBtn")
      ?.addEventListener("click", async () => {
        await ensureStopsLoaded(true);
        renderWorkList();
        document.querySelector("section.active")?.classList.remove("active");
        document.getElementById("work")?.classList.add("active");
      });
  });
})();