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

  function getRun(){
    return J.get(LSK_RUN, {
      driver:'',
      equipment:{plow:false,fres:false,sand:false},
      dir:'Normal',
      idx:0
    });
  }
  function setRun(r){ J.set(LSK_RUN, r); }

  function getNowNext(){
    const A = window.Sync.getAddresses() || [];
    const r = getRun();
    const total = A.length;
    const idx = Math.max(0, Math.min(r.idx ?? 0, Math.max(0,total-1)));
    const now  = total ? A[idx] : null;
    const next = total && idx+1<total ? A[idx+1] : null;
    return {A, r, idx, now, next, total};
  }

  function describeTaskRow(){
    const r = getRun();
    return r.equipment?.sand ? 'Strøing av grus' : 'Snøbrøyting';
  }

  function statusTextFor(id){
    const map = window.Sync.getStatusMap() || {};
    const st = map[id]?.state;
    switch(st){
      case 'not_started': case 'ikke_påbegynt': return 'Ikke påbegynt';
      case 'in_progress': case 'pågår':         return 'Pågår';
      case 'done':         return 'Ferdig';
      case 'skipped':      return 'Hoppet over';
      case 'blocked':      return 'Ikke mulig';
      default:             return 'Ukjent';
    }
  }

  function renderProgress(){
    const {A} = getNowNext();
    const total = A.length || 1;

    let mine=0, andre=0;
    const map = window.Sync.getStatusMap() || {};
    const r = getRun();
    for (const id in map){
      const st = map[id];
      if(!st || st.state!=='done') continue;
      if(st.driver && r.driver && st.driver === r.driver) mine++; else andre++;
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

    $('#b_task')   && ($('#b_task').textContent   = describeTaskRow());
    $('#b_status') && ($('#b_status').textContent = now ? statusTextFor(now.id) : '—');

    renderProgress();

    const disabled = !now;
    $$('.btn, .btn-ghost', section).forEach(btn=>{
      btn.disabled = disabled;
      btn.setAttribute('aria-disabled', disabled ? 'true':'false');
    });
  }

  function gotoService(){ location.hash = '#service'; }

  function onStart(){
    const {now} = getNowNext();
    if (!now) return;
    const r = getRun();
    window.Sync.setAddressState(now.id, 'pågår', {driver: r.driver});
    renderWork();
  }

  function onDone(){
    const {A, r, idx, now} = getNowNext();
    if (!now) return;
    window.Sync.setAddressState(now.id, 'ferdig', {driver: r.driver});

    const nextIdx = idx + 1;
    if (nextIdx < A.length){
      r.idx = nextIdx; setRun(r);
      renderWork();
      return;
    }

    const choice = window.confirm(
      'Runden er ferdig.\n\nOK = Start ny brøyterunde\nAvbryt = Gå til Service (ferdig for i dag)'
    );
    if (choice){
      r.idx = 0; setRun(r);
      renderWork();
    } else {
      gotoService();
    }
  }

  function onSkip(){
    const {A, r, idx, now} = getNowNext();
    if (!now) return;
    window.Sync.setAddressState(now.id, 'hoppet', {driver: r.driver});
    r.idx = Math.min(idx+1, Math.max(0, A.length-1)); setRun(r);
    renderWork();
  }

  function onNext(){
    const {A, r, idx} = getNowNext();
    r.idx = Math.min(idx+1, Math.max(0, A.length-1)); setRun(r);
    renderWork();
  }

  function onBlock(){
    const {now} = getNowNext();
    if (!now) return;
    const r = getRun();
    window.Sync.setAddressState(now.id, 'ikke_mulig', {driver:r.driver});
    renderWork();
  }

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

  function wire(){
    $('#act_start')?.addEventListener('click', onStart);
    $('#act_done') ?.addEventListener('click', onDone);
    $('#act_skip') ?.addEventListener('click', onSkip);
    $('#act_next') ?.addEventListener('click', onNext);
    $('#act_block')?.addEventListener('click', onBlock);
    $('#act_nav')  ?.addEventListener('click', onNav);

    if (window.Sync?.on){
      window.Sync.on('ready',      renderWork);
      window.Sync.on('addresses',  renderWork);
      window.Sync.on('status',     renderWork);
    }

    window.addEventListener('hashchange', renderWork);
    renderWork();
  }

  document.addEventListener('DOMContentLoaded', wire);
})();