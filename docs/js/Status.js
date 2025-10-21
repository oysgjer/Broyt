// js/Status.js
(() => {
  'use strict';
  const $ = (s,r=document)=>r.querySelector(s);

  const STATE_LABEL={ not_started:'Ikke påbegynt', in_progress:'Pågår', done:'Ferdig', skipped:'Hoppet over', blocked:'Ikke mulig', accident:'Uhell' };

  async function loadStatus(){
    const cloud = await window.Sync.loadCloud();
    const settings = cloud.settings || {};
    const addrs = Array.isArray(cloud.snapshot.addresses) ? cloud.snapshot.addresses : [];
    const modeSel = 'snow'; // du kan utvide med UI-filter senere
    const bag = (modeSel==='snow') ? (cloud.statusSnow||{}) : (cloud.statusGrit||{});

    // Progress-sammendrag (viser i toppen av work, men kjør en enkel her også hvis ønskelig)
    // ...

    // Minimal tabell/oversikt (kan bygges ut senere)
    const list = addrs.map((a,i)=>{
      const s = bag[a.name] || {state:'not_started'};
      return `${i+1}. ${a.name} — ${STATE_LABEL[s.state] || '—'}`;
    }).join('\n');

    const host = $('#status');
    if(!host) return;
    // enkel visning:
    if(!host.querySelector('.status-list')){
      const pre = document.createElement('pre');
      pre.className='status-list';
      pre.style.whiteSpace='pre-wrap';
      pre.style.background='transparent';
      pre.style.border='1px solid var(--sep)';
      pre.style.borderRadius='8px';
      pre.style.padding='10px';
      pre.textContent = list || 'Ingen adresser.';
      host.appendChild(pre);
    }else{
      host.querySelector('.status-list').textContent = list || 'Ingen adresser.';
    }
  }

  function wire(){
    window.addEventListener('hashchange', ()=>{
      const id=(location.hash||'#home').replace('#','');
      if(id==='status'){ loadStatus().catch(console.error); }
    });
    if((location.hash||'#home').replace('#','')==='status'){
      loadStatus().catch(console.error);
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();