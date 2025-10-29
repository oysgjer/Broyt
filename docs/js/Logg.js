// Logg.js – henter hendelser fra JSONBin, lager printbar logg pr dato/sjåfør
(function(){
  const BIN_ID = '68e89e3443b1c97be9611c48';
  const API_LATEST = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

  const $ = s=>document.querySelector(s);
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
      const candidates = ['BRYT_SYNC_CFG','SYNC_CFG','APP_CFG','CONFIG','BRØYT_CFG','BROYT_CFG','JSONBIN_CFG','JSONBIN'];
      const fields = ['apiKey','reportsKey','masterKey','jsonbinKey','key'];
      for (const k of candidates){
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) continue;
        try{
          const obj = JSON.parse(raw);
          for (const f of fields){ if (typeof obj[f] === 'string' && obj[f].length > 10) return obj[f]; }
          const stack=[obj];
          while (stack.length){
            const it = stack.pop();
            if (typeof it === 'string' && it.length > 20) return it;
            if (it && typeof it === 'object'){ for (const v of Object.values(it)) stack.push(v); }
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

  function inferSG(){
    try{
      const labels = Array.from(document.querySelectorAll('label'));
      const g   = labels.some(l => /sand|grus/i.test(l.textContent) && l.querySelector('input[type=checkbox]')?.checked);
      const s   = labels.some(l => /skjær|skjaer|fres/i.test(l.textContent) && l.querySelector('input[type=checkbox]')?.checked);
      if (s && g) return 'S/G';
      if (s) return 'S';
      if (g) return 'G';
    }catch{}
    try{
      const raw = localStorage.getItem('UTSTYR') || localStorage.getItem('EQUIPMENT');
      if (raw){
        const o = JSON.parse(raw);
        const s = !!(o.skjær || o.skjaer || o.fres || o.S);
        const g = !!(o.sand || o.grus || o.G);
        if (s && g) return 'S/G';
        if (s) return 'S';
        if (g) return 'G';
      }
    }catch{}
    return '';
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
            rows.push({address: addr, start: pendingStart.ts, end: null, sg: pendingStart.sg || inferSG(), note: pendingStart.notes||''});
          }
          pendingStart = e;
        }else if (e.action==='ferdig'){
          if (pendingStart){
            rows.push({address: addr, start: pendingStart.ts, end: e.ts, sg: pendingStart.sg || inferSG(), note: pendingStart.notes||''});
            pendingStart = null;
          }else{
            rows.push({address: addr, start: null, end: e.ts, sg: inferSG(), note:'(mangler start)'});
          }
        }else if (e.action==='hopp_over' || e.action==='ikke_mulig'){
          rows.push({address: addr, start: e.ts, end: null, sg:'', note: e.action==='hopp_over'?'Hopp over':'Ikke mulig'});
        }
      }
      if (pendingStart){
        rows.push({address: addr, start: pendingStart.ts, end: null, sg: pendingStart.sg || inferSG(), note: pendingStart.notes||''});
      }
    });
    rows.sort((a,b)=> new Date(a.start||a.end||0)-new Date(b.start||b.end||0));
    return rows;
  }

  function buildTable(addrs, rows){
    const hdr1 = byId('hdr1');
    const hdr2 = byId('hdr2');
    const tbody = byId('tbody');

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
      const timeStr = (r.start?fmtHm(r.start):'—') + '–' + (r.end?fmtHm(r.end):'—');
      const td1 = document.createElement('td'); td1.textContent = timeStr; tr.appendChild(td1);
      const td2 = document.createElement('td'); td2.textContent = r.note || ''; tr.appendChild(td2);
      for (let i=0;i<addrs.length;i++){ const td=document.createElement('td'); tr.appendChild(td); }
      const idx = colIndex.get(r.address);
      if (idx!=null){
        const cell = tr.children[2+idx];
        if (r.note==='Hopp over' || r.note==='Ikke mulig'){
          cell.textContent = r.note;
        }else{
          cell.textContent = (r.sg||'') + (r.sg? ' ' : '') + timeStr;
        }
      }else{
        tr.children[1].textContent = (tr.children[1].textContent? tr.children[1].textContent + ' | ' : '') + (r.address||'');
      }
      tbody.appendChild(tr);
    });
  }

  async function loadAndRender(){
    const dateSel = byId('inpDato').value || fmtDateInput(new Date());
    const driverSel = byId('selDriver').value || '';

    const key = getMasterKey();
    if (!key){ alert('Mangler X-Master-Key i localStorage (Admin).'); return; }

    const r = await fetch(API_LATEST, { headers:{'X-Master-Key': key} });
    if (!r.ok){ alert('Feil fra JSONBin: '+r.status); return; }
    const j = await r.json();
    const all = (j && j.record && Array.isArray(j.record.reports)) ? j.record.reports : [];

    const drivers = Array.from(new Set(all.map(x=>x.driver).filter(Boolean))).sort();
    const sel = byId('selDriver'); const cur = sel.value;
    sel.innerHTML = '<option value="">Alle</option>' + drivers.map(d=>`<option value="${d}">${d}</option>`).join('');
    sel.value = driverSel || cur || '';

    const d0 = parseLocalDate(dateSel);
    const filtered = all.filter(x=> sameDay(x.ts, d0) && (!sel.value || x.driver===sel.value));

    let addrs = getAddressesFromApp();
    if (!addrs.length){
      addrs = Array.from(new Set(filtered.map(x=>x.address).filter(Boolean)));
    }

    const rows = groupRows(filtered);

    try{
      const name = localStorage.getItem('DRIVER_NAME') || sel.value || '';
      byId('inpNavn').value = name;
    }catch{}
    byId('inpDatoHdr').value = dateSel;
    const dt = parseLocalDate(dateSel);
    byId('inpMnd').value = String(dt.getMonth()+1).padStart(2,'0') + '.' + dt.getFullYear();

    buildTable(addrs, rows);
  }

  function init(){
    byId('inpDato').value = fmtDateInput(new Date());
    byId('inpDatoHdr').value = byId('inpDato').value;
    byId('btnReload').addEventListener('click', loadAndRender);
    byId('btnPrint').addEventListener('click', ()=> window.print());
    byId('inpDato').addEventListener('change', loadAndRender);
    byId('selDriver').addEventListener('change', loadAndRender);
    loadAndRender();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
