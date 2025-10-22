// js/Work.js
(() => {
  'use strict';

  /* -------------------- små hjelpere -------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const JGET = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const JSET = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const K_RUN      = 'BRYT_RUN';       // { driver, equipment:{...}, dir, idx, mode }
  const K_SETTINGS = 'BRYT_SETTINGS';  // { driver, equipment, ... }

  /* -------------------- Sync-«adapter» -------------------- */
  // Vi pakker kall mot Sync slik at vi tåler små API-endringer.
  const Sync = {
    have() { return !!window.Sync; },
    addresses() {
      // Prioritér en «get»-metode om den finnes, ellers fall tilbake på cachefelt.
      if (!window.Sync) return [];
      if (typeof window.Sync.getAddresses === 'function') return window.Sync.getAddresses() || [];
      if (Array.isArray(window.Sync.addresses)) return window.Sync.addresses;
      if (window.Sync.cache && Array.isArray(window.Sync.cache.addresses)) return window.Sync.cache.addresses;
      return [];
    },
    statuses() {
      if (!window.Sync) return {};
      if (typeof window.Sync.getStatuses === 'function') return window.Sync.getStatuses() || {};
      if (window.Sync.cache && window.Sync.cache.statuses) return window.Sync.cache.statuses;
      return {};
    },
    async setStatus(id, payload) {
      if (!window.Sync || typeof window.Sync.setStatus !== 'function') {
        throw new Error('Sync.setStatus mangler');
      }
      return window.Sync.setStatus(id, payload);
    }
  };

  /* -------------------- aktiv runde / mode -------------------- */
  function getRun() {
    let run = JGET(K_RUN, null);
    if (!run) {
      // Fallback: hent innstillinger og lag en «minimal» run
      const st = JGET(K_SETTINGS, { driver:'', equipment:{ plow:false, fres:false, sand:false }, dir:'Normal' });
      run = { driver: st.driver || '', equipment: st.equipment || {}, dir: st.dir || 'Normal', idx: 0 };
    }
    // Bestem modus dersom ikke satt
    if (!run.mode) {
      const sand = !!run.equipment?.sand;
      run.mode = sand ? 'grus' : 'snow';
    }
    return run;
  }
  function saveRun(run) { JSET(K_RUN, run); }

  /* -------------------- filtrer adresser på valgt oppgave -------------------- */
  function getActiveAddresses() {
    const all = Sync.addresses();
    const run = getRun();
    const mode = run.mode; // 'snow' | 'grus'

    // Tillat både flat bool-felt (snow/grus) og nested tasks-objekt
    const hasTask = (a) => {
      if (!a) return false;
      if (mode === 'grus') {
        if (typeof a.grus === 'boolean') return a.grus;
        if (a.tasks && typeof a.tasks.grus === 'boolean') return a.tasks.grus;
        // hvis ingen flagg: anta false for grus
        return false;
      } else {
        if (typeof a.snow === 'boolean') return a.snow;
        if (a.tasks && typeof a.tasks.snow === 'boolean') return a.tasks.snow;
        // hvis ingen flagg: anta true for snø (bakoverkompatibelt)
        return true;
      }
    };

    const filtered = all.filter(hasTask);
    // Rekkefølge
    const dir = (getRun().dir || 'Normal').toLowerCase();
    if (dir.startsWith('mot')) filtered.reverse();

    return filtered;
  }

  /* -------------------- nå/neste + progresjon -------------------- */
  function getNowNext() {
    const run = getRun();
    const list = getActiveAddresses();
    const total = list.length || 0;

    // Korriger idx hvis utenfor
    if (run.idx < 0) run.idx = 0;
    if (run.idx >= total) run.idx = total > 0 ? (total - 1) : 0;
    saveRun(run);

    return { list, run, total, now: list[total ? run.idx : 0] || null, next: list[run.idx + 1] || null };
  }

  // Tell «mine» og «andre» ferdige for valgt oppgave
  function computeProgress(list, driver) {
    const st = Sync.statuses(); // { id: { state, driver, ... }, ... }
    let mine = 0, other = 0, doneTotal = 0;

    for (const a of list) {
      const s = st[a.id] || st[a._id] || null; // støtt litt ulike ID-felt
      const isDone = s?.state === 'done' || s?.state === 'ferdig';
      if (isDone) {
        doneTotal++;
        if (s?.driver && driver && s.driver === driver) mine++;
        else other++;
      }
    }
    return { mine, other, doneTotal, total: list.length };
  }

  function taskLabel(run) {
    return run.mode === 'grus' ? 'Strø grus' : 'Fjerne snø';
  }

  /* -------------------- UI-render -------------------- */
  function render() {
    // Ikke gjør noe dersom vi ikke står på «Under arbeid»
    const host = $('#work');
    if (!host || host.hasAttribute('hidden')) return;

    const { list, run, total, now, next } = getNowNext();

    // Overskrifter Nå/Neste
    $('#b_now')  && ($('#b_now').textContent  = now  ? (now.name || now.title || now.address || String(now.id))  : '—');
    $('#b_next') && ($('#b_next').textContent = next ? (next.name || next.title || next.address || String(next.id)) : '—');

    // Oppgavetekst
    $('#b_task') && ($('#b_task').textContent = taskLabel(run));

    // Status «venter/pågår/ferdig» for current
    const st = Sync.statuses();
    const sid = now ? (now.id || now._id) : null;
    const sObj = sid ? st[sid] : null;
    const human =
      !sObj || !sObj.state ? 'Venter' :
      sObj.state === 'start'  ? 'Pågår' :
      sObj.state === 'done'   ? 'Ferdig' :
      sObj.state === 'skip'   ? 'Hoppet over' :
      sObj.state === 'block'  ? 'Ikke mulig' : 'Venter';
    $('#b_status') && ($('#b_status').textContent = human);

    // Progress
    const prog = computeProgress(list, run.driver || '');
    const meBar    = $('#b_prog_me');
    const otherBar = $('#b_prog_other');

    const pctMine  = total ? Math.round(100 * (prog.mine / total)) : 0;
    const pctOther = total ? Math.round(100 * (prog.other / total)) : 0;

    if (meBar)    meBar.style.width    = pctMine + '%';
    if (otherBar) otherBar.style.width = pctOther + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${prog.mine}/${total} mine`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${prog.other}/${total} andre`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${prog.doneTotal} av ${total} adresser fullført`);
  }

  /* -------------------- handlinger -------------------- */
  function ensureNowOrAlert() {
    const { now } = getNowNext();
    if (!now) { alert('Ingen adresser i denne modusen. Sjekk oppgave/JSONBin.'); }
    return now;
  }

  async function doSet(state) {
    const run = getRun();
    const a = ensureNowOrAlert();
    if (!a) return;

    const id = a.id || a._id;
    const payload = {
      state,                    // 'start' | 'done' | 'skip' | 'block'
      driver: run.driver || '',
      mode: run.mode            // snø/grus, nyttig i status
    };

    try {
      await Sync.setStatus(id, payload);
      // Om vi markerer «done», hopp automatisk videre
      if (state === 'done') {
        const ctx = getNowNext();
        if (ctx.run.idx < ctx.total - 1) {
          ctx.run.idx++;
          saveRun(ctx.run);
        }
      }
      render();
    } catch (e) {
      alert('Kunne ikke oppdatere status: ' + (e?.message || e));
    }
  }

  function onStart() { return doSet('start'); }
  function onDone()  { return doSet('done');  }
  function onSkip()  { return doSet('skip');  }
  function onBlock() { return doSet('block'); }

  function onNext() {
    const ctx = getNowNext();
    if (ctx.run.idx < ctx.total - 1) {
      ctx.run.idx++;
      saveRun(ctx.run);
      render();
    }
  }

  function onNav() {
    const a = ensureNowOrAlert();
    if (!a) return;
    const lat = a.lat ?? a.latitude;
    const lon = a.lon ?? a.lng ?? a.longitude;
    if (typeof lat === 'number' && typeof lon === 'number') {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
      window.open(url, '_blank');
    } else {
      alert('Adresse mangler koordinater.');
    }
  }

  /* -------------------- wiring -------------------- */
  function wire() {
    $('#act_start') && $('#act_start').addEventListener('click', onStart);
    $('#act_done')  && $('#act_done') .addEventListener('click', onDone);
    $('#act_skip')  && $('#act_skip') .addEventListener('click', onSkip);
    $('#act_block') && $('#act_block').addEventListener('click', onBlock);
    $('#act_next')  && $('#act_next') .addEventListener('click', onNext);
    $('#act_nav')   && $('#act_nav')  .addEventListener('click', onNav);

    window.addEventListener('hashchange', render);
    // Hvis Sync finnes med eventer, re-render ved endring
    if (Sync.have() && typeof window.Sync.on === 'function') {
      window.Sync.on('status-changed', render);
      window.Sync.on('addresses-loaded', render);
    }
    render();
  }

  document.addEventListener('DOMContentLoaded', wire);
})();