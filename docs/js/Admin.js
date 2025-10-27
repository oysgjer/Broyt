// Admin.js — oppdatert: to JSONBin-IDer (drift/rapporter) + én felles Master Key
(function(){
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const LS_SETTINGS = 'BRYT_SETTINGS';

  function settings(){ return RJ(LS_SETTINGS, {}); }

  function getCfg(){
    if (window.Sync && typeof window.Sync.getConfig === 'function') return window.Sync.getConfig();
    return RJ('BRYT_CFG', { binId:'', apiKey:'' });
  }
  function setCfg(obj){
    if (window.Sync && typeof window.Sync.setConfig === 'function') return window.Sync.setConfig(obj);
    WJ('BRYT_CFG', obj);
  }

  function adminLoadBins(){
    const cfg = getCfg();
    const st  = settings();

    $('#cfg_bin_drift')  && ($('#cfg_bin_drift').value  = (cfg.binId || ''));
    $('#cfg_bin_report') && ($('#cfg_bin_report').value = (st.reportBin || ''));
    $('#cfg_master_key') && ($('#cfg_master_key').value = (cfg.apiKey || ''));
  }

  async function adminSaveBins(){
    const driftBin  = ($('#cfg_bin_drift')?.value || '').trim();
    const reportBin = ($('#cfg_bin_report')?.value || '').trim();
    const masterKey = ($('#cfg_master_key')?.value || '').trim();

    setCfg({ binId: driftBin, apiKey: masterKey });
    const st = settings(); st.reportBin = reportBin; WJ(LS_SETTINGS, st);

    alert('Lagret ✅');
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    try { adminLoadBins(); } catch(e){ console.warn(e); }
    $('#admin_save_bins')?.addEventListener('click', adminSaveBins);
  });
})();