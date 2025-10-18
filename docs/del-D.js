/* del-D.js — Brøyterute v10.4.7
   - Auto-fix av avkorta JSONBin-URLer (GET/PUT) ved oppstart
   - Synk-status i Admin (☁️ OK / ❌ Feil)
   - Robust lagring med lokal fallback + klare feilmeldinger
   - Adresse-register: Hent/Lagre fungerer; koordinater, flags, stikker
   - Start runde (Snø/Grus), progresjonsbar (grønn/lilla), hurtig-knapper (grus/diesel/base)
*/

const $  = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const fmtTime = t => !t ? '—' : new Date(t).toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'});
const fmtDate = () => new Date().toLocaleDateString('no-NO');
const STATE_LABEL = {
  not_started:'Ikke påbegynt', in_progress:'Pågår', done:'Ferdig',
  skipped:'Hoppet over', blocked:'Ikke mulig', accident:'Uhell'
};

const S = {
  dir: 'Normal',
  addresses: [],
  idx: 0,
  driver: 'driver',
  autoNav: false,
  mode: 'snow', // 'snow' | 'grit'
  cloud: null
};

/* ---------------------------------------------------
   JSONBin helper (med auto-fix av URLer)
----------------------------------------------------*/
const JSONBIN = {
  // lagre/les to sett med nøkler (backwards compat)
  _keys: {
    get1: 'BROYT_BIN_URL', put1: 'BROYT_BIN_PUT',
    get2: 'JSONBIN_BIN_URL', put2: 'JSONBIN_BIN_PUT_URL',
    key1: 'BROYT_XKEY', key2: 'JSONBIN_MASTER'
  },
  get _getUrl(){
    return localStorage.getItem(this._keys.get1) ||
           localStorage.getItem(this._keys.get2) || '';
  },
  get _putUrl(){
    return localStorage.getItem(this._keys.put1) ||
           localStorage.getItem(this._keys.put2) || '';
  },
  get _key(){
    return localStorage.getItem(this._keys.key1) ||
           localStorage.getItem(this._keys.key2) || '';
  },
  setUrlPair(getUrl, putUrl){
    if(getUrl){
      localStorage.setItem(this._keys.get1, getUrl);
      localStorage.setItem(this._keys.get2, getUrl);
    }
    if(putUrl){
      localStorage.setItem(this._keys.put1, putUrl);
      localStorage.setItem(this._keys.put2, putUrl);
    }
  },
  setKey(k){
    const v = (k || '').trim();
    if(!v){
      localStorage.removeItem(this._keys.key1);
      localStorage.removeItem(this._keys.key2);
      return false;
    }
    localStorage.setItem(this._keys.key1, v);
    localStorage.setItem(this._keys.key2, v);
    return true;
  },
  clearKey(){
    localStorage.removeItem(this._keys.key1);
    localStorage.removeItem(this._keys.key2);
  },
  hasAll(){
    return !!(this._getUrl && this._putUrl);
  },
  // Ekstra: trekk ut bin-id fra URL
  _extractId(u){
    const m = String(u||'').match(/\/b\/([a-z0-9]{1,24})(?:\/|$)/i);
    return m ? m[1] : '';
  },
  // Auto-fix: hvis en av URL-ene har komplett 24-tegns id, kopier den til begge
  normalizeUrls(){
    const g1 = localStorage.getItem(this._keys.get1)||'';
    const g2 = localStorage.getItem(this._keys.get2)||'';
    const p1 = localStorage.getItem(this._keys.put1)||'';
    const p2 = localStorage.getItem(this._keys.put2)||'';
    const all = [g1,g2,p1,p2].filter(Boolean);
    let fullId = '';
    for(const u of all){
      const id = this._extractId(u);
      if(id && id.length === 24){ fullId = id; break; }
    }
    if(!fullId) return false;

    const makeGet = (id) => `https://jsonbin-proxy.oysgjer.workers.dev/v3/b/${id}/latest`;
    const makePut = (id) => `https://jsonbin-proxy.oysgjer.workers.dev/v3/b/${id}`;

    // Skriv eksplisitt til alle fire feltene for å trumfe gamle verdier
    localStorage.setItem(this._keys.get1, makeGet(fullId));
    localStorage.setItem(this._keys.get2, makeGet(fullId));
    localStorage.setItem(this._keys.put1, makePut(fullId));
    localStorage.setItem(this._keys.put2, makePut(fullId));
    return true;
  },
  _headers(){
    const h = {'Content-Type':'application/json'};
    const k = this._key; if(k) h['X-Master-Key'] = k;
    return h;
  },
  async testConnection(){
    const el = $('#adm_urls_status');
    const get = this._getUrl, put = this._putUrl;
    const idG = this._extractId(get), idP = this._extractId(put);
    if(!get || !put || idG.length !== 24 || idP.length !== 24){
      if(el) el.textContent = '☁️ Sky: mangler/ugyldig URL';
      return false;
    }
    try{
      const r = await fetch(get, {headers:this._headers()});
      if(!r.ok){ if(el) el.textContent = '☁️ Sky: tilgang FEIL ('+r.status+')'; return false; }
      if(el) el.textContent = '☁️ Sky: OK';
      return true;
    }catch{
      if(el) el.textContent = '☁️ Sky: frakoblet';
      return false;
    }
  },
  async getLatest(){
    const get = this._getUrl;
    if(!get){ return this._localFallback(); }
    try{
      const res = await fetch(get, {headers:this._headers()});
      if(!res.ok) throw new Error('GET '+res.status);
      const j = await res.json();
      return j.record || j;
    }catch{
      return this._localFallback();
    }
  },
  async putRecord(obj){
    const put = this._putUrl;
    if(!put){
      localStorage.setItem('BROYT_LOCAL_DATA', JSON.stringify(obj||{}));
      return {ok:false, local:true};
    }
    try{
      const res = await fetch(put, {
        method:'PUT', headers:this._headers(), body:JSON.stringify(obj||{})
      });
      return res.ok ? {ok:true} : {ok:false, status:res.status};
    }catch{
      return {ok:false};
    }
  },
  _localFallback(){
    const local = JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'null');
    if(local) return local;
    // Minimal seed
    return {
      version:'10.4.7', updated:Date.now(), by:'local',
      settings:{grusDepot:"60.2527264,11.1687230",diesel:"60.2523185,11.1899926",base:"60.2664414,11.2208819",seasonLabel:"2025–26",stakesLocked:false},
      snapshot:{addresses:[]}, statusSnow:{}, statusGrit:{}, serviceLogs:[]
    };
  }
};

/* ---------------------------------------------------
   Første gangs seed hvis skyen er tom
----------------------------------------------------*/
function seedAddressesList(){
  const base = [
    "Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42","Hjeramoen vei til 32-34-40-42",
    "Hjeramoen 47-49-51-53","Hjeramoen 48-50-52-54","Hjerakroken 2-4","Vognvegen 17","Tunlandvegen",
    "Bjørnsrud Skog 38","Trondheimsvegen 26-36","Sessvollvegen 9","Sessvollvegen 11","Mette Hasler",
    "Henning Morken Hasler","Hasler Drivhus","Grendehuset","Søjordet","Folkeparken","Folkeparken Bakke",
    "Læringsverkstedet Parkering","Læringsverkstedet Ute området","Hagamoen","(Sjøviken) Hagamoen 12",
    "Moen Nedre vei","Fred/ Moen Nedre 17","Odd/ Moen Nedre 15","Trondheimsvegen 86","Fjellet (400m vei Råholt)",
    "Bilextra (hele bygget)","Lundgårdstoppen","Normann Hjellesveg"
  ];
  return base.map(n => ({
    name:n, group:"", active:true,
    flags:{snow:true, grit:false}, // default: snø = ja, grus = nei
    stakes:'', coords:''
  }));
}
async function ensureAddressesSeeded(){
  S.cloud = await JSONBIN.getLatest();
  const arr = Array.isArray(S.cloud?.snapshot?.addresses) ? S.cloud.snapshot.addresses : [];
  if(arr.length>0) return;
  if(localStorage.getItem('BROYT_SEEDED_ADDR')==='yes') return;
  const list = seedAddressesList();
  S.cloud.snapshot = {...(S.cloud.snapshot||{}), addresses:list};
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  localStorage.setItem('BROYT_SEEDED_ADDR','yes');
  localStorage.setItem('BROYT_LOCAL_DATA', JSON.stringify(S.cloud));
  await JSONBIN.putRecord(S.cloud);
}
async function refreshCloud(){
  S.cloud = await JSONBIN.getLatest();
  if(!S.cloud.statusSnow && S.cloud.status){ S.cloud.statusSnow=S.cloud.status; delete S.cloud.status; }
  S.cloud.statusSnow ||= {}; S.cloud.statusGrit ||= {};
  S.cloud.settings    ||= {seasonLabel:"2025–26", stakesLocked:false};
}
async function saveCloud(showMsgEl){
  S.cloud.updated = Date.now(); S.cloud.by = S.driver||'driver';
  localStorage.setItem('BROYT_LOCAL_DATA', JSON.stringify(S.cloud));
  const r = await JSONBIN.putRecord(S.cloud);
  if(showMsgEl){
    if(r.ok){ showMsgEl.textContent = 'Lagret.'; }
    else if(r.local){ showMsgEl.textContent = 'Lagret lokalt (offline)'; }
    else { showMsgEl.textContent = 'Kunne ikke lagre (sjekk URL/nøkkel)'; }
  }
  $('#adm_urls_status') && JSONBIN.testConnection();
}
function statusStore(){ return S.mode==='snow' ? S.cloud.statusSnow : S.cloud.statusGrit; }
function nextIndex(i,dir){ return dir==='Motsatt' ? i-1 : i+1; }

/* ---------------------------------------------------
   Google Maps helper
----------------------------------------------------*/
function mapsUrlFromAddr(addr){
  if(!addr) return 'https://www.google.com/maps';
  if(addr.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(addr.coords)){
    const q = addr.coords.replace(/\s+/g,'');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  }
  if(typeof addr.lat==='number' && typeof addr.lon==='number'){
    return `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lon}`;
  }
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
}

/* ---------------------------------------------------
   WORK UI
----------------------------------------------------*/
function updateProgressBars(){
  const total = S.addresses.length || 1; let me=0, other=0;
  const bag = statusStore();
  for(const k in bag){
    const st = bag[k];
    if(st.state==='done'){ if(st.driver===S.driver) me++; else other++; }
  }
  $('#b_prog_me')    && ($('#b_prog_me').style.width = Math.round(100*me/total)+'%');
  $('#b_prog_other') && ($('#b_prog_other').style.width = Math.round(100*other/total)+'%');
}
function uiSetWork(){
  const now  = S.addresses[S.idx] || null;
  const next = S.addresses[nextIndex(S.idx,S.dir)] || null;
  $('#b_now')  && ($('#b_now').textContent  = now ? (now.name||'—')  : '—');
  $('#b_next') && ($('#b_next').textContent = next? (next.name||'—') : '—');
  $('#b_dir')  && ($('#b_dir').textContent  = S.dir);
  $('#b_task') && ($('#b_task').textContent = (S.mode==='snow')?'Snø':'Grus');

  const bag = statusStore();
  const st  = (now?.name && bag[now.name]?.state) || 'not_started';
  $('#b_status') && ($('#b_status').textContent = STATE_LABEL[st]||'—');

  updateProgressBars();
}
function allDone(){
  if(!S.addresses.length) return false;
  const bag = statusStore();
  return S.addresses.every(a => (bag[a.name]?.state === 'done'));
}
function maybeShowAllDoneDialog(){
  if(!allDone()) return;
  const modeTxt = (S.mode==='snow') ? 'Snø' : 'Grus';
  if(confirm(`Alt er utført for ${modeTxt}-runden 🎉\n\nOK = Gå til Service\nAvbryt = bli`)){
    showPage('service');
  }
}
function setStatusFor(name, patch){
  const bag = statusStore();
  const cur = bag[name] || {};
  bag[name] = {...cur, ...patch, driver:S.driver};
}
async function stepState(patch, nextAfter = true){
  await refreshCloud();
  const cur = S.addresses[S.idx]; if(!cur) return;
  setStatusFor(cur.name, {...patch});
  await saveCloud();
  uiSetWork();
  if(allDone()){ maybeShowAllDoneDialog(); return; }
  if(nextAfter){
    const ni = nextIndex(S.idx, S.dir);
    if(ni>=0 && ni<S.addresses.length){
      S.idx = ni; uiSetWork();
      if(S.autoNav){
        const t = S.addresses[S.idx];
        if(t) window.open(mapsUrlFromAddr(t),'_blank');
      }
    }else{
      showPage('service');
    }
  }
}

/* ---------------------------------------------------
   STATUS
----------------------------------------------------*/
function summarize(addrs, bag){
  let c={tot:addrs.length,not:0,prog:0,done:0,skip:0,blk:0,acc:0};
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
function makeRow(i, a, s){
  const hasCoord = !!(a.coords && /,/.test(a.coords));
  const mapLink  = hasCoord ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coords.replace(/\s+/g,''))}" target="_blank" rel="noopener">🧭</a>` : '—';
  const oppdrag  = (a.flags?.snow && a.flags?.grit) ? 'Snø + Grus' : (a.flags?.grit ? 'Grus' : 'Snø');
  const img      = s?.photo ? '🖼️' : '';
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${i+1}</td><td>${a.name||''}</td><td>${oppdrag}</td>
    <td>${(a.stakes!=='' && a.stakes!=null)?a.stakes:'—'}</td>
    <td style="text-align:center">${mapLink}</td>
    <td>${STATE_LABEL[s?.state||'not_started']}</td>
    <td>${fmtTime(s?.startedAt)}</td>
    <td>${fmtTime(s?.finishedAt)}</td>
    <td>${s?.driver||'—'}</td>
    <td>${img}</td>`;
  return tr;
}
async function loadStatus(){
  try{
    await ensureAddressesSeeded();
    const modeSel = $('#st_mode')?.value || 'snow';
    const cloud   = await JSONBIN.getLatest();
    if(!cloud.statusSnow && cloud.status) cloud.statusSnow = cloud.status;

    const addrs = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
    const bag   = (modeSel==='snow') ? (cloud.statusSnow||{}) : (cloud.statusGrit||{});
    const filter= $('#st_filter')?.value || 'alle';
    const tbody = $('#st_tbody'); if(tbody) tbody.innerHTML='';

    const badge = $('#st_season_badge'); if(badge) badge.textContent='Sesong: '+((cloud.settings&&cloud.settings.seasonLabel)||'—');
    const lockBtn = $('#st_lock_toggle');
    if(lockBtn){ const lk=!!(cloud.settings&&cloud.settings.stakesLocked); lockBtn.textContent=lk?'🔒 Stikker låst':'🔓 Lås stikker (sesong)'; lockBtn.dataset.locked=String(lk); }

    addrs.forEach((a,i)=>{
      const s = bag[a.name]||{state:'not_started'};
      let ok = true;
      if(filter==='ikke'  && s.state!=='not_started') ok=false;
      if(filter==='pågår' && s.state!=='in_progress') ok=false;
      if(filter==='ferdig'&& s.state!=='done') ok=false;
      if(filter==='hoppet'&& s.state!=='skipped') ok=false;
      if(filter==='umulig'&& s.state!=='blocked') ok=false;
      if(filter==='uhell' && s.state!=='accident') ok=false;
      if(ok && tbody) tbody.appendChild(makeRow(i,a,s));
    });

    const c = summarize(addrs, bag);
    const label = (modeSel==='snow') ? 'Snø' : 'Grus';
    const sum = $('#st_summary');
    if(sum) sum.textContent = `${label}-runde: ${c.tot} adresser • Ikke påbegynt ${c.not} • Pågår ${c.prog} • Ferdig ${c.done} • Hoppet ${c.skip} • Ikke mulig ${c.blk} • Uhell ${c.acc}`;
  }catch(e){
    alert('Kunne ikke hente status: '+(e.message||e));
  }
}

/* ---------------------------------------------------
   ADMIN
----------------------------------------------------*/
function ensureCloudSetupCard(){
  const g=$('#adm_geturl'), p=$('#adm_puturl'), st=$('#adm_urls_status');
  if(g) g.value = JSONBIN._getUrl || '';
  if(p) p.value = JSONBIN._putUrl || '';
  if(st) st.textContent = JSONBIN.hasAll() ? '☁️ Sky: sjekker…' : '☁️ Sky: mangler URL';
  JSONBIN.normalizeUrls();
  JSONBIN.testConnection();
  $('#adm_urls_save')?.addEventListener('click', ()=>{
    const gg = $('#adm_geturl')?.value.trim() || '';
    const pp = $('#adm_puturl')?.value.trim() || '';
    JSONBIN.setUrlPair(gg,pp);
    JSONBIN.normalizeUrls();
    JSONBIN.testConnection();
  });
  $('#adm_urls_clear')?.addEventListener('click', ()=>{
    ['BROYT_BIN_URL','BROYT_BIN_PUT','JSONBIN_BIN_URL','JSONBIN_BIN_PUT_URL'].forEach(k=>localStorage.removeItem(k));
    if($('#adm_geturl')) $('#adm_geturl').value='';
    if($('#adm_puturl')) $('#adm_puturl').value='';
    if(st) st.textContent='☁️ Sky: URL-er fjernet';
  });
}
function renderAdminAddresses(){
  const tb=$('#adm_addr_tbody'); if(!tb) return;
  tb.innerHTML='';
  const locked = !!(S.cloud.settings && S.cloud.settings.stakesLocked);
  (S.cloud.snapshot.addresses||[]).forEach((a,idx)=>{
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
    tr.querySelector('.adm-stakes').value = (a.stakes!==undefined && a.stakes!=='') ? a.stakes : '';
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
  $('#adm_grus')   && ($('#adm_grus').value   = st.grusDepot||'');
  $('#adm_diesel') && ($('#adm_diesel').value = st.diesel||'');
  $('#adm_base')   && ($('#adm_base').value   = st.base||'');
  $('#adm_stakes_lock') && ($('#adm_stakes_lock').textContent = st.stakesLocked ? '🔒 Låst' : '🔓 Lås stikker');

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

    // lagre settings (destinasjoner)
    const st = S.cloud.settings ||= {};
    st.grusDepot = ($('#adm_grus')?.value||'').trim();
    st.diesel    = ($('#adm_diesel')?.value||'').trim();
    st.base      = ($('#adm_base')?.value||'').trim();

    await saveCloud(msg);
  }catch(e){
    if(msg) msg.textContent='Feil: '+(e.message||e);
  }
}

/* ---------------------------------------------------
   INIT / ROUTING / HANDLERS
----------------------------------------------------*/
window.addEventListener('DOMContentLoaded', ()=>{
  // Auto-fix URLer på oppstart
  JSONBIN.normalizeUrls();

  // Drawer
  const drawer=$('#drawer'), scrim=$('#scrim');
  const open = ()=>{drawer?.classList.add('open'); scrim?.classList.add('show'); drawer?.setAttribute('aria-hidden','false');};
  const close=()=>{drawer?.classList.remove('open'); scrim?.classList.remove('show'); drawer?.setAttribute('aria-hidden','true');};
  $('#btnMenu')?.addEventListener('click', open);
  $('#btnCloseDrawer')?.addEventListener('click', close);
  scrim?.addEventListener('click', close);
  $$('#drawer .drawer-link[data-go]').forEach(b=>b.addEventListener('click',()=>{showPage(b.getAttribute('data-go')); close();}));

  // Quick nav (grus/diesel/base)
  const navToCoord = (val)=>{ if(!val) return; const url=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(val.replace(/\s+/g,''))}`; window.open(url,'_blank'); };
  $('#qk_grus')  ?.addEventListener('click', async ()=>{ await refreshCloud(); navToCoord(S.cloud?.settings?.grusDepot); });
  $('#qk_diesel')?.addEventListener('click', async ()=>{ await refreshCloud(); navToCoord(S.cloud?.settings?.diesel); });
  $('#qk_base')  ?.addEventListener('click', async ()=>{ await refreshCloud(); navToCoord(S.cloud?.settings?.base);  });

  // Routing
  window.showPage = function(id){
    $$('main section').forEach(s=>s.style.display='none');
    const el=$('#'+id); if(el) el.style.display='block';
    location.hash='#'+id;
    if(id==='status'){ $('#rp_date')?.textContent = fmtDate(); loadStatus(); }
    if(id==='admin'){ loadAdmin(); }
  };
  window.addEventListener('hashchange', ()=>{
    const id=(location.hash||'#home').replace('#','');
    showPage($('#'+id)?id:'home');
  });

  // Hent prefs
  try{
    const p=JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
    if(p.driver) $('#a_driver').value = p.driver;
    if(p.dir)    $('#a_dir').value    = p.dir;
    if(p.eq){
      $('#a_eq_plow').checked = !!p.eq.plow;
      $('#a_eq_fres').checked = !!p.eq.fres;
      $('#a_eq_sand').checked = !!p.eq.sand;
    }
    if(typeof p.autoNav==='boolean') $('#a_autoNav').checked = p.autoNav;
  }catch{}

  showPage('home');

  // Start runde
  $('#a_start')?.addEventListener('click', async ()=>{
    try{
      const prefs = {
        driver: ($('#a_driver').value||'').trim() || 'driver',
        dir: $('#a_dir').value,
        eq: { plow:$('#a_eq_plow').checked, fres:$('#a_eq_fres').checked, sand:$('#a_eq_sand').checked },
        autoNav: $('#a_autoNav').checked
      };
      localStorage.setItem('BROYT_PREFS', JSON.stringify(prefs));
      S.driver  = prefs.driver; S.dir = prefs.dir; S.autoNav = prefs.autoNav;
      S.mode    = prefs.eq.sand ? 'grit' : 'snow';

      await ensureAddressesSeeded();
      await refreshCloud();

      const arr = (S.cloud?.snapshot?.addresses)||[];
      S.addresses = arr
        .filter(a => a.active!==false)
        .filter(a => S.mode==='snow' ? (a.flags?.snow!==false) : !!a.flags?.grit);

      S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

      uiSetWork();
      showPage('work');
    }catch(e){ alert('Startfeil: '+(e.message||e)); }
  });

  // Work actions
  $('#act_start')?.addEventListener('click', ()=>stepState({state:'in_progress',startedAt:Date.now()}, false));
  $('#act_skip') ?.addEventListener('click', ()=>stepState({state:'skipped', finishedAt:Date.now()}));
  $('#act_block')?.addEventListener('click', ()=>{ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; stepState({state:'blocked',finishedAt:Date.now(),note:reason}); });
  $('#act_acc')  ?.addEventListener('click', async ()=>{
    try{
      const note=prompt('Beskriv uhell (valgfritt)','')||'';
      const file=await pickImage(); let photo=null;
      if(file) photo=await compressImage(file,900,0.6);
      await stepState({state:'accident',finishedAt:Date.now(),note,photo}, false);
    }catch(e){ alert('Feil ved uhell: '+(e.message||e)); }
  });
  $('#act_done') ?.addEventListener('click', ()=>stepState({state:'done', finishedAt:Date.now()}));
  $('#act_nav_next')?.addEventListener('click', ()=>{
    const next=S.addresses[nextIndex(S.idx,S.dir)];
    if(next) window.open(mapsUrlFromAddr(next),'_blank');
  });

  // Status-handlers
  $('#st_reload')?.addEventListener('click', loadStatus);
  $('#st_filter')?.addEventListener('change', loadStatus);
  $('#st_mode')  ?.addEventListener('change', loadStatus);
  $('#st_lock_toggle')?.addEventListener('click', async ()=>{
    try{
      await refreshCloud();
      S.cloud.settings ||= {};
      S.cloud.settings.stakesLocked = !S.cloud.settings.stakesLocked;
      await saveCloud();
      loadStatus(); loadAdmin();
    }catch(e){ alert('Feil: '+(e.message||e)); }
  });
  $('#st_reset_all') ?.addEventListener('click', async ()=>{
    if(!confirm('Nullstille denne runden for alle?')) return;
    await refreshCloud();
    const bag = statusStore();
    (S.cloud.snapshot.addresses||[]).forEach(a=>{
      bag[a.name] = {state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};
    });
    await saveCloud();
    loadStatus();
  });
  $('#st_reset_mine')?.addEventListener('click', async ()=>{
    if(!confirm('Nullstille kun dine punkter?')) return;
    await refreshCloud();
    const bag = statusStore();
    for(const k in bag){
      if(bag[k]?.driver === S.driver){
        bag[k] = {state:'not_started',startedAt:null,finishedAt:null,driver:null,note:null,photo:null};
      }
    }
    await saveCloud();
    loadStatus();
  });

  // Nøkkel-knapper
  $('#adm_key_save') ?.addEventListener('click', ()=>{ const ok=JSONBIN.setKey($('#adm_key')?.value||''); const s=$('#adm_key_status'); if(s) s.textContent = ok ? 'Lagret nøkkel.' : 'Ugyldig nøkkel.'; JSONBIN.testConnection(); });
  $('#adm_key_clear')?.addEventListener('click', ()=>{ JSONBIN.clearKey(); const s=$('#adm_key_status'); if(s) s.textContent='Nøkkel fjernet.'; JSONBIN.testConnection(); });

  // Stikker lock
  $('#adm_stakes_lock')?.addEventListener('click', async ()=>{
    try{
      await refreshCloud();
      S.cloud.settings ||= {};
      S.cloud.settings.stakesLocked = !S.cloud.settings.stakesLocked;
      await saveCloud();
      if($('#adm_stakes_lock')) $('#adm_stakes_lock').textContent = S.cloud.settings.stakesLocked ? '🔒 Låst' : '🔓 Lås stikker';
      renderAdminAddresses();
    }catch(e){ alert('Feil: '+(e.message||e)); }
  });

  // Adresse-register knapper
  $('#adm_addr_fetch')?.addEventListener('click', loadAdmin);
  $('#adm_addr_save') ?.addEventListener('click', saveAdminAddresses);
  $('#adm_addr_wipe') ?.addEventListener('click', ()=>{
    localStorage.removeItem('BROYT_LOCAL_DATA');
    $('#adm_addr_msg') && ($('#adm_addr_msg').textContent='Lokal data tømt.');
  });
});

/* ---------------------------------------------------
   Uhell-bilde (komprimer)
----------------------------------------------------*/
function pickImage(){
  return new Promise(resolve=>{
    const i=document.createElement('input');
    i.type='file'; i.accept='image/*'; i.capture='environment';
    i.onchange=()=>resolve(i.files&&i.files[0]?i.files[0]:null);
    i.click();
    setTimeout(()=>resolve(null),15000);
  });
}
function compressImage(file,maxW=1000,q=0.7){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const scale=maxW/Math.max(img.width,img.height);
        const w=img.width>=img.height?maxW:Math.round(img.width*scale);
        const h=img.width>=img.height?Math.round(img.height*scale):maxW;
        const cv=document.createElement('canvas');
        cv.width=w; cv.height=h;
        const ctx=cv.getContext('2d');
        ctx.drawImage(img,0,0,w,h);
        res(cv.toDataURL('image/jpeg',q));
      };
      img.src=fr.result;
    };
    fr.onerror=rej;
    fr.readAsDataURL(file);
  });
}

/* ---------------------------------------------------
   Rapport CSV
----------------------------------------------------*/
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