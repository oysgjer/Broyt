/* ===== del-F.js (UNDER ARBEID – UI + dobbel fremdrift) ===== */
(() => {
  const { $, qs, qsa, esc, cfg, state: S0, save, fmtTime, seasonKey } = window.Core || {};
  if (!window.Core) { console.error('Core mangler – last del-C først'); return; }

  const Core = window.Core;

  // --- Små utils ---
  const S = () => Core.state;              // Live-peker
  const stops = () => (Core.state.stops || []);
  const dir = () => (Core.state.direction || 'forward');

  // Gjenværende indeksliste etter retning
  function idxList() {
    const left = stops().map((s, i) => ({ i, s })).filter(x => !x.s.f && !x.s.b).map(x => x.i);
    return dir() === 'forward' ? left : left.slice().reverse();
  }
  function curIndex() {
    const l = idxList();
    const c = (S().ui?.cursor ?? 0);
    if (!l.length) return -1;
    const pos = Math.min(c, l.length - 1);
    return l[pos];
  }
  function curStop() {
    const i = curIndex();
    return i >= 0 ? stops()[i] : null;
  }
  function nextStop() {
    const l = idxList();
    const c = (S().ui?.cursor ?? 0);
    if (l.length <= c + 1) return null;
    return stops()[l[c + 1]];
  }

  // --- Render skeletton hvis work-seksjonen er “tom” ---
  function ensureWorkSkeleton() {
    const host = document.getElementById('work');
    if (!host) return;
    if (host.dataset.wired === '1') return;

    host.innerHTML = `
      <div class="card stack">
        <div class="row" style="align-items:center;gap:8px">
          <div id="driverLbl" class="muted">Rolle: —</div>
          <div id="directionLbl" class="badge">Retning: —</div>
          <div id="equipLbl" class="badge">Utstyr: —</div>
        </div>

        <h2 id="curName" class="title-lg">—</h2>
        <div class="muted">Oppgave: <span id="curTask">—</span></div>
        <div class="muted">Neste: <span id="curNext">—</span></div>

        <div class="progress-card">
          <div class="progress" id="progressTrack">
            <div class="bar bar-total" id="progBar"></div>
            <div class="bar bar-forward" id="progForward"></div>
            <div class="bar bar-reverse" id="progReverse"></div>
          </div>
          <div class="progress-legend">
            <span class="pill pill-total">Samlet</span>
            <span class="pill pill-forward">Vanlig</span>
            <span class="pill pill-reverse">Baklengs</span>
          </div>
          <div class="muted" id="progTxt">0 % fullført (0/0)</div>
        </div>

        <div class="thumbs" id="thumbs"></div>

        <div class="row">
          <button id="ongo" class="btn btn-gray">▶️ Start</button>
          <button id="done" class="btn btn-green">✅ Utført</button>
          <button id="block" class="btn btn-red">⛔ Ikke mulig</button>
          <button id="photo" class="btn btn-gray">📷 Foto</button>
          <button id="nav" class="btn btn-blue">🧭 Naviger</button>
          <button id="next" class="btn btn-gray">🔁 Neste</button>
          <button id="editPins" class="btn btn-gray">📍 Brøytestikker</button>
          <button id="incident" class="btn btn-red">❗ Uhell</button>
        </div>

        <div class="small muted" id="lastSyncTextWork">—</div>
      </div>

      <input id="fileInput" type="file" accept="image/*" capture="environment" style="display:none">
    `;

    // Enkel stilinjeksjon (dobbel progress)
    if (!document.getElementById('work-progress-styles')) {
      const css = document.createElement('style'); css.id = 'work-progress-styles';
      css.textContent = `
        .progress-card{display:flex;flex-direction:column;gap:6px;margin:8px 0}
        .progress{position:relative;width:100%;height:14px;border-radius:999px;background:#242830;border:1px solid var(--cardBorder);overflow:hidden}
        .progress .bar{position:absolute;top:0;height:100%;transition:width .3s ease}
        .bar-total{left:0;width:0;background:linear-gradient(90deg,#16a34a,#22c55e)}
        .bar-forward{left:0;width:0;opacity:.8;background:rgba(59,130,246,.85)}
        .bar-reverse{right:0;width:0;opacity:.8;background:rgba(124,58,237,.85)}
        .progress-legend{display:flex;gap:8px;align-items:center}
        .pill{border:1px solid var(--cardBorder);border-radius:999px;padding:2px 8px;font-size:12px}
        .pill-total{background:linear-gradient(90deg,#16a34a,#22c55e);color:#fff;border:none}
        .pill-forward{background:rgba(59,130,246,.85);color:#fff;border:none}
        .pill-reverse{background:rgba(124,58,237,.85);color:#fff;border:none}
      `;
      document.head.appendChild(css);
    }

    host.dataset.wired = '1';
  }

  // --- Progress-beregninger ---
  function globalProgressPct() {
    const a = stops(); const total = a.length;
    const cleared = a.filter(s => s.f || s.b).length;
    return { pct: total ? Math.round(100 * cleared / total) : 0, done: cleared, total };
  }

  // Heartbeat tolkning: gjennomsnittlig egen-progresjon pr retning
  // (Hvis ingen data, faller tilbake til 0)
  function computeDirectionalFromHeartbeat(list) {
    const fwd = list.filter(x => (x.direction || 'forward') === 'forward' && Number.isFinite(x.progress));
    const rev = list.filter(x => (x.direction || 'forward') === 'reverse' && Number.isFinite(x.progress));

    const avg = arr => {
      if (!arr.length) return 0;
      const s = arr.reduce((acc, x) => acc + (x.progress || 0), 0);
      // clamp 0..100
      return Math.min(100, Math.max(0, Math.round(s / arr.length)));
    };
    return { forwardPct: avg(fwd), reversePct: avg(rev) };
  }

  // --- RENDER ---
  function renderWork() {
    ensureWorkSkeleton();

    const c = curStop();
    const n = nextStop();
    const { pct, done, total } = globalProgressPct();

    const equip = S().equipment || {};
    const equipStr = [
      equip.plog ? 'Skjær' : null,  // NB: vist som Skjær
      equip.fres ? 'Fres' : null,
      equip.stro ? 'Strøkasse' : null
    ].filter(Boolean).join(', ') || '—';

    $('driverLbl').textContent    = "Rolle: " + Core.displayName();
    $('directionLbl').textContent = "Retning: " + (dir() === 'forward' ? 'Vanlig' : 'Baklengs');
    $('equipLbl').textContent     = "Utstyr: " + equipStr;

    $('curName').textContent = c ? esc(c.n) : "—";
    $('curTask').textContent = c ? esc(c.t || '') : "—";
    $('curNext').textContent = n ? esc(n.n) : "—";

    // Hoved (samlet) progresjon
    const bar = $('progBar');
    if (bar) bar.style.width = pct + "%";
    const txt = $('progTxt');
    if (txt) txt.textContent = `${pct}% fullført (${done}/${total})`;

    // Bilder/”thumbs”
    $('thumbs').innerHTML = (c && Array.isArray(c.p) && c.p.length)
      ? c.p.map(src => `<img src="${src}" style="width:80px;border-radius:6px;border:1px solid var(--cardBorder)">`).join('')
      : '';

    // Sist synk (om SYNC oppdaterer state.lastSyncAt/By)
    const when = Core.fmtTime(S().lastSyncAt);
    const who  = S().lastSyncBy || '—';
    $('lastSyncTextWork').textContent = `Sist synk: ${when} (${who})`;
  }

  // Oppdater dobbeltstripe fra heartbeat
  function renderDirectionalBarsFromHeartbeat(list) {
    const { forwardPct, reversePct } = computeDirectionalFromHeartbeat(list);
    const fBar = $('progForward'), rBar = $('progReverse');
    if (fBar) fBar.style.width = forwardPct + "%";
    if (rBar) rBar.style.width = reversePct + "%";
  }

  // --- HANDLERS ---
  function onStart() {
    const c = curStop(); if (!c) return;
    c.started = c.started || Date.now();
    Core.touchActivity(); save();
    // ping heartbeat (min. data)
    Core.status?.updateSelf?.({ current: c.n, progress: globalProgressPct().pct });
    renderWork();
    // skyv rolig opp hvis SYNC er tilgjengelig
    window.SYNC?.syncPush?.();
  }

  function onDone() {
    const i = curIndex(); if (i < 0) return;
    const c = stops()[i];

    // Brøytestikker spørring med sesonglås kun hvis "brøytestikker" i oppgaven
    if (/brøytestikker/i.test(c.t || '')) {
      const locked = c.pinsLockedYear && String(c.pinsLockedYear) === seasonKey();
      if (!locked) {
        const v = prompt("Antall brøytestikker brukt (låses for sesongen):", "");
        if (v === null) return; // avbrutt
        const n = parseInt((v || "").trim() || "0", 10) || 0;
        c.pinsCount = n;
        c.pinsLockedYear = seasonKey();
      }
    }

    c.f = true;
    c.finished = Date.now();

    // Flytt cursor til neste ikke-utført først
    const list = idxList();
    const curPos = (S().ui?.cursor ?? 0);
    if (curPos < list.length - 1) {
      S().ui.cursor = curPos + 1;
    }

    save(); renderWork();
    Core.status?.updateSelf?.({ current: nextStop()?.n || "", progress: globalProgressPct().pct });
    window.SYNC?.syncPush?.();
  }

  function onBlock() {
    const i = curIndex(); if (i < 0) return;
    const c = stops()[i];
    const note = prompt("Hvorfor ikke mulig?", "") || "";
    c.details = note;
    c.b = true;
    c.finished = Date.now();

    const list = idxList();
    const curPos = (S().ui?.cursor ?? 0);
    if (curPos < list.length - 1) {
      S().ui.cursor = curPos + 1;
    }

    save(); renderWork();
    Core.status?.updateSelf?.({ current: nextStop()?.n || "", progress: globalProgressPct().pct });
    window.SYNC?.syncPush?.();
  }

  function onNext() {
    const list = idxList();
    const curPos = (S().ui?.cursor ?? 0);
    if (!list.length) return;
    if (curPos < list.length - 1) {
      S().ui.cursor = curPos + 1; // bare hopp, ikke rør status
      save(); renderWork();
      const c = curStop();
      if (c) onNav(); // valgfritt: åpne navigasjon på ny current
    } else {
      alert("Ingen flere adresser å hoppe til.");
    }
  }

  function onNav() {
    const c = curStop(); if (!c) return;
    location.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(c.n);
  }

  function onPhoto(e) {
    const input = $('fileInput'); if (!input) return;
    input.click();
  }
  function onPhotoChosen(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const c = curStop(); if (!c) return; (c.p ||= []).push(r.result); save(); renderWork(); window.SYNC?.syncPush?.(); };
    r.readAsDataURL(f); e.target.value = "";
  }

  function onEditPins() {
    const c = curStop(); if (!c) return;

    const locked = c.pinsLockedYear && String(c.pinsLockedYear) === seasonKey();
    if (locked) {
      alert("Brøytestikker er allerede registrert og låst for inneværende sesong.");
      return;
    }

    const curVal = Number.isFinite(c.pinsCount) ? c.pinsCount : 0;
    const v = prompt("Antall brøytestikker brukt (låses for sesongen):", String(curVal));
    if (v === null) return;
    const n = parseInt((v || "").trim() || "0", 10) || 0;
    c.pinsCount = n;
    c.pinsLockedYear = seasonKey();
    save(); renderWork(); window.SYNC?.syncPush?.();
  }

  function onIncident() {
    const c = curStop();
    const msg = prompt("Kort beskrivelse av uhell" + (c ? ` ved ${c.n}` : "") + ":", "");
    if (msg) alert("Uhell logget.");
  }

  // --- Wire knapper ---
  function wireWorkButtons() {
    $('ongo')    && ($('ongo').onclick    = onStart);
    $('done')    && ($('done').onclick    = onDone);
    $('block')   && ($('block').onclick   = onBlock);
    $('next')    && ($('next').onclick    = onNext);
    $('nav')     && ($('nav').onclick     = onNav);
    $('photo')   && ($('photo').onclick   = onPhoto);
    $('fileInput') && ($('fileInput').onchange = onPhotoChosen);
    $('editPins')&& ($('editPins').onclick = onEditPins);
    $('incident')&& ($('incident').onclick = onIncident);
  }

  // --- Heartbeat: oppdater egne data + poll alles ---
  function startDriverHeartbeatAndPolling() {
    try {
      Core.status?.startHeartbeat?.(); // sender egen “jeg lever”
      Core.status?.startPolling?.((list) => {
        // Tegn de to retningene sin “egen fremdrift”
        renderDirectionalBarsFromHeartbeat(list);

        // (Valgfritt) – logg i konsoll:
        // console.log('Driver heartbeat list:', list);
      });
    } catch (_) {}
  }

  // --- Start/oppkobling ---
  document.addEventListener('DOMContentLoaded', () => {
    // Sikre cursor peker på første ikke-utførte når man åpner/kjører ny runde
    if (!Array.isArray(S().stops)) S().stops = [];
    const l = idxList();
    if (l.length) {
      // hvis cursor peker utenfor liste, reset til 0
      const c = (S().ui?.cursor ?? 0);
      if (c >= l.length) { S().ui.cursor = 0; save(); }
    }

    ensureWorkSkeleton();
    wireWorkButtons();
    renderWork();
    startDriverHeartbeatAndPolling();

    // Oppdater når man bytter til “Under arbeid”-fanen
    const tab = document.querySelector('.tab[data-tab="work"]');
    tab && tab.addEventListener('click', () => {
      renderWork();
    });

    // Liten interval for å holde global bar live hvis SYNC/andre oppdaterer lokalt
    setInterval(() => {
      const { pct } = globalProgressPct();
      const bar = $('progBar'); if (bar) bar.style.width = pct + '%';
      const txt = $('progTxt');
      if (txt) {
        const gp = globalProgressPct(); txt.textContent = `${gp.pct}% fullført (${gp.done}/${gp.total})`;
      }
    }, 5000);
  });

})();