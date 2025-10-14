// del-C.js – felles kjernefunksjoner for Brøyterute v9.11

console.log("✅ del-C.js (core) lastet");

// --- Grunnleggende konstanter ---
const VERSION = "v9.11";
const DEFAULT_JSONBIN_ID = "68ed425cae596e708f11d25f"; // katalog
const DEFAULT_POS_BIN_ID = "68ed41ee43b1c97be9661c65"; // posisjoner
const API_ROOT = "https://api.jsonbin.io/v3/b/";
const LOCAL_KEY = "broyte_data_v911";

// Hjelpeverktøy for DOM
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// --- Lokal lagring (for offline) ---
function saveLocal(data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("⚠️ Kunne ikke lagre lokalt:", err);
  }
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

// --- Hent API-nøkkel ---
function getKey() {
  return (
    localStorage.getItem("broyte_api_key") ||
    window.DEFAULT_JSONBIN_KEY ||
    ""
  );
}

// --- Hent katalog fra JSONBin ---
async function fetchCatalog(binId = DEFAULT_JSONBIN_ID) {
  const key = getKey();
  const url = `${API_ROOT}${binId}/latest`;
  const headers = key ? { "X-Master-Key": key } : {};
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(resp.statusText);
    const json = await resp.json();
    console.log("📦 Katalog hentet", json);
    return json.record || [];
  } catch (err) {
    console.error("🚫 Feil ved henting av katalog:", err.message);
    return [];
  }
}

// --- Lagre katalog til JSONBin ---
async function saveCatalog(binId, data) {
  const key = getKey();
  if (!key) {
    alert("Ingen API-nøkkel satt!");
    return;
  }
  const url = `${API_ROOT}${binId}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": key
    },
    body: JSON.stringify(data)
  });
  if (!resp.ok) throw new Error("Feil ved lagring");
  const json = await resp.json();
  console.log("💾 Katalog lagret", json);
  return json;
}

// --- Posisjonslogg for sjåfører ---
async function postPosition(lat, lon, driverName) {
  const key = getKey();
  if (!key) return;
  const payload = {
    tid: new Date().toISOString(),
    navn: driverName || "ukjent",
    lat,
    lon
  };
  await fetch(`${API_ROOT}${DEFAULT_POS_BIN_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": key
    },
    body: JSON.stringify(payload)
  }).catch(e => console.warn("⚠️ Kunne ikke logge posisjon:", e.message));
}

// --- Eksporter funksjonene globalt ---
window.Core = {
  VERSION,
  fetchCatalog,
  saveCatalog,
  postPosition,
  saveLocal,
  loadLocal
};