<!-- del-G.js -->
<script>
(()=>{
  // -- Sikker start ----------------------------------------------------------
  if(!window.Core){ console.error('Del C må lastes før Del G.'); return; }
  if(!Core.cfg){   console.error('Del D må lastes før Del G.'); }

  const CFG     = Core.cfg;
  const BINS    = CFG?.BINS || {};
  const headers = Core.headers || (()=>({"Content-Type":"application/json"}));
  const esc     = Core.esc || (s=>String(s??"")
                        .replace(/&/g,"&amp;")
                        .replace(/</g,"&lt;")
                        .replace(/>/g,"&gt;")
                        .replace(/"/g,"&quot;"));

  // liten helper: sørg for at "brøytestikker" er med i oppgaven
  const normalizeTask = (t)=>{
    t = String(t||"").trim();
    return /brøytestikker/i.test(t) ? t : (t ? `${t} + brøytestikker` : "Snø + brøytestikker");
  };

  let CAT = { addresses: [], updated: 0, version: CFG.VERSION };

  // -- UI mount --------------------------------------------------------------
  function mountAdmin(){
    const host = document.getElementById('adminCatalog');
    if(!host) return;

    host.innerHTML = `
      <div class="card stack" style="background:#151515;border:1px solid #2a2a2a;border-radius:12px;padding:12px">
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button id="gLoad"  class="btn btn-gray">⟳ Last katalog</button>
          <button id="gAdd"   class="btn btn-blue">➕ Legg til</button>
          <button id="gSave"  class="btn btn-green">💾 Lagre (med backup)</button>
          <button id="gPub"   class="btn btn-blue">🚀 Publiser til MASTER</button>
          <button id="gCsv"   class="btn btn-gray">⬇︎ Eksporter CSV</button>
          <button id="gRestore" class="btn btn-red">⏪ Gjenopprett fra backup</button>
          <span id="gMsg" class="small muted" style="margin-left:auto">–</span>
        </div>
        <div id="gList" style="margin-top:10px"></div>
      </div>
    `;

    document.getElementById('gLoad').onclick    = loadCatalog;
    document.getElementById('gAdd').onclick     = addRow;
    document.getElementById('gSave').onclick    = saveCatalogWithBackup;
    document.getElementById('gPub').onclick     = publishToMaster;
    document.getElementById('gCsv').onclick     = exportCSV;
    document.getElementById('gRestore').onclick = restoreFromBackup;

    // auto-last første gang
    loadCatalog();
  }

  // -- Render liste ----------------------------------------------------------
  function renderList(){
    const host = document.getElementById('gList');
    if(!host) return;

    if(!CAT.addresses.length){
      host.innerHTML = `<div class="small muted">– tom katalog –</div>`;
      setMsg(`Rader: 0`);
      return;
    }

    const taskSelect = (val, idx) =>
      `<select data-k="task" data-i="${idx}" style="flex:1;min-width:220px">
        ${CFG.DEFAULT_TASKS.map(t=>`<option value="${esc(t)}" ${val===t?'selected':''}>${esc(t)}</option>`).join('')}
      </select>`;

    host.innerHTML = CAT.addresses.map((a,idx)=>`
      <div class="item" style="padding:8px 0;border-bottom:1px solid #2a2a2a">
        <div class="row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input data-k="name" data-i="${idx}" value="${esc(a.name||'')}" placeholder="Navn/adresse" style="flex:2;min-width:260px">
          ${taskSelect(a.task || CFG.DEFAULT_TASKS[0], idx)}
          <label class="small"><input type="checkbox" data-k="twoDriverRec" data-i="${idx}" ${a.twoDriverRec?'checked':''}> 2 sjåfører</label>
          <label class="small"><input type="checkbox" data-k="active" data-i="${idx}" ${a?.active===false?'':'checked'}> Aktiv</label>
          <label class="small">📍
            <input type="number" min="0" data-k="pinsCount" data-i="${idx}" value="${Number.isFinite(a.pinsCount)?a.pinsCount:0}" style="width:80px">
          </label>
          <button class="btn btn-gray small" data-up="${idx}">⬆️</button>
          <button class="btn btn-gray small" data-down="${idx}">⬇️</button>
          <button class="btn btn-red small" data-del="${idx}">Slett</button>
        </div>
      </div>
    `).join('');

    // inputs
    host.querySelectorAll('input[data-k]').forEach(el=>{
      el.oninput = ()=>{
        const i = +el.dataset.i, k = el.dataset.k;
        if (k==='twoDriverRec' || k==='active'){
          CAT.addresses[i][k] = (k==='active') ? el.checked : !!el.checked;
          if (k==='active' && el.checked) CAT.addresses[i].active = true;
        } else if (k==='pinsCount'){
          CAT.addresses[i][k] = parseInt(el.value||'0', 10) || 0;
        } else {
          CAT.addresses[i][k] = el.value;
        }
      };
      if (el.type==='checkbox') el.onchange = el.oninput;
    });

    host.querySelectorAll('select[data-k="task"]').forEach(sel=>{
      sel.onchange = ()=>{ CAT.addresses[+sel.dataset.i].task = sel.value; };
    });

    // flytt/slett
    host.querySelectorAll('button[data-del]').forEach(b=> b.onclick = ()=>{
      CAT.addresses.splice(+b.dataset.del,1); renderList();
    });
    host.querySelectorAll('button[data-up]').forEach(b=> b.onclick = ()=>{
      const i = +b.dataset.up; if(i<=0) return;
      [CAT.addresses[i-1], CAT.addresses[i]] = [CAT.addresses[i], CAT.addresses[i-1]];
      renderList();
    });
    host.querySelectorAll('button[data-down]').forEach(b=> b.onclick = ()=>{
      const i = +b.dataset.down; if(i>=CAT.addresses.length-1) return;
      [CAT.addresses[i+1], CAT.addresses[i]] = [CAT.addresses[i], CAT.addresses[i+1]];
      renderList();
    });

    setMsg(`Rader: ${CAT.addresses.length}`);
  }

  // -- Actions ---------------------------------------------------------------
  function setMsg(t){ const m=document.getElementById('gMsg'); if(m) m.textContent=t; }

  async function loadCatalog(){
    try{
      setMsg('Laster katalog …');
      const r  = await fetch(`https://api.jsonbin.io/v3/b/${BINS.CATALOG}/latest`, { headers: headers() });
      const js = await r.json();
      CAT = js?.record || { addresses: [], updated: 0, version: CFG.VERSION };
      CAT.addresses = Array.isArray(CAT.addresses) ? CAT.addresses : [];
      console.log('Katalog hentet', js);
      setMsg(`Lastet ${CAT.addresses.length} adresser`);
      renderList();
    }catch(e){
      console.error(e);
      setMsg('Feil ved lasting (nøkkel?)');
    }
  }

  function addRow(){
    CAT.addresses.push({ name:'', task: CFG.DEFAULT_TASKS[0], active:true, twoDriverRec:false, pinsCount:0 });
    renderList();
  }

  async function saveCatalogWithBackup(){
    try{
      setMsg('Lagrer (backup)…');
      // 1) backup
      const backup = { version: CFG.VERSION, updated: Date.now(), by: Core?.displayName?.() || 'admin', snapshot: CAT };
      await fetch(`https://api.jsonbin.io/v3/b/${BINS.BACKUP}`, { method:'PUT', headers: headers(), body: JSON.stringify(backup) });
      // 2) save catalog
      const rec = { version: CFG.VERSION, updated: Date.now(), by: Core?.displayName?.() || 'admin', addresses: CAT.addresses };
      await fetch(`https://api.jsonbin.io/v3/b/${BINS.CATALOG}`, { method:'PUT', headers: headers(), body: JSON.stringify(rec) });
      setMsg('Katalog lagret ✔︎');
    }catch(e){
      console.error(e); setMsg('Feil ved lagring (nøkkel?)');
    }
  }

  async function publishToMaster(){
    try{
      setMsg('Publiserer til MASTER …');
      const nowSeason = Core.seasonKey ? Core.seasonKey() : (()=>{
        const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
        return m>=7 ? `${y}/${(y+1).toString().slice(-2)}` : `${y-1}/${y.toString().slice(-2)}`;
      })();

      const active = (CAT.addresses||[]).filter(a=>a?.active!==false);
      const stops = active.map(a=>({
        n: a.name || '',
        t: normalizeTask(a.task || CFG.DEFAULT_TASKS[0]),
        f: false, b: false, p: [],
        twoDriverRec: !!a.twoDriverRec,
        pinsCount: Number.isFinite(a.pinsCount) ? a.pinsCount : 0,
        pinsLockedYear: (Number.isFinite(a.pinsCount) && a.pinsCount>0) ? nowSeason : null
      }));

      const payload = {
        version: CFG.VERSION,
        updated: Date.now(),
        lastSyncAt: Date.now(),
        lastSyncBy: Core?.displayName?.() || 'admin',
        stops,
        meta: { from:'catalog' }
      };

      await fetch(`https://api.jsonbin.io/v3/b/${BINS.MASTER}`, {
        method:'PUT', headers: headers(), body: JSON.stringify(payload)
      });
      setMsg(`Publisert ${stops.length} adresser ✔︎`);
    }catch(e){
      console.error(e); setMsg('Feil ved publisering');
    }
  }

  function exportCSV(){
    const rows = [['name','task','active','twoDriverRec','pinsCount']]
      .concat((CAT.addresses||[]).map(a=>[
        (a.name||'').replaceAll('"','""'),
        (a.task||'').replaceAll('"','""'),
        (a.active===false?0:1),
        (a.twoDriverRec?1:0),
        Number.isFinite(a.pinsCount)?a.pinsCount:0
      ]));
    const csv = rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'katalog.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  async function restoreFromBackup(){
    if(!confirm('Erstatt katalog med siste backup?')) return;
    try{
      setMsg('Henter backup …');
      const r  = await fetch(`https://api.jsonbin.io/v3/b/${BINS.BACKUP}/latest`, { headers: headers() });
      const js = await r.json();
      const snap = js?.record?.snapshot;
      if(!snap?.addresses){ setMsg('Fant ingen snapshot i backup'); return; }
      CAT = { ...snap };
      await saveCatalogWithBackup(); // lagre tilbake som gjeldende + ny backup
      renderList();
      setMsg('Gjenopprettet fra backup ✔︎');
    }catch(e){
      console.error(e); setMsg('Feil ved gjenoppretting');
    }
  }

  // -- Start når DOM er klar --------------------------------------------------
  document.addEventListener('DOMContentLoaded', ()=> {
    try{
      mountAdmin();
      console.log('del-G.js (admin) lastet');
    }catch(e){
      console.error(e); setMsg('Init-feil i del-G');
    }
  });
})();
</script>