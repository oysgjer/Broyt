/* ======= COMMON (må lastes først) ======= */
(function () {
  // Små helpers – defineres én gang globalt
  if (!window.$)  window.$  = (s, root = document) => root.querySelector(s);
  if (!window.$$) window.$$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  if (!window.on) window.on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  if (!window.nowHHMM) {
    window.nowHHMM = (t = Date.now()) =>
      new Date(t).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  }
  if (!window.fmtTime) window.fmtTime = (t) => (!t ? '—' : nowHHMM(t));
  if (!window.fmtDate) window.fmtDate = () => new Date().toLocaleDateString('no-NO');

  // Trygg stub: hindrer “ensureAddressesSeeded is not defined”
  if (typeof window.ensureAddressesSeeded === 'undefined') {
    window.ensureAddressesSeeded = async function () {
      console.warn('ensureAddressesSeeded(): midlertidig stub (OK for stabilitet).');
      return;
    };
  }
})();