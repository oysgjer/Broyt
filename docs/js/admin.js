/* =========================================================
   Brøyterute – Admin modul
   v10.4.13
   - Samhandler med del-d.js (JSONBIN)
   - Håndterer oppsett, adresser og sesong-lås
   ========================================================= */

async function ensureCloudSetupCard(){
  const g=$('#adm_geturl'), p=$('#adm_puturl'), st=$('#adm_urls_status');
  if(g) g.value = localStorage.getItem('BROYT_BIN_URL')||'';
  if(p) p.value = localStorage.getItem('BROYT_BIN_PUT')||'';
  if(st) st.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';

  $('#adm_urls_save')?.addEventListener('click', ()=>{
    const gg=g?.value.trim()||''; const pp=p?.value.trim()||'';
    JSONBIN.setUrlPair(gg,pp);
    st.textContent = JSONBIN.hasAll() ? 'Sky-oppsett: OK' : 'Mangler noe…';
  });

  $('#adm_urls_clear')?.addEventListener('click', ()=>{
    ['BROYT_BIN_URL','BROYT_BIN_PUT'].forEach(k=>localStorage.removeItem(k));
    if(g) g.value=''; if(p) p.value='';
    st.textContent='URL-er fjernet';
  });
}

function renderAdminAddresses(){
  const tb=$('#adm_addr_tbody'); if(!tb) return;
  tb.innerHTML='';
  const locked=!!(S.cloud.settings&&S.cloud.settings.stakesLocked);
  (S.cloud.snapshot.addresses||[]).forEach((a,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="adm-active"></td>
      <td><input class="adm-name" placeholder="Adresse"></td>
      <td><input class="adm-group" placeholder="Gruppe"></td>
      <td style="text-align:center"><input type="checkbox" class="adm-snow"></td>
      <td style="text-align:center"><input type="checkbox" class="adm-grit"></td>
      <td><input class="adm-stakes" inputmode="numeric" placeholder="0" ${locked?'disabled':''}></td>
      <td><input class="adm-coords" placeholder="60.xxxxxx,11.xxxxxx"></td>
      <td>
        <div class="row" style="gap:6px">
          <button class="btn btn-ghost adm-up">⬆️</button>
          <button class="btn btn-ghost adm-down">⬇️</button>
        </div>
      </td>`;
    tb.appendChild(tr);
    tr.querySelector('.adm-active').checked = a.active!==false;
    tr.querySelector('.adm-name').value   = a.name||'';
    tr.querySelector('.adm-group').value  = a.group||'';
    tr.querySelector('.adm-snow').checked = !!((a.flags&&('snow' in a.flags)) ? a.flags.snow : true);
    tr.querySelector('.adm-grit').checked = !!(a.flags && a.flags.grit);
    tr.querySelector('.adm-stakes').value = (a.stakes!==undefined&&a.stakes!=='')?a.stakes:'';
    tr.querySelector('.adm-coords').value = a.coords||'';

    // flytt opp/ned
    tr.querySelector('.adm-up').addEventListener('click',()=>{
      if(idx<=0) return;
      const arr=S.cloud.snapshot.addresses;
      [arr[idx-1],arr[idx]]=[arr[idx],arr[idx-1]];
      renderAdminAddresses();
    });
    tr.querySelector('.adm-down').addEventListener('click',()=>{
      const arr=S.cloud.snapshot.addresses;
      if(idx>=arr.length-1) return;
      [arr[idx+1],arr[idx]]=[arr[idx],arr[idx+1]];
      renderAdminAddresses();
    });
  });
}

async function loadAdmin(){
  await ensureAddressesSeeded();
  await refreshCloud();
  ensureCloudSetupCard();

  const st=Object.assign({}, S.cloud.settings||{});
  $('#adm_grus')?.setAttribute('value', st.grusDepot||'');
  $('#adm_diesel')?.setAttribute('value', st.diesel||'');
  $('#adm_base')?.setAttribute('value', st.base||'');
  const lockBtn=$('#adm_stakes_lock');
  if(lockBtn) lockBtn.textContent=st.stakesLocked?'🔒 Låst':'🔓 Lås stikker';

  if(!Array.isArray(S.cloud.snapshot.addresses)) S.cloud.snapshot.addresses=[];
  renderAdminAddresses();
}

async function saveAdminAddresses(){
  const msg=$('#adm_addr_msg');
  try{
    const rows=$$('#adm_addr_tbody tr');
    const list=[];
    rows.forEach(tr=>{
      const active = tr.querySelector('.adm-active').checked;
      const name   = tr.querySelector('.adm-name').value.trim();
      if(!name) return;
      const group  = tr.querySelector('.adm-group').value.trim();
      const snow   = tr.querySelector('.adm-snow').checked;
      const grit   = tr.querySelector('.adm-grit').checked;
      const stakes = tr.querySelector('.adm-stakes').value.trim();
      const coords = tr.querySelector('.adm-coords').value.trim();
      list.push({active,name,group,flags:{snow,grit},stakes,coords});
    });
    S.cloud.snapshot.addresses = list;
    await saveCloud();
    if(msg) msg.textContent='✅ Lagret';
  }catch(e){
    if(msg) msg.textContent='Feil: '+(e.message||e);
  }
}

async function toggleStakesLock(){
  try{
    await refreshCloud();
    if(!S.cloud.settings) S.cloud.settings={seasonLabel:"2025–26",stakesLocked:false};
    S.cloud.settings.stakesLocked=!S.cloud.settings.stakesLocked;
    await saveCloud();
    const b=$('#adm_stakes_lock'); if(b) b.textContent=S.cloud.settings.stakesLocked?'🔒 Låst':'🔓 Lås stikker';
    renderAdminAddresses();
  }catch(e){ alert('Feil: '+(e.message||e)); }
}

function initAdmin(){
  $('#adm_key_save')?.addEventListener('click',()=>{
    const ok=JSONBIN.setKey($('#adm_key')?.value||'');
    const s=$('#adm_key_status');
    if(s) s.textContent=ok?'Lagret nøkkel.':'Ugyldig nøkkel.';
  });
  $('#adm_key_clear')?.addEventListener('click',()=>{
    JSONBIN.clearKey();
    const s=$('#adm_key_status'); if(s) s.textContent='Nøkkel fjernet.';
  });

  $('#adm_stakes_lock')?.addEventListener('click',toggleStakesLock);
  $('#adm_addr_fetch')?.addEventListener('click',loadAdmin);
  $('#adm_addr_save')?.addEventListener('click',saveAdminAddresses);
}

document.addEventListener('DOMContentLoaded', initAdmin);
