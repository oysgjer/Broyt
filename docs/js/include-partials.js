// /js/include-partials.js
async function injectIncludes(root = document) {
  const targets = [...root.querySelectorAll('[data-include]')];
  await Promise.all(
    targets.map(async el => {
      const url = el.getAttribute('data-include');
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        const html = await res.text();
        el.innerHTML = html;
        el.removeAttribute('data-include');
      } catch (e) {
        el.innerHTML = `<div style="color:#ef4444">Kunne ikke laste ${url}: ${e.message}</div>`;
      }
    })
  );
  // Skjul alle seksjoner bortsett fra #home ved første visning
  const sections = [...document.querySelectorAll('main section')];
  sections.forEach(s => (s.style.display = s.id === 'home' ? 'block' : 'none'));
}
injectIncludes();

// En enkel global funksjon for å bytte side (brukes av menylenker)
window.showPage = function(id) {
  const sections = [...document.querySelectorAll('main section')];
  sections.forEach(s => (s.style.display = s.id === id ? 'block' : 'none'));
  location.hash = '#' + id;
};

window.addEventListener('hashchange', () => {
  const id = (location.hash || '#home').slice(1);
  const el = document.getElementById(id);
  window.showPage(el ? id : 'home');
});