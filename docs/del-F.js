/* ===== del-F.js (UNDER ARBEID – Snø/Strø deloppgaver + dobbel fremdrift) ===== */
(() => {
  if (!window.Core) { console.error('Core mangler – last del-C.js først'); return; }
  const { $, esc, state: _S, save, fmtTime, seasonKey } = Core;

  // --- State helpers ---
  const S = () => Core.state;
  const stops = () => (Core.state.stops ||= []);
  const dir = () => (Core.state.direction || 'forward');

  // --- Migrering til deloppgaver (én gang) ---
  function migrateStopsShape() {
    (stops() || []).forEach(s => {
      // Krev deloppgavefelt
      if (typeof s.snowDone !== 'boolean') s.snowDone = !!s.f;             // fallback fra v9.10
      if (typeof s.gritDone !== 'boolean') s.gritDone = false;
      if (typeof s.blocked !== 'boolean')  s.blocked  = !!s.b;
      // Tidsstempler (deloppgaver)
      s.snowStart  = s.snowStart  ?? null;
      s.snowFinish = s.snowFinish ?? (s.f ? (s.finished || null) : null);
      s.gritStart  = s.gritStart  ?? null;
      s.gritFinish = s.gritFinish ?? null;
      // Oppgave-tekst
      s.t = Core.normalizeTask(s.t || '');
      // Pins
      s.pinsCount = Number.isFinite(s.pinsCount) ? s.pinsCount : 0;
      s.pinsLockedYear = s.pinsLockedYear ?? null;
      // Behold legacy felt (f/b/finished) for bakoverkompabilitet, men vi bruker dem ikke videre
    });
  }

  // --- Deloppgave-regler ---
  const requiresGrit = s => /grus/i.test(s?.t || '');
  const needsSnow = s => !s.snowDone && !s.blocked;
  const needsGrit = s => requiresGrit(s) && !s.gritDone && !s.blocked;

  // Aktiv arbeidsmodus: "snow" | "grit"
  function getMode() {
    const ui = (S().ui ||= {});
    ui.mode = ui.mode || 'snow';
    return ui.mode;
  }
  function setMode(m) {
    (S().ui ||= {}).mode = m === 'grit' ? 'grit' : 'snow';
    save();
    renderWork();
  }
  function toggleMode() {
    setMode(getMode() === 'snow' ? 'grit' : 'snow');
  }

  // Indeksliste etter retning + aktiv modus
  function idxList() {
    const arr = stops().map((s, i) => ({ i, s }))
      .filter(x => (getMode() === 'snow' ? needsSnow(x.s) : needsGrit(x.s)))
      .map(x => x.i);
    return dir() === 'forward' ? arr : arr.slice().reverse();
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

  // --- Total fremdrift = deloppgaver fullført / deloppgaver som trengs ---
  function totalSubtasks() {
    return stops().reduce((acc, s) => acc + (requiresGrit(s) ? 2 : 1), 0);
  }
  function doneSubtasks() {
    return stops().reduce((acc, s) => {
      const need2 = requiresGrit(s);
      const d1 = s.snowDone ? 1 : 0;
      const d2 = (need2 && s.gritDone) ? 1 : 0;
      const blk = s.blocked ? (need2 ? 2 : 1) : 0;
      return acc + Math.max(d1 + d2, blk);
    }, 0);
  }
  function globalProgress() {
    const total = totalSubtasks();
    const done  = doneSubtasks();
    const pct   = total ? Math.round((100 * done) / total) : 0;
    return { total, done, pct };
  }

  // --- Heartbeat: retningprogresjon (bruker fortsatt Core.status) ---
  function computeDirectionalFromHeartbeat(list) {
    const fwd = list.filter(x => (x.direction || 'forward') === 'forward' && Number.isFinite(x.progress));
    const rev = list.filter(x => (x.direction || 'forward') === 'reverse' && Number.isFinite(x.progress));
    const avg = a => a.length ? Math.min(100, Math.max(0, Math.round(a.reduce((s, x) => s + (x.progress || 0), 0) / a.length))) : 0;
    return { forwardPct: avg(fwd), reversePct: avg(rev) };
  }

  // --- UI bygg om nødvendig ---
  function ensureWorkSkeleton() {
    const host = document.getElementById('work');
    if (!host || host.dataset.wired === '1') return;

    host.innerHTML = `
      <div class="card stack">
        <div class="row" style="align-items:center;gap:8px;justify-content:space-between">
          <div class="row" style="align-items:center;gap:8px">
            <div id="driverLbl" class="muted">Rolle: —</div>
            <div id="directionLbl" class="badge">Retning: —</div>
            <div id="equipLbl" class="badge">Utstyr: —</div>
          </div>
          <button id="modeBtn" class="btn btn-gray small">Bytt modus: Snø ⇄ Strø</button>
        </div>

        <h2 id="curName" class="title-lg">—</h2>
        <div class="muted">Oppgave: <span id="curTask">—</span></div>
        <div class="muted">Arbeidsmodus: <span id="curMode">—</span></div>
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

        <div id="subtaskBadges" class="row" style="gap:8px;align-items:center"></div>

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

    // Lett stil
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
        .badge.good{border-color:#22c55e;color:#22c55e}
        .badge.warn{border-color:#d97706;color:#f59e0b}
        .badge.bad{border-color:#ef4444;color:#ef4444}
      `;
      document.head.appendChild(css);
    }

    host.dataset.wired = '1';
  }

  // --- RENDER ---
  function renderSubtaskBadges(s) {
    const snowTxt = s.snowDone ? `Snø: ferdig ${fmtStamp(s.snowFinish)}` :
                    s.snowStart ? `Snø: startet ${fmtStamp(s.snowStart)}` : 'Snø: ikke startet';
    const gritTxt = requiresGrit(s)
      ? (s.gritDone ? `Strø: ferdig ${fmtStamp(s.gritFinish)}`
        : (s.gritStart ? `Strø: startet ${fmtStamp(s.gritStart)}` : 'Strø: ikke startet'))
      : 'Strø: ikke nødvendig';

    return `
      <span class="badge ${s.snowDone?'good':(s.snowStart?'warn':'')}">${esc(snowTxt)}</span>
      <span class="badge ${requiresGrit(s) ? (s.gritDone?'good':(s.gritStart?'warn':'')) : ''}">${esc(gritTxt)}</span>
      ${s.blocked ? `<span class="badge bad">⛔ Blokkert${s.details?': '+esc(s.details):''}</span>` : ''}
    `;
  }
  const fmtStamp = (ts) => ts ? new Date(ts).toLocaleTimeString('no-NO', {hour:'2-digit',minute:'2-digit'}) : '—';

  function renderWork() {
    ensureWorkSkeleton();

    // Topp-info
    const equip = S().equipment || {};
    const equipStr = [
      equip.plog ? 'Skjær' : null,
      equip.fres ? 'Fres' : null,
      equip.stro ? 'Strøkasse' : null
    ].filter(Boolean).join(', ') || '—';

    const c = curStop();
    const n = nextStop();
    const GP = globalProgress();

    $('driverLbl').textContent    = "Rolle: " + Core.displayName();
    $('directionLbl').textContent = "Retning: " + (dir() === 'forward' ? 'Vanlig' : 'Baklengs');
    $('equipLbl').textContent     = "Utstyr: " + equipStr;

    $('curName').textContent = c ? esc(c.n) : "—";
    $('curTask').textContent = c ? esc(c.t || '') : "—";
    $('curMode').textContent = (getMode() === 'snow' ? 'Snø (skjær/fres)' : 'Strø (strøkasse)');
    $('curNext').textContent = n ? esc(n.n) : "—";

    $('subtaskBadges').innerHTML = c ? renderSubtaskBadges(c) : '';

    // Bilder
    $('thumbs').innerHTML = (c && Array.isArray(c.p) && c.p.length)
      ? c.p.map(src => `<img src="${src}" style="width:80px;border-radius:6px;border:1px solid var(--cardBorder)">`).join('')
      : '';

    // Progresjon
    $('progBar').style.width = GP.pct + "%";
    $('progTxt').textContent = `${GP.pct}% fullført (${GP.done}/${GP.total})`;

    // Sist synk (om SYNC oppdaterer)
    const when = Core.fmtTime(S().lastSyncAt);
    const who  = S().lastSyncBy || '—';
    $('lastSyncTextWork').textContent = `Sist synk: ${when} (${who})`;

    // Mode-knapp label
    const mb = $('modeBtn');
    if (mb) mb.textContent = `Bytt modus: ${getMode()==='snow' ? 'Snø ⇄ Strø' : 'Strø ⇄ Snø'}`;
  }

  function renderDirectionalBarsFromHeartbeat(list) {
    const { forwardPct, reversePct } = computeDirectionalFromHeartbeat(list);
    const fBar = $('progForward'), rBar = $('progReverse');
    if (fBar) fBar.style.width = forwardPct + "%";
    if (rBar) rBar.style.width = reversePct + "%";
  }

  // --- HANDLERS ---
  function onModeToggle() { toggleMode(); }

  function onStart() {
    const c = curStop(); if (!c) return;
    if (getMode() === 'snow') c.snowStart = c.snowStart || Date.now();
    else                      c.gritStart = c.gritStart || Date.now();
    save(); renderWork();
    Core.status?.updateSelf?.({ current: c.n, progress: globalProgress().pct });
    window.SYNC?.syncPush?.();
  }

  function onDone() {
    const i = curIndex(); if (i < 0) return;
    const c = stops()[i];

    // Brøytestikker (spør kun én gang per sesong, og bare hvis oppgaven inneholder brøytestikker)
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

    if (getMode() === 'snow') {
      c.snowDone   = true;
      c.snowFinish = Date.now();
    } else {
      c.gritDone   = true;
      c.gritFinish = Date.now();
    }

    // Hopp til neste som trengs i AKTIV modus
    const list = idxList();
    const curPos = (S().ui?.cursor ?? 0);
    if (curPos < list.length - 1) (S().ui ||= {}).cursor = curPos + 1;

    save(); renderWork();
    Core.status?.updateSelf?.({ current: nextStop()?.n || "", progress: globalProgress().pct });
    window.SYNC?.syncPush?.();
  }

  function onBlock() {
    const i = curIndex(); if (i < 0) return;
    const c = stops()[i];
    const note = prompt("Hvorfor ikke mulig?", "") || "";
    c.details = note;
    c.blocked = true;
    // marker deloppgavene som “ikke aktuelt” via blokkering (progress tar hensyn)
    save();

    // Flytt cursor i aktiv modus
    const list = idxList();
    const curPos = (S().ui?.cursor ?? 0);
    if (curPos < list.length - 1) (S().ui ||= {}).cursor = curPos + 1;

    renderWork();
    Core.status?.updateSelf?.({ current: nextStop()?.n || "", progress: globalProgress().pct });
    window.SYNC?.syncPush?.();
  }

  function onNext() {
    const list = idxList();
    const curPos = (S().ui?.cursor ?? 0);
    if (!list.length) return;
    if (curPos < list.length - 1) {
      (S().ui ||= {}).cursor = curPos + 1;
      save(); renderWork();
      onNav(); // valgfritt: åpne navigasjon
    } else {
      alert("Ingen flere adresser i denne modusen.");
    }
  }

  function onNav() {
    const c = curStop(); if (!c) return;
    location.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(c.n);
  }

  function onPhoto() {
    const input = $('fileInput'); if (input) input.click();
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

  function wireWorkButtons() {
    $('modeBtn')   && ($('modeBtn').onclick   = onModeToggle);
    $('ongo')      && ($('ongo').onclick      = onStart);
    $('done')      && ($('done').onclick      = onDone);
    $('block')     && ($('block').onclick     = onBlock);
    $('next')      && ($('next').onclick      = onNext);
    $('nav')       && ($('nav').onclick       = onNav);
    $('photo')     && ($('photo').onclick     = onPhoto);
    $('fileInput') && ($('fileInput').onchange= onPhotoChosen);
    $('editPins')  && ($('editPins').onclick  = onEditPins);
    $('incident')  && ($('incident').onclick  = onIncident);
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', () => {
    migrateStopsShape();
    // init cursor hvis nødvendig
    const l = idxList();
    if (l.length && (S().ui?.cursor ?? 0) >= l.length) (S().ui ||= {}).cursor = 0;

    ensureWorkSkeleton();
    wireWorkButtons();
    renderWork();

    // Heartbeat/felles status
    try {
      Core.status?.startHeartbeat?.();
      Core.status?.startPolling?.((list) => {
        renderDirectionalBarsFromHeartbeat(list);
      });
    } catch (_) {}

    // Jevnlig oppdater den samlede baren
    setInterval(() => {
      const GP = globalProgress();
      const bar = $('progBar'); if (bar) bar.style.width = GP.pct + '%';
      const txt = $('progTxt'); if (txt) txt.textContent = `${GP.pct}% fullført (${GP.done}/${GP.total})`;
    }, 5000);
  });

})();