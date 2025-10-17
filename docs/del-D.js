/* del-D.js – v10.2
   Nytt:
   - Egen side: Adresse-register (rediger navn/gruppe, Snø/Grus, Aktiv, Koordinater, Stikker pr adresse + lås, flytt opp/ned)
   - Under arbeid: knapp "Naviger til neste" (bruker koordinater hvis satt)
   - Status viser per-adresse stikker + lås-ikon
   - Kontrastforbedringer, 24-tidsformat
*/

const $ = (s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const t24 = ts => !ts ? '—' : new Date(ts).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit',hour12:false});
const dmy = () => new Date().toLocaleDateString('no-NO');
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

/* ---------- Drawer & Routing ---------- */
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
    if(id==='status'){ $('#rp_date').textContent=dmy(); loadStatus(); }
    if(id==='admin'){ loadSettingsToAdmin(); }
    if(id==='register'){ buildRegisterTable(); }
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

/* ---------- Wake Lock ---------- */
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

/* ---------- JSONBin helper ---------- */
const JSONBIN={
  get getUrl(){return localStorage.getItem('BROYT_BIN_URL')||localStorage.getItem('JSONBIN_BIN_URL')||'';},
  get putUrl(){return localStorage.getItem('BROYT_BIN_PUT')||localStorage.getItem('JSONBIN_BIN_PUT_URL')||'';},
  get key(){return localStorage.getItem('BROYT_XKEY')||localStorage.getItem('JSONBIN_MASTER')||'';},
  setUrlPair(g,p){ if(g) localStorage.setItem('BROYT_BIN_URL',g); if(p) localStorage.setItem('BROYT_BIN_PUT',p);
                   if(g) localStorage.setItem('JSONBIN_BIN_URL',g); if(p) localStorage.setItem('JSONBIN_BIN_PUT_URL',p); },
  setKey(k){const v=(k||'').trim(); if(!v){localStorage.removeItem('BROYT_XKEY');return false;} localStorage.setItem('BROYT_XKEY',v); localStorage.setItem('JSONBIN_MASTER',v); return true;},
  clearKey(){localStorage.removeItem('BROYT_XKEY');localStorage.removeItem('JSONBIN_MASTER');},
  ok(){return !!(this.getUrl && this.putUrl && this.key);},
  async get(){ const u=this.getUrl; if(!u) return this.local();
    const r=await fetch(u,{headers:this.h()}).catch(()=>null);
    if(!r||!r.ok) return this.local();
    const j=await r.json(); return j.record||j; },
  async put(obj){ const u=this.putUrl,k=this.key; if(!u||!k) {localStorage.setItem('BROYT_LOCAL_DATA',JSON.stringify(obj)); return {ok:false,local:true};}
    const r=await fetch(u,{method:'PUT',headers:this.h(true),body:JSON.stringify(obj)}).catch(()=>null);
    if(!r||!r.ok) return {ok:false}; return {ok:true}; },
  h(){const h={'Content-Type':'application/json'}; const k=this.key; if(k) h['X-Master-Key']=k; return h;},
  local(){ const j=JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
    if(j) return j;
    return {version:'10.2',updated:Date.now(),by:'local',
      settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",
        seasonLabel:"2025–26",stakesCount:"",stakesLocked:false},
      snapshot:{addresses:[]}, statusSnow:{}, statusGrit:{}, serviceLogs:[]}; },
  async ensureWarn(){ if(!this.ok()) alert('OBS: Sky-oppsett ikke komplett. Legg inn X-Master-Key + GET/PUT-URL i Admin. Appen virker lokalt inntil videre.'); }
};

/* ---------- App-state ---------- */
const S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null};
function storeForMode(){return S.mode==='snow'?S.cloud.statusSnow:S.cloud.statusGrit;}
const nextI = (i,dir)=> dir==='Motsatt'? i-1 : i+1;

/* ---------- Seed adresser (første gang) ---------- */
function seedList(){
  const base=[ "Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42","Hjeramoen vei til 32-34-40-42",
  "Hjeramoen 47-49-51-53","Hjeramoen 48-50-52-54","Hjerakroken 2-4","Vognvegen 17","Tunlandvegen","Bjørnsrud Skog 38",
  "Trondheimsvegen 26-36","Sessvollvegen 9","Sessvollvegen 11","Mette Hasler","Henning Morken Hasler","Hasler Drivhus",
  "Grendehuset","Søjordet","Folkeparken","Folkeparken Bakke","Læringsverkstedet Parkering","Læringsverkstedet Ute området",
  "Hagamoen","(Sjøviken) Hagamoen 12","Moen Nedre vei","Fred/ Moen Nedre 17","Odd/ Moen Nedre 15","Trondheimsvegen 86",
  "Fjellet (400m vei Råholt)","Bilextra (hele bygget)","Lundgårdstoppen","Normann Hjellesveg" ];
  return base.map(n=>({name:n,group:"",active:true,flags:{snow:true,grit:false},coords:"",stakes:"",lockStakes:false}));
}
async function ensureSeed(){
  S.cloud = await