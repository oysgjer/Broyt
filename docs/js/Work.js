/* Under-arbeid side – kun sidespesifikk wiring. 
   MERK: Ingen $ / nowHHMM / osv. her – de kommer fra del-d.js */
(function(){
  // Kalles fra del-d.js når siden vises
  window.initWorkPage = async function(){
    try{
      await ensureAddressesSeeded();
      await refreshCloud();
    }catch{}
    updateProgressBars();
  };

  // Hvis du senere vil legge til klikkhåndtering for knapper:
  document.addEventListener('DOMContentLoaded', ()=>{
    // Eksempel:
    // $('#act_start')?.addEventListener('click', ()=> console.log('Start klikket'));
  });
})();