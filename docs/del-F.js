// ===== del-F.js (Adresse-register) =====
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del F."); return; }
  const C = Core;

  const Register = (window.Register = {
    init(){ document.addEventListener('DOMContentLoaded', Register.render); },
    render(){
      const host = document.getElementById('addresses');
      if (!host) return;

      host.innerHTML = `
        <h2>Adresse-register</h2>
        <div class="small" id="regInfo" style="color:#9aa4af;margin-bottom:12px"></div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button id="regFetch" class="btn btn-blue">↘︎ Hent fra katalog</button>
          <button id="regClearFlags" class="btn btn-gray">Nullstill lokal status</button>
        </div>

        <div class="card" style="background:#171a1f;border:1px solid #2b3037;border-radius:12px;padding:12px;margin-bottom:14px">
          <h3 style="margin:0 0 8px 0">Legg til ny adresse (lokalt)</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap">
            <input id="regName" placeholder="Navn / adresse" style="flex:2;min-width:240px">
            <select id="regTask" style="flex:1;min-width:220px"></select>
            <label style="display:flex;align-items:center;gap:6px">
              <input id="regTwo" type="checkbox"> 2 sjåfører
            </label>
            <button id="regAdd" class="btn btn-green">+ Legg til</button>
          </div>
        </div>

        <div id="regList"></div>
      `;

      // Fyll task-valg
      const sel = host.querySelector('#regTask');
      sel.innerHTML = C.cfg.DEFAULT_TASKS.map(t=>`<option>${C.esc(t)}</option>`).join('');

      // Info
      const total = (C.state?.stops||[]).length;
      host.querySelector('#regInfo').textContent = total ? `Adresser i runde: ${total}` : 'Ingen adresser enda. Hent katalog eller legg til lokalt.';

      // Liste
      const list = host.querySelector('#regList');
      const rows = (C.state?.stops||[]).map(s=>{
        const pinsBadge = s.pinsLockedYear ? `<span class="badge" style="margin-left:6px">📍${s.pinsCount??0}</span>` : '';
        const two = s.twoDriverRec ? `<span class="badge" style="margin-left:6px">👥 2</span>` : '';
        const status = s.f ? '✅' : (s.b ? '⛔' : '');
        return `
          <div class="item" style="padding:10px;border:1px solid #2b3037;border-radius:10px;margin-bottom:8px;background:#111318">
            <div style="font-weight:700">${C.esc(s.n)} ${two} ${pinsBadge}</div>
            <div class="small" style="color:#9aa4af">${C.esc(s.t)} ${status}</div>
          </div>`;
      }).join('') || `<div class="small" style="color:#9aa4af">– tomt –</div>`;
      list.innerHTML = rows;

      // Handlere
      host.querySelector('#regFetch').onclick = async ()=>{
        try{
          console.log('Laster inn katalog fra JSONBin …');
          const rec = await C.fetchCatalog();
          const src = Array.isArray(rec.addresses) ? rec.addresses : [];
          if (!src.length){ console.warn('Ingen adresser funnet i katalog'); return; }

          // Importer (merge basert på navn)
          const key = s => (s?.name||s?.n||'').trim().toLowerCase();
          const have = new Set((C.state.stops||[]).map(s=>key(s)));
          let added = 0;
          src.forEach(a=>{
            if (a?.active === false) return;
            const k = key(a);
            if (have.has(k)) return;
            (C.state.stops ||= []).push({
              n: a.name || '',
              t: C.normalizeTask(a.task || C.cfg.DEFAULT_TASKS[0]),
              f:false,b:false,p:[],
              twoDriverRec: !!a.twoDriverRec,
              pinsCount: Number.isFinite(a.pinsCount)?a.pinsCount:0,
              pinsLockedYear: (Number.isFinite(a.pinsCount) && a.pinsCount>0) ? C.seasonKey() : null
            });
            added++;
          });
          C.save();
          Register.render();
          console.log(`Importerte fra KATALOG: ${added}`);
        }catch(e){ console.error(e); }
      };

      host.querySelector('#regClearFlags').onclick = ()=>{
        (C.state.stops||[]).forEach(s=>{ s.f=false; s.b=false; s.started=null; s.finished=null; });
        C.save(); Register.render();
      };

      host.querySelector('#regAdd').onclick = ()=>{
        const name = host.querySelector('#regName').value.trim();
        if (!name) return;
        const task = C.normalizeTask(host.querySelector('#regTask').value);
        const two = !!host.querySelector('#regTwo').checked;
        (C.state.stops ||= []).push({ n:name, t:task, f:false, b:false, p:[], started:null, finished:null, twoDriverRec:two, pinsCount:0, pinsLockedYear:null });
        host.querySelector('#regName').value='';
        host.querySelector('#regTwo').checked=false;
        C.save(); Register.render();
      };
    }
  });

  // En liten stilpakke (for knapper/badges hvis ikke allerede i CSS)
  const style = document.createElement('style');
  style.textContent = `
    .btn{border:none;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer}
    .btn-green{background:#0f9d58;color:#fff}
    .btn-blue{background:#0b66ff;color:#fff}
    .btn-gray{background:#2f3337;color:#fff}
    .badge{display:inline-block;border:1px solid #2b3037;border-radius:999px;padding:2px 8px;font-size:12px;color:#cbd5e1}
    .small{font-size:12px}
  `;
  document.head.appendChild(style);

  Register.init();
})();