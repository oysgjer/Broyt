/* === Del C: Konfig, state, helpers, lett UI-init ========================= */

/* ——— KONFIG ——— */
window.BROYTE_CFG = {
  VERSION: "9.10",
  HEARTBEAT_MS: 30000,
  BINS: {
    MASTER:    "68e774c9ae596e708f0b9977",
    CATALOG:   "68e782f3d0ea881f409ae08a",
    INBOX:     "68e7833843b1c97be95ff286",
    BACKUP:    "68e7b4d2ae596e708f0bde7d",
    REPORTS:   "68e89e3443b1c97be9611c48",
    POSITIONS: "68ed41ee43b1c97be9661c65",
    MAPLAYERS: "68ed425cae596e708f11d25f"
  },
  BASE_ADDR: "Hagavegen 8, 2072 Dal",
  GRAVEL_ADDR: "Dal pukkverk",
  FUEL_CHOICES: [
    { name: "Driv Dal",        q: "Driv Dal avgiftsfri diesel" },
    { name: "Esso Energi Dal", q: "Esso Energi Dal avgiftsfri diesel" }
  ],
  DEFAULT_TASKS: [
    "Snø + brøytestikker",
    "Snø og grus + brøytestikker"
  ],
  // Fallback nøkkel – kan overstyres i Hjem-fanen
  DEFAULT_API_KEY: "$2a$10$DK3EUoEj/YsimWzgYG.DMOb4aEFFUiRPdJgmkOzfPQ3Jx2evIIWma"
};

// Back-compat (bruker samme verdi)
window.DEFAULT_JSONBIN_KEY = window.BROYTE_CFG.DEFAULT_API_KEY;
if (!localStorage.getItem("broyte_api_key")) {
  localStorage.setItem("broyte_api_key", window.DEFAULT_JSONBIN_KEY);
}

/* ——— STATE ——— */
const LS_KEY = "broyte_v910_state";
let state = loadState() || makeDefaultState();

function makeDefaultState(){
  return {
    role:"driver1",
    direction:"forward",
    equipment:{ plog:true, fres:false, stro:false },
    autoCheck:true,
    hanske:false,
    useCustomName:false,
    customName:"",
    theme:"auto",

    stops:[],

    service:{
      plog:false, fres:false, stro:false,
      oilFront:false, oilBack:false, steering:false,
      other:false, notes:""
    },

    lastSyncAt:null,
    lastSyncBy:"",
    ui:{ pinFilter:"all", adminPinFilter:"all", cursor:0 },
    lastActiveAt:Date.now(),
    dayLog:{ dateKey:dateKey(new Date()), entries:[] }
  };
}

/* ——— STORAGE + API HEADERS ——— */
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||""); }catch{ return null; } }
function apiKey(){
  return localStorage.getItem("broyte_api_key")
      || window.BROYTE_CFG.DEFAULT_API_KEY
      || window.DEFAULT_JSONBIN_KEY
      || "";
}
function headers(){ return {"Content-Type":"application/json","X-Master-Key": apiKey()}; }

/* ——— HELPERS ——— */
const $ = id => document.getElementById(String(id).replace(/^#/, ''));
const esc = s => String(s ?? "");
const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString("no-NO",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—";
const fmtDT   = ts => ts ? new Date(ts).toLocaleString("no-NO") : "—";

function displayName(){
  return state.useCustomName && state.customName ? state.customName : (state.role || "Sjåfør");
}
function dateKey(d){ return d.toISOString().slice(0,10); }
function seasonKey(){
  const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
  return m>=7 ? `${y}/${(y+1).toString().slice(-2)}` : `${y-1}/${y.toString().slice(-2)}`;
}
function touchActivity(){ state.lastActiveAt = Date.now(); save(); }
function applyTheme(mode){ document.documentElement.dataset.theme = mode; }

function idxList(){
  const rem = state.stops.map((s,i)=>({i,s})).filter(x=>!x.s.f && !x.s.b).map(x=>x.i);
  return state.direction==="forward" ? rem : rem.slice().reverse();
}
function cur(){
  const l = idxList();
  const c = (state.ui?.cursor ?? 0);
  if (!l.length) return null;
  const pos = Math.min(c, l.length - 1);
  return state.stops[l[pos]];
}
function curIndex(){
  const l = idxList();
  const c = (state.ui?.cursor ?? 0);
  if (!l.length) return -1;
  const pos = Math.min(c, l.length - 1);
  return l[pos];
}
function nxt(){
  const l = idxList();
  const c = (state.ui?.cursor ?? 0);
  if (l.length <= c + 1) return null;
  return state.stops[l[c+1]];
}
function prog(){
  const total=state.stops.length;
  const done=state.stops.filter(s=>s.f).length;
  const blocked=state.stops.filter(s=>s.b).length;
  const cleared=done+blocked;
  const pct = total? Math.round(100*cleared/total):0;
  return {total,done,blocked,cleared,pct};
}

function navTo(address){ if(!address) return; location.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(address); }
function mapsSearch(q){ location.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q); }

/* Geo footer (lett) */
function initGeolocation(){
  const posEl = $("pos"); if(!posEl) return;
  if(!navigator.geolocation){ posEl.textContent="Posisjon ikke tilgjengelig"; return; }
  const fmt=n=>Number.isFinite(n)?n.toFixed(5):"—";
  navigator.geolocation.watchPosition(
    (p)=>{ const {latitude,longitude,accuracy}=p.coords||{}; posEl.textContent = `${fmt(latitude)}, ${fmt(longitude)} (±${Math.round(accuracy||0)} m)`; },
    ()=>{ posEl.textContent = "Posisjon utilgjengelig"; },
    { enableHighAccuracy:true, maximumAge:5000, timeout:15000 }
  );
}

/* Førstegangs default-adresser */
function bootDefaults(){
  if(!Array.isArray(state.stops)) state.stops=[];
  if(state.stops.length===0){
    const T = window.BROYTE_CFG.DEFAULT_TASKS;
    state.stops = [
      { n:"AMFI Eidsvoll (Råholt)", t:T[0], f:false, b:false, p:[], twoDriverRec:false, pinsCount:0, pinsLockedYear:null },
      { n:"Råholt barneskole",      t:T[1], f:false, b:false, p:[], twoDriverRec:true,  pinsCount:0, pinsLockedYear:null },
      { n:"Råholt ungdomsskole",    t:T[0], f:false, b:false, p:[], twoDriverRec:false, pinsCount:0, pinsLockedYear:null }
    ];
    save();
  }
}

/* Eksporter helpers til andre deler */
window.BroyteHelpers = {
  $, save, loadState, apiKey, headers, esc, fmtTime, fmtDT,
  displayName, dateKey, seasonKey, touchActivity, applyTheme,
  idxList, cur, curIndex, nxt, prog, navTo, mapsSearch,
  initGeolocation, bootDefaults, state
};

/* ——— Lett UI-init (tabs + baseline) ———
   Dette gjør at appen er klikkbar selv før Del F er lastet. */
document.addEventListener("DOMContentLoaded", ()=>{
  try{
    // Tabs
    document.querySelectorAll(".tab").forEach(btn=>{
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
        document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
        btn.classList.add("active");
        const page = document.getElementById("page-"+btn.dataset.tab);
        if (page) page.classList.add("active");

        // Kall renderer hvis senere deler har satt dem
        if (btn.dataset.tab==="work"     && window.BroyteWork?.renderWork)     window.BroyteWork.renderWork();
        if (btn.dataset.tab==="register" && window.BroyteWork?.renderRegister) window.BroyteWork.renderRegister();
        if (btn.dataset.tab==="admin"    && window.BroyteWork?.renderAdmin)    window.BroyteWork.renderAdmin();
      });
    });

    // Fyll inn standardverdier i Hjem
    $("#role")        && ($("#role").value = state.role);
    $("#direction")   && ($("#direction").value = state.direction);
    $("#eq_plog")     && ($("#eq_plog").checked = !!state.equipment.plog);
    $("#eq_fres")     && ($("#eq_fres").checked = !!state.equipment.fres);
    $("#eq_stro")     && ($("#eq_stro").checked = !!state.equipment.stro);
    $("#autoCheck")   && ($("#autoCheck").checked = !!state.autoCheck);
    document.body.classList.toggle("hanske", !!state.hanske);
    $("#useCustomName") && ($("#useCustomName").checked = !!state.useCustomName);
    $("#customName")    && ($("#customName").value = state.customName || "",
                            $("#customName").style.display = state.useCustomName ? "block" : "none");
    $("#themeSel")    && ($("#themeSel").value = state.theme || "auto");
    applyTheme(state.theme||"auto");

    // Oppgave-valg i "Legg til"
    const taskSel = $("#taskSel");
    if (taskSel){
      taskSel.innerHTML = window.BROYTE_CFG.DEFAULT_TASKS.map(t=>`<option>${esc(t)}</option>`).join("");
    }

    // Footer versjon
    const footerVer = document.querySelector('.footer div:last-child');
    if (footerVer) footerVer.textContent = `v${window.BROYTE_CFG.VERSION} – Romerike Trefelling`;

    // Geolokasjon i footer
    initGeolocation();

    // Default-stops + første render (hvis Del F/Del D ikke er lastet ennå gjør dette i det minste Hjem → Work mulig)
    bootDefaults();
    window.BroyteWork?.renderRegister?.();
    window.BroyteWork?.renderWork?.();

  }catch(err){
    console.error('Init-feil (Del C):', err);
  }
});

/* ——— Mykt feilbanner i bunn (hjelper under feilsøk) ——— */
window.addEventListener('error', (ev) => {
  try{
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#b00020;color:#fff;padding:8px 12px;font:12px system-ui;z-index:99999';
    bar.textContent = 'JS-feil: ' + (ev.message || 'ukjent') + (ev.filename ? ' @ ' + ev.filename + ':' + ev.lineno : '');
    document.body.appendChild(bar);
    console.error('JS error', ev);
  }catch(_){}
});
