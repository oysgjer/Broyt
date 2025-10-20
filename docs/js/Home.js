// Home.js – binder Hjem-skjerm og "Start runde"
(function(){
  const $ = window.$;

  document.addEventListener('DOMContentLoaded', ()=>{
    // Prefill av lagrede preferanser
    try{
      const p = JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}');
      if (p.driver && $('#a_driver')) $('#a_driver').value = p.driver;
      if (p.dir && $('#a_dir')) $('#a_dir').value = p.dir;
      if (p.eq){
        $('#a_eq_plow') && ($('#a_eq_plow').checked = !!p.eq.plow);
        $('#a_eq_fres') && ($('#a_eq_fres').checked = !!p.eq.fres);
        $('#a_eq_sand') && ($('#a_eq_sand').checked = !!p.eq.sand);
      }
      if (typeof p.autoNav==='boolean' && $('#a_autoNav')) $('#a_autoNav').checked = p.autoNav;
    }catch{}

    // Start runde
    const startBtn = $('#a_start');
    if (!startBtn) return;

    startBtn.addEventListener('click', async ()=>{
      try{
        const prefs = {
          driver: ($('#a_driver')?.value || '').trim() || 'driver',
          dir:     $('#a_dir')?.value || 'Normal',
          eq: {
            plow: !!$('#a_eq_plow')?.checked,
            fres: !!$('#a_eq_fres')?.checked,
            sand: !!$('#a_eq_sand')?.checked
          },
          autoNav: !!$('#a_autoNav')?.checked
        };
        localStorage.setItem('BROYT_PREFS', JSON.stringify(prefs));

        // lagre i global S til Work/UI bruker samme verdier
        window.S.driver   = prefs.driver;
        window.S.dir      = prefs.dir;
        window.S.mode     = prefs.eq.sand ? 'grit' : 'snow';
        window.S.autoNav  = prefs.autoNav;

        // Gå til arbeidssiden (resten – henting fra JSONBin – håndteres i Work.js)
        window.showPage('work');
      }catch(e){
        alert('Startfeil: ' + (e.message || e));
      }
    });
  });
})();