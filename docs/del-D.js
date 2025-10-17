/* del-D.js – v10.1f
   - Alt som i v10.1e
   - + Admin: innebygd "Sky-oppsett (JSONBin/Proxy)"-kort (GET/PUT-URLer)
   - Fortsatt auto-seed av adresser hvis tomt
*/

const $ = (s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const fmtTime=t=>!t?'—':new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtDate=()=>new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

/* =============== Drawer & routing =============== */
(function(){
  const drawer=$('#drawer'),scrim=$('#scrim');
  const open=()=>{drawer.classList.add('open');scrim.classList.add('show');drawer.setAttribute('aria-hidden','false');};
  const close=()=>{drawer.classList.remove('open');scrim.classList.remove('show');drawer.setAttribute('aria-hidden','true');};
  $('#btnMenu')?.addEventListener('click',open);
  $('#btnCloseDrawer')?.addEventListener('click',close);
  scrim?.addEventListener('click',close);
  $$('#drawer .drawer-link[data-go]').forEach(b=>b.addEventListener('click',()=>{showPage(b.getAttribute('data-go'));close();}));

  window.showPage=function(id){
    $$('main section').forEach(s=>s.style.display='none');
    const el=$('#'+id); if(el) el.style.display='block';
    location.hash='#'+id;
    if(id==='status'){ $('#rp_date').textContent=fmtDate(); loadStatus(); }
    if(id==='admin'){ loadSettingsToAdmin(); }
  };

  window.addEventListener('hashchange',()=>{
    const id=(location.hash||'#home').replace('#','');
    showPage($('#'+id)?id:'home');
  });
  window.addEventListener('DOMContentLoaded',()=>{
    const id=(location.hash||'#home').replace('#','');
    showPage($('#'+id)?id:'home');
    try{
      const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      if(p.driver)$('#a_driver').value=p.driver;
      if(p.dir)$('#a_dir').value=p.dir;
      if(p.eq){$('#a_eq_plow').checked=!!p.eq.plow;$('#a_eq_fres').checked=!!p.eq.fres;$('#a_eq_sand').checked=!!p.eq.sand;}
      if(typeof p.autoNav==='boolean')$('#a_autoNav').checked=p.autoNav;
    }catch{}
  });
})();

/* =============== Wake Lock =============== */
(function(){
  let wl=null; const btn=$('#qk_wl'), st=$('#qk_wl_status'); if(!btn) return;
  const supported=()=>('wakeLock' in navigator && typeof navigator.wakeLock.request==='function');
  const setS=t=>st&&(st.textContent='Status: '+t);
  const setB=a=>btn.textContent=a?'🔓 Slå av skjerm-lås':'🔒 Hold skjermen våken';
  async function acquire(){ if(!supported()){setS('ikke støttet');return;}
    try{ wl=await navigator.wakeLock.request('screen'); setS('aktiv'); setB(true);
      wl.addEventListener('release',()=>{setS('av'); setB(false);});
    }catch(e){ setS('feil: '+(e.name||e.message)); setB(false);}
  }
  async function release(){ try{ if(wl){await wl.release(); wl=null; setS('av'); setB(false);} }catch{} }
  btn.addEventListener('click',()=> wl?release():acquire());
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && wl){ acquire(); } });
})();

/* =============== JSONBin helper =============== */
const JSONBIN={
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||localStorage.getItem('JSONBIN_BIN_URL')||'';},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||localStorage.getItem('JSONBIN_BIN_PUT_URL')||'';},
  get _key(){return localStorage.getItem('BROYT_XKEY')||localStorage.getItem('JSONBIN_MASTER')||'';},
  setUrlPair(getUrl,putUrl){
    const g=(getUrl||'').trim(), p=(putUrl||'').trim();
    if(g) localStorage.setItem('BROYT_BIN_URL', g);
    if(p) localStorage.setItem('BROYT_BIN_PUT', p);
    // legacy alias
    if(g) localStorage.setItem('JSONBIN_BIN_URL', g);
    if(p) localStorage.setItem('JSONBIN_BIN_PUT_URL', p);
  },
  setKey(k){const v=(k||'').trim(); if(!v){localStorage.removeItem('BROYT_XKEY');return false;} localStorage.setItem('BROYT_XKEY',v); localStorage.setItem('JSONBIN_MASTER',v); return true;},
  clearKey(){localStorage.removeItem('BROYT_XKEY');localStorage.removeItem('JSONBIN_MASTER');},
  hasAll(){ return !!(this._getUrl && this._putUrl && this._key); },
  async getLatest(){
    const url=this._getUrl; if(!url){ console.warn('Ingen GET-URL; lokal fallback'); return this._localFallback(); }
    const res=await fetch(url,{headers:this._headers(false)}).catch(()=>null);
    if(!res||!res.ok){ console.warn('GET feilet; lokal fallback'); return this._localFallback(); }
    const j=await res.json(); return j.record||j;
  },
  async putRecord(obj){
    const url=this._putUrl,key=this._key;
    if(!url||!key){ console.warn('PUT mangler URL/nøkkel – lagrer lokalt'); return {ok:false,local:true}; }
    const res=await fetch(url,{method:'PUT',headers:this._headers(true),body:JSON.stringify(obj||{})}).catch(()=>null);
    if(!res||!res.ok){ console.warn('PUT feilet'); return {ok:false}; }
    return {ok:true};
  },
  _headers(){const h={'Content-Type':'application/json'}; const k=this._key; if(k)h['X-Master-Key']=k; return h;},
  _localFallback(){
    const local=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
    if(local) return local;
    return {version:'10.1f',updated:Date.now(),by:'local',
      settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",
        seasonLabel:"2025–26",stakesCount:"",stakesLocked:false},
      snapshot:{addresses:[]}, statusSnow:{}, statusGrit:{}, serviceLogs:[]};
  },
  async checkConfigOrWarn(){
    if(!this.hasAll()){
      alert('OBS: Sky-oppsett ikke komplett.\n\nLim inn X-Master-Key i Admin og fyll inn GET-/PUT-URL i "Sky-oppsett".\nAppen virker lokalt så lenge.');
    }
  }
};

/* =============== App-state =============== */
const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null};
function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
function nextIndex(i,d){return d==='Motsatt'?i-1:i+1;}

/* =============== ADRESSE-SEED =============== */
function seedAddressesList(){
  const L=[{name:"Hjeramoen 12-24",group:"Hjeramoen"},{name:"Hjerastubben 8, 10, 12 ,14, 16"},
    {name:"Hjeramoen 32-34-40-42",group:"Hjeramoen"},{name:"Hjeramoen vei til 32-34-40-42",group:"Hjeramoen"},
    {name:"Hjeramoen 47-49-51-53",group:"Hjeramoen"},{name:"Hjeramoen 48-50-52-54",group:"Hjeramoen"},
    {name:"Hjerakroken 2-4"},{name:"Vognvegen 17"},{name:"Tunlandvegen"},{name:"Bjørnsrud Skog 38"},
    {name:"Trondheimsvegen 26-36"},{name:"Sessvollvegen 9",group:"Sessvollvegen"},{name:"Sessvollvegen 11",group:"Sessvollvegen"},
    {name:"Mette Hasler"},{name:"Henning Morken Hasler"},{name:"Hasler Drivhus"},{name:"Grendehuset"},
    {name:"Søjordet",group:"Søjordet"},{name:"Folkeparken",group:"Folkeparken"},{name:"Folkeparken Bakke",group:"Folkeparken"},
    {name:"Læringsverkstedet Parkering",group:"Folkeparken"},{name:"Læringsverkstedet Ute området",group:"Folkeparken"},
    {name:"Hagamoen"},{name:"(Sjøviken) Hagamoen 12"},{name:"Moen Nedre vei"},{name:"Fred/ Moen Nedre 17"},
    {name:"Odd/ Moen Nedre 15"},{name:"Trondheimsvegen 86"},{name:"Fjellet (400m vei Råholt)"},
    {name:"Bilextra (hele bygget)"},{name:"Lundgårdstoppen"},{name:"Normann Hjellesveg"}];
  return L.map(x=>({name:x.name,group:x.group||"",active:true,flags:{snow:true,grit:false}}));
}
async function ensureAddressesSeeded(){
  S.cloud = await JSONBIN.getLatest();
  S.cloud.snapshot ||= {};
  const arr = Array.isArray(S.cloud.snapshot.addresses)?S.cloud.snapshot.addresses:[];
  if(arr.length>0) return;
  if(localStorage.getItem('BROYT_SEEDED_ADDR')==='yes') return;
  const list=seedAddressesList();
  S.cloud.snapshot.addresses=list;
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  localStorage.setItem('BROYT_SEEDED_ADDR','yes');
  localStorage.setItem('BROYT_LOCAL_DATA', JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}

/* =============== Hjem → Start runde =============== */
$('#a_start').addEventListener('click', async ()=>{
  try{
    const prefs={driver:($('#a_driver').value||'').trim()||'driver',
      dir:$('#a_dir').value,
      eq:{plow:$('#a_eq_plow').checked,fres:$('#a_eq_fres').checked,sand:$('#a_eq_sand').checked},
      autoNav:$('#a_autoNav').checked};
    localStorage.setItem('BROYT_PREFS',JSON.stringify(prefs));
    S.driver=prefs.driver; S.dir=prefs.dir; S.autoNav=prefs.autoNav;
    S.mode = prefs.eq.sand ? 'grit' : 'snow';

    await JSONBIN.checkConfigOrWarn();
    await ensureAddressesSeeded();
    await refreshCloud();

    const arr=(S.cloud?.snapshot?.addresses && Array.isArray(S.cloud.snapshot.addresses))?S.cloud.snapshot.addresses:(Array.isArray(S.cloud?.addresses)?S.cloud.addresses:[]);
    const mapped=(arr||[]).map(a=>{
      const snow=a.flags?!!a.flags.snow:(a.task?true:true);
      const grit=a.flags?!!a.flags.grit:(a.task==='Snø og grus'||a.task==='Grus');
      return {...a, flags:{snow,grit}};
    }).filter(a=>a.active!==false);
    S.addresses = mapped.filter(a=> S.mode==='snow' ? a.flags.snow : a.flags.grit);
    S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

    uiSetWork();
    showPage('work');
  }catch(e){ alert('Start-feil: '+(e.message||e)); }
});

/* =============== Cloud helpers =============== */
async function refreshCloud(){
  S.cloud = await JSONBIN.getLatest();
  if(!S.cloud.statusSnow && S.cloud.status){ S.cloud.statusSnow=S.cloud.status; delete S.cloud.status; }
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  S.cloud.settings ||= {}; S.cloud.serviceLogs ||= [];
}
async function saveCloud(){
  S.cloud.updated=Date.now(); S.cloud.by=S.driver||'driver';
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}

/* =============== Under arbeid =============== */
function mapsUrlFromAddr(addr){
  if(addr && typeof addr.lat==='number' && typeof addr.lon==='number'){
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lon}`;
  }
  if(addr && addr.coords && /,/.test(addr.coords)){
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.coords}`;
  }
  const q=addr?.name||''; return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q+', Norge');
}
function uiSetWork(){
  const now=S.addresses[S.idx]||null;
  const next=S.addresses[nextIndex(S.idx,S.dir)]||null;
  $('#b_now').textContent=now?(now.name||'—'):'—';
  $('#b_next').textContent=next?(next.name||'—'):'—';
  $('#b_dir').textContent=S.dir;
  $('#b_task').textContent=(S.mode==='snow')?'Snø':'Grus';
  const bag=statusStore();
  const st=(now?.name && bag[now.name]?.state) || 'not_started';
  $('#b_status').textContent=STATE_LABEL[st]||'—';
  updateProgressBars();
}
function updateProgressBars(){
  const total=S.addresses.length||1; let me=0,other=0;
  const bag=statusStore();
  for(const k in bag){ const st=bag[k]; if(st.state==='done'){ if(st.driver===S.driver)me++; else other++; } }
  $('#b_prog_me').style.width=Math.min(100,Math.round(100*me/total))+'%';
  $('#b_prog_other').style.width=Math.min(100,Math.round(100*other/total))+'%';
}
function allDone(){ if(!S.addresses.length) return false; const bag=statusStore(); return S.addresses.every(a=>(bag[a.name]?.state==='done')); }
function maybeShowAllDoneDialog(){
  if(!allDone())return;
  const modeTxt=(S.mode==='snow')?'Snø':'Grus';
  const go=confirm(`Alt er utført for ${modeTxt}-runden 🎉\n\nOK = Gå til Service\nAvbryt = Flere valg`);
  if(go){ showPage('service'); return; }
  const choice=prompt('Velg: 1=Bytt til andre runde, 2=Nullstill runden, annen tast=ignorer','1');
  if(choice==='1'){ toggleModeAndReload(); }
  else if(choice==='2'){ if(confirm('Sikker?')) resetRoundAll(); }
}
function toggleModeAndReload(){
  S.mode=(S.mode==='snow')?'grit':'snow';
  const arr=(S.cloud?.snapshot?.addresses && Array.isArray(S.cloud.snapshot.addresses))?S.cloud.snapshot.addresses:(Array.isArray(S.cloud?.addresses)?S.cloud.addresses:[]);
  const mapped=(arr||[]).map(a=>{
    const snow=a.flags?!!a.flags.snow:(a.task?true:true);
    const grit=a.flags?!!a.flags.grit:(a.task==='Snø og grus'||a.task==='Grus');
    return {...a, flags:{snow,grit}};
  }).filter(a=>a.active!==false);
  S.addresses=mapped.filter(a=> S.mode==='snow'?a.flags.snow:a.flags.grit);
  S.idx=(S.dir==='Motsatt')?(S.addresses.length-1):0;
  uiSetWork(); showPage('work');
}
function setStatusFor(name,patch){ const bag=statusStore(); const cur=bag[name]||{}; bag[name]={...cur,...patch,driver:S.driver}; }
async function stepState(patch,nextAfter=true){
  await refreshCloud();
  const cur=S.addresses[S.idx]; if(!cur) return;
  setStatusFor(cur.name,{...patch});
  await saveCloud(); uiSetWork();
  if(allDone()){ maybeShowAllDoneDialog(); return; }
  if(nextAfter){
    const ni=nextIndex(S.idx,S.dir);
    if(ni>=0 && ni<S.addresses.length){
      S.idx=ni; uiSetWork();
      if(S.autoNav){ const t=S.addresses[S.idx]; if(t) window.open(mapsUrlFromAddr(t),'_blank'); }
    }else{ showPage('service'); }
  }
}
$('#act_start').addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
$('#act_skip').addEventListener('click', ()=>stepState({state:'skipped',finishedAt:Date.now()}));
$('#act_block').addEventListener('click',()=>{ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; stepState({state:'blocked',finishedAt:Date.now(),note:reason}); });
$('#act_acc').addEventListener('click', async ()=>{
  try{
    const note=prompt('Beskriv uhell (valgfritt)','')||'';
    const file=await pickImage(); let photo=null;
    if(file) photo=await compressImage(file,900,0.6);
    await stepState({state:'accident',finishedAt:Date.now(),note,photo});
  }catch(e){ alert('Feil uhell: '+e.message); }
});
$('#act_done').addEventListener('click', ()=>stepState({state:'done',finishedAt:Date.now()}));

/* =============== Quick nav i meny =============== */
function mapsUrlFromCoordsText(text){
  const t=(text||'').trim();
  if(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(t)){ return `https://www.google.com/maps/dir/?api=1&destination=${t}`; }
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(t);
}
$('#qk_grus')?.addEventListener('click',async()=>{await refreshCloud();const st=S.cloud.settings||{};const q=st.grusDepot||"60.2527264,11.1687230";window.open(mapsUrlFromCoordsText(q),'_blank');await logServiceVisit('grus');$('#btnCloseDrawer')?.click();});
$('#qk_diesel')?.addEventListener('click',async()=>{await refreshCloud();const st=S.cloud.settings||{};const q=st.diesel||"60.2523185,11.1899926";window.open(mapsUrlFromCoordsText(q),'_blank');await logServiceVisit('diesel');$('#btnCloseDrawer')?.click();});
$('#qk_base')?.addEventListener('click',async()=>{await refreshCloud();const st=S.cloud.settings||{};const q=st.base||"60.2664414,11.2208819";window.open(mapsUrlFromCoordsText(q),'_blank');await logServiceVisit('base');$('#btnCloseDrawer')?.click();});
async function logServiceVisit(type){await refreshCloud();S.cloud.serviceLogs||=[];S.cloud.serviceLogs.push({ts:Date.now(),driver:S.driver,type,kind:'visit'});await saveCloud();}

/* =============== Service lagring =============== */
$('#svc_save').addEventListener('click', async ()=>{
  try{
    await refreshCloud();
    const checks={}; $$('#service .svc').forEach(ch=>{checks[ch.getAttribute('data-key')]=ch.checked;});
    const note=$('#svc_note').value||'';
    S.cloud.serviceLogs||=[]; S.cloud.serviceLogs.push({ts:Date.now(),driver:S.driver,checks,note,kind:'service',roundMode:S.mode});
    await saveCloud();
    $('#svc_msg').textContent='Service lagret ✅';
    setTimeout(()=>{ $('#svc_msg').textContent=''; showPage('home'); }, 900);
  }catch(e){ alert('Service-feil: '+e.message); }
});

/* =============== Status + Rapport + Stikker-lås =============== */
function makeRow(i,a,s,seasonLbl,stakesStr){
  const img=s?.photo?'🖼️':'';
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${i+1}</td><td>${a.name||''}</td><td>${(S.mode==='snow'?'Snø':'Grus')}</td>
    <td>${stakesStr?`${stakesStr} <span class="muted">(${seasonLbl||'sesong'})</span>`:''}</td>
    <td>${STATE_LABEL[s?.state||'not_started']}</td>
    <td>${fmtTime(s?.startedAt)}</td>
    <td>${fmtTime(s?.finishedAt)}</td>
    <td>${s?.driver||'—'}</td><td>${img}</td>`;
  return tr;
}
function summarize(addrs,bag){
  let c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
  addrs.forEach(a=>{const st=(bag[a.name]||{state:'not_started'}).state;
    if(st==='not_started')c.not++; else if(st==='in_progress')c.prog++;
    else if(st==='done')c.done++; else if(st==='skipped')c.skip++;
    else if(st==='blocked')c.blk++; else if(st==='accident')c.acc++;
  }); return c;
}
async function loadStatus(){
  try{
    const modeSel=$('#st_mode').value;
    const cloud=await JSONBIN.getLatest();
    if(!cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;

    const raw=(cloud?.snapshot?.addresses && Array.isArray(cloud.snapshot.addresses))?cloud.snapshot.addresses:(Array.isArray(cloud?.addresses)?cloud.addresses:[]);
    const addrs=(raw||[]).map(a=>{
      const snow=a.flags?!!a.flags.snow:(a.task?true:true);
      const grit=a.flags?!!a.flags.grit:(a.task==='Snø og grus'||a.task==='Grus');
      return {...a,flags:{snow,grit}};
    }).filter(a=>a.active!==false)
      .filter(a=> modeSel==='snow'?a.flags.snow:a.flags.grit);

    const bag=(modeSel==='snow')?(cloud.statusSnow||{}):(cloud.statusGrit||{});
    const filter=$('#st_filter').value;
    const tbody=$('#st_tbody'); tbody.innerHTML='';

    const seasonLbl=(cloud.settings&&cloud.settings.seasonLabel)||'sesong';
    const stakesLocked=!!(cloud.settings&&cloud.settings.stakesLocked);
    const stakesCount=(cloud.settings && (cloud.settings.stakesCount??''))||'';

    $('#st_season_badge').textContent='Sesong: '+seasonLbl;
    const lockBtn=$('#st_lock_toggle');
    lockBtn.textContent=stakesLocked?'🔒 Stikker låst':'🔓 Lås stikker (sesong)';
    lockBtn.dataset.locked=String(stakesLocked);

    const stakesStr=(stakesCount!==''?String(stakesCount):'');

    addrs.forEach((a,i)=>{
      const s=bag[a.name]||{state:'not_started'};
      let ok=true;
      if(filter==='ikke'  && s.state!=='not_started') ok=false;
      if(filter==='pågår' && s.state!=='in_progress') ok=false;
      if(filter==='ferdig'&& s.state!=='done') ok=false;
      if(filter==='hoppet'&& s.state!=='skipped') ok=false;
      if(filter==='umulig'&& s.state!=='blocked') ok=false;
      if(filter==='uhell' && s.state!=='accident') ok=false;
      if(ok) tbody.appendChild(makeRow(i,a,s,seasonLbl,stakesStr));
    });

    const c=summarize(addrs,bag);
    const label=(modeSel==='snow')?'Snø':'Grus';
    $('#st_summary').textContent=`${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
  }catch(e){ alert('Status-feil: '+e.message); }
}
$('#st_reload')?.addEventListener('click',loadStatus);
$('#st_filter')?.addEventListener('change',loadStatus);
$('#st_mode')?.addEventListener('change',loadStatus);

$('#st_lock_toggle')?.addEventListener('click',async()=>{
  try{
    await refreshCloud();
    S.cloud.settings ||= {};
    S.cloud.settings.stakesLocked = !S.cloud.settings.stakesLocked;
    await saveCloud();
    loadStatus();
  }catch(e){ alert('Kunne ikke oppdatere lås: '+e.message); }
});

/* =============== Nullstillinger & Rapport =============== */
async function resetRoundAll(){ await refreshCloud(); const bag=statusStore();
  S.addresses.forEach(a=>{bag[a.name]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};});
  await saveCloud(); loadStatus(); uiSetWork(); }
async function resetRoundMine(){ await refreshCloud(); const bag=statusStore();
  for(const k in bag){ if(bag[k]?.driver===S.driver){bag[k]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};}}
  await saveCloud(); loadStatus(); uiSetWork(); }
$('#st_reset_all')?.addEventListener('click',async()=>{ if(confirm('Nullstille denne runden for alle?')) await resetRoundAll(); });
$('#st_reset_mine')?.addEventListener('click',async()=>{ if(confirm('Nullstille kun dine punkter?')) await resetRoundMine(); });

$('#rp_print')?.addEventListener('click',()=>window.print());
$('#rp_csv')?.addEventListener('click',async()=>{
  try{
    const modeSel=$('#st_mode').value;
    const cloud=await JSONBIN.getLatest(); if(!cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;
    const raw=(cloud?.snapshot?.addresses && Array.isArray(cloud.snapshot.addresses))?cloud.snapshot.addresses:(Array.isArray(cloud?.addresses)?cloud.addresses:[]);
    const addrs=(raw||[]).map(a=>{const snow=a.flags?!!a.flags.snow:(a.task?true:true); const grit=a.flags?!!a.flags.grit:(a.task==='Snø og grus'||a.task==='Grus'); return {...a,flags:{snow,grit}};})
      .filter(a=>a.active!==false).filter(a=> modeSel==='snow'?a.flags.snow:a.flags.grit);
    const bag=(modeSel==='snow')?(cloud.statusSnow||{}):(cloud.statusGrit||{});
    const seasonLbl=(cloud.settings&&cloud.settings.seasonLabel)||'sesong';
    const stakesCount=(cloud.settings&&(cloud.settings.stakesCount??''))||'';
    const rows=[['#','Adresse','Oppgave',`Stikker (${seasonLbl})`,'Status','Start','Ferdig','Utført av','Notat']];
    addrs.forEach((a,i)=>{
      const s=bag[a.name]||{};
      rows.push([String(i+1),a.name||'',(modeSel==='snow'?'Snø':'Grus'), stakesCount!==''?String(stakesCount):'', STATE_LABEL[s.state||'not_started'], fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'', (s.note||'').replace(/\s+/g,' ').trim()]);
    });
    const csv=`Brøyterapport,${fmtDate()},${(modeSel==='snow'?'Snø':'Grus')}\n`+rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`Broeyterapport_${fmtDate()}_${(modeSel==='snow'?'Sno':'Grus')}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){ alert('CSV-feil: '+e.message); }
});

/* =============== Admin: nøkkel + innstillinger + SKY-OPPSETT UI =============== */
$('#adm_key_save')?.addEventListener('click',()=>{ const ok=JSONBIN.setKey($('#adm_key').value||''); $('#adm_key_status').textContent=ok?'Lagret nøkkel.':'Ugyldig nøkkel.'; });
$('#adm_key_clear')?.addEventListener('click',()=>{ JSONBIN.clearKey(); $('#adm_key_status').textContent='Nøkkel fjernet.'; });

function ensureCloudSetupCard(){
  const adminSec = $('#admin');
  if(!adminSec || $('#cloudSetupCard')) return;

  const card = document.createElement('div');
  card.className='card';
  card.id='cloudSetupCard';
  card.innerHTML = `
    <h3 style="margin-top:0">Sky-oppsett (JSONBin/Proxy)</h3>
    <div class="inline-edit" style="gap:8px">
      <label>GET-URL:<br><input id="adm_geturl" placeholder="https://jsonbin-proxy.…" style="min-width:260px"></label>
      <label>PUT-URL:<br><input id="adm_puturl" placeholder="https://jsonbin-proxy.…" style="min-width:260px"></label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button id="adm_urls_save" class="btn btn-primary">Lagre URL-er</button>
      <button id="adm_urls_clear" class="btn btn-ghost">Fjern URL-er</button>
      <span id="adm_urls_status" class="small muted">—</span>
    </div>
  `;
  adminSec.appendChild(card);

  // Prefill
  $('#adm_geturl').value = JSONBIN._getUrl || '';
  $('#adm_puturl').value = JSONBIN._putUrl || '';

  $('#adm_urls_save').addEventListener('click', ()=>{
    const g=$('#adm_geturl').value.trim(), p=$('#adm_puturl').value.trim();
    JSONBIN.setUrlPair(g,p);
    $('#adm_urls_status').textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';
  });
  $('#adm_urls_clear').addEventListener('click', ()=>{
    localStorage.removeItem('BROYT_BIN_URL');
    localStorage.removeItem('BROYT_BIN_PUT');
    localStorage.removeItem('JSONBIN_BIN_URL');
    localStorage.removeItem('JSONBIN_BIN_PUT_URL');
    $('#adm_geturl').value=''; $('#adm_puturl').value='';
    $('#adm_urls_status').textContent='URL-er fjernet';
  });
}
async function loadSettingsToAdmin(){
  try{
    ensureCloudSetupCard();
    await refreshCloud();
    const st={grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",
      seasonLabel:"2025–26",stakesCount:"",...(S.cloud.settings||{})};
    $('#adm_grus').value=st.grusDepot||''; $('#adm_diesel').value=st.diesel||''; $('#adm_base').value=st.base||'';
    $('#adm_stakes').value=(st.stakesCount!==undefined?String(st.stakesCount):'');
    $('#adm_stakes_lock').textContent=st.stakesLocked?'🔒 Stikker låst':'🔓 Lås antall';
    // oppdater sky-statuslinjen
    const el=$('#adm_urls_status'); if(el) el.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Sky-oppsett mangler';
  }catch(e){ console.warn('loadSettingsToAdmin',e); }
}
$('#adm_stakes_lock')?.addEventListener('click', async ()=>{
  try{
    await refreshCloud(); S.cloud.settings ||= {};
    S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked; await saveCloud();
    $('#adm_stakes_lock').textContent=S.cloud.settings.stakesLocked?'🔒 Stikker låst':'🔓 Lås antall';
  }catch(e){ alert('Kunne ikke endre lås: '+e.message); }
});
['adm_grus','adm_diesel','adm_base','adm_stakes'].forEach(id=>{
  const el=$('#'+id); if(!el) return;
  el.addEventListener('change', async ()=>{
    try{
      await refreshCloud(); S.cloud.settings ||= {};
      if(id==='adm_grus') S.cloud.settings.grusDepot=el.value.trim();
      if(id==='adm_diesel') S.cloud.settings.diesel=el.value.trim();
      if(id==='adm_base') S.cloud.settings.base=el.value.trim();
      if(id==='adm_stakes'){ const v=el.value.trim(); S.cloud.settings.stakesCount=(v===''?'':(isNaN(Number(v))?v:Number(v))); }
      await saveCloud();
    }catch(e){ alert('Lagring feilet: '+e.message); }
  });
});

/* =============== Bilde (uhell) =============== */
function pickImage(){ return new Promise(resolve=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange=()=>resolve(i.files&&i.files[0]?i.files[0]:null); i.click(); setTimeout(()=>resolve(null),15000); }); }
function compressImage(file,maxW=1000,q=0.7){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const scale=maxW/Math.max(img.width,img.height); const w=img.width>=img.height?maxW:Math.round(img.width*scale); const h=img.width>=img.height?Math.round(img.height*scale):maxW; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',q)); }; img.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); }); }