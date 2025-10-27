// docs/js/kart-sync-ui.js — Tiny UI for sync status on Kart
(function(root){
  'use strict';
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const LS_SETTINGS='BRYT_SETTINGS';   // { routesBin }
  const LS_CFG='BRYT_CFG';             // { apiKey }
  const LS_ROUTES='KART_ROUTES';       // local routes payload
  const LS_SIG='KART_ROUTES_SIG';      // last cloud signature

  function cfg(){ return RJ(LS_CFG, {}); }
  function st(){ return RJ(LS_SETTINGS, {}); }

  function isKartPage(){
    const p=(location.pathname||'').toLowerCase();
    const h=(location.hash||'').toLowerCase();
    return /(^|\/)tools\/kart\.html$/.test(p) || h.includes('kart');
  }

  function ensurePill(){
    if (document.getElementById('kart_sync_pill')) return;
    const style = document.createElement('style');
    style.textContent = `
      .ks-pill{position:fixed; right:12px; bottom:12px; z-index:9999;
        background:rgba(33,33,33,.92); color:#fff; border-radius:14px; padding:10px 12px;
        box-shadow:0 6px 20px rgba(0,0,0,.25); display:flex; align-items:center; gap:10px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
      .ks-pill .dot{width:10px;height:10px;border-radius:50%; background:#9ca3af; box-shadow:0 0 0 3px rgba(255,255,255,.15) inset;}
      .ks-pill .msg{font-size:13px; white-space:nowrap; max-width:48vw; overflow:hidden; text-overflow:ellipsis;}
      .ks-pill .btn{font-size:12px; font-weight:700; padding:6px 8px; border-radius:10px; border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.06); color:#fff; cursor:pointer}
      .ks-pill .btn:hover{background:rgba(255,255,255,.12)}
      @media (max-width:480px){ .ks-pill{bottom:10px; right:10px} .ks-pill .msg{max-width:40vw} }
    `;
    document.head.appendChild(style);

    const pill = document.createElement('div');
    pill.className = 'ks-pill';
    pill.id = 'kart_sync_pill';
    pill.innerHTML = `
      <span class="dot" id="ks_dot"></span>
      <span class="msg" id="ks_msg">Synk: ukjent</span>
      <button class="btn" id="ks_pull" title="Hent fra sky">Hent</button>
      <button class="btn" id="ks_push" title="Synk til sky">Synk nå</button>
    `;
    document.body.appendChild(pill);

    document.getElementById('ks_pull').addEventListener('click', async ()=>{
      try{
        const ok = await (root.KartRoutes?.pullNow?.() || Promise.resolve(false));
        if (ok){ setStatus('ok',"Hentet fra sky ✔️"); setTimeout(updateStatus, 1200); }
        else   { setStatus('warn',"Fant ingen ruter i sky, eller feil"); }
      }catch(e){ setStatus('err',"Feil ved henting"); }
    });
    document.getElementById('ks_push').addEventListener('click', async ()=>{
      try{
        await (root.KartRoutes?.syncNow?.() || Promise.resolve());
        // syncNow er throttled; gi rask visuell kvittering:
        setStatus('ok',"Synk sendt ✈️"); setTimeout(updateStatus, 1200);
      }catch(e){ setStatus('err',"Feil ved synk"); }
    });
  }

  async function sha1(str){
    try{ const b=await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)); 
      return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
    }catch{ return String(str.length)+'.fallback'; }
  }

  async function updateStatus(){
    const dot = document.getElementById('ks_dot');
    const msg = document.getElementById('ks_msg');
    if (!dot || !msg) return;

    const hasCfg = !!(st().routesBin && cfg().apiKey);
    if (!hasCfg){ setStatus('idle',"Sky ikke satt – lagrer lokalt"); return; }

    // Compare local payload hash with last pushed signature
    const local = RJ(LS_ROUTES, null);
    const localStr = JSON.stringify(local ?? []);
    const sigLocal = await sha1(localStr);
    const sigCloud = localStorage.getItem(LS_SIG) || '';
    if (!local){ setStatus('idle',"Ingen lokale ruter"); return; }

    if (sigLocal === sigCloud){
      setStatus('ok',"Lagret i sky");
    } else {
      setStatus('warn',"Endringer ikke lagret");
    }
  }

  function setStatus(kind, text){
    const dot = document.getElementById('ks_dot');
    const msg = document.getElementById('ks_msg');
    if (!dot || !msg) return;
    const colors = {
      ok:'#10b981',      // green
      warn:'#f59e0b',    // amber
      err:'#ef4444',     // red
      idle:'#9ca3af'     // gray
    };
    dot.style.background = colors[kind] || colors.idle;
    msg.textContent = text || '—';
  }

  function init(){
    if (!isKartPage()) return;
    ensurePill();
    updateStatus();
    // Refresh status periodically & on changes
    setInterval(updateStatus, 5000);
    document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState==='visible') updateStatus(); });
    // If KartRoutes exists, hook into it by monkey-patching setLocal for instant feedback
    if (root.KartRoutes && typeof root.KartRoutes.setLocal === 'function'){
      const orig = root.KartRoutes.setLocal;
      root.KartRoutes.setLocal = function(x){ const r = orig(x); setTimeout(updateStatus, 200); return r; };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
