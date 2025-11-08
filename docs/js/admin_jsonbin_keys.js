// js/admin_jsonbin_keys.js — enkel nøkkel-administrasjon i Admin-seksjonen
(() => {
  'use strict';

  const getMK = () =>
    (localStorage.getItem('X-Master-Key') ||
     localStorage.getItem('x-master-key') ||
     localStorage.getItem('jsonbin_master_key') || '').trim();
  const getAK = () =>
    (localStorage.getItem('X-Access-Key') ||
     localStorage.getItem('x-access-key') ||
     localStorage.getItem('jsonbin_access_key') || '').trim();
  const setMK = (v)=> ['X-Master-Key','x-master-key','jsonbin_master_key'].forEach(k=>localStorage.setItem(k, v));
  const setAK = (v)=> ['X-Access-Key','x-access-key','jsonbin_access_key'].forEach(k=>localStorage.setItem(k, v));

  function inject(){
    const admin = document.getElementById('admin');
    if (!admin) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '12px';
    card.innerHTML = `
      <h2 style="margin:0 0 8px">JSONBin-nøkler</h2>
      <p class="muted" style="margin:0 0 8px">Legg inn X-Master-Key (og ev. X-Access-Key). Lagres lokalt i nettleseren.</p>
      <label class="field">
        <span>X-Master-Key</span>
        <input id="kbMaster_inp" class="input" type="password" placeholder="— lim inn —" />
      </label>
      <label class="field" style="margin-top:8px">
        <span>(Valgfritt) X-Access-Key</span>
        <input id="kbAccess_inp" class="input" type="password" placeholder="— hvis bin krever det —" />
      </label>
      <div class="row" style="gap:10px; margin-top:10px">
        <button id="kbSave" class="btn">Lagre nøkler</button>
        <button id="kbClear" class="btn-ghost">Tøm</button>
      </div>
    `;
    admin.appendChild(card);

    const m = card.querySelector('#kbMaster_inp');
    const a = card.querySelector('#kbAccess_inp');

    m.value = getMK();
    a.value = getAK();

    card.querySelector('#kbSave').addEventListener('click', ()=>{
      setMK(m.value.trim() || '');
      setAK(a.value.trim() || '');
      alert('Nøkler lagret.');
    });
    card.querySelector('#kbClear').addEventListener('click', ()=>{
      setMK(''); setAK('');
      m.value=''; a.value='';
      alert('Nøkler fjernet.');
    });
  }

  document.addEventListener('DOMContentLoaded', inject);
})();
