/* ===== del-G.js — Admin (Hybrid v9.12h) ===== */
(() => {
  if (!window.Core) return console.error("Del-C.js mangler før del-G.");

  const Core = window.Core;
  const LS_KEY = "broyte_v912h_catalog";

  const $  = (sel, root=document) => root.querySelector(sel);
  const CE = (tag, props={}) => Object.assign(document.createElement(tag), props);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));

  function loadCatalog() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { addresses: [] };
    } catch { return { addresses: [] }; }
  }
  function saveCatalog(cat) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cat)); } catch(_){}
  }

  // ----- Oppdater JSONBin (hvis X-Master-Key gyldig) -----
  async function pushToBin() {
    const { CATALOG } = Core.cfg.BINS;
    const cat = loadCatalog();
    const url = `https://api.jsonbin.io/v3/b/${CATALOG}`;
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: Core.headers(),
        body: JSON.stringify(cat)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("✅ Katalog lastet opp til JSONBin!");
    } catch (e) {
      console.error("Feil ved push:", e);
      alert("❌ Kunne ikke laste opp (offline eller ugyldig nøkkel). Endringer lagres lokalt.");
    }
  }

  // ----- Rendre Admin-siden -----
  function render() {
    const root = $("#admin");
    if (!root) return;
    root.innerHTML = "";
    const title = CE("h2", { textContent:"Admin – katalogredigering" });
    const info = CE("div", { className:"muted", textContent:"Endringer lagres lokalt først. Du kan synkronisere når som helst." });
    const btnSave = CE("button", { className:"btn btn-green", textContent:"💾 Lagre lokalt" });
    const btnPush = CE("button", { className:"btn btn-blue", textContent:"☁️ Last opp til JSONBin" });

    btnSave.addEventListener("click", saveEdits);
    btnPush.addEventListener("click", pushToBin);

    root.append(title, info, btnSave, btnPush);

    const cat = loadCatalog();
    const wrap = CE("div", { style:"margin-top:14px;" });

    if (!cat.addresses?.length) {
      wrap.appendChild(CE("div", { className:"muted", textContent:"Ingen adresser i katalogen. Hent eller legg til i Adresse-register." }));
      root.append(wrap);
      return;
    }

    cat.addresses.forEach((a, i) => {
      const card = CE("div", { className:"card", style:"padding:12px;margin:8px 0;" });

      const nameInp = CE("input", {
        type:"text",
        value:a.name || "",
        style:"width:60%;background:#111;color:#fff;border:1px solid #444;border-radius:6px;padding:6px;"
      });
      const selTask = CE("select", { style:"background:#111;color:#fff;border:1px solid #444;border-radius:6px;padding:6px;" });
      Core.cfg.DEFAULT_TASKS.forEach(t => {
        const opt = CE("option", { value:t, textContent:t });
        if ((a.task||"") === t) opt.selected = true;
        selTask.appendChild(opt);
      });

      const twoChk = CE("input", { type:"checkbox", checked:!!a.twoDriverRec });
      const pinsInp = CE("input", {
        type:"number",
        value:a.pinsCount ?? 0,
        min:"0",
        style:"width:70px;background:#111;color:#fff;border:1px solid #444;border-radius:6px;padding:6px;"
      });
      const activeChk = CE("input", { type:"checkbox", checked:a.active !== false });

      card.appendChild(CE("div", { innerHTML:`<strong>${esc(a.name||"Uten navn")}</strong>` }));
      const line = CE("div", { style:"display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;" });

      line.append(
        CE("label", { textContent:"Navn:" }), nameInp,
        CE("label", { textContent:"Oppgave:" }), selTask,
        CE("label", { textContent:"2 sjåfører:" }), twoChk,
        CE("label", { textContent:"Brøytestikker:" }), pinsInp,
        CE("label", { textContent:"Aktiv:" }), activeChk
      );
      card.append(line);
      wrap.append(card);

      card.dataset.index = i;
      card.dataset.name = a.name;
    });

    root.append(wrap);
  }

  // ----- Lagre redigeringer fra UI -----
  function saveEdits() {
    const cat = loadCatalog();
    const cards = document.querySelectorAll("#admin .card");
    cat.addresses = Array.from(cards).map(c => {
      const i = c.dataset.index;
      const inputs = c.querySelectorAll("input,select");
      const [nameInp, selTask, twoChk, pinsInp, activeChk] = inputs;
      return {
        name: nameInp.value.trim(),
        task: Core.normalizeTask(selTask.value),
        twoDriverRec: twoChk.checked,
        pinsCount: parseInt(pinsInp.value || 0),
        active: activeChk.checked
      };
    });
    saveCatalog(cat);
    alert("✅ Endringer lagret lokalt!");
  }

  document.addEventListener("DOMContentLoaded", render);
  console.log("del-G.js (Admin hybrid) lastet");
})();