// work_uhell_fix.js — safe, syntactically-correct wrapper to avoid console errors
(function(){
  const $ = (s,root=document)=>root.querySelector(s);

  function wireUhell(){
    try{
      const scope = document.getElementById('work') || document;
      const btn = scope.querySelector('#btnUhell, button[data-action="uhell"], .btn-uhell');
      if (btn && !btn.dataset.uhellBound){
        btn.dataset.uhellBound = '1';
        btn.addEventListener('click', (ev)=>{
          try {
            if (typeof window.ensureUhell === 'function') { window.ensureUhell(); }
            if (typeof window.onUhellClick === 'function') { window.onUhellClick(ev); }
          } catch(e){ /* swallow */ }
        });
      }
    }catch(e){ /* no-op */ }
  }

  document.addEventListener('DOMContentLoaded', wireUhell);
  window.addEventListener('hashchange', wireUhell);
  setInterval(wireUhell, 1500);
})();
