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

      host.innerHTML = A.map((row,i)=>`
        <div style="padding:10px;border:1px solid #2b3037;border-radius:10px;margin-bottom:8px;background:#111318">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input data-k="name" data-i="${i}" value="${C.esc(row.name||'')}" placeholder="Navn/adresse" style="flex:2;min-width:220px">
            <select data-k="task" data-i="${i}" style="flex:1;min-width:200px">
              ${opt.replace(`value="${C.esc(row.task||C.cfg.DEFAULT_TASKS[0])}"`, `value="${C.esc(row.task||C.cfg.DEFAULT_TASKS[0])}" selected`)}
            </select>
            <label class="small" style="color:#cbd5e1"><input type="checkbox" data-k="twoDriverRec" data-i="${i}" ${row.twoDriverRec?'checked':''}> 2 sjåfører</label>
            <label class="small" style="color:#cbd5e1"><input type="checkbox" data-k="active" data-i="${i}" ${row.active===false?'':'checked'}> Aktiv</label>
            <label class="small" style="color:#cbd5e1">📍
              <input data-k="pinsCount" data-i="${i}" type="number" min="0" value="${Number(row.pinsCount||0)}" style="width:70px"> stk
            </label>
            <button data-up="${i}" class="btn btn-gray small">⬆️</button>
            <button data-down="${i}" class="btn btn-gray small">⬇️</button>
            <button data-del="${i}" class="btn btn-red small">Slett</button>
          </div>
        </div>
      `).join('');

      host.querySelectorAll('input[data-k],select[data-k]').forEach(el=>{
        el.oninput = ()=> {
          const i = +el.dataset.i, k = el.dataset.k;
          if (k === 'active' || k === 'twoDriverRec'){
            Admin.state.addresses[i][k] = !!el.checked;
          } else if (k === 'pinsCount'){
            Admin.state.addresses[i].pinsCount = parseInt(el.value||'0',10)||0;
          } else {
            Admin.state.addresses[i][k] = el.value;
          }
        };
        if (el.type==='checkbox') el.onchange = el.oninput;
      });

      host.querySelectorAll('button[data-del]').forEach(b=> b.onclick=()=>{
        const i=+b.dataset.del; Admin.state.addresses.splice(i,1); Admin.paint();
      });
      host.querySelectorAll('button[data-up]').forEach(b=> b.onclick=()=>{
        const i=+b.dataset.up; if (i<=0) return; const a=Admin.state.addresses; [a[i-1],a[i]]=[a[i],a[i-1]]; Admin.paint();
      });
      host.querySelectorAll('button[data-down]').forEach(b=> b.onclick=()=>{
        const i=+b.dataset.down; const a=Admin.state.addresses; if (i>=a.length-1) return; [a[i+1],a[i]]=[a[i],a[i+1]]; Admin.paint();
      });
    },

    async load(){
      try{
        document.getElementById('admMsg').textContent = 'Laster katalog …';
        const { CATALOG } = C.cfg.BINS;
        const res = await fetch(`https://api.jsonbin.io/v3/b/${CATALOG}/latest`, { headers: C.headers() });
        const js  = await res.json();
        Admin.state = js?.record || {addresses:[]};
        Admin.state.addresses = Array.isArray(Admin.state.addresses) ? Admin.state.addresses : [];
        document.getElementById('admMsg').textContent = `Lastet ${Admin.state.addresses.length} adresser`;
        Admin.paint();
      }catch(e){
        document.getElementById('admMsg').textContent = 'Feil ved lasting (sjekk nøkkel).';
      }
    },

    async saveWithBackup(){
      try{
        document.getElementById('admMsg').textContent = 'Lagrer (med backup) …';
        const stamp = { version:C.cfg.VERSION, updated:Date.now(), by:C.displayName() };

        await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.BACKUP}`, {
          method:'PUT', headers:C.headers(), body: JSON.stringify({ ...stamp, snapshot: Admin.state })
        });

        await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.CATALOG}`, {
          method:'PUT', headers:C.headers(), body: JSON.stringify({ ...stamp, addresses: Admin.state.addresses })
        });

        document.getElementById('admMsg').textContent = 'Katalog lagret ✔︎';
      }catch(e){
        document.getElementById('admMsg').textContent = 'Feil ved lagring (sjekk nøkkel).';
      }
    },

    async publishToMaster(){
      try{
        document.getElementById('admMsg').textContent = 'Publiserer til MASTER …';
        const active = (Admin.state.addresses||[]).filter(a=>a?.active!==false);
        const nowSeason = C.seasonKey();
        const stops = active.map(a=>({
          n: a.name||'',
          t: C.normalizeTask(a.task||C.cfg.DEFAULT_TASKS[0]),
          f:false,b:false,p:[],
          twoDriverRec: !!a.twoDriverRec,
          pinsCount: Number.isFinite(a.pinsCount)?a.pinsCount:0,
          pinsLockedYear: (Number.isFinite(a.pinsCount)&&a.pinsCount>0) ? nowSeason : null
        }));

        const payload = {
          version:C.cfg.VERSION, updated:Date.now(),
          lastSyncAt:Date.now(), lastSyncBy:C.displayName(),
          stops, meta:{ from:'catalog' }
        };

        await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.MASTER}`, {
          method:'PUT', headers:C.headers(), body: JSON.stringify(payload)
        });

        document.getElementById('admMsg').textContent = `Publisert ${stops.length} adresser til MASTER ✔︎`;
      }catch(e){
        document.getElementById('admMsg').textContent = 'Feil ved publisering (sjekk nøkkel).';
      }
    },

    async restore(){
      try{
        document.getElementById('admMsg').textContent = 'Henter backup …';
        const res = await fetch(`https://api.jsonbin.io/v3/b/${C.cfg.BINS.BACKUP}/latest`, { headers:C.headers() });
        const js  = await res.json();
        const snap = js?.record?.snapshot;
        if (!snap?.addresses){ document.getElementById('admMsg').textContent='Ingen gyldig backup.'; return; }
        Admin.state = { addresses: snap.addresses, updated: Date.now() };
        await Admin.saveWithBackup();
        document.getElementById('admMsg').textContent = 'Gjenopprettet fra backup ✔︎';
        Admin.paint();
      }catch(e){
        document.getElementById('admMsg').textContent = 'Feil ved gjenoppretting.';
      }
    },

    exportCsv(){
      const rows = [['name','task','active','twoDriverRec','pinsCount']].concat(
        (Admin.state.addresses||[]).map(a=>[
          (a.name||'').replaceAll('"','""'),
          (a.task||'').replaceAll('"','""'),
          (a.active===false?0:1),
          (a.twoDriverRec?1:0),
          (Number(a.pinsCount||0))
        ])
      );
      const csv = rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='katalog.csv'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1200);
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .btn{border:none;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer}
    .btn-green{background:#0f9d58;color:#fff}
    .btn-blue{background:#0b66ff;color:#fff}
    .btn-gray{background:#2f3337;color:#fff}
    .btn-red{background:#c21d03;color:#fff}
    .small{font-size:12px}
  `;
  document.head.appendChild(style);

  Admin.init();
})();