// js/Status.js
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const readJSON  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const K_ADDR_CACHE = 'BRYT_ADDR_CACHE';

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

  function buildTable(rows){
    const root = $('#status');
    if (!root) return;

    // rydd
    const old = root.querySelector('#stat_wrap');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'stat_wrap';
    wrap.className = 'card';
    wrap.style.overflowX = 'auto';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="text-align:left; padding:8px">#</th>
          <th style="text-align:left; padding:8px">Adresse</th>
          <th style="text-align:left; padding:8px">Startet snø</th>
          <th style="text-align:left; padding:8px">Ferdig snø</th>
          <th style="text-align:left; padding:8px">Startet grus</th>
          <th style="text-align:left; padding:8px">Ferdig grus</th>
          <th style="text-align:left; padding:8px">Sjåfør</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    rows.forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px; border-top:1px solid var(--sep)">${i+1}</td>
        <td style="padding:8px; border-top:1px solid var(--sep)">${r.name}</td>
        <td style="padding:8px; border-top:1px solid var(--sep)">${fmt(r.snowStart)}</td>
        <td style="padding:8px; border-top:1px solid var(--sep)">${fmt(r.snowEnd)}</td>
        <td style="padding:8px; border-top:1px solid var(--sep)">${fmt(r.gritStart)}</td>
        <td style="padding:8px; border-top:1px solid var(--sep)">${fmt(r.gritEnd)}</td>
        <td style="padding:8px; border-top:1px solid var(--sep)">${r.driver || ''}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    root.appendChild(wrap);
  }

  async function init(){
    if (location.hash !== '#status') return;

    let addrs = [];
    try{
      addrs = await window.Sync.loadAddresses({ force:false });
    }catch(e){
      const cache = readJSON(K_ADDR_CACHE, {data:[]});
      addrs = cache.data || [];
    }

    const rows = (addrs || []).map((a, i) => ({
      name: a.name || a.title || a.adresse || `Adresse #${i+1}`,
      snowStart: a.snowStart, snowEnd: a.snowEnd,
      gritStart: a.gritStart, gritEnd: a.gritEnd,
      driver: a.driver || ''
    }));

    buildTable(rows);
  }

  window.addEventListener('hashchange', init);
  document.addEventListener('DOMContentLoaded', init);
})();