// Service.js – kobler opp skjemaet når partialen er lastet
(function(){
  function bindServiceUI(){
    const root = document.querySelector('#service');
    if(!root || !root.querySelector('#serviceForm')) return false;

    const btn = root.querySelector('#svc_send');
    if(!btn || btn._bound) return true; // allerede koblet
    btn._bound = true;

    btn.addEventListener('click', ()=>{
      // Hent verdier
      const v = id => root.querySelector('#'+id);
      const report = {
        smoring: {
          skjaer: !!v('svc_skjaer')?.checked,
          fres: !!v('svc_fres')?.checked,
          forstilling: !!v('svc_forstilling')?.checked
        },
        olje: {
          foran: !!v('svc_olje_foran')?.checked,
          bak: !!v('svc_olje_bak')?.checked,
          etterfylt: !!v('svc_olje_etter')?.checked
        },
        diesel: !!v('svc_diesel')?.checked,
        kasserGrus: (v('svc_kasser')?.value || '').trim(),
        annet: (v('svc_annet')?.value || '').trim(),
        ts: new Date().toLocaleString('no-NO')
      };

      // Enkel deling/e-post (kan senere byttes til PDF + automatisk e-post)
      const subject = `Service-rapport ${report.ts}`;
      const body =
`Smøring
- Skjær smurt: ${report.smoring.skjaer ? 'Ja' : 'Nei'}
- Fres smurt: ${report.smoring.fres ? 'Ja' : 'Nei'}
- Forstilling smurt: ${report.smoring.forstilling ? 'Ja' : 'Nei'}

Olje
- Foran sjekket: ${report.olje.foran ? 'Ja' : 'Nei'}
- Bak sjekket: ${report.olje.bak ? 'Ja' : 'Nei'}
- Etterfylt: ${report.olje.etterfylt ? 'Ja' : 'Nei'}

Drivstoff og grus
- Diesel fylt: ${report.diesel ? 'Ja' : 'Nei'}
- Antall kasser grus: ${report.kasserGrus || '—'}

Annet:
${report.annet || '—'}

Tidspunkt: ${report.ts}`;

      // Prøv Web Share hvis tilgjengelig (iOS/Android), ellers fallback til mailto:
      if (navigator.share) {
        navigator.share({title: subject, text: body}).catch(()=>{});
      } else {
        const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      }
    });

    return true;
  }

  // Koble når partials er ferdig lastet
  document.addEventListener('partials:ready', bindServiceUI);
  // Og ved navigasjon (hvis brukeren kommer til siden etterpå)
  window.addEventListener('hashchange', ()=>{
    if (location.hash.replace('#','') === 'service') setTimeout(bindServiceUI, 0);
  });
  // fallback ved første last
  window.addEventListener('DOMContentLoaded', ()=> setTimeout(bindServiceUI, 0));
})();