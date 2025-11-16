// js/home_dashboard.js
// Samlet brøytetid-kort på Hjem-siden (hentes fra felles reports-bin)

(() => {
  const REPORT_BIN_ID   = '68e89e3443b1c97be9611c48';
  const MAX_INTERVAL_MS = 90 * 60 * 1000;

  const MASTER_KEY_KEYS = [
    'jsonbin_master_key',
    'jsonbin_master',
    'rt_jsonbin_master',
    'rt_jsonbin_key',
    'X-Master-Key'
  ];

  // --- Hjelpere for tid/dato ---
  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  const msToHuman = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0 min';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} t`;
    return `${h} t ${m} min`;
  };

  function getMasterKey() {
    for (const k of MASTER_KEY_KEYS) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
    return null;
  }

  async function fetchJsonbinLatest(binId) {
    const key = getMasterKey();
    const headers = {};
    if (key) headers['X-Master-Key'] = key;

    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`JSONbin ${binId}: ${res.status}`);
    const data = await res.json();
    return data && (data.record || data);
  }

  // --- Normaliser reports til events ---
  function normalizeReports(record) {
    const raw = Array.isArray(record?.reports)
      ? record.reports
      : Array.isArray(record)
      ? record
      : [];

    const rows = [];

    for (const r of raw) {
      const tsStr = r.at || r.ts;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;
      const d = new Date(ts);

      let kind = null;
      if (r.type === 'start' || r.action === 'start') {
        kind = 'start';
      } else if (r.type === 'done' || r.action === 'ferdig') {
        kind = 'done';
      } else if (
        r.type === 'blocked' ||
        r.action === 'ikke-mulig' ||
        r.action === 'ikke mulig' ||
        r.action === 'blokker'
      ) {
        kind = 'done'; // teller som stopp, men kan ev. brukes til merknad i logg
      } else {
        continue; // hopp over "neste" osv.
      }

      const driver  = (r.by || r.driver || '').trim() || 'Ukjent';
      const address = (r.addressId || r.addressName || r.address || '—').trim();

      rows.push({
        ts,
        driver,
        address,
        kind
      });
    }

    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }

  // Bygg start→stopp-intervaller pr (sjåfør+adresse)
  function buildIntervals(events) {
    const byKey = new Map();

    for (const ev of events) {
      const key = `${ev.driver}||${ev.address}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(ev);
    }

    const intervals = [];

    for (const [key, list] of byKey) {
      list.sort((a, b) => a.ts - b.ts);
      let openStart = null;

      for (const ev of list) {
        if (ev.kind === 'start') {
          if (openStart == null) openStart = ev.ts;
        } else if (ev.kind === 'done') {
          if (openStart != null && ev.ts > openStart) {
            let dur = ev.ts - openStart;
            if (dur > MAX_INTERVAL_MS) dur = MAX_INTERVAL_MS;

            intervals.push({
              startTs: openStart,
              durationMs: dur
            });
          }
          openStart = null;
        }
      }
    }

    intervals.sort((a, b) => a.startTs - b.startTs);
    return intervals;
  }

  // --- Aggregér til i dag / uke / mnd / forrige mnd / totalt ---
  function aggregate(intervals) {
    const now = new Date();

    // Start i dag kl 00
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start denne uka (mandag)
    const day = (todayStart.getDay() + 6) % 7; // 0 = mandag
    const weekStart = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() - day
    );

    // Start denne måneden
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Forrige måned (fra 1. forrige mnd til 1. denne mnd)
    const prevMonthStart = new Date(
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      now.getMonth() === 0 ? 11 : now.getMonth() - 1,
      1
    );

    let total = 0;
    let today = 0;
    let week  = 0;
    let month = 0;
    let prevMonth = 0;

    for (const iv of intervals) {
      const d = new Date(iv.startTs);
      total += iv.durationMs;

      if (d >= todayStart) today += iv.durationMs;
      if (d >= weekStart)  week  += iv.durationMs;
      if (d >= monthStart) month += iv.durationMs;
      if (d >= prevMonthStart && d < monthStart) prevMonth += iv.durationMs;
    }

    return { total, today, week, month, prevMonth };
  }

  // --- UI ---
  function ensureStatsCard() {
    const statsEl = document.getElementById('stats');
    if (!statsEl) return;

    statsEl.innerHTML = `
      <div class="card">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span style="font-size:1.4rem;">📊</span>
          <div>
            <div style="font-weight:600;">Samlet brøytetid</div>
            <div class="muted" style="font-size:.8rem;">
              Hentes fra felles logg (alle sjåfører)
            </div>
          </div>
        </div>
        <div style="line-height:1.5; font-size:.95rem;">
          <div>Totalt: <strong id="st_time_total">0 min</strong></div>
          <div>Forrige måned: <strong id="st_time_prev_month">0 min</strong></div>
          <div>Denne måneden: <strong id="st_time_month">0 min</strong></div>
          <div>Denne uken: <strong id="st_time_week">0 min</strong></div>
          <div>I dag: <strong id="st_time_today">0 min</strong></div>
        </div>
      </div>
    `;
  }

  function renderAgg(agg) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = msToHuman(val);
    };
    set('st_time_total',       agg.total);
    set('st_time_prev_month',  agg.prevMonth);
    set('st_time_month',       agg.month);
    set('st_time_week',        agg.week);
    set('st_time_today',       agg.today);
  }

  async function init() {
    ensureStatsCard();

    try {
      const record    = await fetchJsonbinLatest(REPORT_BIN_ID);
      const events    = normalizeReports(record);
      const intervals = buildIntervals(events);
      const agg       = aggregate(intervals);
      renderAgg(agg);
    } catch (err) {
      console.error('Feil ved henting av samlet brøytetid:', err);
      // lar bare 0 min stå hvis noe feiler
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();