/* Work.js – Under arbeid
   - Leser adresser fra S.cloud.snapshot.addresses eller BRYT_ADDR (localStorage)
   - Leser/lagrer status i BRYT_STATUS (localStorage)
   - Oppdaterer fremdrift og speiler til Status.js uten re-load
*/
(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const SEC = $('#work');
  if (!SEC) return;

  /* ---------- Datakilder ---------- */
  function loadAddresses(){
    const fromS = (window.S?.cloud?.snapshot?.addresses) || window.S?.addresses;
    if (Array.isArray(fromS) && fromS.length) return fromS;
    try{
      const ls = JSON.parse(localStorage.getItem('BRYT_ADDR')||'[]');
      if (Array.isArray(ls) && ls.length) return ls;
    }catch{}
    return []; // ingen
  }
  function loadStatusMap(){
    try{ return JSON.parse(localStorage.getItem('BRYT_STATUS')||'{}'); }
    catch { return {}; }
  }
  function saveStatusMap(map){
    localStorage.setItem('BRYT_STATUS', JSON.stringify(map));
  }

  // enkel «cursor» for nåværende adresse
  function loadCursor(){
    return Number(localStorage.getItem('BRYT_CURSOR')||'0')||0;
  }
  function saveCursor(i){
    localStorage.setItem('BRYT_CURSOR', String(Math.max(0,i|0)));
  }

  /* ---------- Status-endringer ---------- */
  function setState(addrId, state){
    const map = loadStatusMap();
    const now = new Date().toISOString();
    map[addrId] = Object.assign({}, map[addrId]||{}, {
      state, ts: now
    });
    saveStatusMap(map);
    // Ping «Status»-siden hvis den er lastet (den re-rendrer på refresh-knappen)
    document.dispatchEvent(new CustomEvent('bryt:status-updated', {detail:{id:addrId,state}}));
  }

  /* ---------- Navigering i liste ---------- */
  function nextIndex(from, addrs){
    const n = addrs.length;
    if (!n) return 0;
    for (let i=from+1;i<from+1+n;i++){
      const idx = i % n;
      // gå til neste element (uansett status)
      return idx;
    }
    return from;
  }

  /* ---------- Render ---------- */
  function pct(a,b){ return Math.round(100 * (b? a/b : 0)); }
  function counts(addrs, map){
    const c = { none:0, started:0, done:0, skipped:0, impossible:0, incident:0 };
    addrs.forEach(a=>{
      const st = map[a.id]?.state || 'none';
      if (c[st]!==undefined) c[st]++; else c.none++;
    });
    return c;
  }
  function label(s){
    return s==='none'?'Ikke påbegynt':
           s==='started'?'Pågår':
           s==='done'?'Ferdig':
           s==='skipped'?'Hoppet over':
           s==='impossible'?'Ikke mulig':
           s==='incident'?'Uhell':'—';
  }

  function render(){
    const addrs = loadAddresses();
    const map   = loadStatusMap();
    let cur     = Math.min(loadCursor(), Math.max(0, addrs.length-1));

    // tomt?
    if (!addrs.length){
      SEC.innerHTML = `
        <h1>Under arbeid</h1>
        <div class="card">
          <p>Ingen adresser. Gå til <em>Admin</em> og trykk «Seed demo-adresser», eller last inn dine data.</p>
        </div>
      `;
      return;
    }

    const nowAddr = addrs[cur];
    const nxtAddr = addrs[nextIndex(cur, addrs)];
    const cs      = counts(addrs, map);
    const total   = addrs.length;

    const nowState = map[nowAddr.id]?.state || 'none';

    SEC.innerHTML = `
      <h1>Under arbeid</h1>

      <div class="work-top" style="margin-bottom:16px">
        <div class="work-prog" aria-label="Fremdrift">
          <div class="me"    style="width:${pct(cs.done, total)}%"></div>
          <div class="other" style="width:${pct(cs.started, total)}%"></div>
        </div>
        <div class="work-caption">
          <span><strong>${cs.done}/${total}</strong> mine • <strong>${cs.started}</strong> andre</span>
          <span>${cs.done+cs.started} av ${total} adresser fullført</span>
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin:0 0 6px">
          <span class="muted">Nå</span>
          <div style="font-weight:800; font-size:1.8rem; line-height:1.2">${escapeHtml(nowAddr.name||nowAddr.id)}</div>
        </div>

        <div class="field" style="margin:6px 0 14px">
          <span class="muted">Neste</span>
          <div style="font-weight:600; font-size:1.1rem">${escapeHtml(nxtAddr.name||nxtAddr.id)}</div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap">
          <button id="w_start"  class="btn btn-ghost ${nowState==='done' ? 'pulse' : ''}">▶️ Start</button>
          <button id="w_done"   class="btn ${nowState==='started' ? 'pulse' : ''}">✅ Ferdig</button>
          <button id="w_skip"   class="btn btn-ghost">⏩ Hopp over</button>
          <button id="w_next"   class="btn btn-ghost">➡️ Neste</button>
          <button id="w_nav"    class="btn btn-ghost">🧭 Naviger</button>
          <button id="w_imp"    class="btn btn-ghost">⛔ Ikke mulig</button>
        </div>

        <div class="muted" style="margin-top:10px">
          Oppgave: — • Status: ${label(nowState)}
        </div>
      </div>
    `;

    // ----- knapper -----
    $('#w_start')?.addEventListener('click', ()=>{
      setState(nowAddr.id, 'started');
      render(); // oppdatér visning + puls på «Ferdig»
    });

    $('#w_done')?.addEventListener('click', ()=>{
      setState(nowAddr.id, 'done');
      // gå automatisk videre til neste
      const ni = nextIndex(cur, addrs);
      saveCursor(ni);
      render(); // oppdatert liste + fremdrift
    });

    $('#w_skip')?.addEventListener('click', ()=>{
      setState(nowAddr.id, 'skipped');
      const ni = nextIndex(cur, addrs);
      saveCursor(ni);
      render();
    });

    $('#w_imp')?.addEventListener('click', ()=>{
      setState(nowAddr.id, 'impossible');
      const ni = nextIndex(cur, addrs);
      saveCursor(ni);
      render();
    });

    $('#w_next')?.addEventListener('click', ()=>{
      saveCursor(nextIndex(cur, addrs));
      render();
    });

    $('#w_nav')?.addEventListener('click', ()=>{
      // enkel kartlenke
      const q = (nowAddr.lat && nowAddr.lon) ? `${nowAddr.lat},${nowAddr.lon}` : (nowAddr.name || '');
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
      window.open(url, '_blank');
    });
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }

  /* ---------- Puls-animasjon for aktiv knapp ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .pulse { position: relative; }
    .pulse::after{
      content:""; position:absolute; inset:-4px;
      border-radius:14px; pointer-events:none;
      box-shadow:0 0 0 0 rgba(37,99,235,.55);
      animation:b_pulse 1.2s ease-out infinite;
    }
    @keyframes b_pulse { to { box-shadow:0 0 0 12px rgba(37,99,235,0); } }
  `;
  document.head.appendChild(style);

  // første render
  render();

  // Hvis andre deler av appen endrer adresser/status, kan vi rerendre:
  document.addEventListener('bryt:status-updated', ()=>render());
})();