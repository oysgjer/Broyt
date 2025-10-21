// js/Work.js
(() => {
  'use strict';

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  const K_SETTINGS = 'BRYT_SETTINGS';
  const K_RUN      = 'BRYT_RUN';

  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  function settings(){ return readJSON(K_SETTINGS, { driver:'', equipment:{plow:false,fres:false,sand:false}, dir:'Normal' }); }
  function run(){ return readJSON(K_RUN, { idx:0, driver:'', equipment:{}, dir:'Normal' }); }
  function saveRun(r){ writeJSON(K_RUN, r); }

  function addresses(){
    return readJSON('BRYT_ADDR_CACHE', []);
  }

  function orderList(list, dir){
    if (dir==='Motsatt') return [...list].reverse();
    return list;
  }

  function describeTask(st){
    const eq = st?.equipment || settings().equipment;
    // Snøbrøyting hvis plow eller fres; ellers Strøing av grus hvis sand
    if (eq?.sand && !eq?.plow && !eq?.fres) return 'Strøing av grus';
    if (eq?.plow || eq?.fres) return 'Snøbrøyting';
    return '—';
  }

  function getNowNext(){
    const s = settings();
    const list = orderList(addresses(), s.dir);
    const r = run();
    const idx = Math.max(0, Math.min(r.idx || 0, Math.max(0, list.length-1)));
    return { s, list, idx, now:list[idx]||null, next:list[idx+1]||null, total:list.length };
  }

  function setBarColors(){
    const task = describeTask();
    const me = $('#b_prog_me');
    if (!me) return;
    me.classList.remove('is-grus');
    if (task === 'Strøing av grus') me.classList.add('is-grus');
  }

  function statusStore(){ return window.Sync?.statusStore() || {}; }

  function updateProgressBars(){
    const { s, list, total } = getNowNext();
    const bag = statusStore();
    let me=0, other=0;

    for (const a of list){
      const st = bag[a.id];
      if (st?.state === 'done'){
        if (st.driver === s.driver) me++; else other++;
      }
    }

    const mePct = Math.round(100 * me / (total||1));
    const otPct = Math.round(100 * other / (total||1));

    const bm = $('#b_prog_me'), bo = $('#b_prog_other');
    if (bm) bm.style.width = mePct + '%';
    if (bo) bo.style.width = otPct + '%';

    $('#b_prog_me_count')    && ($('#b_prog_me_count').textContent    = `${me}/${total}`);
    $('#b_prog_other_count') && ($('#b_prog_other_count').textContent = `${other}/${total}`);
    $('#b_prog_summary')     && ($('#b_prog_summary').textContent     = `${Math.min(me+other,total)} av ${total} adresser fullført`);
  }

  function renderWork(){
    const { s, list, idx, now, next, total } = getNowNext();
    if (!$('#work') || $('#work').hasAttribute('hidden')) return;

    $('#b_now')  && ($('#b_now').textContent  = now ? now.name : '—');
    $('#b_next') && ($('#b_next').textContent = next ? next.name : '—');

    $('#b_task')   && ($('#b_task').textContent   = describeTask(s));
    $('#b_status') && ($('#b_status').textContent = 'Venter');

    setBarColors();
    updateProgressBars();
  }

  async function setState(newState){
    const { list } = getNowNext();
    const r = run();
    const current = list[r.idx];
    if (!current) return;

    const payload = {
      state: newState,
      driver: settings().driver || ''
    };
    await window.Sync.setStatus(current.id, payload);
    // oppdater label
    $('#b_status') && ($('#b_status').textContent = (newState==='start'?'Pågår': newState==='done'?'Ferdig':'Venter'));
    updateProgressBars();
  }

  function goNext(){
    const r = run();
    r.idx = Math.min(r.idx + 1, Math.max(0, addresses().length-1));
    saveRun(r);
    renderWork();
  }

  function goSkip(){
    goNext();
  }

  function navTo(lat,lon,text){
    const base = "https://www.google.com/maps/dir/?api=1";
    const url = `${base}&destination=${encodeURIComponent(`${lat},${lon}`)}&travelmode=driving`;
    window.open(url, '_blank');
  }

  function ensureResetButtons(){
    const host = $('.work-card');
    if (!host || $('#reset_bar')) return;

    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.id = 'reset_bar';
    wrap.style.marginTop = '12px';
    wrap.innerHTML = `
      <button id="reset_mine" class="btn-ghost">↺ Nullstill mine</button>
      <button id="reset_all"  class="btn-ghost">⟲ Nullstill alt</button>
    `;
    host.appendChild(wrap);

    $('#reset_mine')?.addEventListener('click', async ()=>{
      const me = settings().driver || '';
      if (!me) return alert('Sett fører under Hjem først.');
      if (!confirm('Nullstille alle mine adresser til “ikke påbegynt”?')) return;
      await window.Sync.resetMine(me);
      renderWork();
    });
    $('#reset_all')?.addEventListener('click', async ()=>{
      if (!confirm('Nullstille ALLE adresser for alle sjåfører?')) return;
      await window.Sync.resetAll();
      renderWork();
    });
  }

  function wire(){
    // knapper
    $('#act_start')?.addEventListener('click', async ()=>{ await setState('start'); });
    $('#act_done') ?.addEventListener('click', async ()=>{
      await setState('done');
      // Når siste adresse er ferdig -> spør hva videre
      const { idx, total } = getNowNext();
      if (idx >= total-1){
        const choice = prompt('Runde fullført. Svar med: NY, GRUS eller FERDIG', 'FERDIG');
        const s = settings();
        if (choice && choice.toUpperCase().startsWith('NY')){
          // Ny runde samme utstyr
          saveRun({ ...run(), idx:0 });
          renderWork();
        } else if (choice && choice.toUpperCase().startsWith('GRUS')){
          // Ny runde grus
          const st = { ...settings(), equipment:{plow:false,fres:false,sand:true} };
          localStorage.setItem(K_SETTINGS, JSON.stringify(st));
          saveRun({ ...run(), idx:0 });
          renderWork();
        } else {
          // Ferdig -> til service
          location.hash = '#service';
        }
      } else {
        goNext();
      }
    });

    $('#act_next') ?.addEventListener('click', ()=> goNext());
    $('#act_skip') ?.addEventListener('click', ()=> goSkip());
    $('#act_block')?.addEventListener('click', async ()=>{ await setState('blocked'); goNext(); });
    $('#act_nav')  ?.addEventListener('click', ()=>{
      const { now } = getNowNext();
      if (now?.lat && now?.lon) navTo(now.lat, now.lon, now.name);
      else alert('Ingen koordinater på denne adressen.');
    });

    ensureResetButtons();
    setBarColors();
    renderWork();
  }

  window.addEventListener('hashchange', renderWork);
  document.addEventListener('DOMContentLoaded', wire);
})();