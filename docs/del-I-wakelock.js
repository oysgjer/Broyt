// docs/del-I-wakelock.js
// Holder skjermen våken mens "Under arbeid" er aktiv (Screen Wake Lock API)
(function(){
  let sentinel = null;
  const UI = {
    btn: null,
    status: null
  };

  function supported(){
    return 'wakeLock' in navigator && typeof navigator.wakeLock.request === 'function';
  }

  async function acquire(){
    if (!supported()) {
      setStatus('Ikke støttet på denne enheten/nettleseren.');
      return;
    }
    try{
      sentinel = await navigator.wakeLock.request('screen');
      setStatus('Aktiv – skjermen holder seg på');
      updateButton(true);
      sentinel.addEventListener('release', ()=> {
        setStatus('Av – skjermen kan slukke'); updateButton(false);
      });
    }catch(e){
      setStatus('Kunne ikke holde skjermen våken: ' + (e.name||e.message));
      updateButton(false);
    }
  }

  async function release(){
    try{
      if (sentinel) { await sentinel.release(); sentinel = null; }
      setStatus('Av – skjermen kan slukke');
      updateButton(false);
    }catch(e){
      setStatus('Feil ved stopp: ' + (e.name||e.message));
    }
  }

  function setStatus(t){
    if (UI.status) UI.status.textContent = 'Skjermlås: ' + t;
  }
  function updateButton(active){
    if (!UI.btn) return;
    UI.btn.textContent = active ? '🔓 Slå av skjerm-lås' : '🔒 Hold skjermen våken';
  }

  // Re-akkvirer når fanen blir aktiv igjen (mange OS slipper låsen når du “tabber” bort)
  document.addEventListener('visibilitychange', ()=> {
    if (document.visibilityState === 'visible' && sentinel) {
      acquire();
    }
  });

  // Eksponer enkelt API globalt
  window.WakeLock = {
    supported,
    acquire,
    release,
    autoEnable: async ()=>{
      // krever brukerinteraksjon nylig; vi prøver uansett og lar knappen være manuell backup
      await acquire();
    }
  };

  // Knyt UI når siden er klar
  window.addEventListener('DOMContentLoaded', ()=>{
    UI.btn = document.getElementById('wl_toggle');
    UI.status = document.getElementById('wl_status');
    if (!UI.btn || !UI.status) return;

    if (!supported()){
      setStatus('Ikke støttet – prøv nyeste Chrome/Edge/Opera/Android, Safari 16.4+.');
      UI.btn.disabled = true;
      return;
    }
    setStatus('Av – skjermen kan slukke');
    UI.btn.addEventListener('click', ()=>{
      if (sentinel) release(); else acquire();
    });
  });
})();