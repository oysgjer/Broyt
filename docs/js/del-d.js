/* ====== Hjelpefunksjoner og global app-tilstand ====== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Global (enkel) state som også lagres i localStorage */
const LS_STATE_KEY  = 'BRYT_STATE';
const LS_STATUS_KEY = 'BRYT_STATUS';

const S = loadState() || {
  driver: '',
  order: 'normal',
  autoNav: false,
  addresses: [],   // {id, name, task, state, by, ts}
  cursor: 0        // peker på “nå”-adresse
};

function loadState(){
  try { return JSON.parse(localStorage.getItem(LS_STATE_KEY) || 'null'); }
  catch { return null; }
}
function saveState(){
  try { localStorage.setItem(LS_STATE_KEY, JSON.stringify(S)); } catch {}
}

/* Minimal statusStore – lokalt (kan senere kobles mot JSONBin) */
function statusStore(){
  try { return JSON.parse(localStorage.getItem(LS_STATUS_KEY) || '{}'); }
  catch { return {}; }
}
function setStatusStore(obj){
  try { localStorage.setItem(LS_STATUS_KEY, JSON.stringify(obj || {})); } catch {}
}

/* Demo-seeding av adresser hvis listen er tom.
   Senere bytter vi denne med ekte henting fra sky. */
function ensureAddressesSeeded(){
  if (Array.isArray(S.addresses) && S.addresses.length > 0) return S.addresses;

  const demo = [
    { id: 'A01', name: 'Tunlandvegen',   task: 'Sand/Grus', state: 'idle' },
    { id: 'A02', name: 'Sessvollvegen 9',task: 'Sand/Grus', state: 'idle' },
    { id: 'A03', name: 'Ekornstubben',   task: 'Skjær',     state: 'idle' },
    { id: 'A04', name: 'Bjørkestien',    task: 'Skjær',     state: 'idle' }
  ];
  S.addresses = demo;
  S.cursor = 0;
  saveState();
  return S.addresses;
}

/* “Sky”-oppfriskning – no-op nå; kan kobles mot JSONBin senere */
async function refreshCloud(){
  // Her kan du senere lese/merge status fra JSONBin.
  return true;
}

/* Enkel navigasjon mellom seksjoner */
function showPage(id){
  $$('main section').forEach(sec => {
    sec.hidden = (sec.id !== id);
  });
  if (id) location.hash = '#'+id;
}

/* Drawer (hamburger) */
const drawer = $('#drawer');
const scrim  = $('#scrim');

function openDrawer(){
  drawer?.classList.add('open');
  scrim?.classList.add('show');
  drawer?.setAttribute('aria-hidden','false');
}
function closeDrawer(){
  drawer?.classList.remove('open');
  scrim?.classList.remove('show');
  drawer?.setAttribute('aria-hidden','true');
}

$('#btnMenu')?.addEventListener('click', () => {
  if (drawer?.classList.contains('open')) closeDrawer(); else openDrawer();
});
$('#btnCloseDrawer')?.addEventListener('click', closeDrawer);
scrim?.addEventListener('click', closeDrawer);

$$('#drawer .drawer-link[data-go]').forEach(a=>{
  a.addEventListener('click', ()=>{
    showPage(a.getAttribute('data-go'));
    closeDrawer();
  });
});

/* Wake Lock-indikator (prikk) + toggle */
let wakeLock = null;
const wlDot    = $('#wl_dot') || $('#qk_wl_dot');
const wlStatus = $('#wl_badge') || $('#qk_wl_status');

async function toggleWakeLock(){
  try{
    if (wakeLock && wakeLock.active){
      await wakeLock.release(); wakeLock = null;
      wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
      wlStatus && (wlStatus.textContent = 'Status: av');
      return;
    }
    if ('wakeLock' in navigator && navigator.wakeLock?.request){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', ()=>{
        wlDot?.classList.remove('dot-on'); wlDot?.classList.add('dot-off');
        wlStatus && (wlStatus.textContent = 'Status: av');
      });
      wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
      wlStatus && (wlStatus.textContent = 'Status: på (native)');
      return;
    }
    // iOS-fallback: stille, loopet, usynlig video
    let v = document.querySelector('#wlHiddenVideo');
    if (!v){
      v = document.createElement('video');
      v.id='wlHiddenVideo'; v.loop=true; v.muted=true; v.playsInline=true; v.style.display='none';
      v.src='data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDFtcDQyaXNvbWF2YzEAAABsbW9vdgAAAGxtdmhkAAAAANrJLTrayS06AAAC8AAAFW1sb2NhAAAAAAABAAAAAAEAAAEAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABh0cmFrAAAAXHRraGQAAAAD2sk1OdrJNTkAAAFIAAAUbWRpYQAAACBtZGhkAAAAANrJLTrayS06AAAC8AAAACFoZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAAAwAAAAAAABAQAAAAEAAABPAAAAAAAfAAAAAAALc291bmRfbmFtZQAA';
      document.body.appendChild(v);
    }
    await v.play();
    wlDot?.classList.remove('dot-off'); wlDot?.classList.add('dot-on');
    wlStatus && (wlStatus.textContent = 'Status: på (iOS-fallback)');
  }catch(e){
    wlStatus && (wlStatus.textContent = 'Status: feil');
  }
}
$('#qk_wl')?.addEventListener('click', toggleWakeLock);

/* Progress-bar oppdatering (trygg ved tom liste) */
function updateProgressBars(){
  const total = (S.addresses && S.addresses.length) ? S.addresses.length : 0;
  if (!total){
    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = '0%';
    if (bo) bo.style.width = '0%';
    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `0/0`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `0/0`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `0 av 0 adresser fullført`);
    return;
  }

  const store = statusStore();
  let me = 0, other = 0;
  for (const k in store){
    const st = store[k];
    if (st?.state === 'done'){
      if (st.driver === S.driver) me++; else other++;
    }
  }
  const mePct = Math.round(100 * me / total);
  const otPct = Math.round(100 * other / total);

  const bm = $('#b_prog_me'), bo = $('#b_prog_other');
  if (bm) bm.style.width = mePct + '%';
  if (bo) bo.style.width = otPct + '%';

  $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${me}/${total}`);
  $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
  $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(me+other,total)} av ${total} adresser fullført`);
}

/* Gjør symboler tilgjengelige for andre filer */
window.$ = $;
window.$$ = $$;
window.S = S;
window.saveState = saveState;
window.statusStore = statusStore;
window.setStatusStore = setStatusStore;
window.ensureAddressesSeeded = ensureAddressesSeeded;
window.refreshCloud = refreshCloud;
window.showPage = showPage;
window.updateProgressBars = updateProgressBars;