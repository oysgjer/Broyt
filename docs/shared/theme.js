/* Globalt tema – lagrer preferanse og setter data-theme på <html> */
(function (g) {
  const KEY = 'broyt:theme'; // 'auto' | 'light' | 'dark'
  function get() {
    const v = localStorage.getItem(KEY);
    return (v === 'light' || v === 'dark' || v === 'auto') ? v : 'auto';
  }
  function apply(v) {
    const val = (v === 'light' || v === 'dark') ? v : 'auto';
    document.documentElement.setAttribute('data-theme', val);
  }
  function set(v) {
    const val = (v === 'light' || v === 'dark') ? v : 'auto';
    localStorage.setItem(KEY, val);
    apply(val);
    try { window.dispatchEvent(new CustomEvent('theme:changed', { detail: val })); } catch {}
    return val;
  }
  function init() { apply(get()); }
  g.BroytTheme = { get, set, init };
  init();
})(window);
