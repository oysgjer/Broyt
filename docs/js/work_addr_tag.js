/*! work_addr_tag.js (safe)
 * Tagger elementet i #work som viser "Nå"-adressen, med data-current-address.
 * - Leter kun i #work
 * - Skriver KUN data-attributt, ikke tekst
 * - Ingen nye synlige elementer
 */
(function(){
  'use strict';

  function getText(el){
    return (el && (el.getAttribute('data-current-address') || el.textContent || '').trim()) || '';
  }
  function tag(el, txt){
    if (el && txt) el.setAttribute('data-current-address', txt);
  }

  const selectors = [
    '#work [data-current-address]',
    '#work .work-card h2',
    '#work .work-card .title',
    '#work .current-address',
    '#work .now + h2',
    '#work .now + .title',
    '#work [data-addr-now]'
  ];

  function scan(){
    for (let s of selectors){
      const el = document.querySelector(s);
      if (!el) continue;
      const txt = getText(el);
      if (txt && !/^nå$/i.test(txt)){
        tag(el, txt);
        return;
      }
    }
  }

  function init(){
    scan();
    const root = document.querySelector('#work') || document.body;
    const mo = new MutationObserver(()=>{
      if (init._raf) cancelAnimationFrame(init._raf);
      init._raf = requestAnimationFrame(scan);
    });
    mo.observe(root, {childList:true, subtree:true, characterData:true, attributes:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
