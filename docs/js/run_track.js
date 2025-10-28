// docs/js/run_track.js
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);

  function settings(){
    try { return JSON.parse(localStorage.getItem('BRYT_SETTINGS')) || {}; } catch { return {}; }
  }
  function laneFromSettings(){
    const st = settings();
    return (st?.equipment?.sand) ? 'grit' : 'snow';
  }
  function markStart(){
    if (!sessionStorage.getItem('RUN_START')){
      const now = new Date().toISOString();
      sessionStorage.setItem('RUN_START', now);
      const st = settings();
      const lane = laneFromSettings();
      const ctx = { driver: st.driver || '', lane, start_at: now };
      localStorage.setItem('BRYT_LAST_RUN_CTX', JSON.stringify(ctx));
      console.log('[run_track] RUN_START', now, ctx);
    }
  }
  function markEnd(){
    const now = new Date().toISOString();
    sessionStorage.setItem('RUN_END', now);
    try {
      const ctx = JSON.parse(localStorage.getItem('BRYT_LAST_RUN_CTX') || '{}');
      ctx.end_at = now;
      localStorage.setItem('BRYT_LAST_RUN_CTX', JSON.stringify(ctx));
    } catch {}
    console.log('[run_track] RUN_END', now);
  }

  function wire(){
    $('#act_start')?.addEventListener('click', markStart);
    $('#act_done')?.addEventListener('click', markEnd);
  }

  document.addEventListener('DOMContentLoaded', wire);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#work') wire();
    if (location.hash === '#service' && !sessionStorage.getItem('RUN_END')) {
      markEnd();
    }
  });
})();
