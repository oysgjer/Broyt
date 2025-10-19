/* =========================================================
   Brøyterute – app-logikk
   v10.4.13
   - Quick actions: grus/diesel/base + wake lock
   - Under arbeid: én "Naviger" som går til NESTE adresse
   - Fikser filtrering (snø vs grus) og små robusthetsdetaljer
   ========================================================= */

const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtTime = t => !t ? '—' : nowHHMM(t);
const fmtDate = () => new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null,lastSync:0,wake:null};

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
    return {version:'10.4.13',updated:Date.now(),by:'local',
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

/* ----------------- WORK UI ----------------- */
function updateProgressBars(){
  const total=S.addresses.length||1; let me=0,other=0;
  const bag=statusStore();
  for(const k in bag){
    const st=bag[k];
    if(st && st.state==='done'){
      if(st.driver===S.driver) me++;
      else other++;
    }
  }
  const bm=$('#b_prog_me'), bo=$('#b_prog_other');
  if(bm && bm.style) bm.style.width=Math.round(100*me/total)+'%';
  if(bo && bo.style) bo.style.width=Math.round(100*other/total)+'%';
}
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

/* ----------------- STATUS ----------------- */
function summarize(addrs,bag){
  const c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
  addrs.forEach(a=>{
    const st=(bag[a.name]||{state:'not_started'}).state;
    if(st==='not_started') c.not++;
    else if(st==='in_progress') c.prog++;
    else if(st==='done') c.done++;
    else if(st==='skipped') c.skip++;
    else if(st==='blocked') c.blk++;
    else if(st==='accident') c.acc++;
  });
  return c;
}
function makeRow(i,a,s){
  const hasCoord = !!(a.coords && /,/.test(a.coords));
  const mapLink = hasCoord ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coords.replace(/\s+/g,''))}" target="_blank" rel="noopener">🧭</a>` : '—';
  const oppdrag = (a.flags && a.flags.snow && a.flags.grit) ? 'Snø + Grus' : ((a.flags && a.flags.grit) ? 'Grus' : 'Snø');
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${i+1}</td><td>${a.name||''}</td><td>${oppdrag}</td>
    <td>${(a.stakes!==''&&a.stakes!=null)?a.stakes:'—'}</td>
    <td style="text-align:center">${mapLink}</td>
    <td>${STATE_LABEL[(s&&s.state)||'not_started']}</td>
    <td>${fmtTime(s&&s.startedAt)}</td>
    <td>${fmtTime(s&&s.finishedAt)}</td>
    <td>${(s&&s.driver)||'—'}</td>
    <td>${(s&&s.photo)?'🖼️':''}</td>`;
  return tr;
}
async function loadStatus(){
  try{
    await ensureAddressesSeeded();
    const modeSel=$('#st_mode') ? $('#st_mode').value : 'snow';
    const cloud=await JSONBIN.getLatest();
    if(cloud && !cloud.statusSnow && cloud.status) cloud.statusSnow=cloud.status;

    const addrs=Array.isArray(cloud && cloud.snapshot && cloud.snapshot.addresses) ? cloud.snapshot.addresses : [];
    const bag=(modeSel==='snow')?(cloud.statusSnow||{}):(cloud.statusGrit||{});
    const filter=$('#st_filter') ? $('#st_filter').value : 'alle';
    const tbody=$('#st_tbody'); if(tbody) tbody.innerHTML='';

    const badge=$('#st_season_badge'); if(badge) badge.textContent='Sesong: '+((cloud.settings&&cloud.settings.seasonLabel)||'—');
    const lockBtn=$('#st_lock_toggle');
    if(lockBtn){
      const lk=!!(cloud.settings&&cloud.settings.stakesLocked);
      lockBtn.textContent=lk?'🔒 Stikker låst':'🔓 Lås stikker (sesong)';
      lockBtn.dataset.locked=String(lk);
    }

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
    const sum=$('#st_summary');
    if(sum) sum.textContent=`${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
  }catch(e){ alert('Kunne ikke hente status: '+(e.message||e)); }
}

/* ----------------- ADMIN ----------------- */
function ensureCloudSetupCard(){
  const g=$('#adm_geturl'), p=$('#adm_puturl'), st=$('#adm_urls_status');
  if(g) g.value = localStorage.getItem('BROYT_BIN_URL')||'';
  if(p) p.value = localStorage.getItem('BROYT_BIN_PUT')||'';
  if(st) st.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';

  $('#adm_urls_save') && $('#adm_urls_save').addEventListener('click', ()=>{
    const gg=$('#adm_geturl')?$('#adm_geturl').value.trim():'';
    const pp=$('#adm_puturl')?$('#adm_puturl').value.trim():'';
    JSONBIN.setUrlPair(gg,pp);
    const s=$('#adm_urls_status'); if(s) s.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';
  });
  $('#adm_urls_clear') && $('#adm_urls_clear').addEventListener('click', ()=>{
    ['BROYT_BIN_URL','BROYT_BIN_PUT'].forEach(k=>localStorage.removeItem(k));
    if($('#adm_geturl')) $('#adm_geturl').value='';
    if($('#adm_puturl')) $('#adm_puturl').value='';
    const s=$('#adm_urls_status'); if(s) s.textContent='URL-er fjernet';
  });
}
function renderAdminAddresses(){
  const tb=$('#adm_addr_tbody'); if(!tb) return;
  tb.innerHTML='';
  const locked=!!(S.cloud.settings&&S.cloud.settings.stakesLocked);
  (S.cloud.snapshot.addresses||[]).forEach((a,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="adm-active"></td>
      <td><input class="adm-name"    placeholder="Adresse"></td>
      <td><input class="adm-group"   placeholder="Gruppe"></td>
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
    tr.querySelector('.adm-snow').checked = !!((a.flags&&('snow' in a.flags)) ? a.flags.snow : true);
    tr.querySelector('.adm-grit').checked = !!(a.flags && a.flags.grit);
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

  const st=Object.assign({}, S.cloud.settings||{});
  if($('#adm_grus'))   $('#adm_grus').value=st.grusDepot||'';
  if($('#adm_diesel')) $('#adm_diesel').value=st.diesel||'';
  if($('#adm_base'))   $('#adm_base').value=st.base||'';
  if($('#adm_stakes_lock')) $('#adm_stakes_lock').textContent=st.stakesLocked?'🔒 Låst':'🔓 Lås stikker';

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
      const coords = tr.querySelector('.adm-coords').value.trim();
      list.push({active,name,group,flags:{snow,grit},stakes,coords});
    });
    S.cloud.snapshot.addresses = list;
    await saveCloud();
    if(msg) msg.textContent='✅ Lagret';
  }catch(e){
    if(msg) msg.textContent='Feil: '+(e.message||e);
  }
}

/* ---------- Wake Lock (Android/iOS PWA fallback) ---------- */
async function toggleWakeLock() {
  const status = document.querySelector('#qk_wl_status');
  try {
    if (S.wake && S.wake.active) {
      await S.wake.release();
      S.wake = null;
      if (status) status.textContent = 'Status: av';
      return;
    }
    if ('wakeLock' in navigator && navigator.wakeLock.request) {
      S.wake = await navigator.wakeLock.request('screen');
      S.wake.addEventListener('release', () => status && (status.textContent = 'Status: av'));
      if (status) status.textContent = 'Status: på (native)';
      return;
    }
    let v = document.querySelector('#wlHiddenVideo');
    if (!v) {
      v = document.createElement('video');
      v.id = 'wlHiddenVideo';
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.style.display = 'none';
      v.src =
        'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
      document.body.appendChild(v);
    }
    await v.play();
    if (status) status.textContent = 'Status: på (iOS-fallback)';
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Status: feil (' + (err.message || 'ukjent') + ')';
  }
}

/* ----------------- Init / routing / actions ----------------- */
window.addEventListener('DOMContentLoaded', ()=>{
  ensureSyncBadge();

  // Drawer
  const drawer=$('#drawer'), scrim=$('#scrim');
  const open=()=>{drawer && drawer.classList.add('open'); scrim && scrim.classList.add('show'); drawer && drawer.setAttribute('aria-hidden','false');};
  const close=()=>{drawer && drawer.classList.remove('open'); scrim && scrim.classList.remove('show'); drawer && drawer.setAttribute('aria-hidden','true');};
  $('#btnMenu') && $('#btnMenu').addEventListener('click', open);
  $('#btnCloseDrawer') && $('#btnCloseDrawer').addEventListener('click', close);
  scrim && scrim.addEventListener('click', close);
  $$('#drawer .drawer-link[data-go]').forEach(b=>b.addEventListener('click',()=>{showPage(b.getAttribute('data-go')); close();}));

  // Wake Lock – init + klikk
  const wlNote = $('#qk_wl_status'); if (wlNote) wlNote.textContent = 'Status: av';
  $('#qk_wl') && $('#qk_wl').addEventListener('click', toggleWakeLock);

  // Quick actions: grus/diesel/base
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
  $('#qk_grus')   && $('#qk_grus').addEventListener('click', ()=>openDest('grus'));
  $('#qk_diesel') && $('#qk_diesel').addEventListener('click',()=>openDest('diesel'));
  $('#qk_base')   && $('#qk_base').addEventListener('click',  ()=>openDest('base'));

  // Routing
  window.showPage=function(id){
    $$('main section').forEach(s=>s.style.display='none');
    const el=$('#'+id); if(el) el.style.display='block';
    location.hash='#'+id;
    if(id==='status'){ const d=$('#rp_date'); if(d) d.textContent=fmtDate(); loadStatus(); }
    if(id==='admin'){ loadAdmin(); }
  };
  window.addEventListener('hashchange',()=>{
    const id=(location.hash||'#home').replace('#','');
    showPage($('#'+id)?id:'home');
  });

  // Preferences
  try{
    const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
    if(p.driver && $('#a_driver')) $('#a_driver').value=p.driver;
    if(p.dir && $('#a_dir')) $('#a_dir').value=p.dir;
    if(p.eq){
      const a=$('#a_eq_plow'), b=$('#a_eq_fres'), c=$('#a_eq_sand');
      if(a) a.checked=!!p.eq.plow; if(b) b.checked=!!p.eq.fres; if(c) c.checked=!!p.eq.sand;
    }
    if(typeof p.autoNav==='boolean' && $('#a_autoNav')) $('#a_autoNav').checked=p.autoNav;
  }catch{}

  showPage('home');

  // Start runde
  $('#a_start') && $('#a_start').addEventListener('click', async ()=>{
    try{
      const prefs={
        driver:($('#a_driver') && $('#a_driver').value || '').trim() || 'driver',
        dir:$('#a_dir') ? $('#a_dir').value : 'Normal',
        eq:{
          plow: $('#a_eq_plow') ? $('#a_eq_plow').checked : false,
          fres: $('#a_eq_fres') ? $('#a_eq_fres').checked : false,
          sand: $('#a_eq_sand') ? $('#a_eq_sand').checked : false
        },
        autoNav: $('#a_autoNav') ? $('#a_autoNav').checked : false
      };
      localStorage.setItem('BROYT_PREFS',JSON.stringify(prefs));
      S.driver=prefs.driver; S.dir=prefs.dir; S.autoNav=prefs.autoNav;
      S.mode = prefs.eq.sand ? 'grit' : 'snow';

      await ensureAddressesSeeded();
      await refreshCloud();

      const arr=(S.cloud && S.cloud.snapshot && S.cloud.snapshot.addresses) ? S.cloud.snapshot.addresses : [];
      S.addresses = arr
        .filter(a=>a.active!==false)
        .filter(a=> S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
      S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

      uiSetWork();
      showPage('work');
    }catch(e){ alert('Startfeil: '+(e.message||e)); }
  });

  // Work-knapper
  $('#act_start') && $('#act_start').addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
  $('#act_skip')  && $('#act_skip').addEventListener('click',()=>stepState({state:'skipped',finishedAt:Date.now()}));
  $('#act_block') && $('#act_block').addEventListener('click',()=>{ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; stepState({state:'blocked',finishedAt:Date.now(),note:reason}); });
  $('#act_acc')   && $('#act_acc').addEventListener('click', async ()=>{
    try{
      const note=prompt('Beskriv uhell (valgfritt)','')||'';
      const file=await pickImage(); let photo=null;
      if(file) photo=await compressImage(file,900,0.6);
      await stepState({state:'accident',finishedAt:Date.now(),note,photo},false);
    }catch(e){ alert('Feil ved uhell: '+(e.message||e)); }
  });
  $('#act_done')  && $('#act_done').addEventListener('click',()=>stepState({state:'done',finishedAt:Date.now()}));

  // Under arbeid – én "Naviger" til NESTE
  function navigateToNext(){
    const next = S.addresses[nextIndex(S.idx,S.dir)];
    const target = next || S.addresses[S.idx] || null;
    if(!target) return;
    const hasCoord = !!(target.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(target.coords));
    const url = hasCoord
      ? mapsUrlFromLatLon(target.coords)
      : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((target.name||'')+', Norge');
    window.open(url,'_blank');
  }
  // Støtt både #act_nav og (gammel) #act_nav_next
  $('#act_nav')      && $('#act_nav').addEventListener('click', navigateToNext);
  $('#act_nav_next') && $('#act_nav_next').addEventListener('click', navigateToNext);

  // Status-handlinger
  $('#st_reload') && $('#st_reload').addEventListener('click',loadStatus);
  $('#st_filter') && $('#st_filter').addEventListener('change',loadStatus);
  $('#st_mode')   && $('#st_mode').addEventListener('change',loadStatus);
  $('#st_lock_toggle') && $('#st_lock_toggle').addEventListener('click', async ()=>{
    try{
      await refreshCloud();
      if(!S.cloud.settings) S.cloud.settings={seasonLabel:"2025–26",stakesLocked:false};
      S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked;
      await saveCloud(); loadStatus(); loadAdmin();
    }catch(e){ alert('Feil: '+(e.message||e)); }
  });
  $('#st_reset_all') && $('#st_reset_all').addEventListener('click', async ()=>{
    if(!confirm('Nullstille denne runden for alle?')) return;
    await refreshCloud(); const bag=statusStore();
    (S.cloud.snapshot.addresses||[]).forEach(a=>{bag[a.name]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};});
    await saveCloud(); loadStatus();
  });
  $('#st_reset_mine') && $('#st_reset_mine').addEventListener('click', async ()=>{
    if(!confirm('Nullstille kun dine punkter?')) return;
    await refreshCloud(); const bag=statusStore();
    for(const k in bag){ if(bag[k] && bag[k].driver===S.driver){bag[k]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};}}
    await saveCloud(); loadStatus();
  });

  // Admin – nøkkel og adresser
  $('#adm_key_save') && $('#adm_key_save').addEventListener('click',()=>{
    const ok=JSONBIN.setKey($('#adm_key') ? $('#adm_key').value : '');
    const s=$('#adm_key_status'); if(s) s.textContent=ok?'Lagret nøkkel.':'Ugyldig nøkkel.';
  });
  $('#adm_key_clear') && $('#adm_key_clear').addEventListener('click',()=>{
    JSONBIN.clearKey(); const s=$('#adm_key_status'); if(s) s.textContent='Nøkkel fjernet.';
  });

  $('#adm_stakes_lock') && $('#adm_stakes_lock').addEventListener('click', async ()=>{
    try{
      await refreshCloud();
      if(!S.cloud.settings) S.cloud.settings={seasonLabel:"2025–26",stakesLocked:false};
      S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked;
      await saveCloud();
      const b=$('#adm_stakes_lock'); if(b) b.textContent=S.cloud.settings.stakesLocked?'🔒 Låst':'🔓 Lås stikker';
      renderAdminAddresses();
    }catch(e){ alert('Feil: '+(e.message||e)); }
  });

  $('#adm_addr_fetch') && $('#adm_addr_fetch').addEventListener('click',loadAdmin);
  $('#adm_addr_save')  && $('#adm_addr_save').addEventListener('click',saveAdminAddresses);

  // Auto-retry sync
  setInterval(async ()=>{
    const badge=$('#sync_badge'); if(!badge) return;
    const txt=(badge.textContent||'').toLowerCase();
    if(txt.includes('feil') || txt.includes('ukjent')){
      try{ await JSONBIN.getLatest(); }catch{}
    }
  }, 60000);
});

/* ---- uhell-bilde ---- */
function pickImage(){ return new Promise(resolve=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange=()=>resolve(i.files&&i.files[0]?i.files[0]:null); i.click(); setTimeout(()=>resolve(null),15000); }); }
function compressImage(file,maxW=1000,q=0.7){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const scale=maxW/Math.max(img.width,img.height); const w=img.width>=img.height?maxW:Math.round(img.width*scale); const h=img.width>=img.height?Math.round(img.height*scale):maxW; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',q)); }; img.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); }); }

/* ---- rapport CSV ---- */
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