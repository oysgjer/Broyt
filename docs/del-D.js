/* del-D.js – v10.4.8 (synk-indikator + stabil lagring) */
const $  =(s,r=document)=>r.querySelector(s);
const $$ =(s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtTime=t=>!t?'—':new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtDate=()=>new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

const S={dir:'Normal',driver:'',addresses:[],idx:0,autoNav:false,mode:'snow',cloud:null};

/* ---------- synk-indikator ---------- */
function setSync(status, tsMs){
  const dot = $('#syncDot'),  txt = $('#syncText');
  const dot2= $('#syncDot2'), txt2= $('#syncText2');
  const apply=(d,t,ok,label)=>{
    if(!d||!t) return;
    d.classList.remove('sync-ok','sync-warn','sync-err');
    d.classList.add(ok==='ok'?'sync-ok':ok==='warn'?'sync-warn':'sync-err');
    t.textContent = `${label}${tsMs? ' • '+fmtTime(tsMs):''}`;
  };
  if(status==='ok'){ apply(dot,txt,'ok','Synk: OK'); apply(dot2,txt2,'ok','Synk: OK'); }
  else if(status==='warn'){ apply(dot,txt,'warn','Synk: lokal'); apply(dot2,txt2,'warn','Synk: lokal'); }
  else{ apply(dot,txt,'err','Synk: feil'); apply(dot2,txt2,'err','Synk: feil'); }
}

/* ---------- JSONBin ---------- */
const JSONBIN={
  baseId:'68e7b4d2ae596e708f0bde7d',
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||`https://jsonbin.io/v3/b/${this.baseId}/latest`;},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||`https://jsonbin.io/v3/b/${this.baseId}`;},
  get _key(){return localStorage.getItem('BROYT_XKEY')||'';},
  setKey(k){localStorage.setItem('BROYT_XKEY',(k||'').trim());},

  async getLatest(){
    try{
      const res=await fetch(this._getUrl,{headers:this._headers()});
      if(!res.ok) throw new Error('GET '+res.status);
      const j=await res.json(); const rec=j.record||j; setSync('ok', rec.updated||Date.now()); return rec;
    }catch(e){
      const fallback=this._local(); setSync('warn', fallback.updated||Date.now()); return fallback;
    }
  },
  async putRecord(obj){
    try{
      const res=await fetch(this._putUrl,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})});
      if(!res.ok) throw new Error('PUT '+res.status);
      setSync('ok', obj.updated||Date.now()); return {ok:true};
    }catch(e){
      localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{}));
      setSync('warn', obj.updated||Date.now()); return {ok:false,local:true};
    }
  },
  _headers(){const h={'Content-Type':'application/json'};const k=this._key;if(k)h['X-Master-Key']=k;return h;},
  _local(){return JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'{"snapshot":{"addresses":[]}}');}
};

/* ---------- helpers ---------- */
function mapsUrl(addr){
  if(addr?.coords&&/,/.test(addr.coords)){
    const c=addr.coords.replace(/\s+/g,'');return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr?.name||'')+', Norge')}`;
}
function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
function nextIndex(i,d){return d==='Motsatt'?i-1:i+1;}

/* ---------- cloud ---------- */
async function refreshCloud(){
  S.cloud=await JSONBIN.getLatest();
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  S.cloud.snapshot   ||= {addresses:[]};
  S.cloud.settings   ||= {};
}
async function saveCloud(){
  S.cloud.updated=Date.now();
  await JSONBIN.putRecord(S.cloud);
  localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));
}
async function ensureSeed(){
  await refreshCloud();
  if(!Array.isArray(S.cloud.snapshot.addresses)||!S.cloud.snapshot.addresses.length){
    const base=["Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42"];
    S.cloud.snapshot.addresses=base.map(n=>({active:true,name:n,group:"",flags:{snow:true,grit:false},stakes:"",coords:""}));
    await saveCloud();
  }
}

/* ---------- Work UI ---------- */
function updateBars(){
  const tot=S.addresses.length||1;let me=0,other=0;const bag=statusStore();
  for(const k in bag){const s=bag[k]; if(s.state==='done'){ (s.driver===S.driver?me:other)++; } }
  $('#b_prog_me').style.width=Math.round(me/tot*100)+'%';
  $('#b_prog_other').style.width=Math.round(other/tot*100)+'%';
}
function uiWork(){
  const now=S.addresses[S.idx], next=S.addresses[nextIndex(S.idx,S.dir)];
  $('#b_now').textContent = now?.name || '—';
  $('#b_next').textContent= next?.name || '—';
  $('#b_task').textContent= S.mode==='snow'?'Snø':'Grus';
  $('#b_dir').textContent = S.dir;
  const st=statusStore()[now?.name]?.state||'not_started';
  $('#b_status').textContent = STATE_LABEL[st];
  updateBars();
}
async function step(patch,next=true){
  await refreshCloud();
  const now=S.addresses[S.idx]; if(!now) return;
  const bag=statusStore(); bag[now.name]={...(bag[now.name]||{}),...patch,driver:S.driver};
  await saveCloud(); uiWork();
  if(next){ const ni=nextIndex(S.idx,S.dir); if(ni>=0&&ni<S.addresses.length){ S.idx=ni; uiWork(); if(S.autoNav) window.open(mapsUrl(S.addresses[ S.idx ]),'_blank'); } }
}

/* ---------- Status ---------- */
function summarize(addrs,bag){
  let c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
  addrs.forEach(a=>{const st=(bag[a.name]||{state:'not_started'}).state;
    if(st==='not_started')c.not++; else if(st==='in_progress')c.prog++;
    else if(st==='done')c.done++; else if(st==='skipped')c.skip++;
    else if(st==='blocked')c.blk++; else if(st==='accident')c.acc++;
  }); return c;
}
function makeRow(i,a,s){
  const hasCoord = !!(a.coords&&/,/.test(a.coords));
  const mapLink  = hasCoord ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coords.replace(/\s+/g,''))}" target="_blank" rel="noopener">🧭</a>` : '—';
  const oppdrag  = (a.flags?.snow&&a.flags?.grit)?'Snø + Grus':(a.flags?.grit?'Grus':'Snø');
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
  await ensureSeed();
  const modeSel=$('#st_mode').value;
  const addrs=S.cloud.snapshot.addresses||[];
  const bag = modeSel==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;
  const filter=$('#st_filter').value;
  const tbody=$('#st_tbody'); tbody.innerHTML='';
  (addrs).forEach((a,i)=>{
    const s=bag[a.name]||{state:'not_started'};
    let ok=true;
    if(filter==='ikke'  && s.state!=='not_started') ok=false;
    if(filter==='pågår' && s.state!=='in_progress') ok=false;
    if(filter==='ferdig'&& s.state!=='done') ok=false;
    if(filter==='hoppet'&& s.state!=='skipped') ok=false;
    if(filter==='umulig'&& s.state!=='blocked') ok=false;
    if(filter==='uhell' && s.state!=='accident') ok=false;
    if(ok) tbody.appendChild(makeRow(i,a,s));
  });
  const c=summarize(addrs,bag);
  const label=(modeSel==='snow')?'Snø':'Grus';
  $('#st_summary').textContent=`${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
  $('#st_season_badge').textContent = 'Sesong: '+(S.cloud.settings?.seasonLabel||'—');
  $('#st_lock_toggle').textContent  = (S.cloud.settings?.stakesLocked?'🔒 Stikker låst':'🔓 Lås stikker (sesong)');
}

/* ---------- Admin ---------- */
async function loadAdmin(){
  await ensureSeed();
  const tb=$('#adm_addr_tbody'); tb.innerHTML='';
  const locked=!!S.cloud.settings?.stakesLocked;
  (S.cloud.snapshot.addresses||[]).forEach(a=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="a_act" ${a.active?'checked':''}></td>
      <td><input class="a_name" value="${a.name||''}"></td>
      <td style="text-align:center"><input type="checkbox" class="a_snow" ${a.flags?.snow?'checked':''}></td>
      <td style="text-align:center"><input type="checkbox" class="a_grit" ${a.flags?.grit?'checked':''}></td>
      <td><input class="a_stakes" value="${a.stakes||''}" ${locked?'disabled':''}></td>
      <td><input class="a_coords" value="${a.coords||''}" placeholder="60.xxxxxx,11.xxxxxx"></td>`;
    tb.appendChild(tr);
  });
}
async function saveAdmin(){
  const rows=$$('#adm_addr_tbody tr'); const list=[];
  rows.forEach(r=>{
    const act=r.querySelector('.a_act').checked;
    const name=r.querySelector('.a_name').value.trim(); if(!name) return;
    const snow=r.querySelector('.a_snow').checked;
    const grit=r.querySelector('.a_grit').checked;
    const stakes=r.querySelector('.a_stakes').value.trim();
    const coords=r.querySelector('.a_coords').value.trim();
    list.push({active:act,name,group:"",flags:{snow,grit},stakes,coords});
  });
  S.cloud.snapshot.addresses=list; await saveCloud(); $('#adm_addr_msg').textContent='✅ Lagret';
}

/* ---------- init / routing / actions ---------- */
window.addEventListener('DOMContentLoaded',async()=>{
  const open =()=>{$('#drawer').classList.add('open');$('#scrim').classList.add('show');};
  const close=()=>{$('#drawer').classList.remove('open');$('#scrim').classList.remove('show');};
  $('#btnMenu')?.addEventListener('click',open);
  $('#btnCloseDrawer')?.addEventListener('click',close);
  $('#scrim')?.addEventListener('click',close);
  $$('#drawer .drawer-link[data-go]').forEach(b=>b.addEventListener('click',()=>{show(b.dataset.go);close();}));

  function show(id){$$('main section').forEach(s=>s.style.display='none');$('#'+id).style.display='block';
    if(id==='status'){ $('#rp_date').textContent=fmtDate(); loadStatus(); }
    if(id==='admin'){ loadAdmin(); }
  }
  window.addEventListener('hashchange',()=>{ const id=(location.hash||'#home').slice(1); show($('#'+id)?id:'home'); });
  show('home');

  // prefs
  try{
    const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
    if(p.driver)$('#a_driver').value=p.driver;
    if(p.dir)$('#a_dir').value=p.dir;
    if(p.eq){ $('#a_eq_plow').checked=!!p.eq.plow; $('#a_eq_fres').checked=!!p.eq.fres; $('#a_eq_sand').checked=!!p.eq.sand; }
    if(typeof p.autoNav==='boolean')$('#a_autoNav').checked=p.autoNav;
  }catch{}

  // start runde
  $('#a_start')?.addEventListener('click',async()=>{
    const prefs={
      driver:($('#a_driver').value||'').trim()||'driver',
      dir:$('#a_dir').value,
      eq:{plow:$('#a_eq_plow').checked,fres:$('#a_eq_fres').checked,sand:$('#a_eq_sand').checked},
      autoNav:$('#a_autoNav').checked
    };
    localStorage.setItem('BROYT_PREFS',JSON.stringify(prefs));
    S.driver=prefs.driver; S.dir=prefs.dir; S.autoNav=prefs.autoNav;
    S.mode = prefs.eq.sand ? 'grit' : 'snow';
    await ensureSeed();
    S.addresses=(S.cloud.snapshot.addresses||[]).filter(a=>a.active && (S.mode==='snow'?a.flags?.snow:a.flags?.grit));
    S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;
    uiWork(); show('work');
  });

  // work actions
  $('#act_start')?.addEventListener('click',()=>step({state:'in_progress',startedAt:Date.now()},false));
  $('#act_skip') ?.addEventListener('click',()=>step({state:'skipped',finishedAt:Date.now()}));
  $('#act_block')?.addEventListener('click',()=>step({state:'blocked',finishedAt:Date.now()}));
  $('#act_acc')  ?.addEventListener('click',()=>step({state:'accident',finishedAt:Date.now()}));
  $('#act_done') ?.addEventListener('click',()=>step({state:'done',finishedAt:Date.now()}));
  $('#act_nav_next')?.addEventListener('click',()=>{const n=S.addresses[nextIndex(S.idx,S.dir)]; if(n) window.open(mapsUrl(n),'_blank');});

  // status
  $('#st_reload')?.addEventListener('click',loadStatus);
  $('#st_filter')?.addEventListener('change',loadStatus);
  $('#st_mode')  ?.addEventListener('change',loadStatus);
  $('#st_lock_toggle')?.addEventListener('click', async ()=>{
    await refreshCloud(); S.cloud.settings ||= {}; S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked;
    await saveCloud(); loadStatus(); loadAdmin();
  });
  $('#st_reset_all') ?.addEventListener('click', async ()=>{
    if(!confirm('Nullstille denne runden for alle?'))return;
    await refreshCloud(); const bag=statusStore();
    (S.cloud.snapshot.addresses||[]).forEach(a=>{bag[a.name]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};});
    await saveCloud(); loadStatus();
  });
  $('#st_reset_mine')?.addEventListener('click', async ()=>{
    if(!confirm('Nullstille kun dine punkter?'))return;
    await refreshCloud(); const bag=statusStore();
    for(const k in bag){ if(bag[k]?.driver===S.driver){bag[k]={state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};} }
    await saveCloud(); loadStatus();
  });

  // admin
  $('#adm_key_save') ?.addEventListener('click',()=>{ JSONBIN.setKey($('#adm_key')?.value||''); $('#adm_key_status').textContent='Lagret nøkkel.'; });
  $('#adm_key_clear')?.addEventListener('click',()=>{ localStorage.removeItem('BROYT_XKEY'); $('#adm_key_status').textContent='Nøkkel fjernet.'; });
  $('#adm_addr_fetch')?.addEventListener('click',loadAdmin);
  $('#adm_addr_save') ?.addEventListener('click',saveAdmin);

  // hurtigknapper
  const navTo=(id)=>{const s=S.cloud.settings||{};const c=(s[id]||'').replace(/\s+/g,'');if(c)window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c)}`,'_blank');};
  $('#qk_grus')  ?.addEventListener('click',()=>navTo('grusDepot'));
  $('#qk_diesel')?.addEventListener('click',()=>navTo('diesel'));
  $('#qk_base')  ?.addEventListener('click',()=>navTo('base'));

  // hold skjerm våken
  let lock=null;
  $('#qk_wl')?.addEventListener('click', async ()=>{
    try{
      if(!('wakeLock' in navigator)) throw 0;
      if(!lock){ lock=await navigator.wakeLock.request('screen'); $('#qk_wl_status').textContent='Aktiv'; }
      else{ await lock.release(); lock=null; $('#qk_wl_status').textContent='Deaktivert'; }
    }catch{ alert('Hold-skjerm støttes ikke på denne enheten.'); }
  });
});