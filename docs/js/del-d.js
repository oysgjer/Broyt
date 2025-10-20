/* Core app-tilstand og hjelpefunksjoner – felles for alle sider */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});

const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null,lastSync:0,wake:null};

/* ------------------- Synk-indikator -------------------- */
function ensureSyncBadge(){
  if($('#sync_badge')) return $('#sync_badge');
  const host=$('.appbar')||document.body;
  const span=document.createElement('span'); span.id='sync_badge'; span.className='badge';
  span.innerHTML='<span class="dot dot-unknown"></span> Synk: ukjent';
  host.appendChild(span);
  return span;
}
function setSync(status){
  ensureSyncBadge();
  const badge=$('#sync_badge'); if(!badge) return;
  const cls = status==='ok'?'dot-ok':status==='local'?'dot-local':status==='error'?'dot-error':'dot-unknown';
  badge.innerHTML=`<span class="dot ${cls}"></span> Synk: ${status==='ok'?'OK':status==='local'?'lokal':status==='error'?'feil':'ukjent'}`;
}

/* ------------------- JSONBin (minimal) -------------------- */
const JSONBIN={
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||'';},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||'';},
  get _key(){return localStorage.getItem('BROYT_XKEY')||'';},
  _headers(){ const h={'Content-Type':'application/json'}; const k=this._key; if(k) h['X-Master-Key']=k; return h; },

  async getLatest(){
    const url=this._getUrl;
    if(!url){ setSync('local'); return this._localFallback(); }
    try{
      const res=await fetch(url,{headers:this._headers()});
      if(!res.ok) throw new Error(res.status);
      const j=await res.json();
      setSync('ok'); S.lastSync=Date.now();
      return j.record||j;
    }catch(e){
      const local=this._localFallback();
      if(local){ setSync('local'); return local; }
      setSync('error'); throw e;
    }
  },
  async putRecord(obj){
    const url=this._putUrl;
    try{
      if(!url){ localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{})); setSync('local'); S.lastSync=Date.now(); return {ok:false,local:true}; }
      const res=await fetch(url,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})});
      if(!res.ok) throw new Error(res.status);
      setSync('ok'); S.lastSync=Date.now(); return {ok:true};
    }catch{ setSync('error'); return {ok:false}; }
  },
  _localFallback(){
    try{ const j=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null'); if(j) return j; }catch{}
    return {snapshot:{addresses:[]},statusSnow:{},statusGrit:{},settings:{seasonLabel:'2025–26',stakesLocked:false}};
  }
};

/* ----------------- Cloud helpers ----------------- */
async function ensureAddressesSeeded(){
  S.cloud = await JSONBIN.getLatest();
  const arr = Array.isArray(S.cloud?.snapshot?.addresses) ? S.cloud.snapshot.addresses : [];
  if(arr.length>0) return;
  const base=["Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42"];
  S.cloud.snapshot={addresses:base.map(n=>({name:n,group:'',active:true,flags:{snow:true,grit:false},stakes:'',coords:''}))};
  S.cloud.statusSnow ||= {};
  S.cloud.statusGrit ||= {};
  await JSONBIN.putRecord(S.cloud);
}
async function refreshCloud(){
  S.cloud = await JSONBIN.getLatest();
  S.cloud.statusSnow ||= (S.cloud.status||{});
  S.cloud.statusGrit ||= {};
  S.cloud.settings   ||= {seasonLabel:'2025–26',stakesLocked:false};
}
async function saveCloud(){
  S.cloud.updated=Date.now(); S.cloud.by=S.driver||'driver';
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}

/* Trygt når data ikke er lastet */
function statusStore(){
  if(!S.cloud) return {};
  return S.mode==='snow' ? (S.cloud.statusSnow||{}) : (S.cloud.statusGrit||{});
}

/* ----------------- Fremdriftsindikator ----------------- */
function updateProgressBars(){
  const total = Math.max((S.addresses?.length||0), 1);
  let me=0, other=0;
  const bag = statusStore();
  for(const k in bag){
    const st=bag[k];
    if(st?.state==='done'){ (st.driver===S.driver? me:other)++; }
  }
  const mePct=Math.round(100*me/total), otPct=Math.round(100*other/total);
  const bm=$('#b_prog_me'), bo=$('#b_prog_other');
  if(bm) bm.style.width = mePct+'%';
  if(bo) bo.style.width = otPct+'%';
  $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${me}/${total}`);
  $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
  $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(me+other,total)} av ${total} adresser fullført`);
}

/* ----------------- Navigasjon mellom sider ----------------- */
function showPage(id){
  $$('main section').forEach(s=>s.hidden = s.id!==id);
  location.hash='#'+id;

  if(id==='work'){
    // sørg for data før vi tegner barene
    (async()=>{ try{ await ensureAddressesSeeded(); await refreshCloud(); }catch{} updateProgressBars(); })();
  }
}
window.addEventListener('hashchange', ()=>{
  const id=(location.hash||'#home').replace('#','');
  showPage($('#'+id)?id:'home');
});

/* ----------------- Drawer ----------------- */
const drawer=$('#drawer'), scrim=$('#scrim');
const openDrawer = ()=>{drawer?.classList.add('open');scrim?.classList.add('show');drawer?.setAttribute('aria-hidden','false');};
const closeDrawer=()=>{drawer?.classList.remove('open');scrim?.classList.remove('show');drawer?.setAttribute('aria-hidden','true');};
$('#btnMenu')?.addEventListener('click', ()=> drawer?.classList.contains('open') ? closeDrawer() : openDrawer());
$('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);
$$('#drawer .drawer-link[data-go]').forEach(a=>a.addEventListener('click',()=>{showPage(a.getAttribute('data-go')); closeDrawer();}));

/* ----------------- Init ----------------- */
window.addEventListener('DOMContentLoaded', ()=>{
  ensureSyncBadge();
  showPage((location.hash||'#home').replace('#','') || 'home');

  // Demo: sett synk til OK etter et øyeblikk
  setTimeout(()=>setSync('ok'),800);
});

/* Eksporter symboler brukt av andre filer (Work.js) */
window.updateProgressBars = updateProgressBars;
window.showPage = showPage;
window.ensureAddressesSeeded = ensureAddressesSeeded;
window.refreshCloud = refreshCloud;
window.statusStore = statusStore;