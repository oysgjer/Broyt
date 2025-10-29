/* quicklinks.js – Hurtigvalg + Admin-felt for faste posisjoner */
(function(){
  const KEYS = {
    grus:   'QK_GRUS',
    diesel: 'QK_DIESEL',
    base:   'QK_BASE'
  };

  function read() {
    return {
      grus:   localStorage.getItem(KEYS.grus)   || '',
      diesel: localStorage.getItem(KEYS.diesel) || '',
      base:   localStorage.getItem(KEYS.base)   || ''
    };
  }
  function save(k,v){ if(v) localStorage.setItem(KEYS[k], v.trim()); }

  function toMapsUrl(v){
    if(!v) return '';
    const s=v.trim();
    if(/^https?:/i.test(s)) return s;
    if(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s))
      return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s);
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s);
  }

  function openLoc(k){
    const val = localStorage.getItem(KEYS[k]);
    if(!val){ alert('Ingen lagret posisjon for '+k+'. Sett den i Admin.'); return; }
    window.open(toMapsUrl(val),'_blank');
  }

  function bindMenu(){
    const ids=['grus','diesel','base'];
    ids.forEach(k=>{
      const btn=document.getElementById('qk_'+k);
      if(!btn||btn.dataset.bound)return;
      btn.dataset.bound=1;
      btn.addEventListener('click',()=>openLoc(k));
    });
  }

  /* ---------- Admin integrasjon ---------- */
  function addAdminFields(){
    const admin=document.getElementById('admin');
    if(!admin) return;
    const box=document.createElement('div');
    box.className='card';
    box.innerHTML=`
      <h2>Hurtigvalg-lokasjoner</h2>
      <p>Angi koordinater (lat,lon) eller adresse/lenke.</p>
      <label class="field">Hent grus<input id="adm_grus" class="input" placeholder="60.3251, 11.2623"></label>
      <label class="field">Diesel<input id="adm_diesel" class="input" placeholder="60.315, 11.287"></label>
      <label class="field">Base<input id="adm_base" class="input" placeholder="Eidsvoll verk"></label>
      <button id="adm_saveQuick" class="btn">💾 Lagre hurtigvalg</button>
    `;
    admin.appendChild(box);

    const vals=read();
    ['grus','diesel','base'].forEach(k=>{
      const el=document.getElementById('adm_'+k);
      if(el) el.value=vals[k];
    });

    document.getElementById('adm_saveQuick').addEventListener('click',()=>{
      ['grus','diesel','base'].forEach(k=>{
        const v=document.getElementById('adm_'+k).value;
        save(k,v);
      });
      alert('Lagret. Knapper i menyen bruker nå disse lokasjonene.');
    });
  }

  /* init */
  function init(){ bindMenu(); addAdminFields(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
