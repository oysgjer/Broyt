<!-- js/weather_unified.js -->
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  function fmtHour(d){
    const h = d.getHours(), m = d.getMinutes();
    return (h<10?'0':'') + h + ':' + (m<10?'0':'') + m;
  }

  function getData(){
    // 1) Foretrukket: bro fra annen modul (sørger for samme tall overalt)
    if (window.WX_BRIDGE_DATA && (window.WX_BRIDGE_DATA.now || window.WX_BRIDGE_DATA.hourly)){
      return window.WX_BRIDGE_DATA;
    }
    // 2) Fallback: innebygd JSON
    const el = $('#wx_hourly_json');
    if (el){
      try { return JSON.parse(el.textContent); } catch{}
    }
    return null;
  }

  function renderHome(data){
    const box = $('#weather'); if (!box) return;
    if (!data){ box.innerHTML = 'Vær: (ingen data)'; return; }

    const now = data.now || {};
    const hourly = Array.isArray(data.hourly) ? data.hourly.slice(0,3) : [];

    const rows = hourly.map(h => {
      const d = new Date(h.t);
      return `<span class="muted">${fmtHour(d)}</span> ${h.temp}° ${h.desc}`;
    }).join('<br>');

    box.innerHTML = `
      <strong>🌦️ Vær nå:</strong><br>
      ${now.temp ?? ''} ${now.desc ?? ''}<br>
      <div style="margin-top:6px"><strong>Neste 3 timer</strong><br>${rows || '(—)'}</div>
    `;
  }

  function renderWork(data){
    const box = $('#wx_row'); if (!box) return;
    if (!data){ box.textContent = ''; return; }

    const now = data.now || {};
    const hourly = Array.isArray(data.hourly) ? data.hourly.slice(0,3) : [];

    const chips = hourly.map(h => {
      const d = new Date(h.t);
      return `<span class="chip">${fmtHour(d)} • ${h.temp}°</span>`;
    }).join('');

    box.innerHTML = `
      <div class="wx-now"><span>${now.temp ?? ''}</span> <span class="muted">${now.desc ?? ''}</span></div>
      <div class="wx-next">${chips}</div>
    `;
  }

  function renderAll(){
    const data = getData();
    renderHome(data);
    renderWork(data);
  }

  document.addEventListener('DOMContentLoaded', renderAll);
  // tillat manuell oppfriskning: window.dispatchEvent(new Event('wx:refresh'))
  window.addEventListener('wx:refresh', renderAll);
})();