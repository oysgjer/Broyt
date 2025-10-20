/* =========================================================
   Work.js — “Under arbeid”
   v1.0.0
   - Tegner hele “Under arbeid”-UI-et (ingen HTML-endring kreves)
   - Fremdriftsindikator (grønn = meg, lilla = andre)
   - Start/Ferdig/Hopp over/Neste/Naviger/Ikke mulig
   - Leser/lagrer mot JSONBin (GET /latest, PUT)
   - Respekterer preferanser fra Home (BROYT_PREFS)
   ========================================================= */

/* ---------- små utils (bruk eksisterende hvis de finnes) ---------- */
const $_ = window.$  || ((s,root=document)=>root.querySelector(s));
const $$_= window.$$ || ((s,root=document)=>Array.from(root.querySelectorAll(s)));
const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtTime = t => !t ? '—' : nowHHMM(t);

const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

/* ---------- JSONBin helper (leser URL-er fra Admin) ---------- */
const JSONBIN={
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||'';},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||'';},
  get _key(){return localStorage.getItem('BROYT_XKEY')||'';},

  _headers(){
    const h={'Content-Type':'application/json'};
    const k=this._key; if(k) h['X-Master-Key']=k;
    return h;
  },

  async getLatest(){
    const url=this._getUrl;
    if(!url){ Work.setSync('lokal'); return JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null') || null; }
    try{
      const res=await fetch(url.replace(/\/latest?$/,'')+'/latest',{headers:this._headers()});
      if(!res.ok) throw new Error(res.status);
      const j=await res.json();
      Work.setSync('OK');
      return j.record||j;
    }catch(e){
      const local=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
      if(local){ Work.setSync('lokal'); return local; }
      Work.setSync('feil');
      throw e;
    }
  },

  async putRecord(obj){
    const url=this._putUrl;
    if(!url){
      localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{}));
      Work.setSync('lokal');
      return {ok:false,local:true};
    }
    try{
      const res=await fetch(url,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})});
      if(!res.ok) throw new Error(res.status);
      localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{})); // cache
      Work.setSync('OK');
      return {ok:true};
    }catch(e){
      // fall back til lokal cache
      localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{}));
      Work.setSync('feil');
      return {ok:false};
    }
  }
};

/* ---------- Work modul ---------- */
const Work=(function(){
  const S={
    // innstilling/prefs
    driver:'driver',
    dir:'Normal',                // 'Normal' | 'Motsatt'
    autoNav:false,
    mode:'snow',                 // 'snow' | 'grit'

    // data
    cloud:null,
    addresses:[],
    idx:0
  };

  // UI refs
  let elNow, elNext, elStatus, btnStart, btnDone, btnSkip, btnNext, btnNav, btnBlock;
  let barMe, barOther, barMeCount, barOtherCount, barSummary;

  function setSync(status){
    const badge = $_('#sync_badge');
    if(!badge) return;
    const dot = status==='OK'?'dot-ok':status==='lokal'?'dot-warn':status==='feil'?'dot-err':'';
    badge.innerHTML = `<span class="dot ${dot}"></span> Synk: ${status}`;
  }
  Work.setSync=setSync; // eksporter

  /* ---------- DOM tegning ---------- */
  function ensureMarkup(){
    const host = $_('#work');
    if(!host) return;

    host.innerHTML = `
      <div class="work-wrap">
        <div class="progress">
          <div id="b_prog_me" class="bar bar-me"></div>
          <div id="b_prog_other" class="bar bar-other"></div>
        </div>
        <div class="progress-meta">
          <span><span id="b_prog_me_count">0/0</span> (deg)</span>
          <span><span id="b_prog_other_count">0/0</span> (andre)</span>
          <span id="b_prog_summary">0 av 0 adresser fullført</span>
        </div>

        <div class="card">
          <div class="kicker">Aktuell adresse</div>
          <div id="b_now" class="addr-now">—</div>
          <div id="b_status" class="badge">—</div>
        </div>

        <div class="card">
          <div class="kicker">Neste</div>
          <div id="b_next" class="addr-next">—</div>
        </div>

        <div class="actions-grid">
          <button id="act_start" class="btn btn-ghost">▶️ Start</button>
          <button id="act_done"  class="btn btn-primary">✅ Ferdig</button>

          <button id="act_skip"  class="btn btn-ghost">⏭ Hopp over</button>
          <button id="act_next"  class="btn btn-ghost">➡️ Neste</button>

          <button id="act_nav"   class="btn btn-ghost">📍 Naviger</button>
          <button id="act_block" class="btn btn-danger">⛔ Ikke mulig</button>
        </div>
      </div>
    `;

    // refs
    elNow   = $_('#b_now');
    elNext  = $_('#b_next');
    elStatus= $_('#b_status');
    barMe   = $_('#b_prog_me');
    barOther= $_('#b_prog_other');
    barMeCount    = $_('#b_prog_me_count');
    barOtherCount = $_('#b_prog_other_count');
    barSummary    = $_('#b_prog_summary');

    btnStart = $_('#act_start');
    btnDone  = $_('#act_done');
    btnSkip  = $_('#act_skip');
    btnNext  = $_('#act_next');
    btnNav   = $_('#act_nav');
    btnBlock = $_('#act_block');

    btnStart?.addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
    btnDone ?.addEventListener('click',()=>stepState({state:'done',finishedAt:Date.now()},true));
    btnSkip ?.addEventListener('click',()=>stepState({state:'skipped',finishedAt:Date.now()},true));
    btnNext ?.addEventListener('click',()=>goNext());
    btnNav  ?.addEventListener('click',()=>navigateToCurrentOrNext());
    btnBlock?.addEventListener('click', async ()=>{
      const note = prompt('Hvorfor ikke mulig? (valgfritt)','')||'';
      await stepState({state:'blocked',finishedAt:Date.now(),note},false);
    });
  }

  /* ---------- helpers ---------- */
  function nextIndex(i,dir){ return dir==='Motsatt'? i-1 : i+1; }

  function statusStore(){
    const c=S.cloud||{};
    return (S.mode==='snow') ? (c.statusSnow||(c.status||{})) : (c.statusGrit||{});
  }
  function setStatusFor(name,patch){
    const bag=statusStore();
    const cur=bag[name]||{};
    bag[name]={...cur,...patch,driver:S.driver};
  }

  function mapsUrlFromAddr(addr){
    if(!addr) return 'https://www.google.com/maps';
    if(addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
      const q=addr.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
  }

  function updateProgressBars(){
    const total = S.addresses.length || 1;
    let me = 0, other = 0;

    const bag = statusStore();
    for (const k in bag){
      const st = bag[k];
      if (st && st.state === 'done'){
        if (st.driver === S.driver) me++;
        else other++;
      }
    }

    const mePct = Math.round(100 * me / total);
    const otPct = Math.round(100 * other / total);

    if(barMe)    barMe.style.width    = mePct + '%';
    if(barOther) barOther.style.width = otPct + '%';

    if(barMeCount)    barMeCount.textContent    = `${me}/${total}`;
    if(barOtherCount) barOtherCount.textContent = `${other}/${total}`;
    if(barSummary)    barSummary.textContent    = `${Math.min(me+other,total)} av ${total} adresser fullført`;
  }

  function uiSetWork(){
    const now=S.addresses[S.idx]||null;
    const next=S.addresses[nextIndex(S.idx,S.dir)]||null;

    if(elNow)   elNow.textContent   = now?(now.name||'—'):'—';
    if(elNext)  elNext.textContent  = next?(next.name||'—'):'—';

    const bag=statusStore();
    const st=(now && now.name && bag[now.name] && bag[now.name].state) || 'not_started';
    if(elStatus) { elStatus.textContent = STATE_LABEL[st]||'—'; elStatus.dataset.state = st; }

    // naviger-knappen: grå ut hvis vi mangler gyldig destinasjon (hverken coords eller navn)
    const canNav = !!now;
    btnNav?.toggleAttribute('disabled', !canNav);

    updateProgressBars();
  }

  function allDone(){
    if(!S.addresses.length) return false;
    const bag=statusStore();
    return S.addresses.every(a => (bag[a.name] && bag[a.name].state==='done'));
  }
  function maybeShowAllDoneDialog(){
    if(!allDone()) return;
    const modeTxt=(S.mode==='snow')?'Snø':'Grus';
    const go=confirm(`Alt er utført for ${modeTxt}-runden 🎉\n\nOK = Gå til Service\nAvbryt = bli`);
    if(go){
      // finnes global showPage i del-d.js
      if(typeof window.showPage==='function') window.showPage('service');
      else location.hash='#service';
    }
  }

  async function stepState(patch,nextAfter){
    await refreshCloud();
    const cur=S.addresses[S.idx]; if(!cur) return;

    // oppdater status
    setStatusFor(cur.name,{...patch});
    // logg
    logEvent({action:patch.state||'update', name:cur.name, note:patch.note||''});

    await saveCloud();
    uiSetWork();

    if(allDone()){ maybeShowAllDoneDialog(); return; }

    if(nextAfter){
      goNext(true);
    }
  }

  function goNext(alsoNav=false){
    const ni = nextIndex(S.idx,S.dir);
    if(ni>=0 && ni<S.addresses.length){
      S.idx = ni;
      localStorage.setItem('BROYT_WORK_IDX', String(S.idx));
      uiSetWork();
      if(alsoNav && S.autoNav){
        const t=S.addresses[S.idx];
        if(t) window.open(mapsUrlFromAddr(t),'_blank');
      }
    }else{
      if(typeof window.showPage==='function') window.showPage('service');
      else location.hash='#service';
    }
  }

  function navigateToCurrentOrNext(){
    const next = S.addresses[nextIndex(S.idx,S.dir)];
    const target = next || S.addresses[S.idx] || null;
    if(!target) return;
    const url = mapsUrlFromAddr(target);
    window.open(url,'_blank');
  }

  /* ---------- sky ---------- */
  async function ensureAddressesSeeded(){
    S.cloud = await JSONBIN.getLatest();
    if(!S.cloud){
      S.cloud={version:'work-1.0',updated:Date.now(),by:S.driver,
        settings:{seasonLabel:"2025–26",stakesLocked:false},
        snapshot:{addresses:[]},statusSnow:{},statusGrit:{},serviceLogs:[]};
      await JSONBIN.putRecord(S.cloud);
    }
    if(!S.cloud.snapshot) S.cloud.snapshot={addresses:[]};
    if(!Array.isArray(S.cloud.snapshot.addresses)) S.cloud.snapshot.addresses=[];
    if(!S.cloud.statusSnow) S.cloud.statusSnow={};
    if(!S.cloud.statusGrit) S.cloud.statusGrit={};
  }

  async function refreshCloud(){
    await ensureAddressesSeeded();
  }

  async function saveCloud(){
    S.cloud.updated=Date.now(); S.cloud.by=S.driver||'driver';
    await JSONBIN.putRecord(S.cloud);
  }

  function logEvent(e){
    S.cloud.serviceLogs ||= [];
    S.cloud.serviceLogs.push({
      ts: Date.now(),
      driver:S.driver,
      mode:S.mode,
      idx:S.idx,
      ...e
    });
  }

  /* ---------- init ---------- */
  async function init(){
    ensureMarkup();

    // prefs fra Home
    try{
      const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      S.driver  = (p.driver||'driver').trim() || 'driver';
      S.dir     = p.dir || 'Normal';
      S.autoNav = !!p.autoNav;
      S.mode    = p.eq && p.eq.sand ? 'grit' : 'snow';
    }catch{}

    // last sky + adresser
    await refreshCloud();

    const arr=(S.cloud.snapshot.addresses)||[];
    S.addresses = arr
      .filter(a=>a.active!==false)
      .filter(a=> S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));

    // start-posisjon
    const savedIdx = parseInt(localStorage.getItem('BROYT_WORK_IDX')||'NaN',10);
    if(!Number.isNaN(savedIdx)) S.idx=savedIdx;
    else S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

    uiSetWork();
  }

  // start når “work”-seksjonen finnes i DOM
  document.addEventListener('DOMContentLoaded', ()=>{
    // bare kjør init hvis work-siden finnes
    if($_('#work')) init();
  });

  return { setSync };
})();