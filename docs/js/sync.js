/* =========================================================
   sync.js — JSONBin-synk for Brøyterute
   Versjon: 1.0.0
   ---------------------------------------------------------
   • Les/skriv felles skydata (addresses, statusSnow, statusGrit, settings)
   • Robust fallback til localStorage ved nettfeil
   • Polling/abonnement for “live” oppdateringer
   • Kompatibel med eksisterende nøkler i localStorage:
       - BROYT_BIN_URL  (GET-URL, f.eks: https://api.jsonbin.io/v3/b/<ID>/latest)
       - BROYT_BIN_PUT  (PUT-URL, f.eks: https://api.jsonbin.io/v3/b/<ID>)
       - BROYT_XKEY     (X-Master-Key)
   • Alternativ (hvis du heller vil sette BIN_ID her): se CONST nedenfor.
   ========================================================= */

(function(){
  const LS_LOCAL   = 'BROYT_LOCAL_DATA';
  const LS_GETURL  = 'BROYT_BIN_URL';
  const LS_PUTURL  = 'BROYT_BIN_PUT';
  const LS_XKEY    = 'BROYT_XKEY';

  // Sett BIN_ID her hvis du vil at appen selv bygger URL-er:
  // (Kan stå tom – da brukes verdier fra Admin-siden som du allerede har)
  const BIN_ID     = ''; // f.eks: '68e7b4d2ae596e708f0bde7d'
  const API_BASE   = 'https://api.jsonbin.io/v3/b';

  // --------- Utils ---------
  const $ = (s,root=document)=>root.querySelector(s);
  const nowISO = () => new Date().toISOString();
  const deepCopy = obj => JSON.parse(JSON.stringify(obj||null));

  function buildGetUrl(){
    const u = localStorage.getItem(LS_GETURL);
    if (u) return u;
    if (BIN_ID) return `${API_BASE}/${BIN_ID}/latest`;
    return ''; // ikke konfigurert
  }
  function buildPutUrl(){
    const u = localStorage.getItem(LS_PUTURL);
    if (u) return u;
    if (BIN_ID) return `${API_BASE}/${BIN_ID}`;
    return ''; // ikke konfigurert
  }
  function headersJSON(){
    const h = {'Content-Type':'application/json'};
    const k = localStorage.getItem(LS_XKEY)||'';
    if(k) h['X-Master-Key']=k;
    return h;
  }
  function setSyncBadge(state, lastTs){
    const badge = $('#sync_badge');
    const time  = $('#sync_time');
    if(!badge) return;
    const map = {
      ok:      {dot:'●', color:'#22c55e', text:'Synk: OK'},
      local:   {dot:'●', color:'#f59e0b', text:'Synk: lokal'},
      error:   {dot:'●', color:'#ef4444', text:'Synk: feil'},
      unknown: {dot:'●', color:'#94a3b8', text:'Synk: ukjent'},
    };
    const m = map[state] || map.unknown;
    badge.textContent = `${m.dot} ${m.text}`;
    badge.style.color = m.color;
    if (time) time.textContent = lastTs ? `• ${new Date(lastTs).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})}` : '';
  }

  function seedEmptyCloud(){
    return {
      version: '1.0.0',
      updated: Date.now(),
      by: 'system',
      settings: {
        grusDepot:"60.2527264,11.1687230",
        diesel:"60.2523185,11.1899926",
        base:"60.2664414,11.2208819",
        seasonLabel:"2025–26",
        stakesLocked:false
      },
      snapshot:{ addresses: [] },
      statusSnow: {},
      statusGrit: {},
      serviceLogs: []
    };
  }

  async function fetchJSON(url, opt={}, timeoutMs=12000){
    return new Promise((resolve, reject)=>{
      const ctrl = new AbortController();
      const t = setTimeout(()=>{ ctrl.abort(); reject(new Error('timeout')); }, timeoutMs);
      fetch(url,{...opt, signal:ctrl.signal})
        .then(r=>{
          clearTimeout(t);
          if(!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(resolve)
        .catch(reject);
    });
  }

  // --------- Kjerne-API ---------
  const Cloud = {
    _cache: null,
    _pollTimer: null,

    get isConfigured(){
      return !!(buildGetUrl() || buildPutUrl());
    },

    get snapshot(){
      return deepCopy(this._cache);
    },

    async getLatest(){
      const url = buildGetUrl();
      if(!url){
        // Ikke konfigurert GET → lokal fallback
        const local = JSON.parse(localStorage.getItem(LS_LOCAL)||'null') || seedEmptyCloud();
        setSyncBadge('local', local.updated);
        this._cache = local;
        return deepCopy(local);
      }
      try{
        const j = await fetchJSON(url, {headers: headersJSON()});
        // JSONBin v3: {record: {...}, metadata: {...}}
        const data = j && (j.record || j) || seedEmptyCloud();
        if(!data.statusSnow && data.status) data.statusSnow = data.status; // bakoverkomp
        data.statusSnow ||= {};
        data.statusGrit ||= {};
        data.settings   ||= {seasonLabel:"2025–26",stakesLocked:false};
        // cache
        this._cache = data;
        localStorage.setItem(LS_LOCAL, JSON.stringify(data));
        setSyncBadge('ok', Date.now());
        return deepCopy(data);
      }catch(err){
        // fallback: lokal cache
        const local = JSON.parse(localStorage.getItem(LS_LOCAL)||'null') || seedEmptyCloud();
        setSyncBadge('local', local.updated);
        this._cache = local;
        return deepCopy(local);
      }
    },

    async putRecord(obj){
      const url = buildPutUrl();
      if(!url){
        // lagre kun lokalt
        localStorage.setItem(LS_LOCAL, JSON.stringify(obj||{}));
        setSyncBadge('local', Date.now());
        this._cache = deepCopy(obj);
        return {ok:false, local:true};
      }
      try{
        const res = await fetchJSON(url, {
          method: 'PUT',
          headers: headersJSON(),
          body: JSON.stringify(obj||{})
        });
        // JSONBin returnerer record/meta; vi antar OK
        localStorage.setItem(LS_LOCAL, JSON.stringify(obj||{}));
        this._cache = deepCopy(obj);
        setSyncBadge('ok', Date.now());
        return {ok:true, result:res};
      }catch(err){
        // fallback lokalt
        localStorage.setItem(LS_LOCAL, JSON.stringify(obj||{}));
        this._cache = deepCopy(obj);
        setSyncBadge('error', Date.now());
        return {ok:false, error:String(err||'err')};
      }
    },

    async ensureAddressesSeeded(seedListFn){
      const cloud = await this.getLatest();
      const arr = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
      if(arr.length>0) return cloud;
      const list = (typeof seedListFn==='function') ? seedListFn() : [];
      cloud.snapshot ||= {};
      cloud.snapshot.addresses = list;
      cloud.statusSnow ||= {};
      cloud.statusGrit ||= {};
      cloud.updated = Date.now();
      cloud.by = 'seed';
      await this.putRecord(cloud);
      return deepCopy(cloud);
    },

    async updateStatus(addressName, patch, {mode='snow', driver='driver'}={}){
      // Last cache om nødvendig
      if(!this._cache) await this.getLatest();
      const c = this._cache || seedEmptyCloud();
      const bag = (mode==='grit') ? (c.statusGrit||(c.statusGrit={})) : (c.statusSnow||(c.statusSnow={}));
      const cur = bag[addressName] || {};
      bag[addressName] = {...cur, ...patch, driver};
      c.updated = Date.now();
      c.by = driver||'driver';
      return await this.putRecord(c);
    },

    async saveSettings(partial){
      if(!this._cache) await this.getLatest();
      const c = this._cache || seedEmptyCloud();
      c.settings = {...(c.settings||{}), ...(partial||{})};
      c.updated = Date.now();
      return await this.putRecord(c);
    },

    subscribe(onUpdate, intervalMs=30000){
      if(this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(async ()=>{
        const latest = await this.getLatest();
        try{ onUpdate && onUpdate(deepCopy(latest)); }catch{}
      }, intervalMs);
      return ()=>{ clearInterval(this._pollTimer); this._pollTimer=null; };
    }
  };

  // Eksponer globalt
  window.Cloud = Cloud;
})();