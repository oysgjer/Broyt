/* =========================================================
   Brøyterute – delt app-logikk (core)
   v10.6.0 – full JSONBin + fremdrift + wake lock + meny
   ========================================================= */

const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtTime = t => !t ? '—' : nowHHMM(t);
const fmtDate = () => new Date().toLocaleDateString('no-NO');

const STATE_LABEL={
  not_started:'Ikke påbegynt',
  in_progress:'Pågår',
  done:'Ferdig',
  skipped:'Hoppet over',
  blocked:'Ikke mulig',
  accident:'Uhell'
};

const S={
  dir:'Normal',
  addresses:[],
  idx:0,
  driver:'driver',
  autoNav:false,
  mode:'snow',       // 'snow' | 'grit'
  cloud:null,
  lastSync:0,
  wake:null
};

/* ------------------- Synk-indikator -------------------- */
function ensureSyncBadge(){
  if($('#sync_badge')) return $('#sync_badge');
  const host=$('.appbar .appbar-title')||$('.appbar');
  const span=document.createElement('span');
  span.id='sync_badge';
  span.style.marginLeft='10px';
  span.style.fontSize='0.9rem';
  span.style.opacity='0.9';
  span.textContent='Synk: ukjent';
  host && host.appendChild(span);

  const small=document.createElement('span');
  small.id='sync_time';
  small.style.marginLeft='8px';
  small.style.fontSize='0.8rem';
  small.style.opacity='0.7';
  host && host.appendChild(small);
  return span;
}
function setSync(status){ // 'ok' | 'local' | 'error' | 'unknown'
  const el=ensureSyncBadge();
  const time=$('#sync_time');
  const dots = {ok:'●',local:'●',error:'●',unknown:'●'};
  const colors={ok:'#22c55e',local:'#f59e0b',error:'#ef4444',unknown:'#94a3b8'};
  let text='ukjent';
  if(status==='ok') text='OK';
  else if(status==='local') text='lokal';
  else if(status==='error') text='feil';
  else text='ukjent';
  el.textContent=`${dots[status]} Synk: ${text}`;
  el.style.color=colors[status];
  if(S.lastSync){ time.textContent=`• ${nowHHMM(S.lastSync)}`; }
  else { time.textContent=''; }
}

/* ------------------- JSONBin helper -------------------- */
const JSONBIN={
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||'';},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||'';},
  get _key(){return localStorage.getItem('BROYT_XKEY')||'';},

  hasAll(){ return !!(this._getUrl && this._putUrl); },

  setUrlPair(g,p){
    if(g) localStorage.setItem('BROYT_BIN_URL',g);
    if(p) localStorage.setItem('BROYT_BIN_PUT',p);
  },
  setKey(k){
    const v=(k||'').trim();
    if(!v){ localStorage.removeItem('BROYT_XKEY'); return false; }
    localStorage.setItem('BROYT_XKEY',v); return true;
  },
  clearKey(){ localStorage.removeItem('BROYT_XKEY'); },

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
    if(!url){
      localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{}));
      setSync('local'); S.lastSync=Date.now();
      return {ok:false,local:true};
    }
    try{
      const res=await fetch(url,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})});
      if(!res.ok) throw new Error(res.status);
      setSync('ok'); S.lastSync=Date.now();
      return {ok:true};
    }catch(e){
      localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{}));
      setSync('error');
      return {ok:false};
    }
  },
  _headers(){
    const h={'Content-Type':'application/json'};
    const k=this._key; if(k) h['X-Master-Key']=k;
    return h;
  },
  _localFallback(){
    const local=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
    if(local) return local;
    return {version:'10.6.0',updated:Date.now(),by:'local',
      settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",seasonLabel:"2025–26",stakesLocked:false},
      snapshot:{addresses:[]},statusSnow:{},statusGrit:{},serviceLogs:[]};
  }
};

/* ----------------- seed liste ----------------- */
function seedAddressesList(){
  const base=[
    "Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42","Hjeramoen vei til 32-34-40-42",
    "Hjeramoen 47-49-51-53","Hjeramoen 48-50-52-54","Hjerakroken 2-4","Vognvegen 17","Tunlandvegen",
    "Bjørnsrud Skog 38","Trondheimsvegen 26-36","Sessvollvegen 9","Sessvollvegen 11","Mette Hasler",
    "Henning Morken Hasler","Hasler Drivhus","Grendehuset","Søjordet","Folkeparken","Folkeparken Bakke",
    "Læringsverkstedet Parkering","Læringsverkstedet Ute området","Hagamoen","(Sjøviken) Hagamoen 12",
    "Moen Nedre vei","Fred/ Moen Nedre 17","Odd/ Moen Nedre 15","Trondheimsvegen 86","Fjellet (400m vei Råholt)",
    "Bilextra (hele bygget)","Lundgårdstoppen","Normann Hjellesveg"
  ];
  return base.map(n=>({name:n,group:"",active:true,flags:{snow:true,grit:false},stakes:'',coords:''}));
}

/* ----------------- cloud helpers ----------------- */
async function ensureAddressesSeeded(){
  S.cloud = await JSONBIN.getLatest();
  const arr = Array.isArray(S.cloud && S.cloud.snapshot && S.cloud.snapshot.addresses)
    ? S.cloud.snapshot.addresses : [];
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
}
async function saveCloud(){
  S.cloud.updated=Date.now(); S.cloud.by=S.driver||'driver';
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}
function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
const nextIndex=(i,d)=> d==='Motsatt' ? i-1 : i+1;

/* ----------------- Maps helpers ----------------- */
function mapsUrlFromAddr(addr){
  if(!addr) return 'https://www.google.com/maps';
  if(addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
    const q=addr.coords.replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
}
function mapsUrlFromLatLon(latlon){
  if(!latlon) return 'https://www.google.com/maps';
  const q=String(latlon).replace(/\s+/g,'');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

/* ----------------- Fremdrift ----------------- */
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

  $('#b_prog_me_count') && ($('#b_prog_me_count').textContent = `${me}/${total}`);
  $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
  $('#b_prog_summary') && ($('#b_prog_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`);
}

/* ----------------- WORK UI ----------------- */
function uiSetWork(){
  const now=S.addresses[S.idx]||null;
  const next=S.addresses[nextIndex(S.idx,S.dir)]||null;
  if($('#b_now'))  $('#b_now').textContent = now?(now.name||'—'):'—';
  if($('#b_next')) $('#b_next').textContent = next?(next.name||'—'):'—';
  if($('#b_dir'))  $('#b_dir').textContent  = S.dir;
  if($('#b_task')) $('#b_task').textContent = (S.mode==='snow')?'Snø':'Grus';

  const bag=statusStore();
  const st=(now && now.name && bag[now.name] && bag[now.name].state) || 'not_started';
  if($('#b_status')) $('#b_status').textContent = STATE_LABEL[st]||'—';

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
  if(go) showPage('service');
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
      showPage('service');
    }
  }
}

/* ----------------- Wake Lock (Android/iOS PWA fallback) ---------- */
async function toggleWakeLock() {
  const dot = $('#qk_wl_dot') || $('#wl_dot');
  const status = $('#qk_wl_status');
  try {
    if (S.wake && S.wake.active) {
      await S.wake.release();
      S.wake = null;
      dot?.classList.remove('dot-on'); dot?.classList.add('dot-off');
      status && (status.textContent = 'Status: av');
      return;
    }
    if ('wakeLock' in navigator && navigator.wakeLock.request) {
      S.wake = await navigator.wakeLock.request('screen');
      S.wake.addEventListener('release', () => {
        dot?.classList.remove('dot-on'); dot?.classList.add('dot-off');
        status && (status.textContent = 'Status: av');
      });
      dot?.classList.remove('dot-off'); dot?.classList.add('dot-on');
      status && (status.textContent = 'Status: på (native)');
      return;
    }
    let v = document.querySelector('#wlHiddenVideo');
    if (!v) {
      v = document.createElement('video');
      v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
      v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
      document.body.appendChild(v);
    }
    await v.play();
    dot?.classList.remove('dot-off'); dot?.classList.add('dot-on');
    status && (status.textContent = 'Status: på (iOS-fallback)');
  } catch (err) {
    status && (status.textContent = 'Status: feil (' + (err.message || 'ukjent') + ')');
  }
}

/* ----------------- Drawer & routing ----------------- */
const drawer=$('#drawer'), scrim=$('#scrim');
const openDrawer = () => { drawer?.classList.add('open'); scrim?.classList.add('show'); drawer?.setAttribute('aria-hidden','false'); };
const closeDrawer= () => { drawer?.classList.remove('open'); scrim?.classList.remove('show'); drawer?.setAttribute('aria-hidden','true'); };

$('#btnMenu')?.addEventListener('click', () => {
  if (drawer?.classList.contains('open')) closeDrawer(); else openDrawer();
});
$('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);

$$('#drawer .drawer-link[data-go]').forEach(a=>{
  a.addEventListener('click', ()=>{
    showPage(a.getAttribute('data-go'));
    closeDrawer();
  });
});

function showPage(id){
  $$('main section').forEach(s=>{
    if(s.id===id){ s.hidden=false; }
    else { s.hidden=true; }
  });
  location.hash = '#'+id;

  if (id==='status'){ const d=$('#rp_date'); if(d) d.textContent=fmtDate(); }
  if (id==='work'){ updateProgressBars(); }
}
window.addEventListener('hashchange', ()=>{
  const id=(location.hash||'#home').replace('#','');
  showPage($('#'+id)?id:'home');
});
showPage((location.hash||'#home').replace('#','') || 'home');

/* ----------------- Quick actions fra meny ----------------- */
async function openDest(which){
  try{
    await refreshCloud();
    const st=S.cloud && S.cloud.settings ? S.cloud.settings : {};
    let latlon='';
    if(which==='grus')   latlon = st.grusDepot||'';
    if(which==='diesel') latlon = st.diesel||'';
    if(which==='base')   latlon = st.base||'';
    const url = latlon ? mapsUrlFromLatLon(latlon) : 'https://www.google.com/maps';
    window.open(url,'_blank');
  }catch(e){ alert('Kunne ikke åpne destinasjon: '+(e.message||e)); }
}
$('#qk_grus')  ?.addEventListener('click', ()=>openDest('grus'));
$('#qk_diesel')?.addEventListener('click', ()=>openDest('diesel'));
$('#qk_base')  ?.addEventListener('click', ()=>openDest('base'));
$('#qk_wl')    ?.addEventListener('click', toggleWakeLock);

/* ----------------- Prefs + rundestart (knyttes til Home/Work UI) ----------------- */
function loadPrefsIntoState(){
  try{
    const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
    if(p.driver) S.driver=p.driver;
    if(p.dir) S.dir=p.dir;
    if(typeof p.autoNav==='boolean') S.autoNav=p.autoNav;
    S.mode = p.eq && p.eq.sand ? 'grit' : 'snow';
  }catch{}
}
async function startRoundFromHome(){
  loadPrefsIntoState();
  await ensureAddressesSeeded();
  await refreshCloud();

  const arr=(S.cloud && S.cloud.snapshot && S.cloud.snapshot.addresses) ? S.cloud.snapshot.addresses : [];
  S.addresses = arr
    .filter(a=>a.active!==false)
    .filter(a=> S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
  S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

  uiSetWork();
  showPage('work');
}
$('#a_start')?.addEventListener('click', startRoundFromHome);

/* ----------------- Work-knapper (globale lyttere) ----------------- */
$('#act_start')?.addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
$('#act_skip') ?.addEventListener('click',()=>stepState({state:'skipped',finishedAt:Date.now()}));
$('#act_block')?.addEventListener('click',()=>{ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; stepState({state:'blocked',finishedAt:Date.now(),note:reason}); });
$('#act_acc')  ?.addEventListener('click', async ()=>{
  try{
    const note=prompt('Beskriv uhell (valgfritt)','')||'';
    const file=await pickImage(); let photo=null;
    if(file) photo=await compressImage(file,900,0.6);
    await stepState({state:'accident',finishedAt:Date.now(),note,photo},false);
  }catch(e){ alert('Feil ved uhell: '+(e.message||e)); }
});
$('#act_done') ?.addEventListener('click',()=>stepState({state:'done',finishedAt:Date.now()}));

/* ---- uhell-bilde ---- */
function pickImage(){ return new Promise(resolve=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange=()=>resolve(i.files&&i.files[0]?i.files[0]:null); i.click(); setTimeout(()=>resolve(null),15000); }); }
function compressImage(file,maxW=1000,q=0.7){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const scale=maxW/Math.max(img.width,img.height); const w=img.width>=img.height?maxW:Math.round(img.width*scale); const h=img.width>=img.height?Math.round(img.height*scale):maxW; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',q)); }; img.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); }); }

/* ---- rapport CSV (kan knyttes til Status-siden) ---- */
async function exportCsv(){
  try{
    const cloud=await JSONBIN.getLatest(); if(cloud && !cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;
    const addrs=Array.isArray(cloud && cloud.snapshot && cloud.snapshot.addresses)?cloud.snapshot.addresses:[];
    const bagSnow=cloud.statusSnow||{}, bagGrit=cloud.statusGrit||{};
    const rows=[['#','Adresse','Oppdrag','Stikker (sesong)','Koordinater','Status','Start','Ferdig','Utført av','Notat']];
    addrs.forEach((a,i)=>{
      const coord=a.coords||'';
      if(!(a.flags && a.flags.snow===false)){
        const s=bagSnow[a.name]||{};
        rows.push([String(i+1),a.name,'Snø',(a.stakes!==''?a.stakes:''),coord,STATE_LABEL[s.state||'not_started'],fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'',(s.note||'').replace(/\s+/g,' ').trim()]);
      }
      if(a.flags && a.flags.grit){
        const s=bagGrit[a.name]||{};
        rows.push([String(i+1),a.name,'Grus',(a.stakes!==''?a.stakes:''),coord,STATE_LABEL[s.state||'not_started'],fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'',(s.note||'').replace(/\s+/g,' ').trim()]);
      }
    });
    const csv=`Brøyterapport,${fmtDate()}\n`+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`Broeyterapport_${fmtDate()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){ alert('CSV-feil: '+(e.message||e)); }
}

/* ----------------- Auto-retry sync ----------------- */
setInterval(async ()=>{
  const badge=$('#sync_badge'); if(!badge) return;
  const txt=(badge.textContent||'').toLowerCase();
  if(txt.includes('feil') || txt.includes('ukjent')){
    try{ await JSONBIN.getLatest(); }catch{}
  }
}, 60000);

/* ----------------- Ved oppstart ----------------- */
ensureSyncBadge();
