/* ===== del-H.js — Service (Hybrid v9.12h) ===== */
(() => {
  if (!window.Core) return console.error("Del-C.js må lastes før del-H.");

  const Core = window.Core;
  const LS_KEY = "broyte_v912h_service";

  // Struktur vi lagrer lokalt
  function defaultService() {
    return {
      // Vedlikeholdspunkter
      smurtFres: false,
      smurtSkjaer: false,     // (tidl. plog)
      smurtForstilling: false,

      oljeForan: false,
      oljeBak: false,
      etterfyltOlje: false,
      dieselFylt: false,

      annet: false,
      notes: "",

      // metadata
      tsSaved: null,
      by: Core.displayName(),
      dateKey: Core.dateKey(new Date()),
      equipmentSnapshot: Core.state?.equipment || {},
      directionSnapshot: Core.state?.direction || "forward"
    };
  }

  function loadService() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultService();
      const obj = JSON.parse(raw);
      // Sikre nye felter om vi oppgraderer
      return Object.assign(defaultService(), obj);
    } catch {
      return defaultService();
    }
  }

  function saveService(s) {
    try {
      s.tsSaved = Date.now();
      s.by = Core.displayName();
      s.dateKey = Core.dateKey(new Date());
      s.equipmentSnapshot = Core.state?.equipment || {};
      s.directionSnapshot = Core.state?.direction || "forward";
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch(_) {}
  }

  // UI helpers
  const $  = (sel, root=document) => root.querySelector(sel);
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));

  // Renderer
  function renderService() {
    const host = $("#service");
    if (!host) return;

    const S = loadService();

    host.innerHTML = "";
    host.appendChild(CE("h2", { textContent: "Service / Vedlikehold" }));

    // Info-rad (fører, utstyr, retning, sist lagret)
    const meta = CE("div", { className:"small muted" });
    const eq = Core.state?.equipment || {};
    const eqList = [
      eq.skjaer ? "skjær" : null,
      eq.fres ? "fres" : null,
      eq.strokasse ? "strøkasse" : null
    ].filter(Boolean).join(", ") || "—";
    meta.textContent = `Fører: ${Core.displayName()} • Utstyr: ${eqList} • Retning: ${Core.state?.direction || "forward"} • Sist lagret: ${Core.fmtDT(S.tsSaved)}`;
    host.appendChild(meta);

    // Kort med avkryssinger
    const card = CE("div", { className:"card", style:"padding:12px;margin-top:8px" });

    // Gruppe 1 — Smøring
    card.appendChild(CE("h3", { textContent:"Smøring" }));
    card.appendChild(makeCheck("smurtFres",        "Smurt fres", S));
    card.appendChild(makeCheck("smurtSkjaer",      "Smurt skjær", S));
    card.appendChild(makeCheck("smurtForstilling", "Smurt forstilling", S));

    // Gruppe 2 — Olje
    card.appendChild(CE("h3", { textContent:"Olje" }));
    card.appendChild(makeCheck("oljeForan",      "Sjekket olje foran", S));
    card.appendChild(makeCheck("oljeBak",        "Sjekket olje bak", S));
    card.appendChild(makeCheck("etterfyltOlje",  "Etterfylt olje", S));

    // Gruppe 3 — Drivstoff
    card.appendChild(CE("h3", { textContent:"Drivstoff" }));
    card.appendChild(makeCheck("dieselFylt", "Diesel fylt", S));

    // Gruppe 4 — Annet + notater
    card.appendChild(CE("h3", { textContent:"Annet" }));
    card.appendChild(makeCheck("annet", "Annet (se notat)", S));

    const notes = CE("textarea", {
      placeholder:"Anmerkninger …",
      value: S.notes || "",
      style:"width:100%;min-height:120px;margin-top:8px;background:#111;color:#fff;border:1px solid #444;border-radius:8px;padding:10px"
    });
    card.appendChild(notes);

    // Knapperekke
    const row = CE("div", { style:"display:flex;flex-wrap:wrap;gap:8px;margin-top:10px" });
    const btnSave   = CE("button", { className:"btn btn-green", textContent:"💾 Lagre lokalt" });
    const btnCsv    = CE("button", { className:"btn btn-gray",  textContent:"⬇︎ Eksporter CSV" });
    const btnTxt    = CE("button", { className:"btn btn-gray",  textContent:"🧾 Last ned brukerark (TXT)" });
    const btnHtml   = CE("button", { className:"btn btn-blue",  textContent:"🗂️ Lag HTML-rapport (dag)" });

    row.append(btnSave, btnCsv, btnTxt, btnHtml);
    card.appendChild(row);
    host.appendChild(card);

    // Handlers
    // hver checkbox har data-key = felt-navn
    card.querySelectorAll('input[type="checkbox"][data-key]').forEach(chk=>{
      chk.addEventListener('change', ()=>{
        const key = chk.dataset.key;
        S[key] = !!chk.checked;
        saveService(S);
        updateMeta();
      });
    });
    notes.addEventListener('input', ()=>{
      S.notes = notes.value;
      saveService(S);
      updateMeta();
    });

    btnSave.addEventListener('click', ()=>{
      saveService(S);
      alert("✅ Service-status lagret lokalt!");
      updateMeta();
    });

    btnCsv.addEventListener('click', ()=> downloadCSV(S));
    btnTxt.addEventListener('click', ()=> downloadTXT(S));
    btnHtml.addEventListener('click', ()=> downloadHTML(S));

    function updateMeta(){
      meta.textContent = `Fører: ${Core.displayName()} • Utstyr: ${eqList} • Retning: ${Core.state?.direction || "forward"} • Sist lagret: ${Core.fmtDT(Date.now())}`;
    }
  }

  function makeCheck(key, label, S) {
    const wrap = CE("label", { style:"display:flex;align-items:center;gap:8px;margin:6px 0" });
    const chk  = CE("input", { type:"checkbox", checked:!!S[key] });
    chk.dataset.key = key;
    const txt  = CE("span", { textContent: label });
    wrap.append(chk, txt);
    return wrap;
  }

  // Exports
  function downloadCSV(S) {
    const header = [
      "dateKey","by","direction","equipment","smurtFres","smurtSkjaer","smurtForstilling",
      "oljeForan","oljeBak","etterfyltOlje","dieselFylt","annet","notes"
    ];
    const eq = S.equipmentSnapshot || {};
    const eqList = [
      eq.skjaer ? "skjær" : null,
      eq.fres ? "fres" : null,
      eq.strokasse ? "strøkasse" : null
    ].filter(Boolean).join("|");

    const row = [
      S.dateKey,
      S.by,
      S.directionSnapshot,
      eqList || "",
      num(S.smurtFres),
      num(S.smurtSkjaer),
      num(S.smurtForstilling),
      num(S.oljeForan),
      num(S.oljeBak),
      num(S.etterfyltOlje),
      num(S.dieselFylt),
      num(S.annet),
      (S.notes||"").replaceAll('"','""')
    ];

    const csv = [
      header.join(","),
      row.map(v => typeof v === "string" ? `"${v}"` : String(v)).join(",")
    ].join("\n");

    blobDownload(csv, `service-${S.dateKey}.csv`, "text/csv");
  }

  function downloadTXT(S) {
    const eq = S.equipmentSnapshot || {};
    const eqList = [
      eq.skjaer ? "skjær" : null,
      eq.fres ? "fres" : null,
      eq.strokasse ? "strøkasse" : null
    ].filter(Boolean).join(", ") || "—";

    const lines = [
      `Brukerark – Service / Vedlikehold`,
      `Dato: ${S.dateKey}`,
      `Fører: ${S.by}`,
      `Retning: ${S.directionSnapshot}`,
      `Utstyr: ${eqList}`,
      ``,
      `[Smøring]`,
      `- Smurt fres: ${yesno(S.smurtFres)}`,
      `- Smurt skjær: ${yesno(S.smurtSkjaer)}`,
      `- Smurt forstilling: ${yesno(S.smurtForstilling)}`,
      ``,
      `[Olje]`,
      `- Sjekket olje foran: ${yesno(S.oljeForan)}`,
      `- Sjekket olje bak: ${yesno(S.oljeBak)}`,
      `- Etterfylt olje: ${yesno(S.etterfyltOlje)}`,
      ``,
      `[Drivstoff]`,
      `- Diesel fylt: ${yesno(S.dieselFylt)}`,
      ``,
      `[Annet]`,
      `- Annet: ${yesno(S.annet)}`,
      ``,
      `Notater:`,
      S.notes || "—",
      ``,
      `Signatur: ____________________________`
    ].join("\n");

    blobDownload(lines, `service-${S.dateKey}.txt`, "text/plain");
  }

  function downloadHTML(S) {
    const eq = S.equipmentSnapshot || {};
    const eqList = [
      eq.skjaer ? "skjær" : null,
      eq.fres ? "fres" : null,
      eq.strokasse ? "strøkasse" : null
    ].filter(Boolean).join(", ") || "—";

    const html = `<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<title>Service-rapport ${S.dateKey}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:20px;background:#111;color:#f5f5f5}
  .card{background:#181a1e;border:1px solid #2a2f36;border-radius:12px;padding:16px;margin-bottom:12px}
  h1,h2,h3{margin:0 0 10px}
  .grid{display:grid;grid-template-columns:160px 1fr;gap:8px}
  .yes{color:#22c55e} .no{color:#ef4444}
</style>
</head>
<body>
  <h1>Service-rapport</h1>
  <div class="card">
    <div class="grid">
      <div><b>Dato</b></div><div>${esc(S.dateKey)}</div>
      <div><b>Fører</b></div><div>${esc(S.by)}</div>
      <div><b>Retning</b></div><div>${esc(S.directionSnapshot)}</div>
      <div><b>Utstyr</b></div><div>${esc(eqList)}</div>
      <div><b>Sist lagret</b></div><div>${esc(new Date(S.tsSaved||Date.now()).toLocaleString("no-NO"))}</div>
    </div>
  </div>

  <div class="card">
    <h2>Smøring</h2>
    <div>Smurt fres: <span class="${S.smurtFres?'yes':'no'}">${yesno(S.smurtFres)}</span></div>
    <div>Smurt skjær: <span class="${S.smurtSkjaer?'yes':'no'}">${yesno(S.smurtSkjaer)}</span></div>
    <div>Smurt forstilling: <span class="${S.smurtForstilling?'yes':'no'}">${yesno(S.smurtForstilling)}</span></div>
  </div>

  <div class="card">
    <h2>Olje</h2>
    <div>Sjekket olje foran: <span class="${S.oljeForan?'yes':'no'}">${yesno(S.oljeForan)}</span></div>
    <div>Sjekket olje bak: <span class="${S.oljeBak?'yes':'no'}">${yesno(S.oljeBak)}</span></div>
    <div>Etterfylt olje: <span class="${S.etterfyltOlje?'yes':'no'}">${yesno(S.etterfyltOlje)}</span></div>
  </div>

  <div class="card">
    <h2>Drivstoff</h2>
    <div>Diesel fylt: <span class="${S.dieselFylt?'yes':'no'}">${yesno(S.dieselFylt)}</span></div>
  </div>

  <div class="card">
    <h2>Annet</h2>
    <div>Annet: <span class="${S.annet?'yes':'no'}">${yesno(S.annet)}</span></div>
    <h3 style="margin-top:12px">Notater</h3>
    <div>${(esc(S.notes)||"—").replace(/\n/g,"<br>")}</div>
  </div>
</body>
</html>`;

    blobDownload(html, `service-${S.dateKey}.html`, "text/html");
  }

  // Utils
  function blobDownload(text, filename, mime) {
    const blob = new Blob([text], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=> {
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
  }
  const yesno = (b) => (b ? "Ja" : "Nei");
  const num = (b) => (b ? 1 : 0);

  // Kjør ved last
  document.addEventListener("DOMContentLoaded", renderService);
  console.log("del-H.js (Service hybrid) lastet");
})();