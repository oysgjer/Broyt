// js/Home.js
(() => {
  'use strict';

  const $ = (s,r=document)=>r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_SETTINGS='BRYT_SETTINGS';
  const K_RUN='BRYT_RUN';

  function loadSettings(){
    return RJ(K_SETTINGS,{
      driver:'',
      equipment:{ plow:false, fres:false, sand:false },
      dir:'Normal',
      autoNav:false
    });
  }
  function saveSettings(s){ WJ(K_SETTINGS,s); }

  function uiToSettings(){
    return {
      ...loadSettings(),
      driver: $('#a_driver')?.value.trim() || '',
      equipment:{
        plow: !!$('#a_eq_plow')?.checked,
        fres: !!$('#a_eq_fres')?.checked,
        sand: !!$('#a_eq_sand')?.checked,
      },
      dir: $('#a_dir')?.value || 'Normal',
      autoNav: !!$('#a_autoNav')?.checked
    };
  }
  function settingsToUI(){
    const s = loadSettings();
    $('#a_driver')   && ($('#a_driver').value = s.driver || '');
    $('#a_eq_plow')  && ($('#a_eq_plow').checked = !!s.equipment.plow);
    $('#a_eq_fres')  && ($('#a_eq_fres').checked = !!s.equipment.fres);
    $('#a_eq_sand')  && ($('#a_eq_sand').checked = !!s.equipment.sand);
    $('#a_dir')      && ($('#a_dir').value = s.dir || 'Normal');
    $('#a_autoNav')  && ($('#a_autoNav').checked = !!s.autoNav);
  }

  function setRunFromSettings(s){
    const run = {
      driver: s.driver,
      equipment: s.equipment,
      dir: s.dir,
      idx: 0
    };
    WJ(K_RUN, run);
  }

  async function onStart(){
    try{
      const st = uiToSettings();
      saveSettings(st);
      setRunFromSettings(st);

      if (!window.Sync) throw new Error('Sync-modulen er ikke tilgjengelig (mangler js/Sync.js).');

      const cfg = window.Sync.getConfig();
      if (!cfg.binId || !cfg.apiKey) throw new Error('Sync ikke konfigurert (binId/apiKey).');

      const addrs = await window.Sync.loadAddresses({force:true});
      if (!addrs || !addrs.length) throw new Error('Fant ingen adresser i JSONBin.');

      location.hash = '#work';
    }catch(e){
      console.error(e);
      alert('Kunne ikke starte runde: ' + e.message);
    }
  }

  function wire(){
    settingsToUI();
    $('#a_start')?.addEventListener('click', onStart);
    window.addEventListener('hashchange', ()=>{ if (location.hash==='#home') settingsToUI(); });
  }

  document.addEventListener('DOMContentLoaded', wire);
})();