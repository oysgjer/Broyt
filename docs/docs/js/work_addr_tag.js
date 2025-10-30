/*! work_addr_tag.js
 * Setter/vedlikeholder data-current-address i #work når "Nå"-adressen endres.
 * - Leter etter typiske adressefelt (h2 i work-card, .current-address, etc.)
 * - Skriver attributtet på det samme elementet som viser teksten
 * - Kaller også en tilbakemelding dersom global hook finnes (window.onWorkAddressTag)
 */
(function(){
  'use strict';

  function extractText(el){
    if (!el) return '';
    var t = (el.getAttribute('data-current-address') || el.textContent || '').trim();
    return t;
  }

  function tagElement(el, txt){
    if (!el) return;
    if (txt) el.setAttribute('data-current-address', txt);
    // kall hook hvis noen vil vite om oppdatering
    try{
      if (typeof window.onWorkAddressTag === 'function'){
        window.onWorkAddressTag({ element: el, address: txt });
      }
    }catch{}
  }

  function scanOnce(){
    var root = document.querySelector('#work');
    if (!root) return;

    var sels = [
      '#work .work-card h2',
      '#work .work-card .title',
      '#work [data-current-address]',
      '#work .current-address',
      '#work .now + h2',
      '#work .now + .title',
      '#work [data-addr-now]'
    ];

    for (var i=0;i<sels.length;i++){
      var el = document.querySelector(sels[i]);
      if (!el) continue;
      var txt = extractText(el);
      if (txt && !/^nå$/i.test(txt)) {
        tagElement(el, txt);
        return;
      }
    }
  }

  function init(){
    // Først et skann etter DOMContentLoaded
    scanOnce();

    // Overvåk endringer i #work (knapper som navigerer mellom adresser etc.)
    var root = document.querySelector('#work') || document.body;
    var mo = new MutationObserver(function(muts){
      // throttled scan
      if (init._t) cancelAnimationFrame(init._t);
      init._t = requestAnimationFrame(scanOnce);
    });
    mo.observe(root, { childList:true, subtree:true, characterData:true, attributes:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
