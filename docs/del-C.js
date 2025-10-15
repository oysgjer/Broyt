/* ===== del-C.js (CORE / hybrid grunnmur) ===== */
(() => {
  const Core = (window.Core = window.Core || {});

  /* ---------- Konfig ---------- */
  Core.cfg = {
    VERSION: "9.12h",      // hybridversjon
    HYBRID: true,          // aktiver lokal + valgfri sky-synk

    // JSONBin (bare brukt hvis API-nøkkel finnes)
    BINS: {
      MASTER:   "68e774c9ae596e708f0b9977",
      CATALOG:  "68e782f3d0ea881f409ae08a",
      BACKUP:   "68e7b4d2ae596e708f0bde7d",
      INBOX:    "68e7833843b1c97be95ff286",
      REPORTS:  "68e89e3443b1c97be9611c48",
      POSITIONS:"68ed41ee43b1c97be9661c65",
      MAPLAYERS:"68ed425cae596e708f11d25f"
    },

    DEFAULT_TASKS: [
      "Snø + brøytestikker",
      "Snø og grus + brøytestikker"
    ],

    DEFAULT_API_KEY:
      "$2a$10$DK3EUoEj/YsimWzgYG.DMOb4aEFFUiRPdJgmkOzfPQ3Jx2evIIWma"
  };

  /* ---------- Små helpers ---------- */
  Core.$   = (id) => document.getElementById(String(id).replace(/^#/, ""));
  Core.qs  = (sel, root=document) => root.querySelector(sel);
  Core.qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  Core.esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]
  ));
  Core.log = (...a) => console.log(...a);

  /* ---------- Dato/visning ---------- */
  Core.dateKey = (d) => (d||new Date()).toISOString().slice(0,10);
  Core.seasonKey = () => {
    const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
    return m>=7 ? `${y}/${(y+1).toString().slice(-2)}`
                : `${y-1}/${y.toString().slice(-2)}`;
  };
  Core.displayName = () => {
    const s = Core.state || {};
    return (s.useCustomName && s.customName) ? s.customName : (s.role || "Sjåfør");
  };

  /* ---------- Lokal lagring / state ---------- */
  const LS_KEY = "broyte_v912h_state";

  Core.makeDefaultState = () => ({
    role:"driver1",
    direction:"forward",
    equipment:{skjaer:true,fres:false,stroekasse:false},
    autoCheck:true,
    hanske:false,
    useCustomName:false,
    customName:"",
    theme:"auto",

    // arbeidsliste
    stops:[],

    // service
    service:{
      skjaer:false, fres:false, stroekasse:false,
      oilFront:false, oilBack:false, oilFilled:false,
      diesel:false, steering:false, other:false, notes:""
    },

    lastSyncAt:null,
    lastSyncBy:"",
    ui:{ pinFilter:"all", adminPinFilter:"all", cursor:0 },
    lastActiveAt:Date.now(),
    dayLog:{ dateKey:Core.dateKey(new Date()), entries:[] }
  });

  Core.save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(Core.state)); } catch(_){} };
  Core.load = () => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch(_) { return null; } };

  /* ---------- API-nøkkel / headers ---------- */
  Core.apiKey = () =>
    localStorage.getItem("broyte_api_key") ||
    Core.cfg.DEFAULT_API_KEY || "";

  Core.headers = () => ({
    "Content-Type": "application/json",
    "X-Master-Key": Core.apiKey()
  });

  /* ---------- Oppgavetekst ---------- */
  Core.normalizeTask = (t) => {
    t = String(t || "").trim();
    return /brøytestikker/i.test(t) ? t : (t ? `${t} + brøytestikker` : "Snø + brøytestikker");
  };

  /* ---------- Katalog fra sky ---------- */
  Core.fetchCatalog = async () => {
    try {
      if (!Core.cfg.HYBRID) throw "Hybrid off";
      const key = Core.apiKey();
      if (!key) throw "Ingen nøkkel – hopper over sky";
      const { CATALOG } = Core.cfg.BINS;
      const res = await fetch(`https://api.jsonbin.io/v3/b/${CATALOG}/latest`, {
        headers: Core.headers()
      });
      if (!res.ok) throw new Error("Feil ved henting");
      const js = await res.json();
      console.log("Katalog hentet (core hybrid)", js);
      return js?.record || {};
    } catch (e) {
      console.warn("fetchCatalog-feil (lokal fallback):", e);
      const local = Core.load();
      return local?.stops?.length ? { addresses: local.stops } : { addresses: [] };
    }
  };

  /* ---------- Første init ---------- */
  function bootDefaults(){
    const S = Core.state;
    if (!Array.isArray(S.stops)) S.stops = [];
    if (S.stops.length === 0){
      const T = Core.cfg.DEFAULT_TASKS;
      S.stops = [
        { n:"AMFI Eidsvoll (Råholt)", t:T[0], f:false, b:false, p:[], twoDriverRec:false, pinsCount:0, pinsLockedYear:null },
        { n:"Råholt barneskole",      t:T[1], f:false, b:false, p:[], twoDriverRec:true,  pinsCount:0, pinsLockedYear:null },
        { n:"Råholt ungdomsskole",    t:T[0], f:false, b:false, p:[], twoDriverRec:false, pinsCount:0, pinsLockedYear:null }
      ];
      Core.save();
    }
  }

  /* ---------- Formattere ---------- */
  Core.fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString("no-NO",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—";
  Core.fmtDT   = (ts) => ts ? new Date(ts).toLocaleString("no-NO") : "—";
  Core.touchActivity = () => { if (Core.state){ Core.state.lastActiveAt = Date.now(); Core.save(); } };

  /* ---------- Init visning og heartbeat ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    Core.state = Core.load() || Core.makeDefaultState();

    // Sett versjon i footer
    const footer = document.querySelector("footer");
    if (footer && !footer.textContent.includes(Core.cfg.VERSION)){
      footer.textContent = `v${Core.cfg.VERSION} – Romerike Trefelling`;
    }

    bootDefaults();
    Core.log(`del-C.js (core hybrid ${Core.cfg.VERSION}) lastet`);
  });

  /* ---------- Felles status (lokal + hybrid) ---------- */
  Core.status = (() => {
    const BIN = Core.cfg.BINS.POSITIONS;
    let pollTimer = null, beatTimer = null;

    async function readAll() {
      if (!Core.cfg.HYBRID) return {};
      try {
        const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN}/latest`, { headers: Core.headers() });
        if (!r.ok) throw 0;
        const js = await r.json();
        return js?.record || {};
      } catch { return {}; }
    }

    async function writeAll(obj) {
      if (!Core.cfg.HYBRID) return;
      try {
        await fetch(`https://api.jsonbin.io/v3/b/${BIN}`, {
          method: "PUT",
          headers: Core.headers(),
          body: JSON.stringify(obj || {})
        });
      } catch(e){ console.warn("writeAll-feil:", e); }
    }

    async function updateSelf(extra={}) {
      const name = (Core.state.customName || "Ukjent").trim() || "Ukjent";
      const localStamp = Date.now();
      Core.state.lastActiveAt = localStamp;
      Core.save();

      if (!Core.cfg.HYBRID) return; // kun lokal

      const all = await readAll();
      all[name] = {
        name,
        ts: localStamp,
        progress: extra.progress ?? 0,
        current: extra.current || "",
        direction: Core.state.direction || "forward",
        equipment: Core.state.equipment || {}
      };
      await writeAll(all);
    }

    function startHeartbeat() {
      if (beatTimer) return;
      updateSelf({ progress: 0 });
      beatTimer = setInterval(()=> updateSelf({ progress: 0 }), 30000);
    }

    function startPolling(cb) {
      if (pollTimer) return;
      const tick = async () => {
        const all = await readAll();
        const list = Object.values(all).sort((a,b)=> (b.ts||0)-(a.ts||0));
        cb && cb(list);
      };
      tick();
      pollTimer = setInterval(tick, 20000);
    }

    return { updateSelf, startHeartbeat, startPolling };
  })();
})();