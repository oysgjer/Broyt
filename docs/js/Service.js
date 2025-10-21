// ===== SERVICE – enkel sjekklist + lagring =====
(() => {
  const host = $('#service');   // section id="service"

  // Fyll inn markup hvis tom (robust mot tidligere html)
  if (host && host.querySelectorAll('.card').length === 0) {
    host.innerHTML = `
      <h1>Service</h1>

      <div class="card">
        <div class="card-title">Smøring</div>
        <label class="row"><input type="checkbox" id="sv_skj"> Skjær smurt</label>
        <label class="row"><input type="checkbox" id="sv_fres"> Fres smurt</label>
        <label class="row"><input type="checkbox" id="sv_front"> Forstilling smurt</label>
      </div>

      <div class="card">
        <div class="card-title">Olje</div>
        <label class="row"><input type="checkbox" id="sv_o_f"> Olje sjekket foran</label>
        <label class="row"><input type="checkbox" id="sv_o_b"> Olje sjekket bak</label>
        <label class="row"><input type="checkbox" id="sv_o_top"> Olje etterfylt</label>
      </div>

      <div class="card">
        <div class="card-title">Diesel og grus</div>
        <label class="row"><input type="checkbox" id="sv_diesel"> Diesel fylt</label>
        <label class="field">
          <span>Antall kasser grus:</span>
          <input class="input" id="sv_kasser" placeholder="f.eks. 2 kasser">
        </label>
      </div>

      <div class="card">
        <div class="card-title">Annet</div>
        <textarea class="input" id="sv_annet" rows="3" placeholder="Skriv eventuelle kommentarer..."></textarea>
      </div>

      <button class="btn" id="sv_save">Lagre service</button>
    `;
  }

  const ids = ['sv_skj','sv_fres','sv_front','sv_o_f','sv_o_b','sv_o_top','sv_diesel','sv_kasser','sv_annet'];

  // load
  function load() {
    try{
      const st = JSON.parse(localStorage.getItem('BRYT_SERVICE')||'{}');
      ids.forEach(id=>{
        const el = $('#'+id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!st[id];
        else el.value = st[id] || '';
      });
    }catch(e){}
  }
  // save
  function save() {
    const st = {};
    ids.forEach(id=>{
      const el = $('#'+id);
      if (!el) return;
      st[id] = (el.type === 'checkbox') ? !!el.checked : (el.value||'');
    });
    localStorage.setItem('BRYT_SERVICE', JSON.stringify(st));
  }

  $('#sv_save')?.addEventListener('click', ()=>{
    save();
    alert('Service lagret.');
    // TODO: etter bekreftelse kan vi sende e-post via webhook – når du ønsker.
  });

  document.addEventListener('page:shown', (e)=>{ if (e.detail.id==='service') load(); });
  if ((location.hash||'#').includes('service')) load();
})();