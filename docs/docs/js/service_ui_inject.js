// docs/js/service_ui_inject.js — injiserer visning av sjåfør + e-postknapp i Service-seksjonen
(function(){
  function ensureServiceUI(){
    const svc = document.getElementById('service');
    if (!svc) return;
    if (svc.querySelector('#svc_driver_name')) return; // allerede lagt inn

    const block = document.createElement('div');
    block.innerHTML = `
      <div class="card" id="svc_header_block" style="margin:8px 0; padding:10px">
        <div class="row" style="align-items:center; gap:12px;">
          <div>
            <div class="label-muted">Sjåfør</div>
            <div id="svc_driver_name" class="muted-strong">—</div>
          </div>
          <div style="flex:1"></div>
          <button id="svc_mail" class="btn btn-ghost" type="button">✉️ Send på e-post</button>
        </div>
      </div>
    `;
    // plasser øverst i sekjsonen
    svc.insertBefore(block.firstElementChild, svc.firstChild);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', ensureServiceUI, {once:true});
  else ensureServiceUI();
})();