/* del-A.js — app-konfig + JSONBin-hjelpere + automatisk nøkkel-sjekk (v9.12i) */

(function () {
  // ====== KONFIG ======
  // Sett riktig BIN_ID før bruk.
  const APP_CFG = {
    API_BASE: "https://api.jsonbin.io/v3/",   // må slutte med /
    BIN_ID:   "68e7b4d2ae596e708f0bde7d",     // <- DIN BIN-ID (24 hex-tegn)
    APP_VER:  "9.12i"
  };

  // Eksponer for andre deler
  window.APP_CFG = APP_CFG;

  // ====== UTIL ======
  const LS_KEY = "JSONBIN_KEY";

  function getKey() {
    const k = localStorage.getItem(LS_KEY);
    return (typeof k === "string" && k.trim().length > 10) ? k.trim() : null;
  }
  function setKey(v) {
    if (!v || v.trim().length < 10) return false;
    localStorage.setItem(LS_KEY, v.trim());
    return true;
  }
  function clearKey() {
    localStorage.removeItem(LS_KEY);
  }

  function validBinId(id) {
    // JSONBin standard: 24 hex characters
    return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
  }
  function validApiBase(u) {
    try {
      const url = new URL(u);
      return url.protocol.startsWith("http") && u.endsWith("/");
    } catch {
      return false;
    }
  }

  // ====== VARSELBANNER (injiseres automatisk) ======
  function ensureBanner() {
    if (document.getElementById("key-banner")) return;
    const css = `
      #key-banner{position:sticky;top:0;z-index:9999;background:#7c2d12;color:#fff;
        padding:10px 12px;border-bottom:2px solid #ef4444;display:none}
      #key-banner .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      #key-banner button{background:#ef4444;border:none;color:#fff;padding:8px 12px;
        border-radius:8px;font-size:15px;cursor:pointer}
      #key-banner .sec{opacity:.9;font-size:13px}
      @media (prefers-color-scheme:light){#key-banner{background:#dc2626;border-color:#b91c1c}}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "key-banner";
    bar.innerHTML = `
      <div class="row">
        <strong id="key-banner-msg">Mangler API-nøkkel for å synkronisere.</strong>
        <button id="btn-enter-key">Legg inn nøkkel</button>
        <button id="btn-hide-key">Skjul</button>
      </div>
      <div class="sec" id="key-banner-sec"></div>
    `;
    document.body.prepend(bar);

    document.getElementById("btn-hide-key").onclick = () => (bar.style.display = "none");
    document.getElementById("btn-enter-key").onclick = async () => {
      const val = prompt("Lim inn X-Master-Key (JSONBin):", "");
      if (setKey(val || "")) {
        alert("Nøkkel lagret. Prøver å synkronisere på nytt.");
        bar.style.display = "none";
        window.dispatchEvent(new CustomEvent("broyt:key:updated"));
      } else {
        alert("Ugyldig nøkkel. Prøv igjen.");
      }
    };
  }

  function showBanner(msg, secondary = "") {
    ensureBanner();
    const bar = document.getElementById("key-banner");
    document.getElementById("key-banner-msg").textContent = msg;
    document.getElementById("key-banner-sec").textContent = secondary;
    bar.style.display = "block";
  }

  // ====== KONFIG-SJEKK ======
  function checkConfigOrWarn() {
    const issues = [];
    if (!validApiBase(APP_CFG.API_BASE)) issues.push("API_BASE er ugyldig (må være URL og slutte med /).");
    if (!validBinId(APP_CFG.BIN_ID)) issues.push("BIN_ID ser ikke riktig ut (forventer 24 heksadesimale tegn).");
    const key = getKey();
    if (!key) issues.push("Mangler X-Master-Key.");

    if (issues.length) {
      const sec = [
        `API_BASE: ${APP_CFG.API_BASE}`,
        `BIN_ID: ${APP_CFG.BIN_ID}`,
        `Key: ${key ? "OK" : "Mangler"}`
      ].join(" • ");
      showBanner("Kan ikke synkronisere: " + issues[0], sec);
      return false;
    }
    return true;
  }

  // ====== JSONBIN FETCH WRAPPER ======
  async function apiFetch(path, init = {}) {
    // Fang konfig-feil på en pen måte
    if (!validApiBase(APP_CFG.API_BASE)) {
      showBanner("Ugyldig API_BASE. Sjekk del-A.js.", `API_BASE: ${APP_CFG.API_BASE}`);
      throw new Error("Invalid API_BASE");
    }
    if (!validBinId(APP_CFG.BIN_ID)) {
      showBanner("Ugyldig BIN_ID. Sjekk del-A.js.", `BIN_ID: ${APP_CFG.BIN_ID}`);
      throw new Error("Invalid BIN_ID");
    }
    const key = getKey();
    if (!key) {
      showBanner("Mangler X-Master-Key – legg inn for å kunne synkronisere.");
      throw new Error("Missing master key");
    }

    const url = APP_CFG.API_BASE + path.replace(/^\//, "");
    const headers = Object.assign(
      { "X-Master-Key": key, "Content-Type": "application/json" },
      init.headers || {}
    );

    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    if (!res.ok) {
      // Les tekst/feil for hint
      let hint = "";
      try { hint = await res.text(); } catch {}
      showBanner(`Synk-feil (${res.status})`, hint.slice(0, 200));
      throw new Error(`JSONBin error ${res.status}: ${hint}`);
    }
    return res;
  }

  // ====== HØYNIVÅ-API ======
  async function getLatest() {
    const r = await apiFetch(`b/${APP_CFG.BIN_ID}/latest`);
    const j = await r.json();
    return j && j.record ? j.record : j;
  }

  async function putRecord(record) {
    const payload = JSON.stringify(record);
    const r = await apiFetch(`b/${APP_CFG.BIN_ID}`, { method: "PUT", body: payload });
    return await r.json();
  }

  // ====== EKSPORT ======
  window.JSONBIN = {
    getKey, setKey, clearKey,
    getLatest, putRecord,
    checkConfigOrWarn,
    apiFetch
  };

  // ====== AUTO-SJEKK VED OPPSTART ======
  window.addEventListener("DOMContentLoaded", () => {
    // Viser banner hvis noe mangler
    checkConfigOrWarn();
  });

  // Andre deler kan lytte når nøkkel oppdateres og prøve på nytt
  // window.addEventListener('broyt:key:updated', ...);

})();