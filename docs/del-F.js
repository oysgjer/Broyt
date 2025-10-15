<!-- del-F.js -->
<script>
/* ===== del-F.js – Under arbeid ===== */
(() => {
  if (!window.Core) { console.error("Core mangler – last del-C.js først"); return; }
  const Core = window.Core;

  /* ---------- CSS injiseres lett ---------- */
  const style = document.createElement('style');
  style.textContent = `
  #work .work-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  #work .badge { display:inline-block; border:1px solid #2a2f36; border-radius:999px; padding:2px 8px; font-size:12px; color:#b9c2cc; }
  #work .muted { color:#b9c2cc; font-size:12px; }
  #work .title { font-weight:700; font-size:18px; margin:8px 0 0 0; }
  #work .progress { position:relative; width:100%; height:14px; border-radius:999px; background:#242830; border:1px solid #2a2f36; overflow:hidden; }
  #work .progress .bar { position:absolute; top:0; bottom:0; left:0; width:0%; background:linear-gradient(90deg,#0f9d58,#22c55e); transition:width .25s ease; }
  #work .progress.reverse .bar { right:0; left:auto; }
  #work .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  #work .btn { background:#333; color:#fff; border:none; padding:10px 14px; border-radius:12px; font-weight:700; cursor:pointer; }
  #work .btn-green { background:#0f9d58; }
  #work .btn-blue  { background:#0b66ff; }
  #work .btn-red   { background:#c21d03; }
  #work .btn-gray  { background:#2f3337; }
  #work .list .card { background:#181a1e; border:1px solid #2a2f36; border-radius:14px; padding:12px; margin:10px 0; }
  #work .line { display:flex; justify-content:space-between; gap:8px; }
  #work .small { font-size:12px; }
  #work .pill { display:inline-block; border:1px solid #2a2f36; border-radius:999px; padding:2px 8px; font-size:12px; }
  `;
  document.head.appendChild(style);

  /* ---------- Interne helpers ---------- */
  function ensureStopShape(s){
    // migrer gamle felt -> nye delmål (snow/grit)
    if (!s.snow) s.snow = { started:null, finished:null, done:!!s.f, by:"" };
    if (!s.grit) s.grit = { started:null, finished:null, done:false, by:"" };
    if (s.f && !s.snow.done) s.snow.done = true;
    if (s.started && !s.snow.started) s.snow.started = s.started;
    if (s.finished && !s.snow.finished) s.snow.finished = s.finished;
    // brøytestikker-feltene beholdes som før (pinsCount / pinsLockedYear)
  }

  function requiresGrit(s){
    // Oppgaven avgjør om grus (🪨) kreves
    const t = String(s.t||"");
    return /grus/i.test(t);
  }

  function listOrder(){
    const S = Core.state;
    const base = (S.stops||[]).map((s,i)=>({i,s}));
    // filtrer ikke-utførte først: vi lar alt vises, men progress teller krav
    const arr = base;
    return (S.direction === 'reverse') ? arr.slice().reverse() : arr;
  }

  function totals(){
    const stops = Core.state.stops || [];
    let need = 0, done = 0;
    stops.forEach(s=>{
      ensureStopShape(s);
      // ❄️ alltid krav
      need += 1;
      if (s.snow?.done) done += 1;
      // 🪨 krav bare hvis oppgaven krever grus
      if (requiresGrit(s)){
        need += 1;
        if (s.grit?.done) done += 1;
      }
    });
    const pct = need ? Math.round(100*done/need) : 0;
    return { need, done, pct };
  }

  function currentName(){
    const arr = listOrder();
    const idx = Core.state.ui?.cursor || 0;
    return arr[idx]?.s?.n || "—";
  }

  function setCursor(i){
    Core.state.ui = Core.state.ui || {};
    Core.state.ui.cursor = i;
    Core.save();
  }

  function advanceCursor(){
    const arr = listOrder();
    const cur = Core.state.ui?.cursor || 0;
    if (cur < arr.length-1){
      setCursor(cur+1);
    }
  }

  function now() { return Date.now(); }

  function renderHeader(host){
    const t = totals();
    const dir = Core.state.direction === 'reverse' ? 'Motsatt' : 'Normal';
    const eq = Core.state.equipment || {};
    // visningsnavn i henhold til ønsket terminologi
    const eqList = []
      .concat(eq.plog||eq.skjaer ? ['Skjær'] : [])
      .concat(eq.fres ? ['Fres'] : [])
      .concat(eq.stro||eq.strokasse ? ['Strøkasse'] : []);
    const who = Core.displayName();

    host.innerHTML = `
      <div class="work-head">
        <span class="badge">Sjåfør: ${Core.esc(who)}</span>
        <span class="badge">Retning: ${dir}</span>
        <span class="badge">Utstyr: ${eqList.join(', ') || '—'}</span>
      </div>

      <div class="row" style="margin-top:8px">
        <div class="muted" id="wkProgTxt">${t.pct}% fullført (${t.done}/${t.need})</div>
      </div>
      <div class="progress ${Core.state.direction==='reverse'?'reverse':''}" style="margin:6px 0 14px">
        <div class="bar" id="wkProgBar" style="width:${t.pct}%"></div>
      </div>

      <div class="line">
        <div class="small muted">Nå: <b id="wkCurName">${Core.esc(currentName())}</b></div>
        <div class="small muted" id="wkLastSync">—</div>
      </div>
    `;
  }

  function fmtHM(ts){
    if(!ts) return '—';
    const d=new Date(ts);
    return d.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
  }

  function renderList(host){
    const rows = listOrder();
    const cur = Core.state.ui?.cursor || 0;
    host.innerHTML = rows.map((x,idx)=>{
      const s = x.s; ensureStopShape(s);
      const curMark = (idx===cur) ? ' (nå)' : '';
      const gritReq = requiresGrit(s);

      return `
        <div class="card" data-idx="${idx}">
          <div class="line">
            <div class="title">${Core.esc(s.n)}${curMark}</div>
            <div>
              ${s.twoDriverRec?`<span class="pill">👥</span>`:''}
              ${s.pinsLockedYear?`<span class="pill">📍${s.pinsCount??0}</span>`:''}
            </div>
          </div>
          <div class="small muted">${Core.esc(s.t || '')}</div>

          <div class="row" style="margin-top:8px">
            <button class="btn btn-gray act-start"   data-idx="${idx}">Start</button>
            <button class="btn btn-green act-snow"   data-idx="${idx}">Fullført ❄️</button>
            ${gritReq
              ? `<button class="btn btn-blue act-grit" data-idx="${idx}">Strødd 🪨</button>`
              : `<button class="btn btn-blue act-grit" data-idx="${idx}" title="Oppgaven krever ikke strø – valgfritt">Strødd 🪨</button>`}
            <button class="btn btn-gray act-next"   data-idx="${idx}">Neste →</button>
          </div>

          <div class="small muted" style="margin-top:6px">
            ❄️ ${s.snow.started?`Startet kl ${fmtHM(s.snow.started)}`:'Ikke startet'}
            ${s.snow.finished?` · Ferdig kl ${fmtHM(s.snow.finished)}`:''}
            ${s.snow.by?` · av ${Core.esc(s.snow.by)}`:''}
          </div>
          <div class="small muted">
            🪨 ${s.grit.started?`Startet kl ${fmtHM(s.grit.started)}`:'Ikke startet'}
            ${s.grit.finished?` · Ferdig kl ${fmtHM(s.grit.finished)}`:''}
            ${s.grit.by?` · av ${Core.esc(s.grit.by)}`:''}
          </div>
        </div>
      `;
    }).join('');
  }

  function updateProgressUI(){
    const t = totals();
    const bar = document.getElementById('wkProgBar');
    const txt = document.getElementById('wkProgTxt');
    if (bar) bar.style.width = t.pct + '%';
    if (txt) txt.textContent = `${t.pct}% fullført (${t.done}/${t.need})`;

    // fellesstatus
    Core.status.updateSelf({
      progress: t.pct,
      current: currentName()
    }).catch?.(()=>{});
  }

  function updateCurName(){
    const el = document.getElementById('wkCurName');
    if (el) el.textContent = currentName();
  }

  function updateLastSync(){
    const el = document.getElementById('wkLastSync');
    if (!el) return;
    const t = Core.fmtTime(Core.state.lastSyncAt);
    const by = Core.state.lastSyncBy || '—';
    el.textContent = `Sist synk: ${t} (${by})`;
  }

  function actStart(idx){
    const arr = listOrder();
    const real = arr[idx]?.i;
    if (real == null) return;
    const s = Core.state.stops[real]; ensureStopShape(s);
    const who = Core.displayName();

    // marker start for ❄️ (og for 🪨 dersom utstyr = strøkasse og grit ikke startet)
    if (!s.snow.started) s.snow.started = now();
    if (!s.snow.by) s.snow.by = who;
    // starter ikke automatisk grit – det starter når man trykker "Strødd" (eller Start hvis man har strøkasse?)
    Core.save();
    updateCurName();
    renderList(Core.qs('#workList'));
    updateProgressUI();
  }

  function actSnowDone(idx){
    const arr = listOrder();
    const real = arr[idx]?.i;
    if (real == null) return;
    const s = Core.state.stops[real]; ensureStopShape(s);
    const who = Core.displayName();

    if (!s.snow.started) s.snow.started = now();
    s.snow.done = true;
    s.snow.finished = now();
    s.snow.by = who;

    // gammelt felt for kompatibilitet (om noe annet leser det)
    s.f = true;
    s.finished = s.snow.finished;

    Core.save();
    renderList(Core.qs('#workList'));
    updateProgressUI();

    // hopp til neste
    const cur = Core.state.ui?.cursor || 0;
    if (cur === idx) advanceCursor();
    updateCurName();
  }

  function actGritDone(idx){
    const arr = listOrder();
    const real = arr[idx]?.i;
    if (real == null) return;
    const s = Core.state.stops[real]; ensureStopShape(s);
    const who = Core.displayName();

    if (!s.grit.started) s.grit.started = now();
    s.grit.done = true;
    s.grit.finished = now();
    s.grit.by = who;

    Core.save();
    renderList(Core.qs('#workList'));
    updateProgressUI();
  }

  function actNext(idx){
    const cur = Core.state.ui?.cursor || 0;
    if (idx === cur){
      advanceCursor();
      updateCurName();
      // scroll litt ned for å vise ny "nå"
      const list = Core.qs('#workList');
      if (list){
        const card = list.querySelector(`[data-idx="${cur+1}"]`);
        if (card) card.scrollIntoView({behavior:'smooth', block:'start'});
      }
    } else {
      setCursor(idx);
      updateCurName();
      renderList(Core.qs('#workList'));
    }
  }

  function attachListHandlers(){
    const list = Core.qs('#workList');
    if (!list) return;
    list.onclick = (e)=>{
      const btn = e.target.closest('button');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      if (btn.classList.contains('act-start')) return actStart(idx);
      if (btn.classList.contains('act-snow'))  return actSnowDone(idx);
      if (btn.classList.contains('act-grit'))  return actGritDone(idx);
      if (btn.classList.contains('act-next'))  return actNext(idx);
    };
  }

  function render(){
    const headHost = Core.qs('#work');
    if (!headHost) return;
    // topp
    const top = document.createElement('div');
    renderHeader(top);
    headHost.innerHTML = '';
    headHost.appendChild(top);

    // liste
    const listWrap = document.createElement('div');
    listWrap.id = 'workList';
    headHost.appendChild(listWrap);

    renderList(listWrap);
    updateLastSync();
    updateProgressUI();
    attachListHandlers();
  }

  /* ---------- Koble til navigasjon + knapp "Start ny runde" ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    // Når man trykker "Start ny runde" i Hjem
    const startBtn = document.getElementById('startBtn');
    if (startBtn){
      startBtn.addEventListener('click', ()=>{
        // index.html show('work') bytter seksjon; vi re-render etter en liten delay
        setTimeout(()=> render(), 50);
      });
    }

    // Når man manuelt går til "Under arbeid"-fanen via navbar
    const nav = document.querySelector('nav');
    if (nav){
      nav.addEventListener('click', (e)=>{
        const b = e.target.closest('button');
        if (!b) return;
        if (b.textContent && /under arbeid/i.test(b.textContent)){
          setTimeout(()=> render(), 50);
        }
      });
    }

    // Oppdater "sist synk" periodisk (dersom andre moduler setter lastSyncAt)
    setInterval(updateLastSync, 5000);

    // Start heartbeat (fellesstatus)
    Core.status?.startHeartbeat?.();
  });

  // Eksponer for debugging/andre moduler
  Core.Work = { render };
})();
</script>