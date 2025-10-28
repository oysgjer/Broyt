(() => {
  'use strict';

  const BIN_ID = '68e89e3443b1c97be9611c48'; // Reports bin
  const API_BASE = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;

  function getAdminKey(){
    try{
      if (window.Sync && typeof window.Sync.getConfig === 'function'){
        const cfg = window.Sync.getConfig();
        if (cfg && cfg.apiKey) return cfg.apiKey;
      }
    }catch{}
    return '';
  }

  function $(s, r=document){ return r.querySelector(s); }
  function fmtDate(s){
    try{
      const d = new Date(s);
      return d.toLocaleString('nb-NO');
    }catch{ return s; }
  }
  function ms(d1,d2){ return Math.max(0, new Date(d2)-new Date(d1)); }
  function fmtDur(ms){
    const sec = Math.round(ms/1000);
    if (sec < 60) return sec+'s';
    const m = Math.floor(sec/60), s = sec%60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m/60), mm = m%60;
    return `${h}t ${mm}m`;
  }

  async function fetchLatest(key){
    const r = await fetch(API_BASE, { headers: { 'X-Master-Key': key, 'Cache-Control':'no-store' }});
    if (!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json();
    const rec = j && j.record;
    return Array.isArray(rec) ? rec : (rec ? [rec] : []);
  }

  function aggregate(events){
    // Build map: driver -> addr_id -> {addr_name, started_at, finished_at, duration_ms, lane, actions[]}
    const out = {};
    for (const e of events){
      const d = e.driver || 'Ukjent';
      const a = e.addr_id || '-';
      const name = e.addr_name || '-';
      out[d] = out[d] || {};
      out[d][a] = out[d][a] || { addr_id:a, addr_name:name, lane:e.lane||'', actions:[] };
      out[d][a].actions.push(e);
      // derive duration for address_finish if present
      if (e.action === 'address_finish'){
        const start = e.started_at || null;
        const dur = (start && e.t) ? ms(start, e.t) : (typeof e.duration_ms==='number' ? e.duration_ms : null);
        out[d][a].duration_ms = dur;
        out[d][a].finished_at = e.t;
        out[d][a].started_at = start;
        out[d][a].lane = e.lane || out[d][a].lane;
      }
      if (e.action === 'address_start'){
        out[d][a].started_at = e.t;
        out[d][a].lane = e.lane || out[d][a].lane;
      }
      if (e.action === 'address_skip' || e.action === 'address_block'){
        out[d][a].finished_at = e.t;
        out[d][a].lane = e.lane || out[d][a].lane;
      }
    }
    return out;
  }

  function renderTable(agg){
    const wrap = $('#tableWrap');
    if (!agg || !Object.keys(agg).length){
      wrap.innerHTML = '<div style="padding:12px;">Ingen data.</div>';
      return;
    }
    const drivers = Object.keys(agg).sort();
    let html = '';
    for (const d of drivers){
      html += `<h2 style="padding:12px 12px 0;">Sjåfør: ${d}</h2>`;
      html += `<table class="rep"><thead><tr>
        <th>Adresse</th><th>Fil</th><th>Start</th><th>Slutt</th><th>Varighet</th><th>Type</th>
      </tr></thead><tbody>`;
      const rows = Object.values(agg[d]).sort((a,b)=> (a.started_at||'').localeCompare(b.started_at||''));
      for (const r of rows){
        const doneType = (r.actions||[]).find(x=>x.action==='address_finish') ? 'Ferdig' :
                         (r.actions||[]).find(x=>x.action==='address_block') ? 'Ikke mulig' :
                         (r.actions||[]).find(x=>x.action==='address_skip') ? 'Hoppet over' : '';
        html += `<tr>
          <td>${r.addr_name||r.addr_id||''}</td>
          <td>${r.addr_id||''}</td>
          <td>${r.started_at? fmtDate(r.started_at): ''}</td>
          <td>${r.finished_at? fmtDate(r.finished_at): ''}</td>
          <td>${typeof r.duration_ms==='number'? fmtDur(r.duration_ms): ''}</td>
          <td>${r.lane==='grit'?'Grus':(r.lane==='snow'?'Snø':'')}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }
    wrap.innerHTML = html;
  }

  async function init(){
    const keyInput = $('#key');
    keyInput.value = getAdminKey();
    $('#load').addEventListener('click', async ()=>{
      const key = keyInput.value.trim();
      if (!key) return alert('Legg inn Master Key først (Admin → Sync).');
      $('#summary').textContent = 'Laster...';
      try{
        const events = await fetchLatest(key);
        $('#summary').textContent = `Hendelser i JSONBin: ${events.length}`;
        const agg = aggregate(events.filter(e => e && e.action));
        renderTable(agg);
      }catch(e){
        $('#summary').textContent = 'Feil: '+e.message;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
