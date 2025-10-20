/* =========================================================
   Work.js — “Under arbeid”
   • Viser nåværende og neste adresse
   • Statusknapper som oppdaterer JSONBin via Cloud.updateStatus()
   • Naviger til neste
   ========================================================= */

(function(){
  const $  = (s,root=document)=>root.querySelector(s);

  const S = {
    driver: 'driver',
    dir: 'Normal',         // 'Normal' | 'Motsatt'
    autoNav: false,
    mode: 'snow',          // 'snow' | 'grit'
    addresses: [],
    idx: 0
  };

  function nextIndex(i, d){ return d==='Motsatt' ? i-1 : i+1; }

  function mapsUrl(addr){
    if(!addr) return 'https://www.google.com/maps';
    const coords = (addr.coords||'').trim();
    if (coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(coords)) {
      const q = coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((addr.name||'')+', Norge');
  }

  function hydratePrefs(){
    try{
      const p = JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      S.driver = (p.driver||'driver').trim() || 'driver';
      S.dir = p.dir || 'Normal';
      S.autoNav = !!p.autoNav;
      S.mode = (p.eq && p.eq.sand) ? 'grit' : 'snow';
    }catch{}
  }

  function filterAddresses(cloud){
    const all = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
    const list = all
      .filter(a => a.active!==false)
      .filter(a => S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
    return list;
  }

  function renderNowNext(){
    const now = S.addresses[S.idx] || null;
    const nxt = S.addresses[nextIndex(S.idx, S.dir)] || null;

    const elNow = $('#w_now'), elNext = $('#w_next');
    if(elNow) elNow.textContent = now ? (now.name||'—') : '—';
    if(elNext) elNext.textContent = nxt ? (nxt.name||'—') : '—';

    // Status-etikett under progress
    const bag = (S.mode==='grit') ? (Cloud.snapshot?.statusGrit||{}) : (Cloud.snapshot?.statusSnow||{});
    const st = now?.name ? (bag[now.name]?.state || 'not_started') : 'not_started';
    const elLbl = $('#w_state_label');
    if(elLbl){
      const L = {not_started:'Ikke påbegynt', in_progress:'Pågår', done:'Ferdig', skipped:'Hoppet over', blocked:'Ikke mulig', accident:'Uhell'};
      elLbl.textContent = L[st] || '—';
    }

    // Puls-animasjon (ønsket)
    const bStart = $('#act_start'), bDone = $('#act_done');
    if(bStart && bDone){
      bStart.classList.remove('pulse');
      bDone.classList.remove('pulse');
      if (st==='in_progress') {
        bDone.classList.add('pulse');  // når pågår → pulser ferdig
      } else if (st==='done' || st==='skipped' || st==='blocked' || st==='accident'){
        bStart.classList.add('pulse'); // ferdig/annet → pulser start
      }
    }
  }

  async function loadWork(){
    hydratePrefs();
    // Hent sky-data
    const cloud = await Cloud.getLatest();
    S.addresses = filterAddresses(cloud);
    S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;
    renderNowNext();
  }

  async function step(patch, {nextAfter=true} = {}){
    const cur = S.addresses[S.idx]; if(!cur) return;
    await Cloud.updateStatus(cur.name, {...patch, ts: nowISO()}, {mode:S.mode, driver:S.driver});
    // Etter lagring: ev. neste
    if(nextAfter){
      const ni = nextIndex(S.idx, S.dir);
      if(ni>=0 && ni<S.addresses.length){
        S.idx = ni;
      }
    }
    renderNowNext();
  }

  function navigateNext(){
    const target = S.addresses[nextIndex(S.idx,S.dir)] || S.addresses[S.idx] || null;
    if(!target) return;
    window.open(mapsUrl(target), '_blank');
  }

  // ---------- Knapper ----------
  $('#act_start')?.addEventListener('click', ()=>step({state:'in_progress', startedAt: Date.now()}, {nextAfter:false}));
  $('#act_done') ?.addEventListener('click', ()=>step({state:'done',        finishedAt: Date.now()}, {nextAfter:true}));
  $('#act_skip') ?.addEventListener('click', ()=>step({state:'skipped',     finishedAt: Date.now()}, {nextAfter:true}));
  $('#act_block')?.addEventListener('click', ()=>{
    const reason = prompt('Hvorfor ikke mulig? (valgfritt)','')||'';
    step({state:'blocked', note:reason, finishedAt: Date.now()},{nextAfter:true});
  });
  $('#act_nav')  ?.addEventListener('click', navigateNext);

  // ---------- Oppstart + Abonnement ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    loadWork();
    // Oppdater automatisk fra skyen (f.eks. annen sjåfør)
    Cloud.subscribe(()=>{ loadWork(); }, 30000);
  });

  // Eksponer for debugging
  window.__WORK__ = { state:S, reload:loadWork };
})();