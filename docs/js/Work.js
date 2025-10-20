/* Work.js – Under arbeid (fullverdig side, isolerte navn) */
(() => {
  // ----- små helpers (unik prefiks for å unngå kollisjoner) -----
  const _q  = (s, r=document) => r.querySelector(s);
  const _qa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const _fmtHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
  const _STATE_LABEL = {
    not_started:'Ikke påbegynt', in_progress:'Pågår', done:'Ferdig',
    skipped:'Hoppet over', blocked:'Ikke mulig', accident:'Uhell'
  };

  // ----- JSONBin miniklient (leser samme nøkler som resten av appen) -----
  const JSONBIN = {
    get _get(){ return localStorage.getItem('BROYT_BIN_URL') || ''; },
    get _put(){ return localStorage.getItem('BROYT_BIN_PUT') || ''; },
    get _key(){ return localStorage.getItem('BROYT_XKEY') || ''; },
    _headers(){
      const h = {'Content-Type':'application/json'};
      const k = this._key; if (k) h['X-Master-Key'] = k;
      return h;
    },
    async latest(){
      const url = this._get;
      if (!url) return _localFallback();
      try{
        const r = await fetch(url, {headers:this._headers()});
        const j = await r.json();
        return j.record || j;
      }catch{
        return _localFallback();
      }
    },
    async put(obj){
      const url = this._put;
      if (!url){ localStorage.setItem('BROYT_LOCAL_DATA', JSON.stringify(obj||{})); return {ok:false,local:true}; }
      try{
        const r = await fetch(url,{method:'PUT',headers:this._headers(),body:JSON.stringify(obj||{})});
        if(!r.ok) throw new Error('PUT');
        return {ok:true};
      }catch{
        localStorage.setItem('BROYT_LOCAL_DATA', JSON.stringify(obj||{}));
        return {ok:false};
      }
    }
  };

  function _localFallback(){
    const local = localStorage.getItem('BROYT_LOCAL_DATA');
    if (local) return JSON.parse(local);
    return {settings:{seasonLabel:"2025–26",stakesLocked:false}, snapshot:{addresses:[]}, statusSnow:{}, statusGrit:{}};
  }

  function _mapsUrlFrom(latlonOrName){
    if(!latlonOrName) return 'https://www.google.com/maps';
    const s = String(latlonOrName);
    const hasCoord = /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(s);
    return hasCoord
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.replace(/\s+/g,''))}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s+', Norge')}`;
  }

  // ----- lokal side-state -----
  const W = {
    cloud: null,
    mode: 'snow',       // 'snow' | 'grit'
    dir: 'Normal',      // 'Normal' | 'Motsatt'
    autoNav: false,
    driver: 'driver',
    addresses: [],
    idx: 0
  };

  // Leser brukerpreferanser fra BROYT_PREFS (samme format som Hjem-siden)
  function loadPrefs(){
    try{
      const p = JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      W.driver = (p.driver||'driver');
      W.dir = p.dir || 'Normal';
      W.autoNav = !!p.autoNav;
      // modus: sand = grit, ellers snow
      W.mode = (p.eq && p.eq.sand) ? 'grit' : 'snow';
    }catch{ /* ignore */ }
  }

  function statusBag(){
    if (!W.cloud) return {};
    if (!W.cloud.statusSnow && W.cloud.status) W.cloud.statusSnow = W.cloud.status; // bakoverkomp.
    return W.mode === 'snow' ? (W.cloud.statusSnow||{}) : (W.cloud.statusGrit||{});
  }

  function ensureCloudShape(){
    if(!W.cloud.settings)   W.cloud.settings   = {seasonLabel:"2025–26",stakesLocked:false};
    if(!W.cloud.statusSnow) W.cloud.statusSnow = {};
    if(!W.cloud.statusGrit) W.cloud.statusGrit = {};
    if(!W.cloud.snapshot)   W.cloud.snapshot   = {addresses:[]};
  }

  function buildAddressList(){
    const arr = Array.isArray(W.cloud?.snapshot?.addresses) ? W.cloud.snapshot.addresses : [];
    const filtered = arr
      .filter(a => a && a.active !== false)
      .filter(a => W.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
    W.addresses = filtered;
    W.idx = (W.dir === 'Motsatt') ? (filtered.length ? filtered.length-1 : 0) : 0;
  }

  function cur(){ return W.addresses[W.idx] || null; }
  function next(){
    if (!W.addresses.length) return null;
    const step = (W.dir === 'Motsatt') ? -1 : 1;
    const ni = W.idx + step;
    if (ni < 0 || ni >= W.addresses.length) return null;
    return W.addresses[ni];
  }

  // ----- UI binding -----
  function uiUpdate(){
    const c = cur(), n = next();
    const bag = statusBag();
    const st = c && bag[c.name] ? bag[c.name].state : 'not_started';

    const nowEl  = _q('#b_now');
    const nextEl = _q('#b_next');
    const taskEl = _q('#b_task');
    const stateEl= _q('#b_status');

    if(nowEl)  nowEl.textContent  = c ? (c.name || '—') : '—';
    if(nextEl) nextEl.textContent = n ? (n.name || '—') : '—';
    if(taskEl) taskEl.textContent = W.mode === 'snow' ? 'Snø' : 'Sand/Grus';
    if(stateEl)stateEl.textContent= _STATE_LABEL[st] || '—';

    updateProgressBars();
  }

  function updateProgressBars(){
    const bag = statusBag();
    const total = W.addresses.length || 1;
    let me=0, other=0;

    for (const k in bag){
      const s = bag[k];
      if(s && s.state === 'done'){
        if (s.driver === W.driver) me++; else other++;
      }
    }
    const mePct = Math.round(100*me/total);
    const otPct = Math.round(100*other/total);

    const bm=_q('#b_prog_me'), bo=_q('#b_prog_other');
    if (bm) bm.style.width = mePct+'%';
    if (bo) bo.style.width = otPct+'%';

    const meC=_q('#b_prog_me_count'), otC=_q('#b_prog_other_count'), sum=_q('#b_prog_summary');
    if (meC) meC.textContent = `${me}/${total}`;
    if (otC) otC.textContent = `${other}/${total}`;
    if (sum) sum.textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`;
  }

  // ----- sky-IO -----
  async function loadCloud(){
    W.cloud = await JSONBIN.latest();
    ensureCloudShape();
  }
  async function saveCloud(){
    W.cloud.updated = Date.now();
    W.cloud.by = W.driver || 'driver';
    await JSONBIN.put(W.cloud);
  }

  function setStatusFor(name, patch){
    const bag = statusBag();
    const cur = bag[name] || {};
    bag[name] = {...cur, ...patch, driver: W.driver};
  }

  // ----- actions -----
  async function doStart(){
    const c = cur(); if(!c) return;
    await loadCloud();
    setStatusFor(c.name, {state:'in_progress', startedAt:Date.now()});
    await saveCloud();
    uiUpdate();
  }
  async function doDone(){
    const c = cur(); if(!c) return;
    await loadCloud();
    setStatusFor(c.name, {state:'done', finishedAt:Date.now()});
    await saveCloud();
    stepNext();
  }
  async function doSkip(){
    const c = cur(); if(!c) return;
    await loadCloud();
    setStatusFor(c.name, {state:'skipped', finishedAt:Date.now()});
    await saveCloud();
    stepNext();
  }
  async function doBlocked(){
    const c = cur(); if(!c) return;
    const reason = prompt('Hvorfor ikke mulig? (valgfritt)','') || '';
    await loadCloud();
    setStatusFor(c.name, {state:'blocked', finishedAt:Date.now(), note:reason});
    await saveCloud();
    uiUpdate();
  }
  function stepNext(){
    if(!W.addresses.length) return;
    const step = (W.dir === 'Motsatt') ? -1 : 1;
    const ni = W.idx + step;
    if (ni >=0 && ni < W.addresses.length){
      W.idx = ni;
      uiUpdate();
      if (W.autoNav){
        const t = cur();
        const dest = (t && t.coords) ? t.coords : (t && t.name) || '';
        window.open(_mapsUrlFrom(dest), '_blank');
      }
    }
  }
  function doNavigate(){
    const t = next() || cur();
    if(!t) return;
    const dest = t.coords ? t.coords : t.name;
    window.open(_mapsUrlFrom(dest), '_blank');
  }

  // ----- init & routing -----
  async function enterWork(){
    loadPrefs();
    await loadCloud();
    buildAddressList();
    uiUpdate();
  }

  function attachHandlers(){
    _q('#act_start')?.addEventListener('click', doStart);
    _q('#act_done') ?.addEventListener('click', doDone);
    _q('#act_skip') ?.addEventListener('click', doSkip);
    _q('#act_next') ?.addEventListener('click', stepNext);
    _q('#act_nav')  ?.addEventListener('click', doNavigate);
    _q('#act_block')?.addEventListener('click', doBlocked);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    attachHandlers();

    // Kjør init når man lander på #work, og når man skifter tilbake til den
    const runIfWork = () => {
      const id = (location.hash||'#home').replace('#','') || 'home';
      if (id === 'work') enterWork();
    };
    runIfWork();
    window.addEventListener('hashchange', runIfWork);
  });
})();