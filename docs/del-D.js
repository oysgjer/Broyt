/* del-D.js – v10.4
   Nytt:
   - Koordinater per adresse (Admin: "Koordinater (lat,lon)")
   - Navigering bruker coords hvis tilgjengelig
   - Status-tabell viser kart-ikon/lenke per rad
*/

const $ = (s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const fmtTime = t=>!t ? '—' : new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtDate = ()=> new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null};

/* ------------ JSONBin helper ------------- */
const JSONBIN={
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||localStorage.getItem('JSONBIN_BIN_URL')||'';},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||localStorage.getItem('JSONBIN_BIN_PUT_URL')||'';},
  get _key(){return localStorage.getItem('BROYT_XKEY')||localStorage.getItem('JSONBIN_MASTER')||'';},
  setUrlPair(g,p){ if(g){localStorage.setItem('BROYT_BIN_URL',g);localStorage.setItem('JSONBIN_BIN_URL',g);} if(p){localStorage.setItem('BROYT_BIN_PUT',p);localStorage.setItem('JSONBIN_BIN_PUT_URL',p);} },
  setKey(k){const v=(k||'').trim(); if(!v){localStorage.removeItem('BROYT_XKEY');return false;} localStorage.setItem('BROYT_XKEY',v); localStorage.setItem('JSONBIN_MASTER',v); return true;},
  clearKey(){localStorage.removeItem('BROYT_XKEY');localStorage.removeItem('JSONBIN_MASTER');},
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
    return {version:'10.4',updated:Date.now(),by:'local',
      settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",seasonLabel:"2025–26",stakesLocked:false},
      snapshot:{addresses:[]},statusSnow:{},statusGrit:{},serviceLogs:[]};
  }
};

/* ------------ seed --------------- */
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

/* ------------ cloud ------------ */
async function ensureAddressesSeeded(){
  S.cloud = await JSONBIN.getLatest();
  const arr = Array.isArray(S.cloud?.snapshot?.addresses)?S.cloud.snapshot.addresses:[];
  if(arr.length>0) return;
  if(localStorage.getItem('BROYT_SEEDED_ADDR')==='yes') return;
  const list=seedAddressesList();
  S.cloud.snapshot={...(S.cloud.snapshot||{}),addresses:list};
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  localStorage.setItem('BROYT_SEEDED_ADDR','yes');
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}
async function refreshCloud(){
  S.cloud = await JSONBIN.getLatest();
  if(!S.cloud.statusSnow && S.cloud.status){ S.cloud.statusSnow=S.cloud.status; delete S.cloud.status; }
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  S.cloud.settings ||= {seasonLabel:"2025–26",stakesLocked:false};
}
async function saveCloud(){
  S.cloud.updated=Date.now(); S.cloud.by=S.driver||'driver';
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}
function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
function nextIndex(i,d){return d==='Motsatt'?i-1:i+1;}

/* ------------ maps helper ------------- */
function mapsUrlFromAddr(addr){
  if(!addr) return 'https://www.google.com/maps';
  // "lat,lon" i addr.coords
  if(addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
    const q=addr.coords.replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  // eksplisitt lat/lon felter?
  if(typeof addr.lat==='number' && typeof addr.lon==='number'){
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lon}`;
  }
  // fallback: navn
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
}

/* ------------ WORK UI ------------- */
function updateProgressBars(){
  const total=S.addresses.length||1; let me=0,other=0;
  const bag=statusStore();
  for(const k in bag){ const st=bag[k]; if(st.state==='done'){ if(st.driver===S.driver)me++; else other++; } }
  $('#b_prog_me').style.width=Math.round(100*me/total)+'%';
  $('#b_prog_other').style.width=Math.round(100*other/total)+'%';
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
function allDone(){ if(!S.addresses.length) return false; const bag=statusStore(); return S.addresses.every(a=>(bag[a.name]?.state==='done')); }
function maybeShowAllDoneDialog(){
  if(!allDone())return;
  const modeTxt=(S.mode==='snow')?'Snø':'Grus';
  const go=confirm(`Alt er utført for ${modeTxt}-runden 🎉\n\nOK = Gå til Service\nAvbryt = bli`);
  if(go){ showPage('service'); }
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

/* ------------ STATUS ------------- */
function summarize(addrs,bag){
  let c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
  addrs.forEach(a=>{const st=(bag[a.name]||{state:'not_started'}).state;
    if(st==='not_started')c.not++; else if(st==='in_progress')c.prog++;
    else if(st==='done')c.done++; else if(st==='skipped')c.skip++;
    else if(st==='blocked')c.blk++; else if(st==='accident')c.acc++;
  }); return c;
}
function makeRow(i,a,s){
  const hasCoord = !!(a.coords && /,/.test(a.coords));
  const mapLink = hasCoord ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coords.replace(/\s+/g,''))}" target="_blank" rel="noopener">🧭</a>` : '—';
  const oppdrag = (a.flags?.snow && a.flags?.grit) ? 'Snø + Grus' : (a.flags?.grit ? 'Grus' : 'Snø');
  const img=s?.photo?'🖼️':'';
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${i+1}</td><td>${a.name||''}</td><td>${oppdrag}</td>
    <td>${(a.stakes!==''&&a.stakes!=null)?a.stakes:'—'}</td>
    <td style="text-align:center">${mapLink}</td>
    <td>${STATE_LABEL[s?.state||'not_started']}</td>
    <td>${fmtTime(s?.startedAt)}</td>
    <td>${fmtTime(s?.finishedAt)}</td>
    <td>${s?.driver||'—'}</td><td>${img}</td>`;
  return tr;
}
async function loadStatus(){
  try{
    await ensureAddressesSeeded();
    const modeSel=$('#st_mode')?.value || 'snow';
    const cloud=await JSONBIN.getLatest();
    if(!cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;

    const addrs=Array.isArray(cloud?.snapshot?.addresses)?cloud.snapshot.addresses:[];
    const bag=(modeSel==='snow')?(cloud.statusSnow||{}):(cloud.statusGrit||{});
    const filter=$('#st_filter')?.value || 'alle';
    const tbody=$('#st_tbody'); if(tbody) tbody.innerHTML='';

    const badge=$('#st_season_badge'); if(badge) badge.textContent='Sesong: '+((cloud.settings&&cloud.settings.seasonLabel)||'—');
    const lockBtn=$('#st_lock_toggle'); if(lockBtn){ const lk=!!(cloud.settings&&cloud.settings.stakesLocked); lockBtn.textContent=lk?'🔒 Stikker låst':'🔓 Lås stikker (sesong)'; lockBtn.dataset.locked=String(lk); }

    addrs.forEach((a,i)=>{
      const s=bag[a.name]||{state:'not_started'};
      let ok=true;
      if(filter==='ikke'  && s.state!=='not_started') ok=false;
      if(filter==='pågår' && s.state!=='in_progress') ok=false;
      if(filter==='ferdig'&& s.state!=='done') ok=false;
      if(filter==='hoppet'&& s.state!=='skipped') ok=false;
      if(filter==='umulig'&& s.state!=='blocked') ok=false;
      if(filter==='uhell' && s.state!=='accident') ok=false;
      if(ok && tbody) tbody.appendChild(makeRow(i,a,s));
    });

    const c=summarize(addrs,bag);
    const label=(modeSel==='snow')?'Snø':'Grus';
    const sum=$('#st_summary'); if(sum) sum.textContent=`${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
  }catch(e){ alert('Kunne ikke hente status: '+(e.message||e)); }
}

/* ------------ ADMIN: sky & innstillinger & adresser ------------- */
function ensureCloudSetupCard(){
  $('#adm_geturl').value = JSONBIN._getUrl || '';
  $('#adm_puturl').value = JSONBIN._putUrl || '';
  const el=$('#adm_urls_status'); if(el) el.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';
  $('#adm_urls_save')?.addEventListener('click', ()=>{
    const g=$('#adm_geturl').value.trim(), p=$('#adm_puturl').value.trim();
    JSONBIN.setUrlPair(g,p);
    const el=$('#adm_urls_status'); if(el) el.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';
  });
  $('#adm_urls_clear')?.addEventListener('click', ()=>{
    ['BROYT_BIN_URL','BROYT_BIN_PUT','JSONBIN_BIN_URL','JSONBIN_BIN_PUT_URL'].forEach(k=>localStorage.removeItem(k));
    $('#adm_geturl').value=''; $('#adm_puturl').value=''; const el=$('#adm_urls_status'); if(el) el.textContent='URL-er fjernet';
  });
}
function renderAdminAddresses(){
  const tb=$('#adm_addr_tbody'); if(!tb) return;
  tb.innerHTML='';
  const locked=!!(S.cloud.settings&&S.cloud.settings.stakesLocked);
  S.cloud.snapshot.addresses.forEach((a,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="adm-active"></td>
      <td><input class="adm-name"></td>
      <td><input class="adm-group"></td>
      <td style="text-align:center"><input type="checkbox" class="adm-snow"></td>
      <td style="text-align:center"><input type="checkbox" class="adm-grit"></td>
      <td><input class="adm-stakes" inputmode="numeric" placeholder="0" ${locked?'disabled':''}></td>
      <td><input class="adm-coords" placeholder="60.xxxxxx,11.xxxxxx"></td>
      <td>
        <div class="row" style="gap:6px">
          <button class="btn btn-ghost adm-up">⬆️</button>
          <button class="btn btn-ghost adm-down">⬇️</button>
        </div>
      </td>`;
    tb.appendChild(tr);
    tr.querySelector('.adm-active').checked = a.active!==false;
    tr.querySelector('.adm-name').value   = a.name||'';
    tr.querySelector('.adm-group').value  = a.group||'';
    tr.querySelector('.adm-snow').checked = !!(a.flags?.snow ?? true);
    tr.querySelector('.adm-grit').checked = !!(a.flags?.grit ?? false);
    tr.querySelector('.adm-stakes').value = (a.stakes!==undefined&&a.stakes!=='')?a.stakes:'';
    tr.querySelector('.adm-coords').value = a.coords||'';

    tr.querySelector('.adm-up').addEventListener('click',()=>{
      if(idx<=0) return;
      const arr=S.cloud.snapshot.addresses;
      [arr[idx-1],arr[idx]]=[arr[idx],arr[idx-1]];
      renderAdminAddresses();
    });
    tr.querySelector('.adm-down').addEventListener('click',()=>{
      const arr=S.cloud.snapshot.addresses;
      if(idx>=arr.length-1) return;
      [arr[idx+1],arr[idx]]=[arr[idx],arr[idx+1]];
      renderAdminAddresses();
    });
  });
}
async function loadAdmin(){
  await ensureAddressesSeeded();
  await refreshCloud();
  ensureCloudSetupCard();

  const st={...(S.cloud.settings||{})};
  $('#adm_grus').value=st.grusDepot||'';
  $('#adm_diesel').value=st.diesel||'';
  $('#adm_base').value=st.base||'';
  $('#adm_stakes_lock').textContent=st.stakesLocked?'🔒 Låst':'🔓 Lås stikker';

  if(!Array.isArray(S.cloud.snapshot.addresses)) S.cloud.snapshot.addresses=[];
  renderAdminAddresses();
}
async function saveAdminAddresses(){
  const msg=$('#adm_addr_msg');
  try{
    const rows=$$('#adm_addr_tbody tr');
    const list=[];
    rows.forEach(tr=>{
      const active = tr.querySelector('.adm-active').checked;
      const name   = tr.querySelector('.adm-name').value.trim();
      if(!name) return;
      const group  = tr.querySelector('.adm-group').value.trim();
      const snow   = tr.querySelector('.adm-snow').checked;
      const grit   = tr.querySelector('.adm-grit').checked;
      const stakes = tr.querySelector('.adm-stakes').value.trim();
      const coords = tr.querySelector('.adm-coords').value.trim(); // "lat,lon"
      list.push({active,name,group,flags:{snow,grit},stakes,coords});
    });
    S.cloud.snapshot.addresses = list;
    await saveCloud();
    if(msg) msg.textContent='Lagret.';
  }catch(e){ if(msg) msg.textContent='Feil: '+(e.message||e); }
}

/* ------------ init ------------- */
window.addEventListener('DOMContentLoaded', ()=>{
  // routing/drawer
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
    if(id==='admin'){ loadAdmin(); }
  };
  window.addEventListener('hashchange',()=>{
    const id=(location.hash||'#home').replace('#','');
    showPage($('#'+id)?id:'home');
  });

  // prefs
  try{
    const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
    if(p.driver)$('#a_driver').value=p.driver;
    if(p.dir)$('#a_dir').value=p.dir;
    if(p.eq){ $('#a_eq_plow').checked=!!p.eq.plow; $('#a_eq_fres').checked=!!p.eq.fres; $('#a_eq_sand').checked=!!p.eq.sand; }
    if(typeof p.autoNav==='boolean')$('#a_autoNav').checked=p.autoNav;
  }catch{}

  showPage('home');

  // start runde
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

      const arr=(S.cloud?.snapshot?.addresses)||[];
      S.addresses = arr.filter(a=>a.active!==false).filter(a=> S.mode==='snow' ? (a.flags?.snow!==false) : !!a.flags?.grit);
      S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

      uiSetWork();
      showPage('work');
    }catch(e){ alert('Startfeil: '+(e.message||e)); }
  });

  // work actions
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

  // Én naviger → alltid neste (bruk coords)
  $('#act_nav_next')?.addEventListener('click', ()=>{
    const next=S.addresses[nextIndex(S.idx,S.dir)];
    if(!next) return;
    window.open(mapsUrlFromAddr(next),'_blank');
  });

  // status-knapper
  $('#st_reload')?.addEventListener('click',loadStatus);
  $('#st_filter')?.addEventListener('change',loadStatus);
  $('#st_mode')  ?.addEventListener('change',loadStatus);
  $('#st_lock_toggle')?.addEventListener('click', async ()=>{
    try{ await refreshCloud(); S.cloud.settings ||= {}; S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked; await saveCloud(); loadStatus(); loadAdmin(); }
    catch(e){ alert('Feil: '+(e.message||e)); }
  });
  $('#st_reset_all') ?.addEventListener('click', async ()=>{ if(confirm('Nullstille denne runden for alle?')){ await refreshCloud(); const bag=statusStore(); (S.cloud.snapshot.addresses||[]).forEach(a=>{bag[a.name]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};}); await saveCloud(); loadStatus(); }});
  $('#st_reset_mine')?.addEventListener('click', async ()=>{ if(confirm('Nullstille kun dine punkter?')){ await refreshCloud(); const bag=statusStore(); for(const k in bag){ if(bag[k]?.driver===S.driver){bag[k]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};}} await saveCloud(); loadStatus(); }});

  // admin: nøkkel
  $('#adm_key_save') ?.addEventListener('click',()=>{ const ok=JSONBIN.setKey($('#adm_key').value||''); const s=$('#adm_key_status'); if(s) s.textContent=ok?'Lagret nøkkel.':'Ugyldig nøkkel.'; });
  $('#adm_key_clear')?.addEventListener('click',()=>{ JSONBIN.clearKey(); const s=$('#adm_key_status'); if(s) s.textContent='Nøkkel fjernet.'; });

  // admin: lås stikker
  $('#adm_stakes_lock')?.addEventListener('click', async ()=>{
    try{ await refreshCloud(); S.cloud.settings ||= {}; S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked; await saveCloud(); $('#adm_stakes_lock').textContent=S.cloud.settings.stakesLocked?'🔒 Låst':'🔓 Lås stikker'; renderAdminAddresses(); }
    catch(e){ alert('Feil: '+(e.message||e)); }
  });

  // admin: adresser
  $('#adm_addr_fetch')?.addEventListener('click',loadAdmin);
  $('#adm_addr_save') ?.addEventListener('click',saveAdminAddresses);
});

/* ---- uhell-bilde ---- */
function pickImage(){ return new Promise(resolve=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange=()=>resolve(i.files&&i.files[0]?i.files[0]:null); i.click(); setTimeout(()=>resolve(null),15000); }); }
function compressImage(file,maxW=1000,q=0.7){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const scale=maxW/Math.max(img.width,img.height); const w=img.width>=img.height?maxW:Math.round(img.width*scale); const h=img.width>=img.height?Math.round(img.height*scale):maxW; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',q)); }; img.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); }); }

/* ---- rapport CSV ---- */
async function exportCsv(){
  try{
    const cloud=await JSONBIN.getLatest(); if(!cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;
    const addrs=Array.isArray(cloud?.snapshot?.addresses)?cloud.snapshot.addresses:[];
    const bagSnow=cloud.statusSnow||{}, bagGrit=cloud.statusGrit||{};
    const rows=[['#','Adresse','Oppdrag','Stikker (sesong)','Koordinater','Status','Start','Ferdig','Utført av','Notat']];
    addrs.forEach((a,i)=>{
      const coord=a.coords||'';
      if(a.flags?.snow!==false){
        const s=bagSnow[a.name]||{};
        rows.push([String(i+1),a.name,'Snø',(a.stakes!==''?a.stakes:''),coord,STATE_LABEL[s.state||'not_started'],fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'',(s.note||'').replace(/\s+/g,' ').trim()]);
      }
      if(a.flags?.grit){
        const s=bagGrit[a.name]||{};
        rows.push([String(i+1),a.name,'Grus',(a.stakes!==''?a.stakes:''),coord,STATE_LABEL[s.state||'not_started'],fmtTime(s.startedAt),fmtTime(s.finishedAt),s.driver||'',(s.note||'').replace(/\s+/g,' ').trim()]);
      }
    });
    const csv=`Brøyterapport,${fmtDate()}\n`+rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`Broeyterapport_${fmtDate()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){ alert('CSV-feil: '+(e.message||e)); }
}