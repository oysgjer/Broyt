// Admin config & dummy handlers
(function(){
  const $ = s=>document.querySelector(s);
  const RJ=(k,d)=>{ try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;}};
  const WJ=(k,v)=> localStorage.setItem(k, JSON.stringify(v));
  const K_CFG='BRYT_SYNC_CFG';

  function saveCfg(){
    const bin = $('#adm_bin').value.trim();
    const key = $('#adm_key').value.trim();
    WJ(K_CFG,{binId:bin, apiKey:key});
    $('#adm_status').textContent = 'Lagret';
  }
  document.addEventListener('click', (e)=>{
    if (e.target && e.target.id === 'adm_save_cfg') saveCfg();
  });

  // Wire buttons (dummy)
  const alertBtn = (id, txt)=>{
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', ()=>alert(txt));
  };
  alertBtn('act_start','Start');
  alertBtn('act_done','Ferdig');
  alertBtn('act_skip','Hopp over');
  alertBtn('act_next','Neste');
  alertBtn('act_nav','Naviger');
  alertBtn('act_block','Ikke mulig');
  alertBtn('btnBroytKart','Åpner brøytekart…');
  alertBtn('btnUhell','Registrer uhell…');
})();
