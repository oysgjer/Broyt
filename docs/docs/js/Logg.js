// Logg.js – henter hendelser fra JSONBin, lager printbar logg pr dato/sjåfør
(function(){
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

  function byId(id){ return document.getElementById(id); }
  function fmtHm(d){ try{ return new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }catch{return '';} }
  function fmtDateInput(d){ const dt = new Date(d); return dt.toISOString().slice(0,10); }
  function parseLocalDate(str){ return new Date(str+'T00:00:00'); }

  function getMasterKey(){
    try{
      for (const k of ['X_MASTER_KEY','JSONBIN_MASTER_KEY']) {
        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (v && v.length > 10) return v;
      }
      const cand = ['BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'];
      const fields = ['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of cand){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) continue;
        try{
          const o = JSON.parse(raw);
          for (const f of fields){ if (typeof o[f] === 'string' && o[f].length > 10) return o[f]; }
          const st=[o];
          while(st.length){
            const it=st.pop();
            if (typeof it==='string' && it.length>20) return it;
            if (it && typeof it==='object') Object.values(it).forEach(v=>st.push(v));
          }
        }catch{}
      }
    }catch{}
    return null;
  }

  function getAddressesFromApp(){
    try{
      if (typeof filteredAddresses === 'function' && typeof laneFromSettings === 'function'){
        const lane = laneFromSettings();
        const list = filteredAddresses(lane);
        return list.map(x => (typeof x==='string') ? x : (x.name || x.adresse || x.address || ''));
      }
    }catch{}
    return [];
  }

  function sameDay(a,b){
    const da = new Date(a), db = new Date(b);
    return da.getFullYear()===db.getFullYear() && da.getMonth()===db.getMonth() && da.getDate()===db.getDate();
  }

  function groupRows(events){
    const rows = [];
    const byAddr = new Map();
    events.forEach(e=>{
      const key = e.address || '(ukjent)';
      const arr = byAddr.get(key)||[]; arr.push(e); byAddr.set(key, arr);
    });
    byAddr.forEach((list, addr)=>{
      list.sort((a,b)=> new Date(a.ts)-new Date(b.ts));
      let pendingStart = null;
      for (const e of list){
        if (e.action==='start'){
          if (pendingStart){
            rows.push({address: addr, start: pendingStart.ts, end: null, note: pendingStart.notes||''});
          }
          pendingStart = e;
        }else if (e.action==='ferdig'){
          if (pendingStart){
            rows.push({address: addr, start: pendingStart.ts, end: e.ts, note: pendingStart.notes||''});
            pendingStart = null;
          }else{
            rows.push({address: addr, start: null, end: e.ts, note:'(mangler start)'});
          }
        }else if (e.action==='hopp_over' || e.action==='ikke_mulig'){
          rows.push({address: addr, start: e.ts, end: null, note: e.action==='hopp_over'?'Hopp over':'Ikke mulig'});
        }
      }
      if (pendingStart){
        rows.push({address: addr, start: pendingStart.ts, end: null, note: pendingStart.notes||''});
      }
    });
    rows.sort((a,b)=> new Date(a.start||a.end||0)-new Date(b.start||b.end||0));
    return rows;
  }

  function buildTable(addrs, rows){
    const hdr1 = document.getElementById('hdr1');
    const hdr2 = document.getElementById('hdr2');
    const tbody = document.getElementById('tbody');
    hdr1.querySelectorAll('th.addr').forEach(n=>n.remove());
    hdr2.querySelectorAll('th.addr').forEach(n=>n.remove());
    tbody.innerHTML='';

    addrs.forEach(a=>{
      const th = document.createElement('th'); th.className='addr';
      th.innerHTML = `<div class="addr-th">${a||''}</div>`;
      hdr2.appendChild(th);
      const th2 = document.createElement('th'); th2.className='addr'; th2.style.display='none';
      hdr1.appendChild(th2);
    });

    const colIndex = new Map();
    addrs.forEach((a,i)=> colIndex.set(a,i));

    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const timeStr = (r.start?new Date(r.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}):'—') +
                      '–' +
                      (r.end?new Date(r.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}):'—');
      const td1 = document.createElement('td'); td1.textContent = timeStr; tr.appendChild(td1);
      const td2 = document.createElement('td'); td2.textContent = r.note || ''; tr.appendChild(td2);
      for (let i=0;i<addrs.length;i++){ const td=document.createElement('td'); tr.appendChild(td); }
      const idx = colIndex.get(r.address);
      if (idx!=null){
        tr.children[2+idx].textContent = timeStr;
      }else{
        tr.children[1].textContent = (tr.children[1].textContent? tr.children[1].textContent + ' | ' : '') + (r.address||'');
      }
      tbody.appendChild(tr);
    });
  }

  async function loadAndRender(){
    const dateSel = document.getElementById('inpDato').value || new Date().toISOString().slice(0,10);
    const key = getMasterKey();
    if (!key){ alert('Mangler X-Master-Key i localStorage (Admin).'); return; }

    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if (!r.ok){ alert('Feil fra JSONBin: '+r.status); return; }
    const j = await r.json();
    const all = (j && j.record && Array.isArray(j.record.reports)) ? j.record.reports : [];

    const drivers = Array.from(new Set(all.map(x=>x.driver).filter(Boolean))).sort();
    const sel = document.getElementById('selDriver'); const cur = sel.value;
    sel.innerHTML = '<option value="">Alle</option>' + drivers.map(d=>`<option value="${d}">${d}</option>`).join('');
    sel.value = cur || '';

    const d0 = new Date(dateSel+'T00:00:00');
    const filtered = all.filter(x=> {
      const dx = new Date(x.ts);
      return dx.getFullYear()===d0.getFullYear() && dx.getMonth()===d0.getMonth() && dx.getDate()===d0.getDate();
    });

    let addrs = getAddressesFromApp();
    if (!addrs.length){
      addrs = Array.from(new Set(filtered.map(x=>x.address).filter(Boolean)));
    }

    document.getElementById('inpDatoHdr').value = dateSel;
    const dt = new Date(dateSel+'T00:00:00');
    document.getElementById('inpMnd').value = String(dt.getMonth()+1).padStart(2,'0') + '.' + dt.getFullYear();

    try{
      const name = localStorage.getItem('DRIVER_NAME') || '';
      document.getElementById('inpNavn').value = name;
    }catch{}

    const rows = groupRows(filtered);
    buildTable(addrs, rows);
  }

  function init(){
    document.getElementById('inpDato').value = new Date().toISOString().slice(0,10);
    document.getElementById('inpDatoHdr').value = document.getElementById('inpDato').value;
    document.getElementById('btnReload').addEventListener('click', loadAndRender);
    document.getElementById('btnPrint').addEventListener('click', ()=> window.print());
    document.getElementById('inpDato').addEventListener('change', loadAndRender);
    document.getElementById('selDriver').addEventListener('change', loadAndRender);
    loadAndRender();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
