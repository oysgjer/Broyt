/* ---------------------------------------------------------
   Service.js — lagre + tilby e-post
--------------------------------------------------------- */
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  function collectService() {
    const val = (id) => !!$(id)?.checked;
    return {
      grease: {
        plow:  val('#srv_plow'),
        fres:  val('#srv_fres'),
        front: val('#srv_front'),
      },
      oil: {
        front: val('#srv_oil_front'),
        rear:  val('#srv_oil_rear'),
        fill:  val('#srv_oil_fill'),
      },
      dieselFilled: val('#srv_diesel'),
      gritBoxes: ($('#srv_grit')?.value || '').trim(),
      notes: ($('#srv_notes')?.value || '').trim(),
      driver: (loadState()?.driver || ''),
      ts: new Date().toISOString()
    };
  }

  function saveServiceLocal(rec) {
    const key = 'BRYT_SERVICE_LOG';
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    arr.push(rec);
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function pretty(rec) {
    return [
      `Fører: ${rec.driver || '—'}`,
      `Tid: ${rec.ts}`,
      '',
      'Smøring:',
      `  • Skjær smurt: ${rec.grease.plow ? 'Ja' : 'Nei'}`,
      `  • Fres smurt: ${rec.grease.fres ? 'Ja' : 'Nei'}`,
      `  • Forstilling smurt: ${rec.grease.front ? 'Ja' : 'Nei'}`,
      '',
      'Olje:',
      `  • Foran sjekket: ${rec.oil.front ? 'Ja' : 'Nei'}`,
      `  • Bak sjekket: ${rec.oil.rear ? 'Ja' : 'Nei'}`,
      `  • Etterfylt: ${rec.oil.fill ? 'Ja' : 'Nei'}`,
      '',
      `Diesel fylt: ${rec.dieselFilled ? 'Ja' : 'Nei'}`,
      `Antall kasser grus: ${rec.gritBoxes || '—'}`,
      '',
      `Annet:\n${rec.notes || '—'}`
    ].join('\n');
  }

  function toMailto(rec) {
    const to = (loadSettings()?.serviceEmail) || 'oysgjer@gmail.com';
    const subject = encodeURIComponent('Service-rapport (Brøyterute)');
    const body = encodeURIComponent(pretty(rec));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  function wire() {
    // vi lytter på en "lagre"-knapp hvis den finnes i partialen,
    // ellers auto-lagre når du åpner Service-siden
    const btn = $('#srv_save');
    const runSave = () => {
      const rec = collectService();
      saveServiceLocal(rec);
      alert('Service lagret.');
      setTimeout(() => {
        if (confirm('Vil du sende service-rapport på e-post nå?')) {
          location.href = toMailto(rec);
        }
      }, 50);
    };

    if (btn) btn.addEventListener('click', runSave);

    // auto-wire når vi går til service
    window.addEventListener('hashchange', () => {
      if (location.hash === '#service' && !btn) {
        // auto-lagring gjøres ikke; bare sikre at skjema finnes
      }
    });
  }

  document.addEventListener('DOMContentLoaded', wire);
})();