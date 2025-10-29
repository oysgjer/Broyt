
// work_uhell_fix.js — safe Uhell-button helper (no syntax errors)
(function(){
  function ensureUhellButton(){
    try{
      const grid = document.querySelector('#work .btn-grid');
      if (!grid) return;
      let btn = document.getElementById('act_incident');
      if (!btn){
        btn = document.createElement('button');
        btn.id = 'act_incident';
        btn.className = 'btn btn-warn';
        btn.innerHTML = '⚠️ Uhell';
        btn.addEventListener('click', ()=>{
          try{ sessionStorage.setItem('SERVICE_PRESELECT', JSON.stringify({ type:'incident' })); }catch{}
          location.hash = '#service';
        });
        grid.appendChild(btn);
      }
    }catch(e){
      console.warn('ensureUhellButton failed:', e);
    }
  }
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(ensureUhellButton);
  window.addEventListener('hashchange', ensureUhellButton);
  setTimeout(ensureUhellButton, 600);
})();
