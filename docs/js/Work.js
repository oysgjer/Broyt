// js/Work.js
(() => {
  'use strict';

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const J = {
    get(k,d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  const LSK_RUN = 'BRYT_RUN';

  /* ---------- Run state i LS ---------- */
  function getRun(){
    return J.get(LSK_RUN, {
      driver:'',
      equipment:{plow:false,fres:false,sand:false},
      dir:'Normal',
      idx:0
    });
  }
  function setRun(r){ J.set(LSK_RUN, r); }

  /* ---------- Adresser / kontekst ---------- */
  function getNowNext(){
    const A = window.Sync?.getAddresses?.() || [];
    const r = getRun();
    const total = A.length;
    const idx = Math.max(0, Math.min(r.idx ?? 0, Math.max(0,total-1)));
    const now  = total ? A[idx] : null;
    const next = total && idx+1<total ? A[idx+1] : null;
    return {A, r, idx, now, next, total};
  }

  function taskLabel(){
    const r = getRun();
    return r.equipment?.sand ? 'Strøing av grus' : 'Snøbrøyting';
  }

  /* ---------- Tilstands-mapping ---------- */
  const toCanonical = (s)=>({
    'pågår':'in_progress',
    'in_progress':'in_progress',
    'ferdig':'done',
    'done':'done',
    'hoppet':'skipped',
    'skipped':'skipped',
    'ikke_mulig':'blocked',
    'blocked':'blocked',
    'ikke_påbegynt':'not_started',
    'not_started':'not_started'
  }[s] || 'not_started');

  const toNorwegian = (canon)=>({
    'not_started':'Ikke påbegynt',
    'in_progress':'Pågår',
    'done':'Ferdig',
    'skipped':'Hoppet over',
    'blocked':'Ikke mulig'
  }[canon] || 'Ukjent');

  function statusTextFor(id){
    const map = window.Sync?.getStatusMap?.() || {};
    const canon = toCanonical(map[id]?.state);
    return toNorwegian(canon);
  }

  /* ---------- Render ---------- */
  function renderProgress(){
    const {A} = getNowNext();
    const total = A.length || 1;

    let mine=0, andre=0;
    const map = window.Sync?.getStatusMap?.() || {};
    const r = getRun();

    for (const id in map){
      const st = map[id];
      if(!st) continue;
      if (toCanonical(st.state) !== 'done') continue;
      if (st.driver && r.driver && st.driver === r.driver) mine++;
      else andre++;
    }

    const mePct = Math.round(100*mine/total);
    const otPct = Math.round(100*andre/total);

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = otPct + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${mine}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${andre}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(mine+andre,total)} av ${total} adresser fullført`);
  }

  function renderWork(){
    const section = $('#work');
    if (!section || section.hasAttribute('hidden')) return;

    const {now, next} = getNowNext();
    $('#b_now')  && ($('#b_now').textContent  = now  ? (now.name || '—') : '—');
    $('#b_next') && ($('#b_next').textContent = next ? (next.name|| '—') : '—');

    $('#b_task')   && ($('#b_task').textContent   = taskLabel());
    $('#b_status') && ($('#b_status').textContent = now ? statusTextFor(now.id) : '—');

    renderProgress();

    const disabled = !now;
    $$('.btn, .btn-ghost', section).forEach(btn=>{
      btn.disabled = disabled;
      btn.setAttribute('aria-disabled', disabled ? 'true':'false');
    });
  }

  function gotoService(){ location.hash = '#service'; }

  /* ---------- Handling av statuser ---------- */
  async function changeState(newHumanState){
    const {now, r} = getNowNext();
    if(!now) return;
    const id = now.id;
    const state = toCanonical(newHumanState);

    // Lagre i sky via Sync (driver inkludert for “mine/andre”)
    await window.Sync.setAddressState(id, state, { driver: r.driver || '' });

    // Hent fersk status slik at progress og tekst oppdateres umiddelbart
    if (window.Sync?.refreshStatus) {
      await window.Sync.refreshStatus();
    }
    renderWork();
  }

  async function onStart(){ await changeState('pågår'); }

  async function onDone(){
    await changeState('ferdig');

    const {A, r, idx} = getNowNext();
    const nextIdx = idx + 1;

    if (nextIdx < A.length){
      r.idx = nextIdx; setRun(r);
      renderWork();
      return;
    }

    // Runde ferdig -> valg
    const val = prompt(
      'Runden er ferdig.\n\nSkriv ett av valgene:\n- "ny"  = Ny brøyterunde\n- "grus" = Start ny runde med grus\n- "ferdig" = Gå til Service',
      'ferdig'
    );
    const choice = (val||'').trim().toLowerCase();

    if (choice === 'ny'){
      r.idx = 0; setRun(r);
      // Nullstill status om du ønsker? (da trengs egen sync-funksjon)
      renderWork();
    } else if (choice === 'grus'){
      r.idx = 0;
      r.equipment = {...r.equipment, sand:true, plow:false, fres:false};
      setRun(r);
      renderWork();
    } else {
      gotoService();
    }
  }

  async function onSkip(){
    await changeState('hoppet');
    const {A, r, idx} = getNowNext();
    r.idx = Math.min(idx+1, Math.max(0, A.length-1)); setRun(r);
    renderWork();
  }

  function onNext(){
    const {A, r, idx} = getNowNext();
    r.idx = Math.min(idx+1, Math.max(0, A.length-1)); setRun(r);
    renderWork();
  }

  async function onBlock(){ await changeState('ikke_mulig'); }

  function onNav(){
    const {now} = getNowNext();
    if(!now) return;
    if (Number.isFinite(now.lat) && Number.isFinite(now.lon)){
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${now.lat},${now.lon}`)}`;
      window.open(url, '_blank');
    } else {
      alert('Ingen koordinater tilgjengelig for denne adressen.');
    }
  }

  /* ---------- Wire ---------- */
  function wire(){
    $('#act_start')?.addEventListener('click', onStart);
    $('#act_done') ?.addEventListener('click', onDone);
    $('#act_skip') ?.addEventListener('click', onSkip);
    $('#act_next') ?.addEventListener('click', onNext);
    $('#act_block')?.addEventListener('click', onBlock);
    $('#act_nav')  ?.addEventListener('click', onNav);

    if (window.Sync?.on){
      window.Sync.on('ready',     renderWork);
      window.Sync.on('addresses', renderWork);
      window.Sync.on('status',    renderWork);
    }

    window.addEventListener('hashchange', renderWork);
    renderWork();
  }

  document.addEventListener('DOMContentLoaded', wire);
})();