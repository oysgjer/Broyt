// WORK
(function(){
  const {S,STATE_LABEL,refreshCloud,saveCloud,statusStore,nextIndex,mapsUrlFromAddr,$}=window._shared;

  function updateProgressBars(){
    const total=S.addresses.length||1; let me=0,other=0;
    const bag=statusStore();
    for(const k in bag){ const st=bag[k]; if(st?.state==='done'){ if(st.driver===S.driver) me++; else other++; } }
    const meEl=$('#b_prog_me'), otherEl=$('#b_prog_other');
    if(meEl) meEl.style.width=Math.round(100*me/total)+'%';
    if(otherEl) otherEl.style.width=Math.round(100*other/total)+'%';
  }
  function uiSetWork(){
    const now=S.addresses[S.idx]||null;
    const next=S.addresses[nextIndex(S.idx,S.dir)]||null;
    if($('#b_now'))  $('#b_now').textContent = now?(now.name||'—'):'—';
    if($('#b_next')) $('#b_next').textContent = next?(next.name||'—'):'—';
    if($('#b_dir'))  $('#b_dir').textContent  = S.dir;
    if($('#b_task')) $('#b_task').textContent = (S.mode==='snow')?'Snø':'Grus';
    const bag=statusStore();
    const st=(now?.name && bag[now.name]?.state) || 'not_started';
    if($('#b_status')) $('#b_status').textContent = STATE_LABEL[st]||'—';
    updateProgressBars();
  }
  function allDone(){
    if(!S.addresses.length) return false;
    const bag=statusStore();
    return S.addresses.every(a => (bag[a.name]?.state==='done'));
  }
  function maybeShowAllDoneDialog(){
    if(!allDone()) return;
    const modeTxt=(S.mode==='snow')?'Snø':'Grus';
    const go=confirm(`Alt er utført for ${modeTxt}-runden 🎉\n\nOK = Gå til Service\nAvbryt = bli`);
    if(go) window.showPage('service');
  }
  function setStatusFor(name,patch){ const bag=statusStore(); const cur=bag[name]||{}; bag[name]={...cur,...patch,driver:S.driver}; }

  async function stepState(patch,nextAfter=true){
    await refreshCloud();
    const cur=S.addresses[S.idx]; if(!cur) return;
    setStatusFor(cur.name,{...patch});
    await saveCloud();
    uiSetWork();
    if(allDone()){ maybeShowAllDoneDialog(); return; }
    if(nextAfter){
      const ni=nextIndex(S.idx,S.dir);
      if(ni>=0 && ni<S.addresses.length){
        S.idx=ni; uiSetWork();
        if(S.autoNav){ const t=S.addresses[S.idx]; if(t) window.open(mapsUrlFromAddr(t),'_blank'); }
      }else{ window.showPage('service'); }
    }
  }

  function navigateToNext(){
    const next = S.addresses[nextIndex(S.idx,S.dir)];
    const target = next || S.addresses[S.idx] || null;
    if(!target) return;
    const url = mapsUrlFromAddr(target);
    window.open(url,'_blank');
  }

  window.Work={
    onShow(){
      uiSetWork();
      $('#act_start')?.addEventListener('click',()=>stepState({state:'in_progress',startedAt:Date.now()},false));
      $('#act_skip') ?.addEventListener('click',()=>stepState({state:'skipped',finishedAt:Date.now()}));
      $('#act_block')?.addEventListener('click',()=>{ const reason=prompt('Hvorfor ikke mulig? (valgfritt)','')||''; stepState({state:'blocked',finishedAt:Date.now(),note:reason}); });
      $('#act_acc')  ?.addEventListener('click', async ()=>{
        try{
          const note=prompt('Beskriv uhell (valgfritt)','')||'';
          const file=await (new Promise(res=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.capture='environment'; i.onchange=()=>res(i.files&&i.files[0]?i.files[0]:null); i.click(); setTimeout(()=>res(null),15000); }));
          let photo=null;
          if(file) photo=await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const maxW=900,q=0.6; const scale=maxW/Math.max(img.width,img.height); const w=img.width>=img.height?maxW:Math.round(img.width*scale); const h=img.width>=img.height?Math.round(img.height*scale):maxW; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',q)); }; img.src=fr.result; }; fr.onerror=rej; fr.readAsDataURL(file); });
          await stepState({state:'accident',finishedAt:Date.now(),note,photo},false);
        }catch(e){ alert('Feil ved uhell: '+(e.message||e)); }
      });
      $('#act_done') ?.addEventListener('click',()=>stepState({state:'done',finishedAt:Date.now()}));
      $('#act_nav')  ?.addEventListener('click',navigateToNext);
    }
  };
})();