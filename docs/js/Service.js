/* =========================================================
   Service.js – serviceutfylling + deling/epost av rapport
   Forutsetter at HTML har disse id-ene:
   - svc_skjaer, svc_fres, svc_forstilling
   - svc_olje_foran, svc_olje_bak, svc_olje_etter
   - svc_diesel, svc_kasser (text), svc_annet (textarea)
   - svc_send (knapp)
   Bruker samme lagring som resten av appen:
   - BROYT_LOCAL_DATA  (sky-snapshot + status)
   - BROYT_PREFS       (fører/utstyr/retning)
   ========================================================= */

(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  /* ---------- Små utils ---------- */
  const nowISO = ()=> new Date().toISOString();
  const fmtDate = (d=new Date())=>{
    return d.toLocaleString('no-NO',{ year:'numeric', month:'2-digit', day:'2-digit',
                                      hour:'2-digit', minute:'2-digit' });
  };
  const safe = v => (v==null ? '' : String(v));

  function getPrefs(){
    try{ return JSON.parse(localStorage.getItem('BROYT_PREFS')||'{}'); }
    catch{ return {}; }
  }
  function getCloud(){
    try{ return JSON.parse(localStorage.getItem('BROYT_LOCAL_DATA')||'{}'); }
    catch{ return {}; }
  }

  /* ---------- Les/skriv service-utkast ---------- */
  const DRAFT_KEY='BROYT_SERVICE_DRAFT';

  function readDraft(){
    try{ return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}'); }
    catch{ return {}; }
  }
  function writeDraft(d){
    try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(d||{})); }
    catch{}
  }
  function clearDraft(){
    try{ localStorage.removeItem(DRAFT_KEY); }catch{}
  }

  function collectForm(){
    return {
      skjaer:       $('#svc_skjaer')?.checked || false,
      fres:         $('#svc_fres')?.checked || false,
      forstilling:  $('#svc_forstilling')?.checked || false,

      oljeForan:    $('#svc_olje_foran')?.checked || false,
      oljeBak:      $('#svc_olje_bak')?.checked || false,
      oljeEtter:    $('#svc_olje_etter')?.checked || false,

      diesel:       $('#svc_diesel')?.checked || false,
      kasser:       $('#svc_kasser')?.value?.trim() || '',
      annet:        $('#svc_annet')?.value?.trim() || '',

      ts:           nowISO()
    };
  }

  function applyDraftToForm(d){
    if(!d) return;
    if($('#svc_skjaer'))       $('#svc_skjaer').checked = !!d.skjaer;
    if($('#svc_fres'))         $('#svc_fres').checked = !!d.fres;
    if($('#svc_forstilling'))  $('#svc_forstilling').checked = !!d.forstilling;

    if($('#svc_olje_foran'))   $('#svc_olje_foran').checked = !!d.oljeForan;
    if($('#svc_olje_bak'))     $('#svc_olje_bak').checked   = !!d.oljeBak;
    if($('#svc_olje_etter'))   $('#svc_olje_etter').checked = !!d.oljeEtter;

    if($('#svc_diesel'))       $('#svc_diesel').checked = !!d.diesel;
    if($('#svc_kasser'))       $('#svc_kasser').value   = safe(d.kasser);
    if($('#svc_annet'))        $('#svc_annet').value    = safe(d.annet);
  }

  function autoBindDraft(){
    const inputs = $$('#service section input, #service section textarea');
    inputs.forEach(el=>{
      const ev = (el.tagName==='TEXTAREA' || el.type==='text') ? 'input':'change';
      el.addEventListener(ev, ()=> writeDraft(collectForm()));
    });
  }

  /* ---------- Hent runde-data fra sky (lokal kopi) ---------- */
  function summarizeRounds(){
    const cloud = getCloud();
    const addrs = (cloud && cloud.snapshot && Array.isArray(cloud.snapshot.addresses))
      ? cloud.snapshot.addresses : [];

    // Back-compat: statusSnow kan ligge som "status"
    const bagSnow = (cloud && (cloud.statusSnow || cloud.status)) || {};
    const bagGrit = (cloud && cloud.statusGrit) || {};

    function pickDone(bag){
      const list=[];
      addrs.forEach((a,i)=>{
        const st = bag[a.name] || {};
        if(st.state==='done'){
          list.push({
            idx: i+1,
            name: a.name,
            who: st.driver||'',
            startedAt: st.startedAt||null,
            finishedAt: st.finishedAt||null
          });
        }
      });
      return { total:addrs.length, done:list.length, list };
    }

    return {
      snow: pickDone(bagSnow),
      grit: pickDone(bagGrit),
      season: (cloud && cloud.settings && cloud.settings.seasonLabel) || '—'
    };
  }

  /* ---------- Bygg rapporttekst ---------- */
  function buildReportText(){
    const prefs = getPrefs();
    const svc   = collectForm();
    const sum   = summarizeRounds();

    const driver = prefs?.driver ? prefs.driver : '—';
    const modeSnow = prefs?.eq?.sand ? 'Sand/Grus' : 'Snø';
    const dir   = prefs?.dir || 'Normal';

    const hdr = [
      `Brøyterapport – ${fmtDate(new Date())}`,
      `Fører: ${driver}`,
      `Retning: ${dir}`,
      `Sesong: ${sum.season}`,
      `Aktiv modus ved start: ${modeSnow}`,
      ``,
    ].join('\n');

    const svcTxt = [
      `SERVICE`,
      `- Skjær smurt: ${svc.skjaer?'Ja':'Nei'}`,
      `- Fres smurt: ${svc.fres?'Ja':'Nei'}`,
      `- Forstilling smurt: ${svc.forstilling?'Ja':'Nei'}`,
      ``,
      `- Olje sjekket foran: ${svc.oljeForan?'Ja':'Nei'}`,
      `- Olje sjekket bak: ${svc.oljeBak?'Ja':'Nei'}`,
      `- Olje etterfylt: ${svc.oljeEtter?'Ja':'Nei'}`,
      ``,
      `- Diesel fylt: ${svc.diesel?'Ja':'Nei'}`,
      `- Antall kasser grus: ${svc.kasser||'—'}`,
      ``,
      `- Annet: ${svc.annet||'—'}`,
      ``
    ].join('\n');

    const snowList = sum.snow.list.map(x=>`  ${String(x.idx).padStart(2,'0')}. ${x.name} (${x.who||'—'})`).join('\n') || '  —';
    const gritList = sum.grit.list.map(x=>`  ${String(x.idx).padStart(2,'0')}. ${x.name} (${x.who||'—'})`).join('\n') || '  —';

    const roundsTxt = [
      `RUNDER`,
      `- Snø: ${sum.snow.done} av ${sum.snow.total} fullført`,
      snowList,
      ``,
      `- Sand/Grus: ${sum.grit.done} av ${sum.grit.total} fullført`,
      gritList,
      ``
    ].join('\n');

    return `${hdr}${svcTxt}${roundsTxt}`.trim();
  }

  /* ---------- Del / send e-post ---------- */
  async function shareOrEmail(){
    const text = buildReportText();
    const subject = `Brøyterapport ${fmtDate(new Date())}`;

    // 1) Web Share API med fil (best på iOS/Android moderne)
    try{
      const blob = new Blob([text], {type:'text/plain'});
      const file = new File([blob], `Broeyterapport_${new Date().toISOString().slice(0,10)}.txt`, {type:'text/plain'});
      if(navigator.share && navigator.canShare && navigator.canShare({ files:[file] })){
        await navigator.share({
          title: subject,
          text: 'Se vedlagt brøyterapport.',
          files: [file]
        });
        // Rydd utkast når delt
        clearDraft();
        alert('Rapport delt.');
        return;
      }
    }catch(e){ /* fallthrough til mailto */ }

    // 2) Vanlig mailto (ingen vedlegg, men alt i body)
    const body = encodeURIComponent(text);
    const sub  = encodeURIComponent(subject);
    // Tips: vil du låse til fast mottaker, legg til &to= i index.html <a> eller endre her:
    const mailto = `mailto:?subject=${sub}&body=${body}`;
    // Åpne:
    window.location.href = mailto;

    // Vi rydder ikke utkast automatisk her; bruker kan angre i epost-appen.
  }

  /* ---------- Init ---------- */
  function init(){
    // Last eventuelt kladd
    applyDraftToForm(readDraft());
    // Koble automatisk lagring
    autoBindDraft();
    // Koble "Send rapport"
    $('#svc_send')?.addEventListener('click', (e)=>{
      e.preventDefault();
      // lagre siste input før send
      writeDraft(collectForm());
      shareOrEmail();
    });
  }

  // Kjør når DOM er klar
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();