// js/theme.js – styrer lys/mørk modus

(() => {
  const btn = document.getElementById('themeBtn');

  // last tidligere valg
  const saved = localStorage.getItem('theme') || 'auto';
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
  if (saved === 'light') document.documentElement.dataset.theme = 'light';

  function updateButton() {
    const mode = document.documentElement.dataset.theme;
    if (mode === 'dark') btn.textContent = '☀️ Lys modus';
    else btn.textContent = '🌙 Mørk modus';
  }

  btn.addEventListener('click', () => {
    const mode = document.documentElement.dataset.theme;
    if (mode === 'dark') {
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    }
    updateButton();
  });

  updateButton();
})();