<!-- js/service_capture_emails.js -->
<script>
// Minimal "helpers"
(function(){
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const textOf = el => (el?.value ?? el?.textContent ?? '').trim();

  // Hent speilet navn (fra Hjem -> Service), ellers fra localStorage
  function getDriverName(){
    return (
      $('#service_driver_mirror')?.textContent?.trim() ||
      localStorage.getItem('LAST_DRIVER') ||
      $('#a_driver')?.value?.trim() ||
      ''
    );
  }

  // Les alle servicevalg
  function readServiceForm(){
    const root = $('#service');
    if (!root) return null;

    // Avkryssinger (leser både eksplisitte id-er og generisk)
    const chk = name => {
      const el = $(`#${name}`, root);
      return el ? !!el.checked : false;
    };

    // Prøv å finne relevante felt etter label-tekst (robust om id endres)
    const boolByLabel = (labelTxt) => {
      const lab = $$('label', root).find(l => l.textContent.trim().toLowerCase().includes(labelTxt));
      if (!lab) return false;
      const inpt = lab.querySelector('input[type="checkbox"]');
      return !!(inpt && inpt.checked);
    };

    // Enkel heuristikk:
    const skjSmurt  = boolByLabel('skjær smurt');
    const fresSmurt = boolByLabel('fres smurt');
    const forstSmurt= boolByLabel('forstilling smurt');

    const oljeForan  = boolByLabel('olje sjekket foran');
    const oljeBak    = boolByLabel('olje sjekket bak');
    const oljeEtterf = boolByLabel('olje etterfylt');

    const diesel     = boolByLabel('diesel fylt');

    // Antall kasser grus og fritekst
    const kasserGrus = $('input[type="number"], input[inputmode="numeric"], input[pattern*="\\d"]', root)?.value?.trim()
                      || $('#grus_count', root)?.value?.trim()
                      || '0';
    const annet      = $('textarea', root)?.value?.trim() || '';

    return {
      time: new Date(),
      driver: getDriverName(),
      smoring: {
        skjaer: skjSmurt, fres: fresSmurt, forstilling: forstSmurt
      },
      olje: {
        foran: oljeForan, bak: oljeBak, etterfylt: oljeEtterf
      },
      drivstoff: {
        dieselFylt: diesel, kasserGrus: kasserGrus
      },
      annet
    };
  }

  // Bygg epost-tekst
  function buildMailBody(d){
    const pad = n => (n<10?('0'+n):n);
    const ts = `${d.time.getDate()}.${pad(d.time.getMonth()+1)}.${d.time.getFullYear()} kl. ${pad(d.time.getHours())}:${pad(d.time.getMinutes())}`;
    const yes = v => v ? 'Ja' : 'Nei';

    return [
      `Dato/tid: ${ts}`,
      `Fører: ${d.driver || '(ukjent)'}`,
      '',
      'Smøring:',
      `- Skjær smurt: ${yes(d.smoring.skjaer)}`,
      `- Fres smurt: ${yes(d.smoring.fres)}`,
      `- Forstilling smurt: ${yes(d.smoring.forstilling)}`,
      '',
      'Olje:',
      `- Sjekket foran: ${yes(d.olje.foran)}`,
      `- Sjekket bak: ${yes(d.olje.bak)}`,
      `- Etterfylt: ${yes(d.olje.etterfylt)}`,
      '',
      'Drivstoff & grus:',
      `- Diesel fylt: ${yes(d.drivstoff.dieselFylt)}`,
      `- Antall kasser grus: ${d.drivstoff.kasserGrus}`,
      '',
      'Annet:',
      d.annet || '(tomt)'
    ].join('\n');
  }

  // Trigger print-til-PDF og åpne mailto
  function printAndMail(destEmail){
    const data = readServiceForm();
    if (!data) return;

    const subject = encodeURIComponent(`Service utført – ${data.driver || 'ukjent'}`);
    const body    = encodeURIComponent(buildMailBody(data));
    const to      = encodeURIComponent(destEmail || 'post@eksempel.no');

    // 1) Print til PDF – lar bruker lagre som PDF
    try { window.print(); } catch(e){ /* no-op */ }

    // 2) Mailto (bruker legger ved PDF manuelt)
    const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
    setTimeout(() => { window.location.href = mailto; }, 400); // lite opphold etter print
  }

  // Koble til "Lagre service"
  function hookSave(){
    const root = $('#service');
    if (!root) return;

    // Prøv id først, ellers match på tekst
    let btn = $('#svc_save', root) || $('#btnSaveService', root);
    if (!btn){
      btn = $$('button', root).find(b => /lagre service/i.test(b.textContent));
    }
    if (!btn) return;

    // Ikke dobbel-knytt
    if (btn._emailHooked) return;
    btn._emailHooked = true;

    btn.addEventListener('click', () => {
      // Gi hovedlagring et lite øyeblikk (hvis den er async) før vi henter verdier/trigger e-post
      setTimeout(() => printAndMail(localStorage.getItem('SERVICE_EMAIL_TO') || ''), 200);
    });
  }

  // Kjør når Service blir synlig eller ved last
  const run = () => hookSave();
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('hashchange', run);
})();
</script>