// docs/del-E.js
// Admin: rediger navn/gruppe, avkryss Snø/Grus, koordinater (lat/lon), flytt opp/ned, lagre + innstillinger (v10.1a)
(function () {
  const $ = (s) => document.querySelector(s);
  const BIN = window.APP_CFG?.BIN_ID;

  const els = {
    list:   $('#adm_list'),
    reload: $('#adm_reload'),
    save:   $('#adm_save'),
    status: $('#adm_status'),
    stGrus: $('#st_grus'),
    stDies: $('#st_diesel'),
    stBase: $('#st_base'),
    stSave: $('#st_save_settings'),
    stMsg:  $('#st_settings_msg'),
  };

  const S = { cloud:null, addresses:[] };

  async function getLatest(){
    const ok = window.JSONBIN?.checkConfigOrWarn?.(); if(!ok) throw new Error('Mangler konfig/nøkkel');
    const r = await window.JSONBIN.apiFetch(`b/${BIN}/latest`);
    const j = await r.json(); return j && j.record ? j.record : j;
  }

  async function putAll(nextAddresses, nextSettings){
    const base = S.cloud || await getLatest();
    const payload = {
      version: window.APP_CFG?.APP_VER || '10.x',
      updated: Date.now(),
      by: (JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}')?.driver || 'admin'),
      season: base.season || '',
      addresses: nextAddresses,
      statusSnow: base.statusSnow || base.status || {},
      statusGrit: base.statusGrit || {},
      settings: nextSettings,
      serviceLogs: Array.isArray(base?.serviceLogs)?base.serviceLogs:[],
      backups: Array.isArray(base?.backups)?base.backups:[]
    };
    await window.JSONBIN.apiFetch(`b/${BIN}`,{method:'PUT',body:JSON.stringify(payload)});
  }

  function renderList(){
    const frag = document.createDocumentFragment();
    S.addresses.forEach((a, idx)=>{
      const li=document.createElement('li');
      li.className='sort-item'; li.setAttribute('data-idx',String(idx));
      const snow = a.flags ? !!a.flags.snow : (a.task ? true : true);
      const grit = a.flags ? !!a.flags.grit : (a.task==='Snø og grus'||a.task==='Grus');

      const lat = (typeof a.lat==='number') ? a.lat : (a.coords && a.coords.split(',')[0] ? a.coords.split(',')[0].trim() : '');
      const lon = (typeof a.lon==='number') ? a.lon : (a.coords && a.coords.split(',')[1] ? a.coords.split(',')[1].trim() : '');

      li.innerHTML = `
        <div class="item-row">
          <div class="main">
            <div class="name">${a.name||''}</div>
            <div class="inline-edit">
              <label>Navn: <input class="inp-name" type="text" value="${(a.name||'').replace(/"/g,'&quot;')}"></label>
              <label>Gruppe: <input class="inp-group" type="text" value="${(a.group||'').replace(/"/g,'&quot;')}"></label>
              <label>Snø: <input class="chk-snow" type="checkbox" ${snow?'checked':''}></label>
              <label>Grus: <input class="chk-grit" type="checkbox" ${grit?'checked':''}></label>
              <label>Lat: <input class="inp-lat short" type="text" inputmode="decimal" value="${lat||''}"></label>
              <label>Lon: <input class="inp-lon short" type="text" inputmode="decimal" value="${lon||''}"></label>
            </div>
            <div class="meta small">Koordinater brukes for NAVIGER. Hvis tomme, søkes det på navn.</div>
          </div>
          <label class="active-toggle small">
            <input class="chk-active" type="checkbox" ${a.active!==false?'checked':''}/> Aktiv
          </label>
          <div class="moves">
            <button class="btn btn-ghost btn-move" data-move="up"   title="Flytt opp">⬆️</button>
            <button class="btn btn-ghost btn-move" data-move="down" title="Flytt ned">⬇️</button>
          </div>
        </div>
      `;

      li.querySelector('.inp-name').addEventListener('input', ev=>{ a.name=ev.target.value; li.querySelector('.name').textContent=a.name||''; });
      li.querySelector('.inp-group').addEventListener('input', ev=>{ a.group=ev.target.value; });
      li.querySelector('.chk-snow').addEventListener('change', ev=>{ a.flags=a.flags||{}; a.flags.snow=!!ev.target.checked; });
      li.querySelector('.chk-grit').addEventListener('change', ev=>{ a.flags=a.flags||{}; a.flags.grit=!!ev.target.checked; });
      li.querySelector('.chk-active').addEventListener('change', ev=>{ a.active=!!ev.target.checked; });
      li.querySelector('.inp-lat').addEventListener('input', ev=>{ const v=ev.target.value.trim(); a.lat=(v===''?undefined:parseFloat(v)); syncCoords(a); });
      li.querySelector('.inp-lon').addEventListener('input', ev=>{ const v=ev.target.value.trim(); a.lon=(v===''?undefined:parseFloat(v)); syncCoords(a); });

      li.querySelectorAll('.btn-move').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const dir=btn.getAttribute('data-move');
          const from=idx; const to=dir==='up'?idx-1:idx+1;
          if(to<0||to>=S.addresses.length) return;
          const item=S.addresses.splice(from,1)[0];
          S.addresses.splice(to,0,item);
          renderList();
          els.status.textContent=`Flyttet: ${item.name} → pos ${to+1}`;
        });
      });

      frag.appendChild(li);
    });
    els.list.innerHTML=''; els.list.appendChild(frag);
  }

  function syncCoords(a){
    if(typeof a.lat==='number' && typeof a.lon==='number'){
      a.coords = `${a.lat},${a.lon}`;
    }else{
      delete a.coords;
    }
  }

  async function reload(){
    try{
      els.status.textContent='Henter…'; els.save.disabled=true;
      S.cloud=await getLatest();
      const raw = Array.isArray(S.cloud?.addresses)?S.cloud.addresses:(S.cloud?.snapshot?.addresses||[]);
      S.addresses = raw.map(x=>{
        const snow = x.flags?!!x.flags.snow:(x.task?true:true);
        const grit = x.flags?!!x.flags.grit:(x.task==='Snø og grus'||x.task==='Grus');
        let lat = (typeof x.lat==='number')?x.lat:undefined;
        let lon = (typeof x.lon==='number')?x.lon:undefined;
        if((lat===undefined||lon===undefined) && typeof x.coords==='string' && x.coords.includes(',')){
          const [a,b]=x.coords.split(','); lat=parseFloat(a); lon=parseFloat(b);
          if(Number.isNaN(lat)) lat=undefined; if(Number.isNaN(lon)) lon=undefined;
        }
        return {...x, flags:{snow,grit}, lat, lon};
      });
      renderList();

      // settings
      const def = {grusDepot:"60.2527264,11.1687230", diesel:"60.2523185,11.1899926", base:"60.2664414,11.2208819"};
      const st = {...def, ...(S.cloud.settings||{})};
      if(els.stGrus) els.stGrus.value = st.grusDepot||'';
      if(els.stDies) els.stDies.value = st.diesel||'';
      if(els.stBase) els.stBase.value = st.base||'';

      els.status.textContent=`Hentet ${S.addresses.length} adresser. Rediger, flytt og lagre.`;
    }catch(e){ console.error(e); els.status.textContent='Feil: '+e.message; alert('Kunne ikke hente fra sky.'); }
    finally{ els.save.disabled=false; }
  }

  async function saveAll(){
    try{
      els.status.textContent='Lagrer…'; els.save.disabled=true;
      const next=S.addresses.map(a=>{
        const flags={ snow: a.flags?!!a.flags.snow:true, grit: a.flags?!!a.flags.grit:false };
        let lat=(typeof a.lat==='number')?a.lat:undefined;
        let lon=(typeof a.lon==='number')?a.lon:undefined;
        const coords = (typeof lat==='number' && typeof lon==='number') ? `${lat},${lon}` : undefined;
        return {...a, flags, lat, lon, coords};
      });
      const nextSettings={
        grusDepot: (els.stGrus?.value||'').trim(),
        diesel: (els.stDies?.value||'').trim(),
        base: (els.stBase?.value||'').trim()
      };
      await putAll(next, nextSettings);
      els.status.textContent='OK – lagret.';
      els.stMsg && (els.stMsg.textContent='Lagret.');
      setTimeout(()=>{ if(els.stMsg) els.stMsg.textContent=''; }, 1200);
    }catch(e){ console.error(e); els.status.textContent='Feil: '+e.message; alert('Kunne ikke lagre.'); }
    finally{ els.save.disabled=false; }
  }

  function bind(){
    if(!els.reload||!els.save||!els.list) return;
    els.reload.addEventListener('click',reload);
    els.save.addEventListener('click',saveAll);
    if(location.hash==='#admin') reload();
    window.addEventListener('hashchange',()=>{ if(location.hash==='#admin') reload(); });
  }
  bind();
})();