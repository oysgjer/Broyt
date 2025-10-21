// js/Status.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---------- helpers ----------
  const fmtDT = (ts) => {
    if (!ts) return '—';
    try{
      const d = new Date(ts);
      const dstr = d.toLocaleDateString('no-NO',{day:'2-digit',month:'2-digit'});
      const tstr = d.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
      return `${dstr} ${tstr}`;
    }catch{ return '—'; }
  };
  const ymd = (ts) => {
    if (!ts) return 'ukjent';
    const d = new Date(ts);
    return d.toISOString().slice(0,10); // YYYY-MM-DD
  };

  // CSV
  function downloadCSV(filename, rows, headers){
    const esc = (v)=> {
      if (v == null) return '';
      const s = String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const lines = [];
    if (headers) lines.push(headers.map(esc).join(';'));
    for(const r of rows) lines.push(r.map(esc).join(';'));
    const blob = new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // UI bygging
  function makeControls(host){
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.style.gap = '8px';
    wrap.style.flexWrap = 'wrap';
    wrap.style.margin = '8px 0 14px';

    // filter-knapper
    const types = [
      {id:'all',  label:'Alle'},
      {id:'snow', label:'Snø'},
      {id:'grit', label:'Grus'},
    ];
    const group = document.createElement('div');
    group.className = 'row';
    group.style.gap = '6px';
    types.forEach(t=>{
      const b = document.createElement('button');
      b.className = 'btn-ghost';
      b.dataset.filter = t.id;
      b.textContent = t.label;
      b.style.padding = '8px 10px';
      group.appendChild(b);
    });

    // runde-velger
    const sel = document.createElement('select');
    sel.id = 'st_round';
    sel.className = 'input';
    sel.style.maxWidth = '260px';

    // knapper
    const bMine = document.createElement('button');
    bMine.className = 'btn-ghost';
    bMine.textContent = 'Nullstill mine';

    const bAll  = document.createElement('button');
    bAll.className = 'btn-ghost';
    bAll.textContent = 'Nullstill alt';

    const bCsv  = document.createElement('button');
    bCsv.className = 'btn';
    bCsv.textContent = 'Eksporter CSV';

    wrap.appendChild(group);
    wrap.appendChild(sel);
    wrap.appendChild(bMine);
    wrap.appendChild(bAll);
    wrap.appendChild(bCsv);
    host.appendChild(wrap);

    return {wrap, group, sel, bMine, bAll, bCsv};
  }

  function makeTable(headers, rows){
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';

    const thead = document.createElement('thead');
    const trH = document.createElement('tr');
    headers.forEach(h=>{
      const th = document.createElement('th');
      th.textContent = h;
      th.style.textAlign = h==='#' ? 'right' : 'left';
      th.style.padding = '10px 12px';
      th.style.position = 'sticky';
      th.style.top = '0';
      th.style.background = 'var(--surface)';
      th.style.borderBottom = '1px solid var(--sep)';
      th.style.fontWeight = '700';
      trH.appendChild(th);
    });
    thead.appendChild(trH);

    const tbody = document.createElement('tbody');
    rows.forEach((cells, i)=>{
      const tr = document.createElement('tr');
      if (i%2===1) tr.style.background = 'rgba(255,255,255,0.03)';
      cells.forEach((c, ci)=>{
        const td = document.createElement('td');
        td.textContent = c;
        td.style.padding = '10px 12px';
        td.style.borderBottom = '1px solid var(--sep)';
        td.style.whiteSpace = ci===1 ? 'normal' : 'nowrap';
        td.style.textAlign = ci===0 ? 'right' : 'left';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  // ---------- hovedrender ----------
  async function render(){
    const host = $('#status');
    if (!host) return;

    host.innerHTML = '<h1>Status</h1>';

    // kontroller
    const ui = makeControls(host);

    // last data
    const cloud = await window.Sync.loadCloud();
    const addrs = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses.slice() : [];
    const snow  = cloud?.statusSnow || {};
    const grit  = cloud?.statusGrit || {};

    // bygg runde-liste (roundId hvis finnes, ellers dato)
    const rounds = new Map(); // roundId -> label
    function addRoundFrom(entry){
      if (!entry) return;
      const rid = entry.roundId || ymd(entry.startedAt || entry.finishedAt || Date.now());
      const lbl = entry.roundId ? entry.roundId : rid; // enkel label; kan pyntes
      if (!rounds.has(rid)) rounds.set(rid, lbl);
    }
    Object.values(snow).forEach(addRoundFrom);
    Object.values(grit).forEach(addRoundFrom);
    if (rounds.size===0){
      const today = ymd(Date.now());
      rounds.set(today, today);
    }

    // fyll select
    ui.sel.innerHTML = '';
    for (const [rid,lbl] of rounds.entries()){
      const opt = document.createElement('option');
      opt.value = rid; opt.textContent = `Runde: ${lbl}`;
      ui.sel.appendChild(opt);
    }

    // nåværende filter
    let filter = 'all'; // all|snow|grit
    let curRound = ui.sel.value;

    // hjelp for å hente "entry for runde" per adresse
    function pickByRound(obj, name){
      const e = obj[name];
      if (!e) return null;
      const rid = e.roundId || ymd(e.startedAt || e.finishedAt || Date.now());
      return (rid === curRound) ? e : null;
    }

    function buildRows(){
      // sorter adresser
      addrs.sort((a,b)=> (a.name||'').localeCompare(b.name||'','no'));
      const rows = [];
      let n = 0;
      for (const a of addrs){
        const sS = pickByRound(snow, a.name);
        const sG = pickByRound(grit, a.name);

        // filtrering
        if (filter==='snow' && !sS) continue;
        if (filter==='grit' && !sG) continue;

        const driver = (sS?.driver || sG?.driver) || '—';
        rows.push([
          String(++n),
          a.name || '—',
          fmtDT(sS?.startedAt),
          fmtDT(sS?.finishedAt),
          fmtDT(sG?.startedAt),
          fmtDT(sG?.finishedAt),
          driver
        ]);
      }
      return rows;
    }

    function drawTable(){
      $('#st_table_wrap')?.remove();
      const rows = buildRows();
      const headers = ['#','Adresse','Start snø','Slutt snø','Start grus','Slutt grus','Sjåfør'];
      const table = makeTable(headers, rows);
      const card = document.createElement('div');
      card.id = 'st_table_wrap';
      card.className = 'card';
      card.style.overflowX = 'auto';
      card.appendChild(table);
      host.appendChild(card);
      return rows;
    }

    // første tegning
    let lastRows = drawTable();

    // --- handlinger ---
    // filter-knapper
    ui.wrap.addEventListener('click', (e)=>{
      const b = e.target.closest('button');
      if (!b) return;
      const f = b.dataset.filter;
      if (!f) return;

      filter = f;
      // visuelt: markér aktiv
      $$('.btn-ghost[data-filter]').forEach(x=> x.style.outline='none');
      b.style.outline = '2px solid var(--primary)';
      lastRows = drawTable();
    });

    // rundevalg
    ui.sel.addEventListener('change', ()=>{
      curRound = ui.sel.value;
      lastRows = drawTable();
    });

    // Eksport CSV
    ui.bCsv.addEventListener('click', ()=>{
      const headers = ['#','Adresse','Start snø','Slutt snø','Start grus','Slutt grus','Sjåfør'];
      downloadCSV('status.csv', lastRows, headers);
    });

    // Nullstill mine / alt
    async function reset(kind){ // 'mine' | 'all'
      try{
        const me = (localStorage.getItem('BRYT_SETTINGS') && JSON.parse(localStorage.getItem('BRYT_SETTINGS')||'{}')?.driver) || '';
        // Iterer alle adresser – nullstill for valgt filter + runde
        for (const a of addrs){
          if (filter==='all' || filter==='snow'){
            const e = snow[a.name];
            const rid = e?.roundId || ymd(e?.startedAt || e?.finishedAt);
            const belongs = !!e && rid===curRound && (kind==='all' || e.driver===me);
            if (belongs){
              await window.Sync.setStatus(a.name, { type:'snow', state:'none', roundId: curRound });
            }
          }
          if (filter==='all' || filter==='grit'){
            const e = grit[a.name];
            const rid = e?.roundId || ymd(e?.startedAt || e?.finishedAt);
            const belongs = !!e && rid===curRound && (kind==='all' || e.driver===me);
            if (belongs){
              await window.Sync.setStatus(a.name, { type:'grit', state:'none', roundId: curRound });
            }
          }
        }
        // last på nytt
        const newCloud = await window.Sync.loadCloud(true);
        Object.assign(snow, newCloud?.statusSnow||{});
        Object.assign(grit, newCloud?.statusGrit||{});
        lastRows = drawTable();
        alert(kind==='all' ? 'Alle nullstilt for valgt runde.' : 'Mine statuser er nullstilt for valgt runde.');
      }catch(err){
        console.error(err);
        alert('Kunne ikke nullstille: ' + (err?.message||err));
      }
    }

    ui.bMine.addEventListener('click', ()=> reset('mine'));
    ui.bAll .addEventListener('click', ()=> reset('all'));
  }

  // ---------- init ----------
  function wire(){
    const go = () => {
      const id = (location.hash||'#home').slice(1);
      if (id === 'status') render().catch(console.error);
    };
    window.addEventListener('hashchange', go);
    if ((location.hash||'#home').slice(1) === 'status') go();
  }
  document.addEventListener('DOMContentLoaded', wire);
})();