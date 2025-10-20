/* docs/js/Home.js
   Kobler "Start runde" + lagrer valg + sørger for at vi har adresser lokalt
   Fungerer uten sky (bruker fallback-funksjoner i del-d.js)
*/
(function () {
  const $  = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const HOME = $('#home');

  if (!HOME) return;

  // --- Finn felter robust (uavhengig av eksakte id-er) ---
  const inputDriver = HOME.querySelector('input[type="text"], input[type="search"], input:not([type])');
  const selOrder    = HOME.querySelector('select');
  const chkAuto     = HOME.querySelector('input[type="checkbox"][id*="auto" i], input[type="checkbox"][name*="auto" i]') 
                   || HOME.querySelector('input[type="checkbox"]');
  const btnStart    = HOME.querySelector('[data-start], #btnStart, button');

  // Utstyrsvalg: prøv å finne på label-tekst (Skjær/Fres/Sand|Grus)
  const equipChecks = {};
  $$('label', HOME).forEach(lab => {
    const t = (lab.textContent || '').toLowerCase();
    if (t.includes('skjær')) equipChecks.skj = lab.querySelector('input[type="checkbox"]') || lab.previousElementSibling;
    if (t.includes('fres'))  equipChecks.fres = lab.querySelector('input[type="checkbox"]') || lab.previousElementSibling;
    if (t.match(/sand|grus/)) equipChecks.sand = lab.querySelector('input[type="checkbox"]') || lab.previousElementSibling;
  });
  // fallback om label-match ikke fant noe: ta de tre første checkboxene i #home
  if (!equipChecks.skj || !equipChecks.fres || !equipChecks.sand) {
    const cbs = $$('input[type="checkbox"]', HOME);
    equipChecks.skj  = equipChecks.skj  || cbs[0];
    equipChecks.fres = equipChecks.fres || cbs[1];
    equipChecks.sand = equipChecks.sand || cbs[2];
  }

  // Global app-state
  window.S = window.S || {};
  // Last inn tidligere preferanser
  try {
    const saved = JSON.parse(localStorage.getItem('BRYT_HOME_PREFS') || '{}');
    if (saved.driver && inputDriver) inputDriver.value = saved.driver;
    if (saved.order && selOrder) selOrder.value = saved.order;
    if (typeof saved.autoNav === 'boolean' && chkAuto) chkAuto.checked = saved.autoNav;
    if (equipChecks.skj)  equipChecks.skj.checked  = !!saved.skj;
    if (equipChecks.fres) equipChecks.fres.checked = !!saved.fres;
    if (equipChecks.sand) equipChecks.sand.checked = !!saved.sand;
  } catch {}

  function savePrefs() {
    const prefs = {
      driver: inputDriver?.value?.trim() || '',
      order: selOrder?.value || 'Normal',
      autoNav: !!(chkAuto && chkAuto.checked),
      skj:  !!(equipChecks.skj  && equipChecks.skj.checked),
      fres: !!(equipChecks.fres && equipChecks.fres.checked),
      sand: !!(equipChecks.sand && equipChecks.sand.checked),
    };
    localStorage.setItem('BRYT_HOME_PREFS', JSON.stringify(prefs));
    return prefs;
  }

  async function ensureLocalAddresses() {
    // Hvis sky-fallback er i bruk, kan snapshot være tom. Vi lager en enkel demo-liste.
    await (window.ensureAddressesSeeded?.() || Promise.resolve());
    const snap = (window.S.cloud && window.S.cloud.snapshot) || {};
    if (!Array.isArray(snap.addresses) || snap.addresses.length === 0) {
      window.S.cloud = {
        snapshot: {
          addresses: [
            { id: 'A1', name: 'Tunlandvegen',      lat: 63.422, lon: 10.401 },
            { id: 'A2', name: 'Sessvollvegen 9',   lat: 63.425, lon: 10.407 },
            { id: 'A3', name: 'Stasjonsgata 3',    lat: 63.428, lon: 10.412 },
          ]
        }
      };
      // init statusbag lokalt om mangler
      if (!localStorage.getItem('BRYT_STATUS')) {
        localStorage.setItem('BRYT_STATUS', JSON.stringify({}));
      }
    }
  }

  function initRun(prefs) {
    // Sentralt state-objekt for runde
    window.S.driver      = prefs.driver || 'Ukjent';
    window.S.order       = prefs.order || 'Normal';
    window.S.autoNav     = !!prefs.autoNav;
    window.S.gear = {
      skj:  !!prefs.skj,
      fres: !!prefs.fres,
      sand: !!prefs.sand
    };
    // Startposisjon i lista
    window.S.idx = 0;
    // Marker at runde er i gang
    window.S.runActive = true;
  }

  function showPage(id) {
    // finnes i del-d.js, men vi har en defensiv fallback
    if (typeof window.showPage === 'function') return window.showPage(id);
    // fallback
    const sections = document.querySelectorAll('main section');
    sections.forEach(s => s.hidden = (s.id !== id));
    location.hash = '#' + id;
  }

  async function onStartClick(e) {
    e.preventDefault();
    const prefs = savePrefs();

    // Enkle valideringer (valgfritt)
    if (!prefs.driver) {
      alert('Skriv inn navn på fører.');
      inputDriver?.focus();
      return;
    }
    // minst ett utstyr kan være et krav – kommenter ut om ikke ønsket
    // if (!prefs.skj && !prefs.fres && !prefs.sand) {
    //   alert('Velg minst ett utstyr (Skjær, Fres eller Sand/Grus).');
    //   return;
    // }

    try {
      await ensureLocalAddresses();
      initRun(prefs);
      // Oppdater UI på work-siden hvis funksjonene finnes
      window.updateProgressBars?.();
      window.refreshWorkCard?.();

      // Naviger til "work"
      showPage('work');
    } catch (err) {
      console.error(err);
      alert('Klarte ikke å starte runde. Prøv igjen.');
    }
  }

  // Koble events
  if (btnStart) btnStart.addEventListener('click', onStartClick);
})();