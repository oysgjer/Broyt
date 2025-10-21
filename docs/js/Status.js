// ======================================================
// Status.js – viser statusliste + nullstill-funksjoner
// v10.6 – stabil
// ======================================================
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_RUN   = 'BRYT_RUN';
  const K_ADDR  = 'BRYT_ADDR';
  const K_STAT  = 'BRYT_STATUS';

  const STATE_LABEL = {
    waiting:     'Venter',
    in_progress: 'Pågår',
    done:        'Ferdig',
    skipped:     'Hoppet over',
    blocked:     'Ikke mulig'
  };

  const FILTERS = [
    {key:'alle',     label:'Alle'},
    {key:'venter',   label:'Venter'},
    {key:'pågår',    label:'Pågår'},
    {key:'ferdig',   label:'Ferdig'},
    {key:'hoppet',   label:'Hoppet over'},
    {key:'umulig',   label:'Ikke mulig'},
  ];

  // ---------- Hjelp ----------
  function mapsUrlFromAddr(a){
    if (!a) return 'https://www.google.com/maps';
    if (a.coords && /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(a.coords)){
      const q = a.coords.replace(/\s+/g,'');
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((a.name||'')+', Norge');
  }

  function summarize(addrs, bag){
    const c = {tot:addrs.length, venter:0, pågår:0, ferdig:0, hoppet:0, umulig:0};
    addrs.forEach(a=>{
      const st = (bag[a.name]?.state) || 'waiting';
      if (st==='waiting') c.venter++;
      else if (st==='in_progress') c.pågår++;
      else if (st==='done') c.ferdig++;
      else if (st==='skipped') c.hoppet++;
      else if (st==='blocked') c.umulig++;
    });
    return c;
  }

  function renderStatusUI(){
    const host = $('#status');
    if (!host) return;

    // Bygg UI hvis ikke allerede gjort
    if (!host.dataset.enhanced){
      host.innerHTML = `
        <h1>Status</h1>

        <div class="work-top" id="st_top">
          <div class="work-prog" style="height:8px">
            <div class="other" id="st_prog_other"></div>
            <div class="me" id="st_prog_me"></div>
          </div>
          <div class="work-caption">
            <div><strong id="st_me_count">0/0</strong> mine • <strong id="st_other_count">0/0</strong> andre</div>
            <div id="st_summary">0 av 0 adresser fullført</div>
          </div>
        </div>

        <div class="row" style="justify-content:space-between; gap:8px; margin:12px 0 6px">
          <label class="field" style="margin:0; flex:1">
            <span>Filter</span>
            <select id="st_filter" class="input"></select>
          </label>
          <div class="row" style="gap:8px">
            <button id="st_reset_mine" class="btn-ghost">Nullstill mine</button>
            <button id="st_reset_all"  class="btn-ghost">Nullstill alle</button>
          </div>
        </div>

        <div class="card" style="padding:0">
          <table style="width:100%; border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--sep)">
                <th style="text-align:left; padding:10px 12px; width:44px">#</th>
                <th style="text-align:left; padding:10px 12px">Adresse</th>
                <th style="text-align:left; padding:10px 12px">Oppdrag</th>
                <th style="text-align:left; padding:10px 12px">Status</th>
                <th style="text-align:left; padding:10px 12px">Start</th>
                <th style="text-align:left; padding:10px 12px">Ferdig</th>
                <th style="text-align:left; padding:10px 12px">Utført av</th>
                <th style="text-align:center; padding:10px 12px">🧭</th>
              </tr>
            </thead>
            <tbody id="st_tbody"></tbody>
          </table>
        </div>
      `;
      host.dataset.enhanced = '1';

      // Fyll filter
      const sel = $('#st_filter');
      FILTERS.forEach(f=>{
        const o = document.createElement('option');
        o.value = f.key; o.textContent = f.label;
        sel.appendChild(o);
      });
      sel.value = 'alle';

      // Wire-knapper
      $('#st_filter')?.addEventListener('change', renderList);
      $('#st_reset_all')?.addEventListener('click', resetAll);
      $('#st_reset_mine')?.addEventListener('click', resetMine);
    }

    renderList();
  }

  function updateProgressHeader(addrs, bag, driver){
    const total = addrs.length || 1;
    let me = 0, other = 0;

    for (const n in bag){
      const st = bag[n];
      if (st?.state === 'done'){
        if (st.driver === driver) me++; else other++;
      }
    }
    const mePct = Math.round(100 * me / total);
    const otPct = Math.round(100 * other / total);

    $('#st_prog_me')?.style && ($('#st_prog_me').style.width = mePct + '%');
    $('#st_prog_other')?.style && ($('#st_prog_other').style.width = otPct + '%');

    $('#st_me_count').textContent = `${me}/${total}`;
    $('#st_other_count').textContent = `${other}/${total}`;
    $('#st_summary').textContent = `${Math.min(me+other,total)} av ${total} adresser fullført`;
  }

  function renderList(){
    const run  = readJSON(K_RUN, {});
    const addrsSrc = readJSON(K_ADDR, []);
    const addrs = addrsSrc.filter(a => a.active !== false);
    const bag = readJSON(K_STAT, {});

    updateProgressHeader(addrs, bag, run.driver || '');

    const sel = $('#st_filter')?.value || 'alle';
    const tbody = $('#st_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterOk = (st) => {
      if (sel === 'alle') return true;
      if (sel === 'venter') return st === 'waiting';
      if (sel === 'pågår')  return st === 'in_progress';
      if (sel === 'ferdig') return st === 'done';
      if (sel === 'hoppet') return st === 'skipped';
      if (sel === 'umulig') return st === 'blocked';
      return true;
    };

    addrs.forEach((a, i) => {
      const s = bag[a.name] || {state:'waiting'};
      if (!filterOk(s.state)) return;

      const oppdrag = (run?.equipment?.sand) ? 'Strø grus' : 'Fjerne snø';
      const startTxt  = s.startedAt ? new Date(s.startedAt).toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'}) : '—';
      const finishTxt = s.finishedAt? new Date(s.finishedAt).toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'}) : '—';
      const nav = `<a href="${mapsUrlFromAddr(a)}" target="_blank" rel="noopener">🧭</a>`;

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--sep)';
      tr.innerHTML = `
        <td style="padding:10px 12px">${i+1}</td>
        <td style="padding:10px 12px">${a.name || ''}</td>
        <td style="padding:10px 12px">${oppdrag}</td>
        <td style="padding:10px 12px">${STATE_LABEL[s.state] || 'Venter'}</td>
        <td style="padding:10px 12px">${startTxt}</td>
        <td style="padding:10px 12px">${finishTxt}</td>
        <td style="padding:10px 12px">${s.driver || '—'}</td>
        <td style="padding:10px 12px; text-align:center">${nav}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function resetAll(){
    if (!confirm('Nullstille denne runden for alle?')) return;
    const addrsSrc = readJSON(K_ADDR, []);
    const addrs = addrsSrc.filter(a => a.active !== false);

    const bag = readJSON(K_STAT, {});
    addrs.forEach(a=>{
      bag[a.name] = { state:'waiting', startedAt:null, finishedAt:null, driver:null };
    });
    writeJSON(K_STAT, bag);

    // TODO: Sync til JSONBin om ønskelig:
    // if (window.Sync) await window.Sync.saveStatus(bag);

    renderList();
    alert('Runden er nullstilt for alle.');
  }

  function resetMine(){
    const run = readJSON(K_RUN, {});
    const me = run.driver || '';
    if (!me){ alert('Fant ikke førernavn (Hjem-siden).'); return; }
    if (!confirm('Nullstille dine punkter?')) return;

    const bag = readJSON(K_STAT, {});
    for (const k in bag){
      if (bag[k]?.driver === me){
        bag[k] = { state:'waiting', startedAt:null, finishedAt:null, driver:null };
      }
    }
    writeJSON(K_STAT, bag);

    // TODO: Sync til JSONBin om ønskelig:
    // if (window.Sync) await window.Sync.saveStatus(bag);

    renderList();
    alert('Dine punkter er nullstilt.');
  }

  // Re-render når vi åpner Status-siden via hash
  window.addEventListener('hashchange', ()=>{
    const id = (location.hash || '#home').replace('#','');
    if (id === 'status') renderStatusUI();
  });

  document.addEventListener('DOMContentLoaded', ()=>{
    // Vis når siden faktisk er aktiv
    const id = (location.hash || '#home').replace('#','');
    if (id === 'status') renderStatusUI();
  });
})();