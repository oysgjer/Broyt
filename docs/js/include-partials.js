// Load [data-include] HTML partials
(function(){
  const nodes = document.querySelectorAll('[data-include]');
  nodes.forEach(async n=>{
    const url = n.getAttribute('data-include');
    const r = await fetch(url);
    n.outerHTML = await r.text();
  });
})();
