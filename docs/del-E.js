// docs/del-E.js
// Admin: rediger navn/gruppe/oppdrag (Snø/Grus) + flytt opp/ned + lagre + innstillinger (v10.0a)
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

  function equipForTask(task){ return task==='Grus' ? ['stro'] : ['fres']; } // “Grus” ⇒ stro, “Snø” ⇒ fres (kan justeres)

  async function getLatest(){
    const ok = window.JSONBIN?.checkConfigOrWarn?.(); if(!ok) throw new Error('Mangler konfig/nøkkel');
    const r = await window.JSONBIN.apiFetch(`b/${BIN}/latest`);
    const j = await r.json(); return j && j.record ? j.record : j;
  }

  async function putAddressesAndSettings(nextAddresses){
    const base = S.cloud || await getLatest();
    const payload = {
      version: window.APP_CFG?.APP_VER || '10.x',
      updated: Date.now(),
      by: (JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}')?.driver || 'admin'),
      season: base.season || '',
      addresses: nextAddresses,
      status: base.status || {},
      settings: base.settings || {},
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
      const taskVal = (a.task==='Grus')?'Grus':'Snø';
      li.innerHTML = `
        <div class="item-row">
          <div class="main">
            <div class="name">${a.name||''}</div>
            <div class="inline-edit">
              <label>Navn: <input class="inp-name" type="text" value="${(a.name||'').replace(/"/g,'&quot;')}"></label>
              <label>Gruppe: <input class="inp-group" type="text" value="${(a.group||'').replace(/"/g,'&quot;')}"></label>
              <label>Oppdrag:
                <select class="sel-task">
                  <option ${taskVal==='Snø'?'selected':''}>Snø</option>
                  <option ${taskVal==='Grus'?'selected':''}>Grus</option>
                </select>
              </label>
            </div>
            <div class="meta small">Utstyr foreslås fra Oppdrag.</div>
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
      li.querySelector('.sel-task').addEventListener('change', ev=>{ a.task=ev.target.value; a.equipment=equipForTask(a.task); });
      li.querySelector('.chk-active').addEventListener('change', ev=>{ a.active=!!ev.target.checked; });

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

  async function reload(){
    try{
      els.status.textContent='Henter…'; els.save.disabled=true;
      S.cloud=await getLatest();
      const raw = Array.isArray(S.cloud?.addresses)?S.cloud.addresses:(S.cloud?.snapshot?.addresses||[]);
      // map til Snø/Grus kun
      S.addresses = raw.map(x=>({...x, task: (x.task==='Grus'?'Grus':'Snø') }));
      renderList();
      els.status.textContent=`Hentet ${S.addresses.length} adresser. Rediger, flytt og lagre.`;

      // last settings
      const st=S.cloud.settings||{};
      if(els.stGrus)  els.stGrus.value  = st.grusDepot||'';
      if(els.stDies)  els.stDies.value  = st.diesel||'';
      if(els.stBase)  els.stBase.value  = st.base||'';
    }catch(e){ console.error(e); els.status.textContent='Feil: '+e.message; alert('Kunne ikke hente fra sky.'); }
    finally{ els.save.disabled=false; }
  }

  async function saveAll(){
    try{
      els.status.textContent='Lagrer…'; els.save.disabled=true;
      const next=S.addresses.map(a=>{const t=(a.task==='Grus')?'Grus':'Snø'; return {...a,task:t,equipment:equipForTask(t)};});
      // oppdater også innstillinger
      S.cloud.settings=S.cloud.settings||{};
      S.cloud.settings.grusDepot = els.stGrus?.value.trim()||'';
      S.cloud.settings.diesel    = els.stDies?.value.trim()||'';
      S.cloud.settings.base      = els.stBase?.value.trim()||'';
      await putAddressesAndSettings(next);
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