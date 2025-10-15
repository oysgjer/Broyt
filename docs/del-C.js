/* ===== del-C.js (CORE / lokal grunnmur v9.12-L) ===== */
(()=>{

  const Core = (window.Core = window.Core || {});

  Core.cfg = {
    VERSION: "9.12-L",
    DEFAULT_TASKS: ["Snø + brøytestikker","Snø og grus + brøytestikker"],
    LS_KEYS: {
      STATE: "broyte_v912L_state",
      CATALOG: "broyte_v912L_catalog"
    }
  };

  /* ---------- helpers ---------- */
  Core.$   = (id) => document.getElementById(String(id).replace(/^#/,''));
  Core.qs  = (sel,root=document)=>root.querySelector(sel);
  Core.qsa = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
  Core.log = (...a)=>console.log(...a);
  Core.fmtTime = ts => ts? new Date(ts).toLocaleTimeString("no-NO",{hour:'2-digit',minute:'2-digit'}) : "—";
  Core.fmtDT   = ts => ts? new Date(ts).toLocaleString("no-NO") : "—";
  Core.dateKey = (d)=> (d||new Date()).toISOString().slice(0,10);

  /* ---------- state ---------- */
  Core.makeDefaultState = ()=>({
    role:"driver1",
    customName:"",
    useCustomName:true,
    direction:"forward",
    equipment:{ skjaer:true, fres:false, strokasse:false },
    hanske:false,
    ui:{cursor:0},
    stops:[],           // dagens runde (kopi av katalog)
    dayLog:{dateKey:Core.dateKey(new Date()), entries:[]},
    serviceHistory:[]
  });

  Core.save = ()=> localStorage.setItem(Core.cfg.LS_KEYS.STATE, JSON.stringify(Core.state));
  Core.load = ()=> {
    try{
      const raw = localStorage.getItem(Core.cfg.LS_KEYS.STATE);
      return raw? JSON.parse(raw): null;
    }catch{ return null }
  };

  /* ---------- katalog (lokal) ---------- */
  Core.getCatalog = ()=> {
    try{
      const raw = localStorage.getItem(Core.cfg.LS_KEYS.CATALOG);
      if (raw) return JSON.parse(raw);
    }catch{}
    // første gangs minimal katalog
    const first = {
      version: Core.cfg.VERSION,
      addresses: [
        {name:"Hjæramoen 12-24", task:Core.cfg.DEFAULT_TASKS[1], twoDriverRec:false, pinsCount:0, pinsLocked:false, active:true},
        {name:"Hjerastubben 8, 10, 12, 14, 16", task:Core.cfg.DEFAULT_TASKS[1], twoDriverRec:false, pinsCount:0, pinsLocked:false, active:true},
        {name:"Hjæramoen 32-34-40-42", task:Core.cfg.DEFAULT_TASKS[0], twoDriverRec:false, pinsCount:0, pinsLocked:false, active:true}
      ]
    };
    localStorage.setItem(Core.cfg.LS_KEYS.CATALOG, JSON.stringify(first));
    return first;
  };

  Core.setCatalog = (cat)=> localStorage.setItem(Core.cfg.LS_KEYS.CATALOG, JSON.stringify(cat||{version:Core.cfg.VERSION,addresses:[]}));

  Core.cloneRoundFromCatalog = ()=>{
    const cat = Core.getCatalog();
    Core.state.stops = (cat.addresses||[])
      .filter(a=>a.active!==false)
      .map(a=>({
        n:a.name, t:a.task, two:a.twoDriverRec||false, pins:a.pinsCount||0, lock:a.pinsLocked||false,
        startAt:null, endAt:null, status:"ny" // ny|gar|ferdig|umulig
      }));
    Core.state.ui.cursor = 0;
    Core.save();
  };

  /* ---------- eksport / import hjelpere ---------- */
  Core.download = (filename, data, type="application/json")=>{
    const blob = new Blob([data], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  };

  /* ---------- DOM ready ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    Core.state = Core.load() || Core.makeDefaultState();
    const f = document.querySelector('footer');
    if (f) f.textContent = `v${Core.cfg.VERSION} – Romerike Trefelling`;
    Core.log("del-C.js (core) lastet");
  });

})();