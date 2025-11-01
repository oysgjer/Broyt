<!-- lastes allerede i index.html med: <script src="js/home_dashboard.js" defer></script> -->
// home_dashboard.js — Hjem-panelet: fakta, brøytetid (total/måned/uke/dag), siste oppdrag, vær (+ 3 timer)

(function () {
  // ——— KONFIG ———
  // Sett flere BINs via localStorage:
  //  JSONBIN_BIN_IDS: '["bin1","bin2"]'
  //  JSONBIN_KEYS:    '{"bin1":"key1","bin2":"key2"}'
  //  X_MASTER_KEY:    "..." (fallback hvis JSONBIN_KEYS ikke finnes)
  const DEFAULT_BINS = ["68e89e3443b1c97be9611c48"]; // standard event-bin hvis ikke annet er lagret

  function getBinIds() {
    try {
      const raw = localStorage.getItem("JSONBIN_BIN_IDS");
      const a = raw ? JSON.parse(raw) : null;
      if (Array.isArray(a) && a.length) return a;
    } catch {}
    return DEFAULT_BINS.slice();
  }
  function getKeyForBin(binId) {
    try {
      const map = JSON.parse(localStorage.getItem("JSONBIN_KEYS") || "{}");
      if (map && typeof map[binId] === "string" && map[binId].length > 10) return map[binId];
    } catch {}
    return localStorage.getItem("X_MASTER_KEY") || localStorage.getItem("JSONBIN_MASTER_KEY") || null;
  }

  // ——— HJELPERE ———
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const asDate = (v) => (v ? new Date(v) : null);
  const startOfDay  = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d) => {
    const c = new Date(d); const dow = c.getDay(); // 0=Sun..6=Sat
    const md = dow === 0 ? -6 : 1 - dow;           // ISO uke: mandag = 1
    c.setDate(c.getDate() + md);
    c.setHours(0,0,0,0);
    return c;
  };
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtHhMm = (mins) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h ? `${h}t ${m}m` : `${m}m`;
  };
  const monthNameNo = (i) => ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"][i] || "";
  function fmtDateShort(d) { // "31. okt"
    return `${d.getDate()}. ${monthNameNo(d.getMonth())}`;
  }

  // ——— 1) FUNFACT ———
  const FUNFACTS = [
    "En plog på 3 meter i 10 km/t flytter nær 30 tonn snø i minuttet.",
    "Snøkrystaller kan være sekskantede og hule – derfor pakker de seg rart.",
    "Litt silikon på skjæret gjør at snøen slipper lettere.",
    "Våt 5 cm snø ≈ over 50 liter vann pr. m².",
    "Hydraulikk liker det varmt – gi den et minutt før første løft.",
    "En Ariens 28” kan flytte over 75 tonn snø i timen.",
    "Smør fresen før du smører deg selv 😉",
  ];
  function renderFunfact() {
    const i = new Date().getDate() % FUNFACTS.length;
    const box = $("#funfact");
    if (box) box.innerHTML = `<strong>❄️ Dagens brøytefakta:</strong><br>${FUNFACTS[i]}`;
  }

  // ——— 2) HENT HENDELSER ———
  async function fetchLatestForBin(binId) {
    const key = getKeyForBin(binId);
    if (!key) return [];
    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const r = await fetch(url, { headers: { "X-Master-Key": key } });
    if (!r.ok) return [];
    const j = await r.json();
    const rec = j && j.record;
    // Støtt både {reports:[]} og [events]
    return Array.isArray(rec) ? rec : (rec && Array.isArray(rec.reports) ? rec.reports : []);
  }
  async function getAllEvents() {
    const bins = getBinIds();
    const lists = await Promise.all(bins.map(fetchLatestForBin));
    const all = lists.flat().filter(Boolean);
    all.sort((a, b) => new Date(a.ts || a.t || 0) - new Date(b.ts || b.t || 0));
    return all;
  }

  // ——— 3) PAR “start/ferdig” til intervaller ———
  function pairIntervals(events) {
    const keyOf = (e) =>
      [
        (e.address || e.addr || "").trim(),
        (e.driver || "").trim(),
        (e.task || e.oppgave || "").trim(),
      ].join("｜");

    const groups = new Map();
    for (const e of events) {
      const k = keyOf(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }

    const rows = [];
    for (const [, arr] of groups) {
      arr.sort((a, b) => new Date(a.ts || a.t) - new Date(b.ts || b.t));
      let open = null;
      for (const e of arr) {
        const action = (e.action || e.a || "").toLowerCase();
        if (action === "start" && !open) {
          open = e;
        } else if (action === "ferdig" && open) {
          rows.push({
            address: (e.address || open.address || "").trim(),
            driver:  (e.driver  || open.driver  || "").trim(),
            task:    (e.task    || open.task    || e.oppgave || open.oppgave || "").trim() || "Snø",
            start:   asDate(open.ts || open.t),
            end:     asDate(e.ts   || e.t),
          });
          open = null;
        }
      }
      // uparret start ignoreres i statistikk (mangler slutt)
    }
    rows.sort((a, b) => (b.end?.getTime() || 0) - (a.end?.getTime() || 0));
    return rows;
  }

  // ——— 4) BRØYTETID: total / måned / uke / dag ———
  function minsBetween(a, b) { return Math.max(0, (b - a) / 60000); }

  function renderStats(rows) {
    const box = $("#stats"); if (!box) return;

    const now = new Date();
    const sod = startOfDay(now);
    const sow = startOfWeek(now);
    const som = startOfMonth(now);

    const done = rows.filter((r) => r.start && r.end);

    const total = done.reduce((s, r) => s + minsBetween(r.start, r.end), 0);
    const thisMonth = done
      .filter((r) => r.start >= som || r.end >= som)
      .reduce((s, r) => s + minsBetween(r.start, r.end), 0);
    const thisWeek = done
      .filter((r) => r.start >= sow || r.end >= sow)
      .reduce((s, r) => s + minsBetween(r.start, r.end), 0);
    const today = done
      .filter((r) => r.start >= sod || r.end >= sod)
      .reduce((s, r) => s + minsBetween(r.start, r.end), 0);

    box.innerHTML = `
      <strong>📊 Samlet brøytetid</strong><br>
      Totalt: <b>${fmtHhMm(total)}</b><br>
      Denne måneden: <b>${fmtHhMm(thisMonth)}</b><br>
      Denne uken: <b>${fmtHhMm(thisWeek)}</b><br>
      I dag: <b>${fmtHhMm(today)}</b>
    `;
  }

  // ——— 5) VÆR ——— (nå + neste 3 timer)
  function tryReadWxCache() {
    try {
      if (window.__WX__) return window.__WX__;
      const raw = localStorage.getItem("WX_CACHE");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function renderWeather() {
    const box = $("#weather"); if (!box) return;

    const cache = tryReadWxCache();

    const nowTempEl = document.getElementById("wx_temp");
    const nowDescEl = document.getElementById("wx_desc");
    const fallbackNow = [nowTempEl?.textContent || "", nowDescEl?.textContent || ""].join(" ").trim();

    if (!cache && !fallbackNow) {
      box.innerHTML = `<strong>🌦️ Vær nå:</strong><br>Henter…`;
      try { if (typeof window.loadWeather === "function") window.loadWeather(); } catch {}
      return;
    }

    const nowLine = cache?.current
      ? `${cache.current.temp ?? ""} ${cache.current.desc ?? ""}`.trim()
      : fallbackNow;

    let html = `<strong>🌦️ Vær nå:</strong><br>${nowLine || "—"}`;

    if (Array.isArray(cache?.hourly) && cache.hourly.length) {
      const now = Date.now();
      const next3 = cache.hourly
        .filter((h) => new Date(h.t ?? h.time ?? h.dt).getTime() > now)
        .slice(0, 3)
        .map((h) => {
          const tt = new Date(h.t ?? h.time ?? h.dt);
          const temp = (h.temp ?? h.temperature ?? "").toString().replace(/\.0$/, "");
          const desc = h.desc ?? h.description ?? "";
          const hh = pad(tt.getHours());
          const mm = pad(tt.getMinutes());
          return `<li><b>${hh}:${mm}</b> ${temp ? `${temp}°` : ""} ${desc}</li>`;
        });
      if (next3.length) {
        html += `<div class="muted" style="margin-top:6px"><b>Neste 3 t:</b>` +
                `<ul style="margin:4px 0 0 18px; padding:0; list-style:disc">${next3.join("")}</ul></div>`;
      }
    }

    box.innerHTML = html;
  }

  // ——— 6) SISTE OPPDRAG ———
  function renderRecent(rows) {
    const box = $("#recent"); if (!box) return;
    const done = rows.filter((r) => r.start && r.end);
    const latest = done.slice(0, 4);
    if (!latest.length) {
      box.innerHTML = `<strong>🧭 Siste oppdrag</strong><br><em>Ingen fullførte oppdrag enda.</em>`;
      return;
    }
    const li = latest.map((r) => {
      const when  = r.end ? `${fmtDateShort(r.end)} ${fmtClock(r.end)}` : "–";
      const mins  = minsBetween(r.start, r.end);
      const took  = fmtHhMm(mins);
      const task  = r.task || "Snø";
      const addr  = r.address || "";
      return `<li><b>${when}</b> — ${addr} <span class="muted">(${task}, ${took})</span></li>`;
    }).join("");
    box.innerHTML = `<strong>🧭 Siste oppdrag</strong><ul>${li}</ul>`;
  }

  // ——— MAIN ———
  async function init() {
    try { renderFunfact(); } catch {}
    try { renderWeather(); } catch {}

    // re-render vær når broen pusher nye data
    window.addEventListener("wx:update", () => { try { renderWeather(); } catch {} });

    // hent hendelser og bygg visning
    try {
      const all  = await getAllEvents();
      const rows = pairIntervals(all);
      renderStats(rows);
      renderRecent(rows);
    } catch (e) {
      console.warn("Dashboard feilet:", e);
      $("#stats")  && ($("#stats").textContent  = "Kunne ikke hente data.");
      $("#recent") && ($("#recent").textContent = "Kunne ikke hente data.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();