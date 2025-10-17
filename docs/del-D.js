/* del-D.js – v10.2b
   - Naviger/Naviger til neste fungerer (#act_nav og #act_nav_next)
   - Adresser seedes også ved Admin/Status, ikke kun Start runde
   - Fremdriftsbar (grønn/lilla) oppdateres mer pålitelig
*/

const $ = (s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const fmtTime=t=>!t?'—':new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtDate=()=>new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null};

/* ---- feilbanner (hvis noe stopper) ---- */
function showErr(msg){
  let box = $('#errbox');
  if(!box){
    box=document.createElement('div');
    box.id='errbox';
    Object.assign(box.style,{
      position:'fixed',left:'8px',right:'8px',bottom:'8px',zIndex:9999,
      background:'#7c2d12',color:'#fff',padding:'10px 12px',borderRadius:'10px'
    });
    document.body.appendChild(box);
  }
  box.textContent='Feil: '+msg;
  setTimeout(()=>{ try{box.remove();}catch{} }, 5000);
}

/* ---- JSONBin helper ---- */
const JSONBIN={
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||localStorage.getItem('JSONBIN_BIN_URL')||'';},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||localStorage.getItem('JSONBIN_BIN_PUT_URL')||'';},
  get _key(){return localStorage.getItem('BROYT_XKEY')||localStorage.getItem('JSONBIN_MASTER')||'';},
  setUrlPair(g,p){
    if(g){localStorage.setItem('BROYT_BIN_URL',g);localStorage.setItem('JSONBIN_BIN_URL',g);}
    if(p){localStorage.setItem('BROYT_BIN_PUT',p);localStorage.setItem('JSONBIN_BIN_PUT_URL',p);}
  },
  setKey(k){const v=(k||'').trim(); if(!v){localStorage.removeItem('BROYT_XKEY');return false;}
    localStorage.setItem('BROYT_XKEY',v); localStorage.setItem('JSONBIN_MASTER',v); return true; },
  clearKey(){localStorage.removeItem('BROYT_XKEY');localStorage.removeItem('JSONBIN_MASTER');},
  hasAll(){return !!(this._getUrl && this._putUrl && this._key);},
  async getLatest(){
    const url=this._getUrl; if(!url){ return this._localFallback(); }
    const res=await fetch(url,{headers:this._headers()}).catch(()=>null);
    if(!res||!res.ok){ return this._localFallback(); }
    const j=await res.json(); return j.record||j;
  },
  async putRecord(obj){
    const url=this._putUrl,key=this._key;
    if(!url||!key){ localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{})); return {ok:false,local:true};}
    const res=await fetch(url,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})}).catch(()=>null);
    return (!!res&&res.ok)?{ok:true}:{ok:false};
  },
  _headers(){const h={'Content-Type':'application/json'}; const k=this._key; if(k) h['X-Master-Key']=k; return h;},
  _localFallback(){
    const local=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
    if(local) return local;
    return {version:'10.2b',updated:Date.now(),by:'local',
      settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",
        seasonLabel:"2025–26",stakesCount:"",stakesLocked:false},
      snapshot:{addresses:[]},statusSnow:{},statusGrit:{},serviceLogs:[]};
  }
};

/* ---- seeding av adresser ---- */
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
  // Default: Snø = true, Grus = false (kan endres i adresse-register når det kommer)
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
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}

/* ---- cloud helpers ---- */
function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
function nextIndex(i,d){return d==='Motsatt'?i-1:i+1;}
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

/* ---- maps helpers ---- */
function mapsUrlFromAddr(addr){
  if(addr && typeof addr.lat==='number' && typeof addr.lon==='number'){
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lon}`;
  }
  if(addr && addr.coords && /,/.test(addr.coords)){
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.coords}`;
  }
  const q=addr?.name||''; return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q+', Norge');
}

/* ---- work UI ---- */
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

/* ---- STATUS/ADMIN ---- */
function summarize(addrs,bag){
  let c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
  addrs.forEach(a=>{const st=(bag[a.name]||{state:'not_started'}).state;
    if(st==='not_started')c.not++; else if(st==='in_progress')c.prog++;
    else if(st==='done')c.done++; else if(st==='skipped')c.skip++;
    else if(st==='blocked')c.blk++; else if(st==='accident')c.acc++;
  }); return c;
}
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
async function loadStatus(){
  try{
    await ensureAddressesSeeded(); // <— viktig: fyll hvis tomt
    const modeSel=$('#st_mode')?.value || 'snow';
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
    const filter=$('#st_filter')?.value || 'alle';
    const tbody=$('#st_tbody'); if(tbody) tbody.innerHTML='';

    const seasonLbl=(cloud.settings&&cloud.settings.seasonLabel)||'sesong';
    const stakesLocked=!!(cloud.settings&&cloud.settings.stakesLocked);
    const stakesCount=(cloud.settings && (cloud.settings.stakesCount??''))||'';

    const badge=$('#st_season_badge'); if(badge) badge.textContent='Sesong: '+seasonLbl;
    const lockBtn=$('#st_lock_toggle');
    if(lockBtn){ lockBtn.textContent=stakesLocked?'🔒 Stikker låst':'🔓 Lås stikker (sesong)'; lockBtn.dataset.locked=String(stakesLocked); }

    const stakesStr=(stakesCount!==''?String(stakesCount):'');

    if(tbody){
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
    }

    const c=summarize(addrs,bag);
    const label=(modeSel==='snow')?'Snø':'Grus';
    const sum=$('#st_summary'); if(sum) sum.textContent=`${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
  }catch(e){ showErr(e.message||e); }
}

async function resetRoundAll(){ await refreshCloud(); const bag=statusStore();
  S.addresses.forEach(a=>{bag[a.name]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};});
  await saveCloud(); loadStatus(); uiSetWork(); }
async function resetRoundMine(){ await refreshCloud(); const bag=statusStore();
  for(const k in bag){ if(bag[k]?.driver===S.driver){bag[k]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};}}
  await saveCloud(); loadStatus(); uiSetWork(); }

async function exportCsv(){
  try{
    const modeSel=$('#st_mode')?.value || 'snow';
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
  }catch(e){ showErr(e.message||e); }
}

/* ---- Admin helpers ---- */
function ensureCloudSetupCard(){
  const adminSec = $('#admin'); if(!adminSec || $('#cloudSetupCard')) return;
  const card=document.createElement('div'); card.className='card'; card.id='cloudSetupCard';
  card.innerHTML=`
    <h3 style="margin-top:0">Sky-oppsett (JSONBin/Proxy)</h3>
    <div class="inline-edit" style="gap:8px">
      <label>GET-URL:<br><input id="adm_geturl" placeholder="https://jsonbin-proxy.…" style="min-width:260px"></label>
      <label>PUT-URL:<br><input id="adm_puturl" placeholder="https://jsonbin-proxy.…" style="min-width:260px"></label>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button id="adm_urls_save" class="btn btn-primary">Lagre URL-er</button>
      <button id="adm_urls_clear" class="btn btn-ghost">Fjern URL-er</button>
      <span id="adm_urls_status" class="small muted">—</span>
    </div>`;
  adminSec.appendChild(card);
  $('#adm_geturl').value = JSONBIN._getUrl || '';
  $('#adm_puturl').value = JSONBIN._putUrl || '';
  $('#adm_urls_save').addEventListener('click', ()=>{
    const g=$('#adm_geturl').value.trim(), p=$('#adm_puturl').value.trim();
    JSONBIN.setUrlPair(g,p);
    const el=$('#adm_urls_status'); if(el) el.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';
  });
  $('#adm_urls_clear').addEventListener('click', ()=>{
    ['BROYT_BIN_URL','BROYT_BIN_PUT','JSONBIN_BIN_URL','JSONBIN_BIN_PUT_URL'].forEach(k=>localStorage.removeItem(k));
    $('#adm_geturl').value=''; $('#adm_puturl').value=''; const el=$('#adm_urls_status'); if(el) el.textContent='URL-er fjernet';
  });
}
async function loadSettingsToAdmin(){
  try{
    await ensureAddressesSeeded(); // <— viktig
    ensureCloudSetupCard();
    await refreshCloud();
    const st={grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",
      seasonLabel:"2025–26",stakesCount:"",...(S.cloud.settings||{})};
    $('#adm_grus').value=st.grusDepot||''; $('#adm_diesel').value=st.diesel||''; $('#adm_base').value=st.base||'';
    $('#adm_stakes').value=(st.stakesCount!==undefined?String(st.stakesCount):'');
    $('#adm_stakes_lock').textContent=st.stakesLocked?'🔒 Stikker låst':'🔓 Lås antall';
    const el=$('#adm_urls_status'); if(el) el.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Sky-oppsett mangler';
  }catch(e){ showErr(e.message||e); }
}

/* ---- init etter DOMContentLoaded ---- */
window.addEventListener('DOMContentLoaded', ()=>{
  try{
    // Drawer & routing
    const drawer=$('#drawer'), scrim=$('#scrim');
    const open=()=>{drawer?.classList.add('open'); scrim?.classList.add('show'); drawer?.setAttribute('aria-hidden','false');};
    const close=()=>{drawer?.classList.remove('open'); scrim?.classList.remove('show'); drawer?.setAttribute('aria-hidden','true');};
    $('#btnMenu')?.addEventListener('click', open);
    $('#btnCloseDrawer')?.addEventListener('click', close);
    scrim?.addEventListener('click', close);
    $$('#drawer .drawer-link[data-go]').forEach(b=>b.addEventListener('click',()=>{showPage(b.getAttribute('data-go')); close();}));

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

    // Gjenopprett prefs
    try{
      const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      if(p.driver)$('#a_driver').value=p.driver;
      if(p.dir)$('#a_dir').value=p.dir;
      if(p.eq){
        $('#a_eq_plow').checked=!!p.eq.plow;
        $('#a_eq_fres').checked=!!p.eq.fres;
        $('#a_eq_sand').checked=!!p.eq.sand;
      }
      if(typeof p.autoNav==='boolean')$('#a_autoNav').checked=p.autoNav;
    }catch{}

    showPage('home');

    /* HJEM: Start runde */
    $('#a_start')?.addEventListener('click', async ()=>{
      try{
        const prefs={
          driver:($('#a_driver').value||'').trim()||'driver',
          dir:$('#a_dir').value,
          eq:{plow:$('#a_eq_plow').checked,fres:$('#a_eq_fres').checked,sand:$('#a_eq_sand').checked},
          autoNav:$('#a_autoNav').checked
        };
        localStorage.setItem('BROYT_PREFS',JSON.stringify(prefs));
        S.driver=prefs.driver; S.dir=prefs.dir; S.autoNav=prefs.autoNav;
        S.mode = prefs.eq.sand ? 'grit' : 'snow';

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
      }catch(e){ showErr(e.message||e); }
    });

    /* UNDER ARBEID – handlinger */
    $('#act_start')?.addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
    $('#act_skip') ?.addEventListener('click',()=>stepState({state:'skipped',finishedAt:Date.now()}));
    $('#act_block')?.addEventListener('click',()=>{ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; stepState({state:'blocked',finishedAt:Date.now(),note:reason}); });
    $('#act_acc')  ?.addEventListener('click', async ()=>{
      try{
        const note=prompt('Beskriv uhell (valgfritt)','')||'';
        const file=await pickImage(); let photo=null;
        if(file) photo=await compressImage(file,900,0.6);
        await stepState({state:'accident',finishedAt:Date.now(),note,photo});
      }catch(e){ showErr(e.message||e); }
    });
    $('#act_done') ?.addEventListener('click',()=>stepState({state:'done',finishedAt:Date.now()}));

    // NYTT: Navigasjon-knapper (valgfritt i html)
    $('#act_nav')?.addEventListener('click', ()=>{
      const cur=S.addresses[S.idx];
      if(!cur) return;
      window.open(mapsUrlFromAddr(cur),'_blank');
    });
    $('#act_nav_next')?.addEventListener('click', ()=>{
      const next=S.addresses[nextIndex(S.idx,S.dir)];
      if(!next) return;
      window.open(mapsUrlFromAddr(next),'_blank');
    });

    /* STATUS */
    $('#st_reload')?.addEventListener('click',loadStatus);
    $('#st_filter')?.addEventListener('change',loadStatus);
    $('#st_mode')  ?.addEventListener('change',loadStatus);
    $('#st_lock_toggle')?.addEventListener('click', async ()=>{
      try{ await refreshCloud(); S.cloud.settings ||= {};
        S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked; await saveCloud(); loadStatus();
      }catch(e){ showErr(e.message||e); }
    });
    $('#st_reset_all') ?.addEventListener('click', async ()=>{ if(confirm('Nullstille denne runden for alle?')) await resetRoundAll(); });
    $('#st_reset_mine')?.addEventListener('click', async ()=>{ if(confirm('Nullstille kun dine punkter?')) await resetRoundMine(); });
    $('#rp_print')?.addEventListener('click',()=>window.print());
    $('#rp_csv')  ?.addEventListener('click',exportCsv);

    /* ADMIN – nøkler/innstillinger/sky */
    $('#adm_key_save') ?.addEventListener('click',()=>{ const ok=JSONBIN.setKey($('#adm_key').value||''); const s=$('#adm_key_status'); if(s) s.textContent=ok?'Lagret nøkkel.':'Ugyldig nøkkel.'; });
    $('#adm_key_clear')?.addEventListener('click',()=>{ JSONBIN.clearKey(); const s=$('#adm_key_status'); if(s) s.textContent='Nøkkel fjernet.'; });

  }catch(e){ showErr(e.message||e); }
});

/* ---- uhell-bilde ---- */
function pickImage(){ return new Promise(resolve=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange=()=>resolve(i.files&&i.files[0]?i.files[0]:null); i.click(); setTimeout(()=>resolve(null),15000); }); }
function compressImage(file,maxW=1000,q=0.7){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const scale=maxW/Math.max(img.width,img.height); const w=img.width>=img.height?maxW:Math.round(img.width*scale); const h=img.width>=img.height?Math.round(img.height*scale):maxW; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',q)); }; img.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); }); }