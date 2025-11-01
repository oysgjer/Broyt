// autonav_settings.js — lagrer/leser "Auto-naviger" fra Hjem (#a_autoNav)
(function(){
  function init(){
    const chk = document.getElementById('a_autoNav');
    if (!chk) return;
    chk.checked = localStorage.getItem('AUTO_NAV') === '1';
    chk.addEventListener('change', ()=> {
      localStorage.setItem('AUTO_NAV', chk.checked ? '1' : '0');
    }, {once:false});
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();