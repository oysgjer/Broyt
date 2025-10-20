<script>
/* Home.js — robust start-runde that always yields adresser */

(() => {
  const $  = (s,root=document)=>root.querySelector(s);

  // small helpers from core (with fallbacks so Start always works)
  const Core = {
    ensureAddressesSeeded:  (window.ensureAddressesSeeded  || (async()=>{})),
    refreshCloud:           (window.refreshCloud           || (async()=>{})),
    saveCloud:              (window.saveCloud              || (async()=>{})),
    showPage:               (window.showPage               || ((id)=>{ location.hash='#'+id; })),
    S:                      (window.S                      || (window.S={dir:'Normal',addresses:[],idx:0,driver:'driver',autoNav:false,mode:'snow',cloud:null}))
  };

  // Build a safe default seed list if cloud is empty and core seeding didn’t run
  function localSeedIfNeeded() {
    const c = Core.S.cloud || {};
    const has = Array.isArray(c?.snapshot?.addresses) && c.snapshot.addresses.length>0;
    if (has) return;
    const base=[
      "Hjeramoen 12-24","Hjerastubben 8, 10, 12 ,14, 16","Hjeramoen 32-34-40-42","Hjeramoen vei til 32-34-40-42",
      "Hjeramoen 47-49-51-53","Hjeramoen 48-50-52-54","Hjerakroken 2-4","Vognvegen 17","Tunlandvegen",
      "Bjørnsrud Skog 38","Trondheimsvegen 26-36","Sessvollvegen 9","Sessvollvegen 11","Mette Hasler",
      "Henning Morken Hasler","Hasler Drivhus","Grendehuset","Søjordet","Folkeparken","Folkeparken Bakke",
      "Læringsverkstedet Parkering","Læringsverkstedet Ute området","Hagamoen","(Sjøviken) Hagamoen 12",
      "Moen Nedre vei","Fred/ Moen Nedre 17","Odd/ Moen Nedre 15","Trondheimsvegen 86","Fjellet (400m vei Råholt)",
      "Bilextra (hele bygget)","Lundgårdstoppen","Normann Hjellesveg"
    ];
    Core.S.cloud = Core.S.cloud || {};
    Core.S.cloud.snapshot = Core.S.cloud.snapshot || {};
    Core.S.cloud.snapshot.addresses = base.map(n=>({
      name:n, group:"", active:true,
      flags:{snow:true,grit:false}, stakes:'', coords:''
    }));
  }

  async function startRound(){
    try{
      // read form
      const driver = ($('#a_driver')?.value || '').trim() || 'driver';
      const dir    = $('#a_dir')?.value || 'Normal';
      const eqSand = !!$('#a_eq_sand')?.checked; // Sand/Grus
      const autoNav= !!$('#a_autoNav')?.checked;

      // persist prefs
      localStorage.setItem('BROYT_PREFS', JSON.stringify({driver,dir,eq:{sand:eqSand},autoNav}));

      // write runtime state
      Core.S.driver = driver;
      Core.S.dir    = dir;
      Core.S.autoNav= autoNav;
      Core.S.mode   = eqSand ? 'grit' : 'snow';

      // sync + seed
      await Core.ensureAddressesSeeded();
      await Core.refreshCloud();
      localSeedIfNeeded(); // hard fallback if cloud is still empty

      // pull list and filter robustly
      const all = Array.isArray(Core.S.cloud?.snapshot?.addresses) ? Core.S.cloud.snapshot.addresses : [];

      let list = all
        .filter(a => a?.active !== false)
        .filter(a => {
          const snow = (a?.flags && 'snow' in a.flags) ? !!a.flags.snow : true; // default snow=true
          const grit = !!(a?.flags?.grit);
          return Core.S.mode === 'snow' ? snow : grit;
        });

      // if filter removed everything, fall back to all active so “Under arbeid” never blanks
      if (list.length === 0) {
        list = all.filter(a => a?.active !== false);
      }

      Core.S.addresses = list;
      Core.S.idx = (Core.S.dir === 'Motsatt') ? (list.length-1) : 0;

      // go work
      Core.showPage('work');

      // if Work.js exposed a re-render, call it
      if (typeof window.uiSetWork === 'function') window.uiSetWork();

    }catch(e){
      alert('Kunne ikke starte runde: ' + (e.message || e));
      console.error(e);
    }
  }

  // wire button
  window.addEventListener('DOMContentLoaded', ()=>{
    $('#a_start')?.addEventListener('click', startRound);
  });
})();
</script>