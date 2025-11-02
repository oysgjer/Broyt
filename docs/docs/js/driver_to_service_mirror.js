// docs/js/driver_to_service_mirror.js — speiler sjåførnavn fra Hjem til Service
(function(){
  const KEY = 'DRIVER_NAME';

  function getNameFromHome(){
    const inp = document.getElementById('a_driver');
    if (inp && inp.value && inp.value.trim().length) return inp.value.trim();
    // Fallback fra localStorage (noen lagrer navnet her)
    const ls = localStorage.getItem(KEY) || localStorage.getItem('driver') || '';
    try{ const j = JSON.parse(ls); if (typeof j === 'string') return j; }catch{}
    return (ls || '').toString();
  }

  function setNameToService(name){
    const el = document.getElementById('svc_driver_name');
    if (el) el.textContent = name || '—';
  }

  function persist(name){
    if (!name) return;
    try { localStorage.setItem(KEY, name); } catch {}
  }

  function wire(){
    // Les + sett ved last
    const name = getNameFromHome();
    if (name) setNameToService(name);

    // Speil hver gang Hjem-feltet endres
    const inp = document.getElementById('a_driver');
    if (inp && !inp.dataset._svcBound){
      inp.dataset._svcBound = '1';
      inp.addEventListener('input', ()=>{
        const v = (inp.value||'').trim();
        setNameToService(v);
        persist(v);
      });
    }

    // Liten retry i SPA-miljø
    let tries = 0;
    const iv = setInterval(()=>{
      const n = getNameFromHome();
      if (n){ setNameToService(n); persist(n); clearInterval(iv); }
      if (++tries > 10) clearInterval(iv);
    }, 400);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', wire, {once:true});
  else wire();
})();