/* docs/js/Home.js
   Robust start-knapp: virker selv om id/klassene varierer.
   Lagrer valg, seeder lokale adresser ved behov, hopper til #work.
*/
(function () {
  const $  = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const HOME = $('#home');
  if (!HOME) return;

  // ---------- Finn felter ----------
  const inputDriver = HOME.querySelector('input[type="text"],input[type="search"],input:not([type])');
  const selOrder    = HOME.querySelector('select');
  const chkAuto     = HOME.querySelector('input[type="checkbox"][id*="auto" i],input[type="checkbox"][name*="auto" i]')
                      || HOME.querySelector('input[type="checkbox"]');

  // Utstyr (forsøker via label-tekst; faller tilbake til de 3 første checkboxene i seksjonen)
  const equipChecks = {};
  $$('label', HOME).forEach(l => {
    const t = (l.textContent||'').toLowerCase();
    const box = l.querySelector('input[type="checkbox"]') || l.previousElementSibling;
    if (t.includes('skjær')) equipChecks.skj = box;
    if (t.includes('fres'))  equipChecks.fres = box;
    if (t.match(/sand|grus/)) equipChecks.sand = box;
  });
  if (!equipChecks.skj || !equipChecks.fres || !equipChecks.sand) {
    const cbs = $$('input[type="checkbox"]', HOME);
    equipChecks.skj  = equipChecks.skj  || cbs[0];
    equipChecks.fres = equipChecks.fres || cbs[1];
    equipChecks.sand = equipChecks.sand || cbs[2];
  }

  // ---------- Finn startknapp (flere strategier) ----------
  let btnStart =
    HOME.querySelector('#btnStart') ||
    HOME.querySelector('[data-start],[data-action="start"]') ||
    null;

  if (!btnStart) {
    // Siste utvei: finn en <button> i #home med tekst "Start runde"
    const buttons = $$('button, input[type="submit"]', HOME);
    btnStart = buttons.find(b => (b.textContent||b.value||'').trim().toLowerCase().includes('start runde'));
  }

  // ---------- Last inn lagrede valg ----------
  window.S = window.S || {};
  try {
    const saved = JSON.parse(localStorage.getItem('BRYT_HOME_PREFS') || '{}');
    if (saved.driver && inputDriver) inputDriver.value = saved.driver;
    if (saved.order  && selOrder)    selOrder.value    = saved.order;
    if (typeof saved.autoNav === 'boolean' && chkAuto) chkAuto.checked = saved.autoNav;
    if (equipChecks.skj)  equipChecks.skj.checked  = !!saved.skj;
    if (equipChecks.fres) equipChecks.fres.checked = !!saved.fres;
    if (equipChecks.sand) equipChecks.sand.checked = !!saved.sand;
  } catch {}

  function savePrefs(){
    const prefs = {
      driver: inputDriver?.value?.trim() || '',
      order:  selOrder?.value || 'Normal',
      autoNav: !!(chkAuto && chkAuto.checked),
      skj:  !!(equipChecks.skj  && equipChecks.skj.checked),
      fres: !!(equipChecks.fres && equipChecks.fres.checked),
      sand: !!(equipChecks.sand && equipChecks.sand.checked),
    };
    localStorage.setItem('BRYT_HOME_PREFS', JSON.stringify(prefs));
    return prefs;
  }

  async function ensureLocalAddresses(){
    // Kall eksisterende seeding hvis den finnes
    if (typeof window.ensureAddressesSeeded === 'function') {
      try { await window.ensureAddressesSeeded(); } catch {}
    }
    const snap = (window.S.cloud && window.S.cloud.snapshot) || {};
    if (!Array.isArray(snap.addresses) || snap.addresses.length === 0) {
      // Minimal lokal demo-liste
      window.S.cloud = {
        snapshot: {
          addresses: [
            { id:'A1', name:'Tunlandvegen',    lat:63.422, lon:10.401 },
            { id:'A2', name:'Sessvollvegen 9', lat:63.425, lon:10.407 },
            { id:'A3', name:'Stasjonsgata 3',  lat:63.428, lon:10.412 },
          ]
        }
      };
      if (!localStorage.getItem('BRYT_STATUS')) {
        localStorage.setItem('BRYT_STATUS', JSON.stringify({}));
      }
    }
  }

  function initRun(p){
    window.S.driver   = p.driver || 'Ukjent';
    window.S.order    = p.order  || 'Normal';
    window.S.autoNav  = !!p.autoNav;
    window.S.gear     = { skj:!!p.skj, fres:!!p.fres, sand:!!p.sand };
    window.S.idx      = 0;
    window.S.runActive= true;
  }

  function gotoWork(){
    if (typeof window.showPage === 'function') {
      window.showPage('work');
    } else {
      // fallback
      $$('main section').forEach(s => s.hidden = (s.id !== 'work'));
      location.hash = '#work';
    }
  }

  async function handleStart(e){
    e?.preventDefault?.();
    const prefs = savePrefs();

    if (!prefs.driver) {
      alert('Skriv inn navn på fører.');
      inputDriver?.focus();
      return;
    }

    try {
      await ensureLocalAddresses();
      initRun(prefs);
      // Oppdater "Under arbeid" hvis helpers finnes
      window.updateProgressBars?.();
      window.refreshWorkCard?.();
      gotoWork();
    } catch (err){
      console.error('Start runde feilet:', err);
      alert('Klarte ikke å starte runde.');
    }
  }

  // Koble klikker – både direkte og delegert (i tilfelle knappen re-renderes)
  if (btnStart) btnStart.addEventListener('click', handleStart);
  HOME.addEventListener('click', (ev)=>{
    const el = ev.target.closest('#btnStart,[data-start],[data-action="start"]');
    if (el) handleStart(ev);
    // også: match på tekst som sikkerhetsnett
    if (!el && ev.target.closest('button')) {
      const b = ev.target.closest('button');
      const txt = (b.textContent||b.value||'').trim().toLowerCase();
      if (txt.includes('start runde')) handleStart(ev);
    }
  });
})();