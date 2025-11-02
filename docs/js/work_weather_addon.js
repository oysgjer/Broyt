// js/work_weather_addon.js
// Work er fasit for vær. Vi speiler "nå + neste 3 timer" til localStorage,
// slik at Home kan vise nøyaktig det samme.

(function(){
  const row = document.getElementById('wx_row');
  if (!row) return;

  function saveSnapshot(snap){
    try {
      localStorage.setItem('WX_LATEST', JSON.stringify(snap));
      window.dispatchEvent(new CustomEvent('wx:update', { detail: snap }));
    } catch(e){
      console.warn('WX_LATEST: klarte ikke lagre', e);
    }
  }

  function ds(key){ return row?.dataset ? row.dataset[key] : undefined; }

  function parseH(s){
    if (!s) return null;
    const [t, temp, desc] = String(s).split('|');
    if (!t) return null;
    return { t, temp: Number(temp), desc };
  }

  // Prøv å bygge snapshot fra data-attributter eller fra tekst i wx_row
  function snapshotFromDom(){
    const nowTemp = ds('temp') || '';
    const nowDesc = ds('desc') || '';

    const h1 = parseH(ds('h1'));
    const h2 = parseH(ds('h2'));
    const h3 = parseH(ds('h3'));
    const hourly = [h1, h2, h3].filter(Boolean);

    // Dersom dataset ikke finnes, prøv å tolke enkel tekst: "2° Lett snø" + "14:00 • 2° …"
    // (holder det veldig konservativt – dataset er anbefalt)
    let now = { temp: nowTemp, desc: nowDesc };
    if (!nowTemp && !nowDesc){
      const txt = row.textContent.trim();
      // veldig enkel heuristikk – dataset gir bedre resultat
      const m = txt.match(/(-?\d+)\s*°\s*([^\n•]+)/);
      if (m) now = { temp: `${m[1]}°`, desc: m[2].trim() };
    }

    return {
      at: Date.now(),
      source: 'work_weather_addon',
      now,
      hourly
    };
  }

  // Kalles av Work.js når vær hentes (anbefalt)
  //   now = { temp:"2°", desc:"Lett snø" }
  //   hourly = [{t:"ISO", temp:2, desc:"..."}, ...] (0..3)
  function setFromWork(now, hourly){
    if (row){
      row.dataset.temp = now?.temp || '';
      row.dataset.desc = now?.desc || '';
      ['h1','h2','h3'].forEach((k,i)=>{
        const h = hourly?.[i];
        row.dataset[k] = h ? `${h.t}|${h.temp}|${h.desc}` : '';
      });
    }
    saveSnapshot({
      at: Date.now(),
      source: 'work_weather_addon',
      now: now || { temp:'', desc:'' },
      hourly: (hourly || []).slice(0,3)
    });
  }

  // Eksponer for Work.js
  window.WX = Object.assign({}, window.WX, { set: setFromWork });

  // Lag et første snapshot fra DOM (fallback om WX.set ikke kalles)
  saveSnapshot(snapshotFromDom());

  // Hold øye med endringer på #wx_row (tekst eller dataset)
  const mo = new MutationObserver(() => {
    saveSnapshot(snapshotFromDom());
  });
  mo.observe(row, {
    childList: true, subtree: true,
    attributes: true,
    attributeFilter: ['data-temp','data-desc','data-h1','data-h2','data-h3']
  });
})();