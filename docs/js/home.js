// HOME
(function(){
  const {S,ensureAddressesSeeded,refreshCloud,saveCloud,$}=window._shared;

  async function startRound(){
    try{
      const prefs={
        driver:($('#a_driver').value||'').trim()||'driver',
        dir:$('#a_dir').value,
        eq:{ plow:$('#a_eq_plow').checked, fres:$('#a_eq_fres').checked, sand:$('#a_eq_sand').checked },
        autoNav: $('#a_autoNav').checked
      };
      localStorage.setItem('BROYT_PREFS',JSON.stringify(prefs));
      S.driver=prefs.driver; S.dir=prefs.dir; S.autoNav=prefs.autoNav;
      S.mode = prefs.eq.sand ? 'grit' : 'snow';

      await ensureAddressesSeeded();
      await refreshCloud();

      const arr = (S.cloud?.snapshot?.addresses)||[];
      S.addresses = arr
        .filter(a=>a.active!==false)
        .filter(a=> S.mode==='snow' ? ((a.flags?.snow)!==false) : !!(a.flags?.grit));
      S.idx = (S.dir==='Motsatt') ? (S.addresses.length-1) : 0;

      window.showPage('work');
    }catch(e){ alert('Startfeil: '+(e.message||e)); }
  }

  window.Home={
    onShow(){ $('#a_start')?.addEventListener('click', startRound, {once:true}); }
  };
})();
