// js/home_dashboard.js
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

  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const msToHhMm = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return '0:00';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${pad(m)}`;
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
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['X-Master-Key'] = key;

    const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`JSONbin ${binId} status ${res.status}`);
    }
    const data = await res.json();
    return data && (data.record || data);
  }

  // Normaliserer reports til rader vi kan jobbe videre med
  function normalizeReports(record) {
    const raw = Array.isArray(record?.reports) ? record.reports
      : Array.isArray(record) ? record
      : [];

    const rows = [];

    for (const r of raw) {
      const tsStr = r.at || r.ts;
      const ts = Date.parse(tsStr);
      if (!Number.isFinite(ts)) continue;

      const d = new Date(ts);
      const date = d.toISOString().slice(0, 10);
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

      const driver  = r.by || r.driver || '';
      const address = r.addressId || r.addressName || r.address || '—';
      const task    = (r.task || '').trim();

      let action = null;
      if (r.type === 'start' || r.action === 'start') {
        action = 'start';
      } else if (r.type === 'done' || r.action === 'ferdig') {
        action = 'ferdig';
      } else {
        // ignorer "neste" og annet
        continue;
      }

      rows.push({ ts, date, time, driver, address, task, action });
    }

    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }

  // Lager intervaller start→stopp per (sjåfør+adresse+oppgave)
  function buildIntervals(rows) {
    const byKey = new Map();
    for (const r of rows) {
      const key = `${r.driver}||${r.address}||${r.task}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(r);
    }

    const intervals = [];

    for (const [key, list] of byKey) {
      list.sort((a, b) => a.ts - b.ts);
      let openStart = null;
      let openDate  = null;

      const [driver, address, task] = key.split('||');

      for (const ev of list) {
        if (ev.action === 'start') {
          if (openStart == null) {
            openStart = ev.ts;
            openDate  = ev.date;
          }
        } else if (ev.action === 'ferdig') {
          if (openStart != null && ev.ts > openStart) {
            let dur = ev.ts - openStart;
            if (dur > MAX_INTERVAL_MS) dur = MAX_INTERVAL_MS;

            intervals.push({
              startTs: openStart,
              stopTs: ev.ts,
              date: openDate,     // kalenderdato for start
              driver,
              address,
              task,
              durationMs: dur
            });
          }
          openStart = null;
          openDate  = null;
        }
      }
    }

    return intervals;
  }

  // Hjelpere for dato-områder (lokal tid)
  function getDateOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function computeBuckets(intervals) {
    const now = new Date();
    const todayDate = getDateOnly(now);
    const todayISO  = isoDate(todayDate);

    const dayOfWeek = todayDate.getDay(); // 0 = søn
    const offsetToMonday = (dayOfWeek + 6) % 7; // hvor mange dager tilbake til mandag
    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - offsetToMonday);

    const thisMonthYear  = todayDate.getFullYear();
    const thisMonthIndex = todayDate.getMonth(); // 0-11
    const monthStart = new Date(thisMonthYear, thisMonthIndex, 1);

    let prevMonthYear  = thisMonthYear;
    let prevMonthIndex = thisMonthIndex - 1;
    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      prevMonthYear -= 1;
    }
    const prevMonthStart = new Date(prevMonthYear, prevMonthIndex, 1);
    const prevMonthEnd   = new Date(thisMonthYear, thisMonthIndex, 1); // eksklusiv

    let sumToday = 0;
    let sumWeek  = 0;
    let sumThisM = 0;
    let sumPrevM = 0;
    let sumTotal = 0;

    for (const iv of intervals) {
      const d = new Date(iv.startTs);
      const dateOnly = getDateOnly(d);
      const dateISO  = isoDate(dateOnly);

      const dur = iv.durationMs;
      sumTotal += dur;

      // i dag
      if (dateISO === todayISO) {
        sumToday += dur;
      }

      // denne uken (fra mandag til i dag)
      if (dateOnly >= weekStart && dateOnly <= todayDate) {
        sumWeek += dur;
      }

      // denne måneden
      if (
        d.getFullYear() === thisMonthYear &&
        d.getMonth() === thisMonthIndex
      ) {
        sumThisM += dur;
      }

      // forrige måned
      if (dateOnly >= prevMonthStart && dateOnly < prevMonthEnd) {
        sumPrevM += dur;
      }
    }

    return {
      today: sumToday,
      week: sumWeek,
      thisMonth: sumThisM,
      prevMonth: sumPrevM,
      total: sumTotal
    };
  }

  function ensureStatsLayout() {
    const statsEl = document.getElementById('stats');
    if (!statsEl) return null;

    statsEl.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:4px;">
          <h2 style="margin:0; font-size:1rem;">Samlet brøytetid</h2>
          <span style="font-size:.8rem; opacity:.7;">Hentes fra felles logg (alle sjåfører)</span>
        </div>
        <div class="home-stats-row" style="display:flex; gap:8px; overflow-x:auto;">
          <div class="home-stat" style="min-width:90px;">
            <div style="font-size:.8rem; opacity:.7;">I dag</div>
            <div id="st_time_today" style="font-weight:600; font-size:1.1rem;">0:00</div>
          </div>
          <div class="home-stat" style="min-width:90px;">
            <div style="font-size:.8rem; opacity:.7;">Denne uken</div>
            <div id="st_time_week" style="font-weight:600; font-size:1.1rem;">0:00</div>
          </div>
          <div class="home-stat" style="min-width:90px;">
            <div style="font-size:.8rem; opacity:.7;">Denne mnd</div>
            <div id="st_time_month" style="font-weight:600; font-size:1.1rem;">0:00</div>
          </div>
          <div class="home-stat" style="min-width:100px;">
            <div style="font-size:.8rem; opacity:.7;">Forrige mnd</div>
            <div id="st_time_prev_month" style="font-weight:600; font-size:1.1rem;">0:00</div>
          </div>
          <div class="home-stat" style="min-width:90px;">
            <div style="font-size:.8rem; opacity:.7;">Totalt</div>
            <div id="st_time_total" style="font-weight:600; font-size:1.1rem;">0:00</div>
          </div>
        </div>
      </div>
    `;
    return statsEl;
  }

  function renderBuckets(buckets) {
    const elToday = document.getElementById('st_time_today');
    const elWeek  = document.getElementById('st_time_week');
    const elMonth = document.getElementById('st_time_month');
    const elPrevM = document.getElementById('st_time_prev_month');
    const elTotal = document.getElementById('st_time_total');

    if (elToday) elToday.textContent = msToHhMm(buckets.today);
    if (elWeek)  elWeek.textContent  = msToHhMm(buckets.week);
    if (elMonth) elMonth.textContent = msToHhMm(buckets.thisMonth);
    if (elPrevM) elPrevM.textContent = msToHhMm(buckets.prevMonth);
    if (elTotal) elTotal.textContent = msToHhMm(buckets.total);
  }

  async function init() {
    const statsEl = ensureStatsLayout();
    if (!statsEl) return;

    try {
      const record = await fetchJsonbinLatest(REPORT_BIN_ID);
      const rows = normalizeReports(record);
      const intervals = buildIntervals(rows);
      const buckets = computeBuckets(intervals);
      renderBuckets(buckets);
    } catch (err) {
      console.error('Feil ved lasting av samlet brøytetid til Hjem:', err);
      // om det feiler, lar vi bare 0:00 stå
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();