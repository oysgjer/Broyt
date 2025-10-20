/* ========= Service.js ========= */
(function () {
  const root = $('#service'); if (!root) return;
  if (root.querySelector('.svc-card')) return; // unngå duplikat

  const html = `
    <div class="svc-card card" style="margin-top:12px">
      <h3 class="muted" style="margin:0 0 8px">Smøring</h3>
      <label class="row"><input type="checkbox" id="svc_skj"> Skjær smurt</label>
      <label class="row"><input type="checkbox" id="svc_fres"> Fres smurt</label>
      <label class="row"><input type="checkbox" id="svc_for"> Forstilling smurt</label>
    </div>

    <div class="svc-card card">
      <h3 class="muted" style="margin:0 0 8px">Olje</h3>
      <label class="row"><input type="checkbox" id="svc_ol_f"> Olje sjekket foran</label>
      <label class="row"><input type="checkbox" id="svc_ol_b"> Olje sjekket bak</label>
      <label class="row"><input type="checkbox" id="svc_ol_e"> Olje etterfylt</label>
    </div>

    <div class="svc-card card">
      <h3 class="muted" style="margin:0 0 8px">Diesel og grus</h3>
      <label class="row"><input type="checkbox" id="svc_diesel"> Diesel fylt</label>
      <label class="field" style="width:100%">
        <span>Antall kasser grus:</span>
        <input id="svc_kasser" class="input" inputmode="numeric" placeholder="f.eks. 2 kasser">
      </label>
    </div>

    <div class="svc-card card">
      <h3 class="muted" style="margin:0 0 8px">Annet</h3>
      <textarea id="svc_annet" class="input" rows="4" placeholder="Skriv eventuelle kommentarer..."></textarea>
    </div>
  `;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  root.appendChild(wrap);

  // (Senere: send til e-post/JSONBin – hook legges her.)
})();