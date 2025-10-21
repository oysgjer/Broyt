// js/Status.js
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const readJSON  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const K_ADDR_CACHE = 'BRYT_ADDR_CACHE'; // {ts, data:[...]} – fylles av Sync
  const K_RUN        = 'BRYT_RUN';        // {driver,...}

  // === Små hjelpere ===
  function fmt(ts){
    if (!ts) return '';
    try{
      const d = new Date(ts);
      const dd = d.getDate().toString().padStart(2,'0');
      const mm = (d.getMonth()+1).toString().padStart(2,'0');
      const hh = d.getHours().toString().padStart(2,'0');
      const mi = d.getMinutes().toString().padStart(2,'0');
      return `${dd}.${mm} ${hh}:${mi}`;
    }catch{ return ''; }
  }

  async function loadAddrs(){
    try{
      return await window.Sync.loadAddresses({ force:false });
    }catch{
      const cache = readJSON(K_ADDR_CACHE, {data:[]});
      return cache.data || [];
    }
  }

  function saveAddrs(addrs){
    writeJSON(K_ADDR_CACHE, { ts: Date.now(), data: addrs });
  }

  function normalize(addrs){
    return (addrs || []).map((a,i)=>({
      id: a.id ?? a.ID ?? a.idr ?? (a.name || String(i)),
      name: a.name || a.title || a.adresse || `Adresse #${i+1}`,
      lat:  a.lat ?? a.latitude,
      lon:  a.lon ?? a.longitude,
      snowStart: a.snowStart, snowEnd: a.snowEnd,
      gritStart: a.gritStart, gritEnd: a.gritEnd,
      driver: a.driver || '',
      skipped: !!a.skipped,
      blocked: !!a.blocked
    }));
  }

  // === Bygg UI ===
  function ensureToolbar(root){
    let bar = root.querySelector('#status_toolbar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'status_toolbar';
    bar.className = 'row';
    bar.style.margin = '8px 0 12px';
    bar.innerHTML = `
      <button id="st_reset_mine" class="btn-ghost">Nullstill min runde</button>
      <button id="st_reset_all"  class="btn-ghost">Nullstill alt</button>
      <button id="st_refresh"    class="btn">Oppfrisk</button>
    `;
    root.appendChild(bar);
    return bar;
  }

  function injectStickyHeaderCSS(){
    if ($('#status_table_sticky_css')) return;
    const st = document.createElement('style');
    st.id = 'status_table_sticky_css';
    st.textContent = `
      #stat_wrap { overflow-x:auto; }
      #stat_wrap table { width:100%; border-collapse:collapse; }
      #stat_wrap thead th {
        position: sticky;
        top: 0;
        background: var(--surface);
        z-index: 1;
      }
      #stat_wrap th, #stat_wrap td {
        text-align:left; padding:8px;
        border-top:1px solid var(--sep);
        white-space: nowrap;
      }
      #stat_wrap tbody tr:nth-child(2) td { border-top:1px solid var(--sep); }
      @media (max-width: 560px){
        #stat_wrap th, #stat_wrap td { padding:10px 8px; font-size:0.95rem; }
      }
    `;
    document.head.appendChild(st);
  }

  function buildTable(root, rows){
    // rydd
    const old = root.querySelector('#stat_wrap');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'stat_wrap';
    wrap.className = 'card';

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Adresse</th>
          <th>Startet snø</th>
          <th>Ferdig snø</th>
          <th>Startet grus</th>
          <th>Ferdig grus</th>
          <th>Sjåfør</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    rows.forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.name}</td>
        <td>${fmt(r.snowStart)}</td>
        <td>${fmt(r.snowEnd)}</td>
        <td>${fmt(r.gritStart)}</td>
        <td>${fmt(r.gritEnd)}</td>
        <td>${r.driver || ''}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    root.appendChild(wrap);
  }

  // === Nullstilling ===
  function clearFields(a){
    delete a.snowStart; delete a.snowEnd;
    delete a.gritStart; delete a.gritEnd;
    delete a.skipped;   delete a.blocked;
    delete a.driver;
    return a;
  }

  async function resetMine(root){
    const run = readJSON(K_RUN, {driver:''});
    const mine = (run.driver || '').trim();
    if (!mine){ alert('Fant ikke sjåførnavn i Hjem.'); return; }

    // last nåværende fra cache (samme som vi viser)
    const current = normalize(await loadAddrs());

    let changed = 0;
    current.forEach(a=>{
      if ((a.driver || '') === mine){
        clearFields(a); changed++;
      }
    });

    saveAddrs(current);
    buildTable(root, current);
    alert(changed ? `Nullstilte ${changed} adresser for ${mine}.` : `Ingen rader tilknyttet ${mine}.`);
  }

  async function resetAll(root){
    if (!confirm('Er du sikker på at du vil nullstille ALT for denne enheten?')) return;

    const current = normalize(await loadAddrs());
    current.forEach(clearFields);
    saveAddrs(current);
    buildTable(root, current);
    alert('Alt er nullstilt lokalt.');
  }

  // === Init ===
  async function renderStatus(){
    if (location.hash !== '#status') return;

    injectStickyHeaderCSS();

    const root = $('#status');
    if (!root) return;

    ensureToolbar(root);

    // data
    const addrs = normalize(await loadAddrs());
    buildTable(root, addrs);

    // knapper
    const btnMine = $('#st_reset_mine');
    const btnAll  = $('#st_reset_all');
    const btnRef  = $('#st_refresh');

    btnMine && (btnMine.onclick = ()=> resetMine(root));
    btnAll  && (btnAll.onclick  = ()=> resetAll(root));
    btnRef  && (btnRef.onclick  = ()=> renderStatus());
  }

  window.addEventListener('hashchange', renderStatus);
  document.addEventListener('DOMContentLoaded', renderStatus);
})();