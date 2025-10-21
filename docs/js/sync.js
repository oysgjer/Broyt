// js/sync.js
(() => {
  'use strict';

  const MEM = { cloud: null, lastOk: 0 };
  const LS_CLOUD = 'BROYT_LOCAL_DATA';     // lokal fallback/cache
  const LS_KEY   = 'BROYT_XKEY';           // API-nøkkel (kan lagres manuelt i localStorage)
  const VERSION  = '10.5.0';

  // Standard-oppsett: BIN-ID er satt til din
  const CFG = {
    binId: '68e7b4d2ae596e708f0bde7d',
    apiKey: null, // fylles fra localStorage automatisk
    base: 'https://api.jsonbin.io/v3/b',
  };

  // ===== utils =====
  const $ = (s,r=document)=>r.querySelector(s);
  const readJSON  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});

  function setSyncBadge(kind){ // 'ok'|'local'|'error'|'unknown'
    const badge = $('#sync_badge');
    if(!badge) return;
    const dot = badge.querySelector('.dot') || badge;
    const cls = {ok:'dot-ok',local:'dot-warn',error:'dot-err',unknown:'dot-unknown'};
    dot.classList.remove('dot-ok','dot-warn','dot-err','dot-unknown');
    dot.classList.add(cls[kind] || 'dot-unknown');
    badge.lastElementChild && (badge.lastElementChild.textContent = '');
    if(kind==='ok'){
      badge.innerHTML = `<span class="dot dot-ok"></span> Synk: OK <small style="opacity:.8">• ${nowHHMM()}</small>`;
    }else if(kind==='local'){
      badge.innerHTML = `<span class="dot dot-warn"></span> Synk: lokal`;
    }else if(kind==='error'){
      badge.innerHTML = `<span class="dot dot-err"></span> Synk: feil`;
    }else{
      badge.innerHTML = `<span class="dot dot-unknown"></span> Synk: ukjent`;
    }
  }

  // ===== JSONBin transport =====
  function headersJSON(){
    const h = { 'Content-Type': 'application/json' };
    const key = CFG.apiKey || localStorage.getItem(LS_KEY) || null;
    if(key) h['X-Master-Key'] = key;
    return h;
  }
  function getUrlLatest(){ return `${CFG.base}/${CFG.binId}/latest`; }
  function getUrlPut(){ return `${CFG.base}/${CFG.binId}`; }

  function seedEmpty(){
    return {
      version: VERSION,
      updated: Date.now(),
      by: 'local',
      settings: {
        grusDepot:"60.2527264,11.1687230",
        diesel:"60.2523185,11.1899926",
        base:"60.2664414,11.2208819",
        seasonLabel:"2025–26",
        stakesLocked:false
      },
      snapshot: { addresses: [] },
      statusSnow: {},
      statusGrit: {},
      serviceLogs: []
    };
  }

  async function fetchLatest(){
    try{
      const res = await fetch(getUrlLatest(), { headers: headersJSON() });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const j = await res.json();
      const cloud = j.record || j;
      MEM.cloud = normalizeCloud(cloud);
      MEM.lastOk = Date.now();
      writeJSON(LS_CLOUD, MEM.cloud);
      setSyncBadge('ok');
      return MEM.cloud;
    }catch(err){
      // fall tilbake til lokal cache
      const local = readJSON(LS_CLOUD, null);
      if(local){
        MEM.cloud = normalizeCloud(local);
        setSyncBadge('local');
        return MEM.cloud;
      }
      setSyncBadge('error');
      throw err;
    }
  }

  async function putCloud(obj){
    try{
      const res = await fetch(getUrlPut(), {
        method:'PUT',
        headers: headersJSON(),
        body: JSON.stringify(obj||{})
      });
      if(!res.ok) throw new Error('HTTP '+res.status);
      MEM.cloud = normalizeCloud(obj);
      MEM.lastOk = Date.now();
      writeJSON(LS_CLOUD, MEM.cloud);
      setSyncBadge('ok');
      return true;
    }catch(err){
      // lagre lokalt likevel
      writeJSON(LS_CLOUD, obj||{});
      setSyncBadge('error');
      return false;
    }
  }

  // Sikrer at obligatoriske noder finnes
  function normalizeCloud(c){
    const cloud = c || {};
    cloud.version  ||= VERSION;
    cloud.updated  ||= Date.now();
    cloud.settings ||= { seasonLabel:'2025–26', stakesLocked:false };
    cloud.snapshot ||= { addresses: [] };
    cloud.statusSnow ||= {};
    cloud.statusGrit ||= {};
    cloud.serviceLogs ||= [];
    return cloud;
  }

  // ===== API: Sync =====
  const Sync = {
    setConfig({apiKey, binId}={}){
      if(apiKey!==undefined) CFG.apiKey = apiKey;
      if(binId) CFG.binId = binId;
    },

    async loadCloud({force=false}={}){
      if(!force && MEM.cloud) return MEM.cloud;
      const cached = readJSON(LS_CLOUD, null);
      if(cached && !force){ MEM.cloud = normalizeCloud(cached); setSyncBadge('local'); }
      return fetchLatest().catch(()=> MEM.cloud || seedEmpty());
    },

    async saveCloud(mutator){
      const cloud = await this.loadCloud();
      if(typeof mutator==='function') mutator(cloud);
      cloud.updated = Date.now();
      return putCloud(cloud);
    },

    async loadAddresses({force=false}={}){
      const cloud = await this.loadCloud({force});
      // hvis tomt: ikke autoseed – anta at skyen har riktig liste
      return Array.isArray(cloud.snapshot.addresses) ? cloud.snapshot.addresses : [];
    },

    async getSettings(){
      const c = await this.loadCloud();
      return c.settings || {};
    },

    async saveSettings(patch){
      return this.saveCloud(c=>{
        c.settings = { ...(c.settings||{}), ...(patch||{}) };
      });
    },

    // ----- status-bag -----
    async getStatusBag(mode='snow'){
      const c = await this.loadCloud();
      return mode==='grit' ? (c.statusGrit||{}) : (c.statusSnow||{});
    },

    async setStatus(name, patch={}, {mode='snow', driver='driver'}={}){
      return this.saveCloud(c=>{
        const bag = (mode==='grit') ? (c.statusGrit ||= {}) : (c.statusSnow ||= {});
        const cur = bag[name] || {};
        bag[name] = { ...cur, ...patch, driver };
      });
    },

    async resetAll(mode='snow'){
      return this.saveCloud(c=>{
        const bag = mode==='grit' ? (c.statusGrit||={}) : (c.statusSnow||={});
        const addrs = c.snapshot.addresses||[];
        addrs.forEach(a=>{
          bag[a.name] = { state:'not_started', startedAt:null, finishedAt:null, driver:null, note:null, photo:null };
        });
      });
    },

    async resetMine(driver='driver', mode='snow'){
      return this.saveCloud(c=>{
        const bag = mode==='grit' ? (c.statusGrit||={}) : (c.statusSnow||={});
        for(const k in bag){
          if(bag[k]?.driver===driver){
            bag[k] = { state:'not_started', startedAt:null, finishedAt:null, driver:null, note:null, photo:null };
          }
        }
      });
    },

    // summering for progresstopp
    summarize(addresses, bag, meName){
      const total = addresses.length || 0;
      let me=0, other=0;
      addresses.forEach(a=>{
        const s = bag[a.name];
        if(s?.state==='done'){
          if(s?.driver===meName) me++; else other++;
        }
      });
      return { total, me, other };
    }
  };

  window.Sync = Sync;

  // Liten auto-retry hvis synk er feil/ukjent
  setInterval(async ()=>{
    const dot = document.querySelector('#sync_badge .dot');
    if(!dot) return;
    if(dot.classList.contains('dot-err') || dot.classList.contains('dot-unknown')){
      try{ await Sync.loadCloud({force:true}); }catch{}
    }
  }, 60000);
// --- Lagre / hente admin-konfig ---
window.Sync.saveAdminConfig = async function (data) {
  if (!window.Sync || !Sync._cfg) throw new Error('Sync ikke initialisert');
  const { binId, apiKey } = Sync._cfg;
  const url = `https://api.jsonbin.io/v3/b/${binId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': apiKey
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Feil ved lagring (' + res.status + ')');
  return await res.json();
};

// Last admin-konfig fra JSONBin (kan kalles ved start av Admin-siden)
window.Sync.loadAdminConfig = async function () {
  if (!window.Sync || !Sync._cfg) throw new Error('Sync ikke initialisert');
  const { binId, apiKey } = Sync._cfg;
  const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
  const res = await fetch(url, {
    headers: { 'X-Master-Key': apiKey }
  });
  if (!res.ok) throw new Error('Feil ved lasting (' + res.status + ')');
  const js = await res.json();
  return js.record;
};
})();