// work_weather_addon.js — weather next to "Under arbeid" title (SVG fix)
(function(){
  const $ = (s,root=document)=>root.querySelector(s);

  // Minimal CSS injection (avoid editing your CSS files)
  function injectStyles(){
    if (document.getElementById('wx_hdr_style')) return;
    const st = document.createElement('style');
    st.id = 'wx_hdr_style';
    st.textContent = `
      .work-header-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px}
      .work-title{margin:0}
      .wx-row{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      @media (max-width:520px){.work-header-row{flex-wrap:wrap}}
    `;
    document.head.appendChild(st);
  }

  function ensureHeader(){
    const sec = document.getElementById('work');
    if (!sec) return;
    let hdr = sec.querySelector('.work-header-row');
    if (hdr) return;

    let title = sec.querySelector('h1');
    if (!title){
      title = document.createElement('h1');
      title.textContent = 'Under arbeid';
    }
    title.classList.add('work-title');

    let wx = sec.querySelector('#wx_row');
    if (!wx){
      wx = document.createElement('div');
      wx.id = 'wx_row';
      wx.className = 'wx-row';
      wx.innerHTML = `
        <img id="wx_icon" alt="vær" width="20" height="20" style="vertical-align:middle;margin-right:6px" />
        <span id="wx_temp">--°</span>
        <span id="wx_desc" class="muted"></span>
      `;
    }

    hdr = document.createElement('div');
    hdr.className = 'work-header-row';
    hdr.appendChild(title);
    hdr.appendChild(wx);
    sec.insertAdjacentElement('afterbegin', hdr);
  }

  function strokeColor(){ return '#111827'; }
  function iconSvg(type){
    // Important: include xmlns so data: SVG renders in all browsers
    const attrs = `xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="${strokeColor()}" stroke-width="1.6"
               stroke-linecap="round" stroke-linejoin="round"`;
    if(type==='sunny')  return `<svg ${attrs}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    if(type==='partly') return `<svg ${attrs}><path d="M4 15a4 4 0 0 1 4-4h.5"/><circle cx="16" cy="8" r="3"/><path d="M2 16h12"/></svg>`;
    if(type==='rain')   return `<svg ${attrs}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M8 19v2M12 19v2M16 19v2"/></svg>`;
    if(type==='snow')   return `<svg ${attrs}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M12 17l-1 1 1 1 1-1-1-1zM8 17l-1 1 1 1 1-1-1-1zM16 17l-1 1 1 1 1-1-1-1z"/></svg>`;
    if(type==='storm')  return `<svg ${attrs}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M13 16l-3 5 5-4-2 5"/></svg>`;
    return               `<svg ${attrs}><path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/></svg>`;
  }
  function svgDataUri(svg){
    // Remove newlines for maximum compatibility, then encode
    const clean = svg.replace(/\s+/g,' ').trim();
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(clean);
  }
  function wxIcon(code){
    const map = {0:'sunny',1:'sunny',2:'partly',3:'cloud',45:'fog',48:'fog',51:'drizzle',53:'drizzle',55:'drizzle',
                 61:'rain',63:'rain',65:'rain',66:'rain',67:'rain',71:'snow',73:'snow',75:'snow',77:'snow',
                 80:'rain',81:'rain',82:'rain',85:'snow',86:'snow',95:'storm',96:'storm',99:'storm'};
    const t = map[code] || 'cloud';
    return svgDataUri(iconSvg(t));
  }

  async function loadWeather(){
    const sec = document.getElementById('work');
    if (!sec) return;
    injectStyles();
    ensureHeader();

    let lat = 60.33, lon = 11.26; // Eidsvoll fallback
    try{
      const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:5000}));
      lat = +pos.coords.latitude.toFixed(4);
      lon = +pos.coords.longitude.toFixed(4);
    }catch{}

    try{
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
      const j = await r.json();
      const t = Math.round(j.current.temperature_2m);
      const code = j.current.weather_code;

      const descMap = {0:'Klar himmel',1:'Hovedsakelig klar',2:'Delvis skyet',3:'Overskyet',45:'Tåke',48:'Ise-tåke',
                       51:'Lett yr',53:'Yr',55:'Kraftig yr',61:'Lett regn',63:'Regn',65:'Kraftig regn',66:'Underkjølt regn',
                       67:'Kraftig underkjølt regn',71:'Lett snø',73:'Snø',75:'Kraftig snø',77:'Snøfnugg',80:'Regnbyger',
                       81:'Kraftige regnbyger',82:'Meget kraftige regnbyger',85:'Snøbyger',86:'Kraftige snøbyger',
                       95:'Torden',96:'Torden med hagl',99:'Torden med kraftig hagl'};

      const ic = document.getElementById('wx_icon');
      const tp = document.getElementById('wx_temp');
      const ds = document.getElementById('wx_desc');
      if (ic) ic.src = wxIcon(code);
      if (tp) tp.textContent = t + '°';
      if (ds) ds.textContent = descMap[code] || 'Vær';
    }catch(e){ /* leave placeholders */ }
  }

  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(loadWeather);
  window.addEventListener('hashchange', loadWeather);
  setTimeout(loadWeather, 800);
})();
