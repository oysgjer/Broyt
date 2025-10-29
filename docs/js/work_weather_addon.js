// work_weather_addon.js — inline SVG weather, theme-aware, stronger stroke + fallback
(function(){
  const $ = (s,root=document)=>root.querySelector(s);

  function prefersDark(){
    try{ return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch{ return false; }
  }

  function applyWxColor() {
    const el = document.getElementById('wx_icon');
    if (!el) return;
    // Bruk currentColor i SVG — sett farge her:
    el.style.color = prefersDark() ? '#f3f4f6' : '#111827';
  }

  function injectStyles(){
    if (document.getElementById('wx_hdr_style')) return;
    const st = document.createElement('style');
    st.id = 'wx_hdr_style';
    st.textContent = `
      .work-header-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px}
      .work-title{margin:0}
      .wx-row{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      #wx_icon{display:inline-flex;width:22px;height:22px;line-height:0;vertical-align:middle;z-index:1}
      #wx_icon svg{width:22px;height:22px;display:block}
      @media (max-width:520px){.work-header-row{flex-wrap:wrap}}
    `;
    document.head.appendChild(st);
  }

  function ensureHeader(){
    const sec = document.getElementById('work'); if(!sec) return;
    let hdr = sec.querySelector('.work-header-row');
    if(!hdr){
      hdr = document.createElement('div'); hdr.className='work-header-row';
      const h1 = document.createElement('h1'); h1.className='work-title'; h1.textContent='Under arbeid';
      const wx = document.createElement('div'); wx.id='wx_row'; wx.className='wx-row';
      wx.innerHTML = `<span id="wx_icon" aria-hidden="true"></span><span id="wx_temp">--°</span><span id="wx_desc" class="muted"></span>`;
      hdr.appendChild(h1); hdr.appendChild(wx);
      sec.insertAdjacentElement('afterbegin', hdr);
    } else {
      // oppgrader evt. gammel <img id="wx_icon">
      const wx = hdr.querySelector('#wx_row') || hdr;
      const ico = wx.querySelector('#wx_icon');
      if(!ico){
        const span = document.createElement('span'); span.id='wx_icon'; span.setAttribute('aria-hidden','true');
        wx.insertAdjacentElement('afterbegin', span);
      } else if (ico.tagName === 'IMG') {
        const span = document.createElement('span'); span.id='wx_icon'; span.setAttribute('aria-hidden','true');
        ico.replaceWith(span);
      }
    }
  }

  // Bygg SVG med stroke=currentColor og litt kraftigere strek
  function svgWrap(body){
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
                 role="img" aria-label="værikon">${body}</svg>`;
  }
  function iconSvg(kind){
    if(kind==='sunny')  return svgWrap(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`);
    if(kind==='partly') return svgWrap(`<path d="M4 15a4 4 0 0 1 4-4h.5"/><circle cx="16" cy="8" r="3"/><path d="M2 16h12"/>`);
    if(kind==='rain')   return svgWrap(`<path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M8 19v2M12 19v2M16 19v2"/>`);
    if(kind==='snow')   return svgWrap(`<path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M12 17l-1 1 1 1 1-1-1-1zM8 17l-1 1 1 1 1-1-1-1zM16 17l-1 1 1 1 1-1-1-1z"/>`);
    if(kind==='storm')  return svgWrap(`<path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/><path d="M13 16l-3 5 5-4-2 5"/>`);
    return               svgWrap(`<path d="M4 15a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4"/>`);
  }
  function pickType(code){
    const map={0:'sunny',1:'sunny',2:'partly',3:'cloud',45:'fog',48:'fog',51:'drizzle',53:'drizzle',55:'drizzle',
               61:'rain',63:'rain',65:'rain',66:'rain',67:'rain',71:'snow',73:'snow',75:'snow',77:'snow',
               80:'rain',81:'rain',82:'rain',85:'snow',86:'snow',95:'storm',96:'storm',99:'storm'};
    return map[code]||'cloud';
  }

  async function loadWeather(){
    const sec = document.getElementById('work'); if (!sec) return;
    injectStyles(); ensureHeader(); applyWxColor();

    let lat=60.33, lon=11.26;
    try{
      const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:5000}));
      lat=+pos.coords.latitude.toFixed(4); lon=+pos.coords.longitude.toFixed(4);
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

      const icon = document.getElementById('wx_icon');
      const temp = document.getElementById('wx_temp');
      const desc = document.getElementById('wx_desc');

      if (icon) icon.innerHTML = iconSvg(pickType(code));
      if (temp) temp.textContent = t + '°';
      if (desc) desc.textContent = descMap[code] || 'Vær';
    }catch{
      // Fallback: enkel emoji så bruker ser noe
      const icon = document.getElementById('wx_icon'); if (icon && !icon.innerHTML) icon.textContent = '⛅';
    }
  }

  // re-render ved temabytte
  if (window.matchMedia){
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    const onchg=()=>{ applyWxColor(); const ico=$('#wx_icon svg'); if(ico){ ico.style.stroke='currentColor'; } };
    if (mq.addEventListener) mq.addEventListener('change', onchg);
    else if (mq.addListener) mq.addListener(onchg);
  }

  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(loadWeather);
  window.addEventListener('hashchange', loadWeather);
  setTimeout(loadWeather, 800);
})();
