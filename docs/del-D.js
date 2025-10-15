/* ===== del-D.js (data + import – rører ikke UI) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del D."); return; }
  const Core = window.Core;

  // Map katalog-adresse -> stop-objekt (samme format som appen bruker)
  function mapCatalogToStops(addresses = []) {
    const T = Core.cfg.DEFAULT_TASKS;
    return addresses
      .filter(a => a && a.active !== false)
      .map(a => ({
        n: a.name || "",
        t: Core.normalizeTask(a.task || T[0]),
        f: false,
        b: false,
        p: [],
        started: null,
        finished: null,
        details: "",
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: Number.isFinite(a.pinsCount) ? a.pinsCount : 0,
        pinsLockedYear:
          Number.isFinite(a.pinsCount) && a.pinsCount > 0 ? Core.seasonKey() : null
      }));
  }

  // Importer fra JSONBin-katalog og legg i Core.state.stops (hvis tom liste)
  async function importFromCatalogIfEmpty() {
    try {
      const S = (Core.state = Core.state || Core.makeDefaultState());
      if (Array.isArray(S.stops) && S.stops.length > 0) {
        console.log("Del-D: stopper er allerede i state:", S.stops.length);
        return;
      }

      console.log("Del-D: Laster inn katalog fra JSONBin …");
      const rec = await Core.fetchCatalog();             // fra del-C.js
      const src = Array.isArray(rec.addresses) ? rec.addresses : [];
      const stops = mapCatalogToStops(src);

      if (stops.length === 0) {
        console.warn("Del-D: Ingen adresser funnet i katalog.");
        return;
      }

      S.stops = stops;
      Core.save();
      console.log("Del-D: Importerte fra KATALOG:", stops.length);

      // Tegn Under arbeid én gang – vi lar del-E styre UI videre
      if (typeof Core.renderWork === "function") {
        Core.renderWork();
      }
    } catch (e) {
      console.error("Del-D: Feil ved import fra katalog:", e);
    }
  }

  // Start: ved DOMContentLoaded henter vi inn data hvis nødvendig – men vi re-rendrer ikke i loop
  document.addEventListener("DOMContentLoaded", () => {
    importFromCatalogIfEmpty();
    console.log("del-D.js lastet");
  });

  // Eksponer en manuell import-funksjon for senere bruk (knapper etc.)
  Core.importFromCatalogIfEmpty = importFromCatalogIfEmpty;
})();