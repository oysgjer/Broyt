// del-E.js – "Under arbeid": status, navigering, vær
console.log("✅ del-E.js lastet");

if (!window.Core) {
  console.warn("⚠️ Del C må lastes først for Del E.");
}

// ---------------------------
// Liten, lokal lagring av status
// ---------------------------
const STORE_KEY = "broyt_v911_workstate";
function loadWorkState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function saveWorkState(st) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch {}
}
let workState = loadWorkState(); // { "<addrKey>": { s:'ongoing|done|blocked', started, finished, notes } }

const keyOf = (a) => (String(a.navn || a.name || a.address || "").trim().toLowerCase());

// ---------------------------
// Vær (nå + 3 timer)
// ---------------------------
async function renderWeather(host) {
  try {
    if (!navigator.geolocation) return;
    const wrap = document.createElement("div");
    wrap.style.margin = "10px 0 14px";
    wrap.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">Vær (nå + 3 t)</div>
      <div id="wxRow" style="display:flex;gap:8px;flex-wrap:wrap;font-size:14px">
        <span style="border:1px solid var(--cardBorder,#333);border-radius:999px;padding:6px 10px">Laster vær …</span>
      </div>`;
    host.prepend(wrap);

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords || {};
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&hourly=temperature_2m,precipitation&forecast_days=1&timezone=auto`;
      const js  = await fetch(url).then(r=>r.json()).catch(()=>null);
      if (!js) return;

      const row = wrap.querySelector("#wxRow");
      const nowT = Math.round(js?.current?.temperature_2m ?? 0);
      const nowP = +(js?.current?.precipitation ?? 0).toFixed(1);
      const times= js?.hourly?.time || [], temps = js?.hourly?.temperature_2m || [], prec = js?.hourly?.precipitation || [];
      const nowISO = new Date().toISOString().slice(0,13);
      const idx = Math.max(0, times.findIndex(t => t.startsWith(nowISO)));

      const mk = (label) => `<span style="border:1px solid var(--cardBorder,#333);border-radius:999px;padding:6px 10px">${label}</span>`;
      const pills = [];
      pills.push(mk(`Nå: ${nowT}°C · ${nowP} mm`));
      [idx+1, idx+2, idx+3].forEach(i=>{
        if (i<times.length) {
          const hh = new Date(times[i]).toLocaleTimeString("no-NO",{hour:"2-digit"});
          const t  = Math.round(temps[i]);
          const p  = +(prec[i]||0).toFixed(1);
          pills.push(mk(`${hh}: ${t}°C · ${p} mm`));
        }
      });
      row.innerHTML = pills.join("");
    }, ()=>{});
  } catch {}
}

// ---------------------------
// Rendering av “Under arbeid”
// ---------------------------
function statusBadge(s) {
  if (s === "done")    return `<span class="badge" style="border:1px solid #2ecc71;color:#2ecc71">✅ Utført</span>`;
  if (s === "ongoing") return `<span class="badge" style="border:1px solid #4aa3ff;color:#4aa3ff">▶️ Pågår</span>`;
  if (s === "blocked") return `<span class="badge" style="border:1px solid #ff5a52;color:#ff5a52">⛔ Stopp</span>`;
  return `<span class="badge" style="border:1px solid #555;color:#aaa">—</span>`;
}

function openMaps(dest) {
  if (!dest) return;
  const url = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest);
  window.open(url, "_blank");
}

function progressBox(list) {
  const total   = list.length;
  const done    = list.filter(a => (workState[keyOf(a)]?.s === "done")).length;
  const blocked = list.filter(a => (workState[keyOf(a)]?.s === "blocked")).length;
  const cleared = done + blocked;
  const pct = total ? Math.round(100 * cleared / total) : 0;

  return `
    <div style="border:1px solid var(--cardBorder,#333);border-radius:10px;padding:10px;margin:6px 0 12px">
      <div style="margin-bottom:6px;font-weight:700">Fremdrift: ${pct}% (${cleared}/${total})</div>
      <div style="height:12px;background:#222;border-radius:999px;overflow:hidden;border:1px solid var(--cardBorder,#333)">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#0f9d58,#22c55e)"></div>
      </div>
    </div>`;
}

async function renderWorkList() {
  const host = document.querySelector("#workList");
  if (!host) return;
  host.innerHTML = `<div style="opacity:.8;font-size:14px">Laster adresser …</div>`;

  let katalog = [];
  try {
    katalog = await Core.fetchCatalog();  // forventer array av { name/navn, task/type }
  } catch (e) {
    host.innerHTML = `<div style="color:#ff6b6b">Kunne ikke hente katalog.</div>`;
    return;
  }

  if (!Array.isArray(katalog) || katalog.length === 0) {
    host.innerHTML = `<div>Ingen adresser tilgjengelig.</div>`;
    return;
  }

  // Header: vær + progress
  host.innerHTML = "";
  await renderWeather(host);
  host.insertAdjacentHTML("beforeend", progressBox(katalog));

  // Liste
  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "10px";
  host.appendChild(list);

  katalog.forEach((a, idx) => {
    const navn = a.navn || a.name || a.address || "Ukjent adresse";
    const oppg = a.task || a.type || "Snø + brøytestikker";
    const k    = keyOf(a);
    const s    = workState[k]?.s || null;

    const row = document.createElement("div");
    row.style.border = "1px solid var(--cardBorder,#333)";
    row.style.borderRadius = "12px";
    row.style.padding = "10px 12px";

    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
        <div>
          <div style="font-weight:700">${navn}</div>
          <div style="opacity:.8;font-size:14px">${oppg}</div>
        </div>
        <div>${statusBadge(s)}</div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ongo"  data-i="${idx}" style="background:#2a2f36;border:none;border-radius:10px;padding:8px 12px;color:#fff">▶️ Pågår</button>
        <button class="btn-done"  data-i="${idx}" style="background:#0f9d58;border:none;border-radius:10px;padding:8px 12px;color:#fff">✅ Utført</button>
        <button class="btn-stop"  data-i="${idx}" style="background:#c21d03;border:none;border-radius:10px;padding:8px 12px;color:#fff">⛔ Ikke mulig</button>
        <button class="btn-nav"   data-i="${idx}" style="background:#0b66ff;border:none;border-radius:10px;padding:8px 12px;color:#fff">🧭 Naviger</button>
      </div>
    `;
    list.appendChild(row);
  });

  // Delegert klikkhåndtering
  host.addEventListener("click", (e) => {
    const b = e.target;
    if (!(b instanceof HTMLElement)) return;
    const idx = b.dataset?.i ? Number(b.dataset.i) : NaN;
    if (Number.isNaN(idx)) return;
    const adr = katalog[idx];
    const k = keyOf(adr);

    if (b.classList.contains("btn-ongo")) {
      workState[k] = workState[k] || {};
      workState[k].s = "ongoing";
      workState[k].started = workState[k].started || Date.now();
      saveWorkState(workState);
      renderWorkList();
    }
    if (b.classList.contains("btn-done")) {
      workState[k] = workState[k] || {};
      workState[k].s = "done";
      workState[k].finished = Date.now();
      saveWorkState(workState);
      renderWorkList();
    }
    if (b.classList.contains("btn-stop")) {
      const why = prompt("Hvorfor ikke mulig?", workState[k]?.notes || "") || "";
      workState[k] = workState[k] || {};
      workState[k].s = "blocked";
      workState[k].notes = why;
      saveWorkState(workState);
      renderWorkList();
    }
    if (b.classList.contains("btn-nav")) {
      const navn = adr.navn || adr.name || adr.address || "";
      openMaps(navn);
    }
  }, { once: true }); // settes én gang per render
}

// ---------------------------
// Init når siden er klar
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Koble "Start ny runde" til å hoppe til Under arbeid
  const startBtn = document.getElementById("startBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      // bytt til fanen "work"
      const navBtn = Array.from(document.querySelectorAll("nav button"))
        .find(b => (b.textContent || "").toLowerCase().includes("under arbeid"));
      if (navBtn) navBtn.click(); else {
        // fallback: vis seksjonen direkte
        document.querySelectorAll("section").forEach(s => s.classList.remove("active"));
        document.getElementById("work")?.classList.add("active");
      }
      renderWorkList();
    });
  }

  // Hvis man klikker "Under arbeid" manuelt i nav, vil index.html bytte seksjon.
  // Her sørger vi for at listen fylles når seksjonen vises første gang.
  const workSec = document.getElementById("work");
  if (workSec) {
    // render umiddelbart første gang man lander på seksjonen
    const obs = new MutationObserver(() => {
      if (workSec.classList.contains("active")) {
        renderWorkList();
        obs.disconnect();
      }
    });
    obs.observe(workSec, { attributes: true, attributeFilter: ["class"] });
  }
});