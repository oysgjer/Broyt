// Work.js — "Under arbeid": fremdrift + fullfør-runde-dialog
// Avhengigheter som leveres av del-d.js:
// - window.S, window.STATE_LABEL, window.nextIndex
// - window.ensureAddressesSeeded, window.refreshCloud, window.saveCloud
// - window.statusStore, window.mapsUrlFromLatLon, window.showPage

(function(){
  'use strict';

  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  // ---------- UI-hjelpere ----------
  function setText(id, txt){ const el=$(id); if(el) el.textContent = txt; }

  // Progressbar og summer
  function updateProgressBars(){
    try{
      const total = (S.addresses && S.addresses.length) ? S.addresses.length : 0;
      if(!total){
        // nullstill progresjon
        const meBar=$('#b_prog_me'), otBar=$('#b_prog_other');
        if(meBar) meBar.style.width='0%';
        if(otBar) otBar.style.width='0%';
        setText('#b_prog_me_count','0/0');
        setText('#b_prog_other_count','0/0');
        setText('#b_prog_summary','0 av 0 adresser fullført');
        return;
      }

      let me=0, other=0;
      const bag = statusStore();
      for(const k in bag){
        const st = bag[k];
        if(st && st.state === 'done'){
          if(st.driver === S.driver) me++;
          else other++;
        }
      }
      const mePct = Math.round(100*me/total);
      const otPct = Math.round(100*other/total);
      const meBar=$('#b_prog_me'), otBar=$('#b_prog_other');
      if(meBar) meBar.style.width = mePct+'%';
      if(otBar) otBar.style.width = otPct+'%';

      setText('#b_prog_me_count', `${me}/${total}`);
      setText('#b_prog_other_count', `${other}/${total}`);
      setText('#b_prog_summary', `${Math.min(me+other,total)} av ${total} adresser fullført`);
    }catch(e){
      // stille feil — ikke knekke UI
      console.warn('updateProgressBars error', e);
    }
  }

  function currentAndNext(){
    const now  = (S.addresses && S.addresses[S.idx]) || null;
    const next = (S.addresses && S.addresses[nextIndex(S.idx,S.dir)]) || null;
    return {now, next};
  }

  function uiSetWork(){
    const {now, next} = currentAndNext();
    setText('#b_now',  now ? (now.name||'—')  : '—');
    setText('#b_next', next? (next.name||'—') : '—');
    setText('#b_dir',  S.dir||'Normal');
    setText('#b_task', (S.mode==='grit')?'Sand/Grus':'Snø');

    // statuslabel for nå
    const bag = statusStore();
    const st  = (now && now.name && bag[now.name] && bag[now.name].state) || 'not_started';
    setText('#b_status', STATE_LABEL[st] || '—');

    updateProgressBars();
  }

  function allDone(){
    if(!S.addresses || !S.addresses.length) return false;
    const bag = statusStore();
    return S.addresses.every(a => (bag[a.name] && bag[a.name].state==='done'));
  }

  function setStatusFor(name, patch){
    const bag=statusStore();
    const cur=bag[name]||{};
    bag[name] = {...cur, ...patch, driver:S.driver};
  }

  // ---------- FULLFØR-RUNDE DIALOG ----------
  async function fullRoundChoiceDialog(){
    // 2-stegs confirm (lett å treffe på mobil)
    const startSnow = window.confirm(
      'Alt er utført 🎉\n\nVil du starte NY BRØYTERUNDE?\n\nOK = Brøyting\nAvbryt = Velg annet'
    );
    if(startSnow){
      await startNewRound('snow');
      return;
    }
    const startGrit = window.confirm(
      'Vil du starte NY GRUSRUNDE?\n\nOK = Grus\nAvbryt = Gå til Service'
    );
    if(startGrit){
      await startNewRound('grit');
      return;
    }
    // Ferdig → Service
    showPage('service');
  }

  // ---------- Start ny runde (snow/grit) ----------
  async function startNewRound(mode /* 'snow' | 'grit' */){
    try{
      await ensureAddressesSeeded();
      await refreshCloud();

      // Bekreft at vi nullstiller status-bag for valgt modus
      const label = (mode==='grit')?'grus':'brøyting';
      if(!window.confirm(`Nullstille status for ${label}-runden og starte på nytt?`)) return;

      // Nullstill riktig bag
      const bag = (mode==='grit') ? (S.cloud.statusGrit||{}) : (S.cloud.statusSnow||{});
      (S.cloud.snapshot.addresses||[]).forEach(a=>{
        bag[a.name] = {state:'not_started', startedAt:null, finishedAt:null, driver:null, note:null, photo:null};
      });
      if(mode==='grit') S.cloud.statusGrit = bag; else S.cloud.statusSnow = bag;
      await saveCloud();

      // Oppdater prefs slik at appen er i riktig modus
      const prefs = JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      const newPrefs = {
        driver: prefs.driver || S.driver || 'driver',
        dir: prefs.dir || S.dir || 'Normal',
        eq: {
          plow: mode==='snow' ? true : false,
          fres: prefs.eq && prefs.eq.fres || false,
          sand: mode==='grit' ? true : false
        },
        autoNav: !!(prefs.autoNav)
      };
      localStorage.setItem('BROYT_PREFS', JSON.stringify(newPrefs));

      // Klargjør S for ny runde
      S.driver = newPrefs.driver;
      S.dir    = newPrefs.dir;
      S.mode   = (mode==='grit')?'grit':'snow';

      const arr=(S.cloud && S.cloud.snapshot && S.cloud.snapshot.addresses) ? S.cloud.snapshot.addresses : [];
      S.addresses = arr
        .filter(a=>a.active!==false)
        .filter(a=> S.mode==='snow' ? ((a.flags && a.flags.snow)!==false) : !!(a.flags && a.flags.grit));
      S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

      uiSetWork();
      showPage('work');
    }catch(e){
      alert('Kunne ikke starte ny runde: '+(e.message||e));
    }
  }

  // ---------- Steg/handlinger ----------
  async function stepState(patch, goNext=true){
    try{
      await refreshCloud();
      const cur = (S.addresses && S.addresses[S.idx]) || null;
      if(!cur) return;

      setStatusFor(cur.name, {...patch});
      await saveCloud();

      uiSetWork();

      // Sjekk "alt ferdig"
      if(allDone()){
        await fullRoundChoiceDialog();
        return;
      }

      if(goNext){
        const ni = nextIndex(S.idx, S.dir);
        if(ni>=0 && ni<S.addresses.length){
          S.idx = ni;
          uiSetWork();
        }else{
          // gikk utenfor — åpne service som failsafe
          showPage('service');
        }
      }
    }catch(e){
      alert('Feil ved statusoppdatering: '+(e.message||e));
    }
  }

  // ---------- Navigasjon til neste ----------
  function navigateToNext(){
    const nxt = S.addresses && S.addresses[nextIndex(S.idx,S.dir)];
    const trg = nxt || (S.addresses && S.addresses[S.idx]) || null;
    if(!trg) return;
    const hasCoord = !!(trg.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(trg.coords));
    const url = hasCoord
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(String(trg.coords).replace(/\s+/g,''))}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((trg.name||'')+', Norge')}`;
    window.open(url,'_blank');
  }

  // ---------- Init kobling ----------
  window.addEventListener('DOMContentLoaded', ()=>{
    // Knapper i "Under arbeid"-skjerm (samme IDer som i work.html)
    $('#act_start') && $('#act_start').addEventListener('click', ()=> stepState({state:'in_progress', startedAt:Date.now()}, false));
    $('#act_done')  && $('#act_done').addEventListener('click',  ()=> stepState({state:'done',        finishedAt:Date.now()}));
    $('#act_skip')  && $('#act_skip').addEventListener('click',  ()=> stepState({state:'skipped',     finishedAt:Date.now()}));
    $('#act_block') && $('#act_block').addEventListener('click',  ()=>{
      const note = prompt('Hvorfor ikke mulig? (valgfritt)','')||'';
      stepState({state:'blocked', finishedAt:Date.now(), note});
    });
    $('#act_nav')   && $('#act_nav').addEventListener('click', navigateToNext);

    // Oppfrisk teksten
    uiSetWork();
  });

  // Eksporter det vi trenger andre steder (hvis noe)
  window.updateProgressBars = updateProgressBars;
  window.uiSetWork          = uiSetWork;
  window.stepState          = stepState;
  window.startNewRound      = startNewRound;
})();