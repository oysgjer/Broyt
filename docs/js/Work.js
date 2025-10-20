/* =========================================================
   Work.js – “Under arbeid”
   - Full arbeidsgang + etter-siste-adresse flyt (ny runde / service)
   - Puls på riktige knapper ved "pågår"/"ferdig"
   - Naviger til NESTE adresse
   - Robuste guards mot manglende globale helpers
   ========================================================= */

/* ---------- Små helpers ---------- */
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const nowHHMM = (t=Date.now()) => new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
const STATE_LABEL={not_started:'Ikke påbegynt',in_progress:'Pågår',done:'Ferdig',skipped:'Hoppet over',blocked:'Ikke mulig',accident:'Uhell'};

/* ---------- Forvent globale helpers fra del-d.js ---------- */
const G = {
  S:            window.S || {dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null,lastSync:0},
  ensureSeed:   window.ensureAddressesSeeded || (async ()=>{}),
  refreshCloud: window.refreshCloud || (async ()=>{}),
  saveCloud:    window.saveCloud || (async ()=>{}),
  statusStore:  window.statusStore || (function(){ return {}; }),
  mapsFromAddr: window.mapsUrlFromAddr || (addr => 'https://www.google.com/maps'),
  mapsFromLatLon: window.mapsUrlFromLatLon || (latlon => 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(String(latlon||'').replace(/\s+/g,''))),
  uiSetWork:    window.uiSetWork || (function(){ updateNowNextUI(); }),
  nextIndex:    window.nextIndex || ((i,d)=> d==='Motsatt' ? i-1 : i+1),
};

/* ---------- UI oppdatering (nå / neste + status) ---------- */
function updateNowNextUI(){
  try{
    const S=G.S;
    const now = S.addresses[S.idx] || null;
    const next= S.addresses[G.nextIndex(S.idx,S.dir)] || null;
    if($('#b_now'))  $('#b_now').textContent  = now ? (now.name||'—')  : '—';
    if($('#b_next')) $('#b_next').textContent = next? (next.name||'—') : '—';

    const bag = G.statusStore();
    const st  = (now && now.name && bag[now.name] && bag[now.name].state) || 'not_started';
    if($('#b_status')) $('#b_status').textContent = STATE_LABEL[st] || '—';

    // Puls på knapper:
    const btnStart = $('#act_start');
    const btnDone  = $('#act_done');
    btnStart?.classList.remove('pulse');
    btnDone ?.classList.remove('pulse');
    if(st==='in_progress' && btnDone){ btnDone.classList.add('pulse'); }
    if(st==='done'        && btnStart){ btnStart.classList.add('pulse'); }

    // Oppdater fremdriftsindikator (om du har disse id-ene i UI)
    updateProgressBars();
  }catch(e){
    console.warn('updateNowNextUI feilet:', e);
  }
}

/* ---------- Fremdriftsindikator ---------- */
function updateProgressBars(){
  try{
    const S = G.S;
    const total = S.addresses.length || 1;
    let me = 0, other = 0;
    const bag = G.statusStore();

    for (const k in bag){
      const st = bag[k];
      if (st && st.state === 'done'){
        if (st.driver === S.driver) me++;
        else other++;
      }
    }
    const mePct = Math.round(100 * me / total);
    const otPct = Math.round(100 * other / total);

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm && bm.style) bm.style.width = mePct + '%';
    if (bo && bo.style) bo.style.width = otPct + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent   = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }catch(e){
    // stille – indikator er valgfri
  }
}

/* ---------- Status-håndtering ---------- */
function setStatusFor(name, patch){
  const S=G.S; const bag = G.statusStore();
  const cur = bag[name] || {};
  bag[name] = {...cur, ...patch, driver: S.driver};
}
function allDone(){
  const S=G.S; const bag = G.statusStore();
  if(!S.addresses.length) return false;
  return S.addresses.every(a => (bag[a.name] && bag[a.name].state==='done'));
}

/* ---------- Navigasjon ---------- */
function navigateTo(target){
  if(!target) return;
  const hasCoord = !!(target.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(target.coords));
  const url = hasCoord
    ? G.mapsFromLatLon(target.coords)
    : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((target.name||'')+', Norge');
  window.open(url,'_blank');
}
function navigateToNext(){
  const S=G.S;
  const next = S.addresses[G.nextIndex(S.idx,S.dir)];
  const target = next || S.addresses[S.idx] || null;
  navigateTo(target);
}

/* ---------- Etter-siste-adresse flyt ---------- */
function startNewRound(mode){ // "snow" | "grit"
  const S=G.S;
  // Nullstill status
  const bag = G.statusStore();
  for(const k in bag){ delete bag[k]; }

  // Sett modus
  S.mode = (mode === 'grit') ? 'grit' : 'snow';
  try { localStorage.setItem('mode', S.mode); } catch{}

  // Ved grus: juster evt. utstyr-preferanse (lagre i BROYT_PREFS om finnes)
  try{
    const prefs = JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
    if(!prefs.eq) prefs.eq={plow:false,fres:false,sand:false};
    prefs.eq.sand = (S.mode==='grit');
    localStorage.setItem('BROYT_PREFS', JSON.stringify(prefs));
  }catch{}

  // Filtrer adresseliste i minnet basert på modus
  try{
    const arr=(S.cloud && S.cloud.snapshot && Array.isArray(S.cloud.snapshot.addresses)) ? S.cloud.snapshot.addresses : (S.addresses||[]);
    S.addresses = (arr||[])
      .filter(a=>a.active!==false)
      .filter(a=> S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
  }catch{}

  S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

  alert(S.mode==='grit' ? 'Ny grusrunde – utstyr satt til strøkasse' : 'Ny brøyterunde startet');
  location.hash='#work';
  updateNowNextUI();
}

/* Når ferdig → Service */
function finishAndGoService(){
  try { sessionStorage.setItem('pendingReport','1'); } catch{}
  alert('Alt er ferdig. Gå til Service for utfylling og rapport.');
  location.hash='#service';
}

/* Spør bruker hva som skjer videre */
function askWhatNext(){
  // Først et enkelt OK/Avbryt, så et valg for 1/2/3 – robust på mobil
  const quick = confirm('Alt er ferdig 🎉\n\nTrykk OK for ny BRØYTERUNDE\nTrykk Avbryt for flere valg.');
  if(quick){ startNewRound('snow'); return; }

  const opt = prompt('Skriv:\n1 = Ny brøyterunde\n2 = Ny grusrunde\n3 = Ferdig og Service', '3');
  if(opt==='1') startNewRound('snow');
  else if(opt==='2') startNewRound('grit');
  else finishAndGoService();
}

/* ---------- Arbeidssteg ---------- */
async function stepState(patch, goNext){
  const S=G.S;
  try{
    await G.refreshCloud();
    const cur = S.addresses[S.idx]; if(!cur) return;
    setStatusFor(cur.name, {...patch});
    await G.saveCloud();
    updateNowNextUI();

    // Hvis alt er ferdig – kjør dialogen
    if(allDone()){ askWhatNext(); return; }

    if(goNext){
      const ni=G.nextIndex(S.idx,S.dir);
      if(ni>=0 && ni<S.addresses.length){ S.idx=ni; updateNowNextUI(); }
    }
  }catch(e){
    alert('Feil ved oppdatering: '+(e.message||e));
  }
}

/* ---------- Knappe-handlere ---------- */
function onStart(){ stepState({state:'in_progress', startedAt:Date.now()}, false); }
function onDone(){  stepState({state:'done',        finishedAt:Date.now()}, true); }
function onSkip(){  stepState({state:'skipped',     finishedAt:Date.now()}, true); }
function onBlock(){
  const reason = prompt('Hvorfor ikke mulig? (valgfritt)','')||'';
  stepState({state:'blocked', finishedAt:Date.now(), note:reason}, true);
}
function onNext(){
  const S=G.S;
  const ni=G.nextIndex(S.idx,S.dir);
  if(ni>=0 && ni<S.addresses.length){ S.idx=ni; updateNowNextUI(); }
}

/* ---------- Init ---------- */
async function initWork(){
  try{
    await G.ensureSeed();
    await G.refreshCloud();
  }catch{}

  // Wire knapper (valgfritt eksisterer)
  $('#act_start') && $('#act_start').addEventListener('click', onStart);
  $('#act_done')  && $('#act_done').addEventListener('click',  onDone);
  $('#act_skip')  && $('#act_skip').addEventListener('click',  onSkip);
  $('#act_next')  && $('#act_next').addEventListener('click',  onNext);
  $('#act_nav')   && $('#act_nav').addEventListener('click',   navigateToNext);
  $('#act_block') && $('#act_block').addEventListener('click', onBlock);

  // Første tegning
  updateNowNextUI();
}

// Kjør når seksjonen lastes / ved DOM klar
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initWork);
}else{
  initWork();
}