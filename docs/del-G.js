// ===== del-G.js (Admin – katalog-editor) =====
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del G."); return; }
  const C = Core;

  const Admin = (window.Admin = {
    state:{ addresses:[], updated:0 },

    init(){ document.addEventListener('DOMContentLoaded', Admin.render); },

    ui(){
      return `
        <h2>Admin</h2>
        <div class="small" id="admSync" style="color:#9aa4af;margin-bottom:10px">Sist synk: —</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button id="admLoad" class="btn btn-gray">⟳ Last katalog</button>
          <button id="admAdd" class="btn btn-blue">➕ Legg til</button>
          <button id="admSave" class="btn btn-green">💾 Lagre (med backup)</button>
          <button id="admPublish" class="btn btn-blue">🚀 Publiser til MASTER</button>
          <button id="admExport" class="btn btn-gray">⬇︎ Eksporter CSV</button>
          <button id="admRestore" class="btn btn-red">⏪ Gjenopprett fra backup</button>
        </div>
        <div class="small" id="admMsg" style="color:#9aa4af;margin-bottom:8px">—</div>
        <div id="admList"></div>
      `;
    },

    render(){
      const host = document.getElementById('admin');
      if (!host) return;
      host.innerHTML = Admin.ui();
      Admin.paint();

      // handlers
      host.querySelector('#admLoad').onclick    = Admin.load;
      host.querySelector('#admAdd').onclick     = ()=>{ Admin.state.addresses.push({name:'',task:C.cfg.DEFAULT_TASKS[0],active:true,twoDriverRec:false,pinsCount:0}); Admin.paint(); };
      host.querySelector('#admSave').onclick    = Admin.saveWithBackup;
      host.querySelector('#admPublish').onclick = Admin.publishToMaster;
      host.querySelector('#admExport').onclick  = Admin.exportCsv;
      host.querySelector('#admRestore').onclick = Admin.restore;
    },

    paint(){
      const host = document.getElementById('admList'); if (!host) return;
      const A = Admin.state.addresses||[];
      document.getElementById('admMsg').textContent = `Rader: ${A.length}`;

      if (!A.length){
        host.innerHTML = `<div class="small" style="color:#9aa4af">– tom katalog –</div>`;
        return;
      }

      const opt = C.cfg.DEFAULT_TASKS.map(t=>`<option value="${C.esc(t)}">${C.esc(t)}</option>`).join('');

      host.innerHTML = A.map((row,i