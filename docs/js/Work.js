/* ====== Work.js — funksjonell «Under arbeid» ======
   Viser statuslinje, aktuell/neste adresse, og knapper som oppdaterer sky.
   Avhengigheter: del-d.js (for routing) og styles.css/work.css for utseende.
*/
(function(){
  /* --- isolerte hjelpere (unngå navnekollisjon) --- */
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
  const fmtTime = t => !t ? '—' : nowHHMM(t);
  const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

  /* --- global app-tilstand (kapslet) --- */
  const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null,lastSync:0};

  /* ------------------- JSONBin helper -------------------- */
  const JSONBIN={
    get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||'';},
    get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||'';},
    get _key(){return localStorage.getItem('BROYT_XKEY')||'';},
    hasAll(){ return !!(this._getUrl && this._putUrl); },
    setUrlPair(g,p){ if(g) localStorage.setItem('BROYT_BIN_URL',g); if(p) localStorage.setItem('BROYT_BIN_PUT',p); },
    setKey(k){ const v=(k||'').trim(); if(!v){localStorage.removeItem('BROYT_XKEY');return false;} localStorage.setItem('BROYT_XKEY',v); return true; },
    clearKey(){ localStorage.removeItem('BROYT_XKEY'); },
    async getLatest(){
      const url=this._getUrl;
      if(!url) return this._localFallback();
      const res=await fetch(url,{headers:this._headers()});
      if(!res.ok) throw new Error('GET '+res.status);
      const j=await res.json(); return j.record||j;
    },
    async putRecord(obj){
      const url=this._putUrl;
      if(!url){ localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{})); return {ok:false,local:true}; }
      const res=await fetch(url,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})});
      if(!res.ok) throw new Error('PUT '+res.status);
      return {ok:true};
    },
    _headers(){
      const h={'Content-Type':'application/json'};
      const k=this._key; if(k) h['X-Master-Key']=k;
      return h;
    },
    _localFallback(){
      const local=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
      if(local) return local;
      return {version:'10.5.0',updated:Date.now(),by:'local',
        settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",seasonLabel:"2025–26",stakesLocked:false},
        snapshot:{addresses:[]},statusSnow:{},statusGrit:{},serviceLogs:[]};
    }
  };

  /* ----------------- seed liste ----------------- */
  function seedAddressesList(){
    const base=[
      "Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42",
      "Hjeramoen vei til 32-34-40-42","Hjeramoen 47-49-51-53","Hjeramoen 48-50-52-54",
      "Hjerakroken 2-4","Vognvegen 17","Tunlandvegen","Bjørnsrud Skog 38",
      "Trondheimsvegen 26-36","Sessvollvegen 9","Sessvollvegen 11","Mette Hasler",
      "Henning Morken Hasler","Hasler Drivhus","Grendehuset","Søjordet","Folkeparken",
      "Folkeparken Bakke","Læringsverkstedet Parkering","Læringsverkstedet Ute området",
      "Hagamoen","(Sjøviken) Hagamoen 12","Moen Nedre vei","Fred/ Moen Nedre 17",
      "Odd/ Moen Nedre 15","Trondheimsvegen 86","Fjellet (400m vei Råholt)",
      "Bilextra (hele bygget)","Lundgårdstoppen","Normann Hjellesveg"
    ];
    return base.map(n=>({name:n,group:"",active:true,flags:{snow:true,grit:false},stakes:'',coords:''}));
  }

  /* ----------------- cloud helpers ----------------- */
  async function ensureAddressesSeeded(){
    S.cloud = await JSONBIN.getLatest();
    const arr = Array.isArray(S.cloud?.snapshot?.addresses) ? S.cloud.snapshot.addresses : [];
    if(arr.length>0) return;
    const list=seedAddressesList();
    if(!S.cloud) S.cloud={};
    if(!S.cloud.snapshot) S.cloud.snapshot={};
    S.cloud.snapshot.addresses=list;
    if(!S.cloud.statusSnow) S.cloud.statusSnow={};
    if(!S.cloud.statusGrit) S.cloud.statusGrit={};
    localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
    await JSONBIN.putRecord(S.cloud);
  }
  async function refreshCloud(){
    S.cloud = await JSONBIN.getLatest();
    if(S.cloud && !S.cloud.statusSnow && S.cloud.status) S.cloud.statusSnow=S.cloud.status;
    if(!S.cloud.statusSnow) S.cloud.statusSnow={};
    if(!S.cloud.statusGrit) S.cloud.statusGrit={};
    if(!S.cloud.settings)   S.cloud.settings={seasonLabel:"2025–26",stakesLocked:false};
    // eksponer litt for quick actions i del-d.js
    window.BROYT = {cloud:S.cloud};
  }
  async function saveCloud(){
    S.cloud.updated=Date.now(); S.cloud.by=S.driver||'driver';
    localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
    await JSONBIN.putRecord(S.cloud);
  }
  function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
  const nextIndex=(i,d)=> d==='Motsatt' ? i-1 : i+1;

  /* ----------------- Maps helper ----------------- */
  function mapsUrlFromAddr(addr){
    if(!addr) return 'https://www.google.com/maps';
    if(addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
      const q=addr.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
  }

  /* ----------------- WORK UI ----------------- */
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
    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm && bm.style) bm.style.width = mePct + '%';
    if (bo && bo.style) bo.style.width = otPct + '%';
    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  function uiSetWork(){
    const now = S.addresses[S.idx] || null;
    const next = S.addresses[nextIndex(S.idx,S.dir)] || null;
    $('#b_now')  && ($('#b_now').textContent  = now ? (now.name||'—') : '—');
    $('#b_next') && ($('#b_next').textContent = next ? (next.name||'—') : '—');
    const bag=statusStore();
    const st=(now && now.name && bag[now.name] && bag[now.name].state) || 'not_started';
    $('#b_status') && ($('#b_status').textContent = STATE_LABEL[st]||'—');
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
    if(go) window.showPage && window.showPage('service');
  }

  function setStatusFor(name,patch){
    const bag=statusStore();
    const cur=bag[name]||{};
    bag[name]={...cur,...patch,driver:S.driver};
  }
  async function stepState(patch,nextAfter=true){
    await refreshCloud();
    const cur=S.addresses[S.idx]; if(!cur) return;
    setStatusFor(cur.name,{...patch});
    await saveCloud();
    uiSetWork();

    if(allDone()){ maybeShowAllDoneDialog(); return; }

    if(nextAfter){
      const ni=nextIndex(S.idx,S.dir);
      if(ni>=0 && ni<S.addresses.length){
        S.idx=ni; uiSetWork();
        if(S.autoNav){
          const t=S.addresses[S.idx];
          if(t) window.open(mapsUrlFromAddr(t),'_blank');
        }
      }else{
        window.showPage && window.showPage('service');
      }
    }
  }

  /* ----------------- INIT: bind knapper og last data ----------------- */
  window.addEventListener('DOMContentLoaded', async ()=>{
    // knapper
    $('#act_start') && $('#act_start').addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
    $('#act_done')  && $('#act_done').addEventListener('click',()=>stepState({state:'done',finishedAt:Date.now()}));
    $('#act_skip')  && $('#act_skip').addEventListener('click',()=>stepState({state:'skipped',finishedAt:Date.now()}));
    $('#act_block') && $('#act_block').addEventListener('click',()=>{
      const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||'';
      stepState({state:'blocked',finishedAt:Date.now(),note:reason});
    });
    $('#act_nav')   && $('#act_nav').addEventListener('click', ()=>{
      const next = S.addresses[nextIndex(S.idx,S.dir)];
      const target = next || S.addresses[S.idx] || null;
      if(!target) return;
      window.open(mapsUrlFromAddr(target),'_blank');
    });

    try{
      // prefs fra Home
      try{
        const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
        S.driver=p.driver||'driver';
        S.dir=p.dir||'Normal';
        S.autoNav=!!p.autoNav;
        S.mode = p?.eq?.sand ? 'grit' : 'snow';
      }catch{}

      await ensureAddressesSeeded();
      await refreshCloud();

      const arr=(S.cloud?.snapshot?.addresses)||[];
      S.addresses = arr
        .filter(a=>a.active!==false)
        .filter(a=> S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
      S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

      uiSetWork();
    }catch(e){
      alert('Kunne ikke laste runde: '+(e.message||e));
    }
  });

  /* eksporter bare det UI trenger (om noe) */
  window.BROYT_WORK = { uiSetWork };
})();