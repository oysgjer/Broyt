// docs/js/reports_view.js
(() => {
  'use strict';
  const BIN_ID = '68e89e3443b1c97be9611c48'; // Report bin (privat)

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function getApiKey(){
    try {
      if (window.Sync && typeof window.Sync.getConfig === 'function') {
        const cfg = window.Sync.getConfig();
        if (cfg && cfg.apiKey) return cfg.apiKey;
      }
    } catch {}
    return localStorage.getItem('BRYT_REPORTS_MASTER_KEY') || '';
  }

  async function fetchReports(){
    const key = getApiKey();
    if (!key) throw new Error('Mangler Master Key (Admin).');

    const latestRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {'X-Master-Key': key, 'cache':'no-store'}
    });
    if (!latestRes.ok) throw new Error(`JSONBin latest ${latestRes.status}`);
    const j = await latestRes.json();
    let arr = Array.isArray(j?.record) ? j.record : [];
    // hold bare service_report
    arr = arr.filter(x => x && (x.type === 'service_report' || x.round || x.data?.round));
    // normaliser til {t, data}
    return arr.map(x => (x.data ? x : { t: x.t || x.data?.round?.end_at || x.round?.end_at, data: x }));
  }

  function unique(values){
    return [...new Set(values)].filter(Boolean).sort((a,b)=> String(a).localeCompare(String(b),'nb'));
  }

  function applyFilters(rows){
    const fDriver = $('#rep_f_driver')?.value || '';
    const fLane   = $('#rep_f_lane')?.value || '';
    const fFrom   = $('#rep_f_from')?.value || '';
    const fTo     = $('#rep_f_to')?.value   || '';

    return rows.filter(r => {
      const d = r.data.round || r.data.data?.round || {};
      if (fDriver && (d.driver||'') !== fDriver) return false;
      if (fLane && (d.lane||'') !== fLane) return false;
      const endAt = d.end_at || d.start_at;
      if (fFrom && endAt && endAt < (new Date(fFrom).toISOString())) return false;
      if (fTo   && endAt && endAt > (new Date(fTo+'T23:59:59').toISOString())) return false;
      return true;
    });
  }

  function msToMin(ms){ return Math.round((ms||0)/60000); }
  function msToHms(ms){
    const s = Math.round((ms||0)/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const ss= s%60;
    const pad = n => String(n).padStart(2,'0');
    return `${pad(h)}:${pad(m)}:${pad(ss)}`;
  }

  function renderSummary(rows){
    const box = $('#rep_summary');
    if (!box) return;
    let totalRounds=0, totalDone=0, totalSkipped=0, totalBlocked=0, totalTime=0;
    for (const r of rows){
      const s = r.data.summary || r.data.data?.summary || {};
      totalRounds += 1;
      totalDone   += s.addresses_done || 0;
      totalSkipped+= s.addresses_skipped || 0;
      totalBlocked+= s.addresses_blocked || 0;
      totalTime   += s.time_done_ms || 0;
    }
    box.innerHTML = `
      <div class="rep-kpi"><div class="k">Runder</div><div class="v">${totalRounds}</div></div>
      <div class="rep-kpi"><div class="k">Fullført</div><div class="v">${totalDone}</div></div>
      <div class="rep-kpi"><div class="k">Hoppet</div><div class="v">${totalSkipped}</div></div>
      <div class="rep-kpi"><div class="k">Blokkert</div><div class="v">${totalBlocked}</div></div>
      <div class="rep-kpi"><div class="k">Arbeidstid</div><div class="v">${msToMin(totalTime)} min</div></div>
    `;
  }

  function renderTable(rows){
    const tbody = $('#rep_tbody');
    const thead = $('#rep_thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `
      <tr>
        <th>Dato</th><th>Runde</th><th>Sjåfør</th><th>Spor</th>
        <th>Adr. (tot/ferdig/hopp/blokk)</th>
        <th>Arbeidstid</th>
        <th>Snitt/adr</th>
        <th>Handlinger</th>
      </tr>`;

    tbody.innerHTML = rows.map(r => {
      const d = r.data.round || r.data.data?.round || {};
      const s = r.data.summary || r.data.data?.summary || {};
      const dateStr = d.end_at ? new Date(d.end_at).toLocaleString('nb-NO') : '';
      const lane = d.lane==='grit' ? 'Grus' : 'Snø';
      const tot = s.addresses_total||0;
      const done= s.addresses_done||0;
      const hop = s.addresses_skipped||0;
      const blk = s.addresses_blocked||0;
      const mins= msToMin(s.time_done_ms||0);
      const avg = s.avg_per_address_ms ? msToMin(s.avg_per_address_ms*1.0) : 0;

      return `
        <tr>
          <td>${dateStr}</td>
          <td>${d.label||''}</td>
          <td>${d.driver||''}</td>
          <td>${lane}</td>
          <td>${tot}/${done}/${hop}/${blk}</td>
          <td>${mins} min</td>
          <td>${avg} min</td>
          <td>
            <button class="mini" data-act="view" data-id="${d.label}">Åpne</button>
            <button class="mini" data-act="csv" data-id="${d.label}">CSV</button>
            <button class="mini" data-act="json" data-id="${d.label}">JSON</button>
          </td>
        </tr>`;
    }).join('');
  }

  function renderDetails(rep){
    const box = $('#rep_details');
    if (!box) return;
    const d = rep.round;
    const s = rep.summary;

    const addrRows = rep.addresses.map(a => `
      <tr>
        <td>${a.name}</td>
        <td>${a.action}</td>
        <td>${a.started_at? new Date(a.started_at).toLocaleTimeString('nb-NO'):'–'}</td>
        <td>${a.finished_at? new Date(a.finished_at).toLocaleTimeString('nb-NO'):'–'}</td>
        <td>${a.duration_ms? msToHms(a.duration_ms):'–'}</td>
      </tr>
    `).join('');

    box.innerHTML = `
      <div class="rep-detail-card">
        <div class="title">Detaljer – ${d.label}</div>
        <div class="muted">Sjåfør: <b>${d.driver}</b> • Spor: <b>${d.lane==='grit'?'Grus':'Snø'}</b> • Varighet: ${msToHms(d.duration_ms)}</div>
        <div class="muted" style="margin-top:6px;">Periode: ${new Date(d.start_at).toLocaleString('nb-NO')} – ${new Date(d.end_at).toLocaleString('nb-NO')}</div>
        <table class="rep-table" style="margin-top:12px;">
          <thead><tr><th>Adresse</th><th>Handling</th><th>Start</th><th>Slutt</th><th>Varighet</th></tr></thead>
          <tbody>${addrRows}</tbody>
        </table>
      </div>
    `;
    box.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function toCSV(rep){
    const header = ['Adresse','Handling','Start','Slutt','Varighet_s'];
    const rows = rep.addresses.map(a => [
      (a.name||'').replaceAll('"','""'),
      a.action||'',
      a.started_at||'',
      a.finished_at||'',
      Math.round((a.duration_ms||0)/1000)
    ]);
    const csv = [header.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    return new Blob([csv], {type:'text/csv'});
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  function wire(){
    const btnLoad = $('#rep_load');
    const btnReset= $('#rep_reset');
    btnLoad?.addEventListener('click', onLoad);
    btnReset?.addEventListener('click', () => {
      $('#rep_f_driver').value = '';
      $('#rep_f_lane').value = '';
      $('#rep_f_from').value = '';
      $('#rep_f_to').value = '';
      onLoad();
    });

    $('#rep_table')?.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const act = t.dataset.act;
      if (!act) return;
      const label = t.dataset.id;
      const rep = window.__REP_CACHE__?.find(x => (x.data.round?.label || x.data.data?.round?.label) === label)?.data;
      const pure = rep?.data ? rep.data : rep;
      if (!pure) return;

      if (act === 'view') {
        renderDetails(pure);
      } else if (act === 'json') {
        const safe = (pure.round.label||'rapport').replace(/\s+/g,'_').replace(/[()]/g,'');
        downloadBlob(new Blob([JSON.stringify(pure,null,2)],{type:'application/json'}), `rapport_${safe}.json`);
      } else if (act === 'csv') {
        const safe = (pure.round.label||'rapport').replace(/\s+/g,'_').replace(/[()]/g,'');
        downloadBlob(toCSV(pure), `rapport_${safe}.csv`);
      }
    });
  }

  async function onLoad(){
    const status = $('#rep_status');
    const driverSel = $('#rep_f_driver');
    const laneSel = $('#rep_f_lane');
    try {
      status.textContent = 'Henter...';
      const rows = await fetchReports();
      window.__REP_CACHE__ = rows;

      const drivers = unique(rows.map(r => (r.data.round?.driver || r.data.data?.round?.driver || '')));
      driverSel.innerHTML = `<option value="">Alle sjåfører</option>` + drivers.map(d => `<option>${d}</option>`).join('');

      laneSel.innerHTML = `<option value="">Begge spor</option><option value="snow">Snø</option><option value="grit">Grus</option>`;

      const filtered = applyFilters(rows);
      renderSummary(filtered);
      renderTable(filtered);
      status.textContent = `Viser ${filtered.length} runde(r).`;
    } catch (e) {
      console.warn(e);
      status.textContent = 'Kunne ikke hente rapporter. Sjekk Master Key.';
    }
  }

  function bootIfActive(){
    if (location.hash === '#reports' || document.querySelector('#reports')) {
      wire();
    }
  }
  document.addEventListener('DOMContentLoaded', bootIfActive);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#reports') onLoad();
  });
})();
