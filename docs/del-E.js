/* ===== del-E.js — Adresse-register ===== */
(() => {
  if (!window.Core) {
    console.error("Del C må lastes før Del E.");
    return;
  }
  const Core = window.Core;
  const $  = (sel, root=document) => root.querySelector(sel);

  function ensureStops() {
    const S = Core.state || (Core.state = Core.load() || Core.makeDefaultState());
    if (!Array.isArray(S.stops)) S.stops = [];
    return S.stops;
  }

  function mapCatalogToStops(record) {
    const list = Array.isArray(record?.addresses) ? record.addresses : [];
    return list.map(a => ({
      n: String(a.name ?? a.n ?? "").trim(),
      t: Core.normalizeTask(a.task ?? a.t ?? ""),
      f: false, b: false, p: Array.isArray(a.p) ? a.p : [],
      twoDriverRec: !!a.twoDriverRec,
      pinsCount: Number(a.pinsCount ?? 0) || 0,
      pinsLockedYear: a.pinsLockedYear ?? null
    })).filter(x => x.n);
  }

  function buildUI() {
    const host = $("#addresses");
    if (!host) return;

    host.innerHTML = `
      <h2>Adresse-register</h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0 1rem 0">
        <button id="addrFetch" class="btn btn-blue">🔄 Hent fra katalog</button>
        <button id="addrReset" class="btn">🧹 Nullstill lokal status</button>
        <span id="addrCount" class="muted" style="align-self:center"></span>
      </div>

      <div class="card" style="padding:12px;margin-bottom:12px">
        <div style="font-weight:600;margin-bottom:.5rem">Legg til ny adresse (lokalt)</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <input id="addrName" type="text" placeholder="Navn / adresse" style="flex:1;min-width:220px;padding:.5rem;border-radius:6px;border:1px solid #333;background:#111;color:#fff">
          <select id="addrTask" style="min-width:220px;padding:.5rem;border-radius:6px;border:1px solid #333;background:#111;color:#fff"></select>
          <label style="display:flex;align-items:center;gap:.5rem"><input id="addrTwo" type="checkbox"> 2 sjåfører</label>
          <button id="addrAdd" class="btn btn-green">➕ Legg til</button>
        </div>
      </div>

      <div id="addrList" style="display:flex;flex-direction:column;gap:.75rem"></div>
    `;

    // Oppgavevalg
    const sel = $("#addrTask", host);
    Core.cfg.DEFAULT_TASKS.forEach(t => {
      const o = document.createElement("option");
      o.value = t; o.textContent = t;
      sel.appendChild(o);
    });

    // Knapper
    $("#addrAdd", host).addEventListener("click", onAdd);
    $("#addrFetch", host).addEventListener("click", onFetch);
    $("#addrReset", host).addEventListener("click", onReset);

    renderList();
    console.log("del-E.js: UI bygget");
  }

  function renderList() {
    const host = $("#addresses");
    if (!host) return;

    const listEl = $("#addrList", host);
    const stops = ensureStops();

    $("#addrCount", host).textContent = `Adresser i runde: ${stops.length}`;
    listEl.innerHTML = "";

    if (stops.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Ingen adresser enda. Hent katalog i Admin-fanen eller legg til her.";
      listEl.appendChild(empty);
      return;
    }

    stops.forEach((st, idx) => {
      const row = document.createElement("div");
      row.className = "card";
      row.style.padding = "10px";

      const taskSelId = `task_${idx}`;
      const twoId = `two_${idx}`;
      const nameId = `name_${idx}`;

      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <label style="font-size:12px;opacity:.8">Adresse</label>
            <input id="${nameId}" type="text" value="${Core.esc(st.n)}"
              style="width:100%;padding:.5rem;border-radius:6px;border:1px solid #333;background:#111;color:#fff">
          </div>

          <div style="min-width:220px">
            <label style="font-size:12px;opacity:.8">Oppgave</label>
            <select id="${taskSelId}"
              style="width:100%;padding:.5rem;border-radius:6px;border:1px solid #333;background:#111;color:#fff"></select>
          </div>

          <div style="display:flex;align-items:center;gap:.5rem;min-width:150px">
            <label><input id="${twoId}" type="checkbox" ${st.twoDriverRec ? "checked":""}> 2 sjåfører</label>
          </div>

          <div style="display:flex;gap:.5rem;align-items:end">
            <button class="btn" data-act="save" data-i="${idx}">💾 Lagre</button>
            <button class="btn btn-red" data-act="del"  data-i="${idx}">Slett</button>
          </div>
        </div>

        <div class="muted" style="margin-top:.5rem">
          Pins: ${st.pinsCount||0} ${st.pinsLockedYear ? `• Låst: ${st.pinsLockedYear}` : ""}
        </div>
      `;

      const tSel = row.querySelector("#"+taskSelId);
      Core.cfg.DEFAULT_TASKS.forEach(t => {
        const o = document.createElement("option");
        o.value = t; o.textContent = t;
        if (Core.normalizeTask(st.t) === Core.normalizeTask(t)) o.selected = true;
        tSel.appendChild(o);
      });

      row.querySelector('[data-act="save"]').addEventListener("click", () => {
        const name = row.querySelector("#"+nameId).value.trim();
        const task = row.querySelector("#"+taskSelId).value;
        const two  = row.querySelector("#"+twoId).checked;

        const stops = ensureStops();
        const s = stops[idx];
        s.n = name || s.n;
        s.t = Core.normalizeTask(task);
        s.twoDriverRec = !!two;
        Core.save();
        flash(row, "Lagret ✅");
      });

      row.querySelector('[data-act="del"]').addEventListener("click", () => {
        const stops = ensureStops();
        stops.splice(idx,1);
        Core.save();
        renderList();
      });

      listEl.appendChild(row);
    });
  }

  function flash(row, msg) {
    const tip = document.createElement("div");
    tip.textContent = msg;
    tip.style.cssText = "margin-top:.5rem;font-size:12px;color:#8f8";
    row.appendChild(tip);
    setTimeout(()=> tip.remove(), 1500);
  }

  function onAdd() {
    const host = $("#addresses");
    const name = $("#addrName", host).value.trim();
    const task = $("#addrTask", host).value;
    const two  = $("#addrTwo", host).checked;
    if (!name) return alert("Skriv inn navn/adresse først.");

    const stops = ensureStops();
    stops.push({ n:name, t:Core.normalizeTask(task), f:false, b:false, p:[], twoDriverRec:!!two, pinsCount:0, pinsLockedYear:null });
    Core.save();

    $("#addrName", host).value = "";
    $("#addrTwo", host).checked = false;
    renderList();
  }

  async function onFetch() {
    try {
      console.info("Laster inn katalog fra JSONBin …");
      const record = await Core.fetchCatalog();
      const mapped = mapCatalogToStops(record);
      if (!mapped.length) {
        console.warn("Ingen adresser funnet i katalog.");
        alert("Ingen adresser funnet i katalogen.");
        return;
      }
      const S = Core.state;
      S.stops = mapped;
      Core.save();
      renderList();
      console.info("Importerte fra KATALOG:", mapped.length);
    } catch (e) {
      console.error("Feil ved henting fra katalog:", e);
      alert("Klarte ikke hente fra katalog (se konsollen).");
    }
  }

  function onReset() {
    if (!confirm("Nullstill lokal status på alle adresser? (Ferdig/Ikke mulig etc.)")) return;
    const stops = ensureStops();
    stops.forEach(s => { s.f = false; s.b = false; });
    Core.save();
    renderList();
  }

  // Start når DOM er klar (tåler både defer og ikke)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();