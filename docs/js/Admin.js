/* Admin.js – enkel adminpanel:
   - Lagre hurtigdestinasjoner (grus/diesel/base)
   - Seed demo-adresser lokalt
   - Tøm status / nullstill alt
*/
(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const SEC = $('#admin');
  if (!SEC) return;

  SEC.innerHTML = `
    <h1>Admin</h1>

    <div class="card">
      <div class="field"><span>Grus (lat,lon)</span><input id="adm_grus"  class="input" placeholder="60.xxxxx, 11.xxxxx"></div>
      <div class="field"><span>Diesel (lat,lon)</span><input id="adm_diesel"class="input" placeholder="60.xxxxx, 11.xxxxx"></div>
      <div class="field"><span>Base (lat,lon)</span><input id="adm_base"  class="input" placeholder="60.xxxxx, 11.xxxxx"></div>
      <button class="btn" id="adm_save">Lagre</button>
    </div>

    <div class="card">
      <div class="row" style="gap:8px; flex-wrap:wrap">
        <button class="btn btn-ghost" id="seed_demo">Seed demo-adresser</button>
        <button class="btn btn-ghost" id="clear_status">Tøm status</button>
        <button class="btn btn-ghost" id="nuke_all">Nullstill ALT (lokalt)</button>
      </div>
      <p class="muted" style="margin-top:8px">Alt lagres kun i nettleseren (localStorage) i denne versjonen.</p>
    </div>
  `;

  // Last inn eksisterende hurtigdestinasjoner
  try{
    const st = JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}');
    $('#adm_grus').value   = st.grus   || '';
    $('#adm_diesel').value = st.diesel || '';
    $('#adm_base').value   = st.base   || '';
  }catch{}

  // Lagre hurtigdestinasjoner
  $('#adm_save')?.addEventListener('click', ()=>{
    const st = {
      grus:   $('#adm_grus').value.trim(),
      diesel: $('#adm_diesel').value.trim(),
      base:   $('#adm_base').value.trim(),
    };
    localStorage.setItem('BRYT_SETTINGS', JSON.stringify(st));
    alert('Lagret.');
  });

  // Seed demo-adresser (gjør både S.* og BRYT_ADDR)
  $('#seed_demo')?.addEventListener('click', ()=>{
    const demo = [
      { id:'A1', name:'Tunlandvegen',    lat:63.422, lon:10.401 },
      { id:'A2', name:'Sessvollvegen 9', lat:63.425, lon:10.407 },
      { id:'A3', name:'Stasjonsgata 3',  lat:63.428, lon:10.412 },
      { id:'A4', name:'Elveveien 17',    lat:63.431, lon:10.418 },
      { id:'A5', name:'Åsvegen 2',       lat:63.436, lon:10.425 },
    ];
    window.S = window.S || {};
    window.S.cloud = { snapshot:{ addresses: demo } };
    localStorage.setItem('BRYT_ADDR', JSON.stringify(demo));
    if (!localStorage.getItem('BRYT_STATUS')) {
      localStorage.setItem('BRYT_STATUS', JSON.stringify({}));
    }
    alert('Demo-adresser er lagt inn. Åpne «Under arbeid» eller «Status».');
  });

  // Tøm status (behold adresser)
  $('#clear_status')?.addEventListener('click', ()=>{
    localStorage.setItem('BRYT_STATUS','{}');
    alert('Status er tømt.');
  });

  // Nullstill ALT
  $('#nuke_all')?.addEventListener('click', ()=>{
    if (!confirm('Sikker? Dette sletter alle lokale data for appen.')) return;
    localStorage.removeItem('BRYT_STATUS');
    localStorage.removeItem('BRYT_ADDR');
    localStorage.removeItem('BRYT_HOME_PREFS');
    localStorage.removeItem('BRYT_SETTINGS');
    if (window.S) { try{ delete window.S.cloud; delete window.S.addresses; }catch{} }
    alert('Alt er nullstilt lokalt.');
  });
})();