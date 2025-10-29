/* work_uhell_fix.js — trygg wiring av Uhell-knapp (ingen syntaksfeil) */
(function () {
  function safe(fn){ try{ fn && fn(); } catch(e){} }

  function bindUhell(){
    var scope = document.getElementById('work') || document;
    var btn = scope.querySelector('#btnUhell, [data-action="uhell"], .btn-uhell');
    if (!btn || btn.dataset.uhellBound) return;
    btn.dataset.uhellBound = "1";
    btn.addEventListener('click', function(ev){
      safe(function(){ if (typeof window.ensureUhell === 'function') window.ensureUhell(); });
      safe(function(){ if (typeof window.onUhellClick === 'function') window.onUhellClick(ev); });
    });
  }

  document.addEventListener('DOMContentLoaded', bindUhell);
  window.addEventListener('hashchange', bindUhell);
  setInterval(bindUhell, 1500);
})();
