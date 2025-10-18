/* del-D.js – v10.4.7  */
const $  =(s,r=document)=>r.querySelector(s);
const $$ =(s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtTime=t=>!t?'—':new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const fmtDate=()=>new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

const S={dir:'Normal',driver:'',addresses:[],idx:0,autoNav:false,mode:'snow',cloud:null};

/* ---------- JSONBin ---------- */
const JSONBIN={
  baseId:'68e7b4d2ae596e708f0bde7d',
  get _getUrl(){return localStorage.getItem('BROYT_BIN_URL')||`https://jsonbin.io/v3/b/${this.baseId}/latest`;},
  get _putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||`https://jsonbin.io/v3/b/${this.baseId}`;},
  get _key(){return localStorage.getItem('BROYT_XKEY')||'';},
  hasAll(){return !!this._key;},
  setKey(k){localStorage.setItem('BROYT_XKEY',(k||'').trim());},
  async getLatest(){
    const res=await fetch(this._getUrl,{headers:this._headers()}).catch(()=>null);
    if(!res||!res.ok){return this._local();}
    const j=await res.json();return j.record||j;
  },
  async putRecord(obj){
    const res=await fetch(this._putUrl,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})}).catch(()=>null);
    if(!res||!res.ok){localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj||{}));return{ok:false,local:true};}
    return{ok:true};
  },
  _headers(){const h={'Content-Type':'application/json'};if(this._key)h['X-Master-Key']=this._key;return h;},
  _local(){
    return JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'{"snapshot":{"addresses":[]}}');
  }
};

/* ---------- helpers ---------- */
function mapsUrl(addr){
  if(addr.coords&&/,/.test(addr.coords)){
    const c=addr.coords.replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.name+', Norge')}`;
}
function statusStore(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
function nextIndex(i,d){return d==='Motsatt'?i-1:i+1;}

/* ---------- core ---------- */
async function refreshCloud(){S.cloud=await JSONBIN.getLatest();S.cloud.statusSnow||={};S.cloud.statusGrit||={};S.cloud.snapshot||={addresses:[]};S.cloud.settings||={};}
async function saveCloud(){S.cloud.updated=Date.now();await JSONBIN.putRecord(S.cloud);localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(S.cloud));}
async function ensureSeed(){
  await refreshCloud();
  if(!Array.isArray(S.cloud.snapshot.addresses)||!S.cloud.snapshot.addresses.length){
    const list=["Hjeramoen 12-24","Hjerastubben 8,10,12,14,16","Hjeramoen 32-34-40-42"];
    S.cloud.snapshot.addresses=list.map(n=>({active:true,name:n,flags:{snow:true,grit:false},stakes:'',coords:''}));
    await saveCloud();
  }
}

/* ---------- UI work ---------- */
function updateBars(){
  const tot=S.addresses.length||1;let me=0,other=0;const bag=statusStore();
  for(const k in bag){const s=bag[k];if(s.state==='done'){s.driver===S.driver?me++:other++;}}
  $('#b_prog_me').style.width=Math.round(me/tot*100)+'%';
  $('#b_prog_other').style.width=Math.round(other/tot*100)+'%';
}
function uiWork(){
  const now=S.addresses[S.idx],next=S.addresses[nextIndex(S.idx,S.dir)];
  $('#b_now').textContent=now?.name||'—';
  $('#b_next').textContent=next?.name||'—';
  $('#b_task').textContent=S.mode==='snow'?'Snø':'Grus';
  $('#b_dir').textContent=S.dir;
  const st=statusStore()[now?.name]?.state||'not_started';
  $('#b_status')?.textContent=STATE_LABEL[st];
  updateBars();
}
async function step(patch,next=true){
  await refreshCloud();const now=S.addresses[S.idx];if(!now)return;
  const bag=statusStore();bag[now.name]={...(bag[now.name]||{}),...patch,driver:S.driver};
  await saveCloud();uiWork();
  const ni=nextIndex(S.idx,S.dir);
  if(next&&ni>=0&&ni<S.addresses.length){S.idx=ni;uiWork();if(S.autoNav)window.open(mapsUrl(S.addresses[S.idx]),'_blank');}
}

/* ---------- Admin ---------- */
async function loadAdmin(){
  await ensureSeed();
  const tb=$('#adm_addr_tbody');tb.innerHTML='';
  const locked=!!S.cloud.settings.stakesLocked;
  S.cloud.snapshot.addresses.forEach((a,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="a_act" ${a.active?'checked':''}></td>
      <td><input class="a_name" value="${a.name||''}"></td>
      <td style="text-align:center"><input type="checkbox" class="a_snow" ${a.flags?.snow?'checked':''}></td>
      <td style="text-align:center"><input type="checkbox" class="a_grit" ${a.flags?.grit?'checked':''}></td>
      <td><input class="a_stakes" value="${a.stakes||''}" ${locked?'disabled':''}></td>
      <td><input class="a_coords" value="${a.coords||''}"></td>`;
    tb.appendChild(tr);
  });
}
async function saveAdmin(){
  const rows=$$('#adm_addr_tbody tr');const list=[];
  rows.forEach(r=>{
    const act=r.querySelector('.a_act').checked;
    const name=r.querySelector('.a_name').value.trim();if(!name)return;
    const snow=r.querySelector('.a_snow').checked;
    const grit=r.querySelector('.a_grit').checked;
    const stakes=r.querySelector('.a_stakes').value.trim();
    const coords=r.querySelector('.a_coords').value.trim();
    list.push({active:act,name,flags:{snow,grit},stakes,coords});
  });
  S.cloud.snapshot.addresses=list;
  await saveCloud();$('#adm_addr_msg').textContent='✅ Lagret';
}

/* ---------- Start ---------- */
window.addEventListener('DOMContentLoaded',async()=>{
  $('#btnMenu').onclick=()=>{$('#drawer').classList.add('open');};
  $('#btnCloseDrawer').onclick=()=>{$('#drawer').classList.remove('open');};
  $$('#drawer .drawer-link[data-go]').forEach(b=>b.onclick=()=>{show(b.dataset.go);$('#drawer').classList.remove('open');});
  function show(id){$$('main section').forEach(s=>s.style.display='none');$('#'+id).style.display='block';if(id==='admin')loadAdmin();}
  show('home');

  $('#a_start').onclick=async()=>{
    const driver=$('#a_driver').value||'Sjåfør';
    const dir=$('#a_dir').value;
    const sand=$('#a_eq_sand').checked;
    S.driver=driver;S.dir=dir;S.autoNav=$('#a_autoNav').checked;S.mode=sand?'grit':'snow';
    await ensureSeed();await refreshCloud();
    S.addresses=S.cloud.snapshot.addresses.filter(a=>a.active&&(S.mode==='snow'?a.flags.snow:a.flags.grit));
    S.idx=S.dir==='Motsatt'?S.addresses.length-1:0;
    uiWork();show('work');
  };

  $('#act_start').onclick=()=>step({state:'in_progress',startedAt:Date.now()},false);
  $('#act_done').onclick =()=>step({state:'done',finishedAt:Date.now()});
  $('#act_skip').onclick =()=>step({state:'skipped',finishedAt:Date.now()});
  $('#act_block').onclick=()=>step({state:'blocked',finishedAt:Date.now()});
  $('#act_acc').onclick  =()=>step({state:'accident',finishedAt:Date.now()});
  $('#act_nav_next').onclick=()=>{const n=S.addresses[nextIndex(S.idx,S.dir)];if(n)window.open(mapsUrl(n),'_blank');};

  $('#adm_addr_fetch').onclick=loadAdmin;
  $('#adm_addr_save').onclick =saveAdmin;

  /* hurtigknapper */
  const navTo=(id)=>{const s=S.cloud.settings||{};const c=(s[id]||'').replace(/\s+/g,'');if(c)window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c)}`,'_blank');};
  $('#qk_grus').onclick  =()=>navTo('grusDepot');
  $('#qk_diesel').onclick=()=>navTo('diesel');
  $('#qk_base').onclick  =()=>navTo('base');

  /* hold skjerm våken */
  let lock=null;
  $('#qk_wl').onclick=async()=>{
    try{
      if(!lock){lock=await navigator.wakeLock.request('screen');$('#qk_wl_status').textContent='Aktiv';}
      else{lock.release();lock=null;$('#qk_wl_status').textContent='Deaktivert';}
    }catch(e){alert('Ikke støttet på denne enheten');}
  };
});