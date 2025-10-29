// Small helpers + live clock
(function(){
  const $ = s=>document.querySelector(s);
  function clock(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const el = document.getElementById('clock');
    if (el) el.textContent = hh+':'+mm;
  }
  setInterval(clock, 30000);
  clock();
})();
