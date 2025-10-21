/* =========================================================
   Service.js – Service-registrering + del via e-post
   - Leser skjema
   - Lagrer til JSONBin (cloud.serviceLogs)
   - Tilbyr sending via e-post (CSV vedlagt via Share, evt. nedlasting+mailto)
   ========================================================= */

(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const nowISO   = ()=> new Date().toISOString();
  const todayNo  = ()=> new Date().toLocaleString('no-NO');
  const fmtTime  = (t)=> t ? new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}) : '—';
  const STATE_LABEL={
    not_started:'Ikke påbegynt', in_progress:'Pågår',
    done:'Ferdig', skipped:'Hoppet over', blocked:'Ikke mulig', accident:'Uhell'
  };

  // UI-elementer (forventer at disse ID-ene finnes i service.html)
  const elMsg    = $('#svc_msg');                 // statuslinje/feedback
  const btnSend  = $('#svc_submit');              // "Send inn"-knapp

  // Skjemafelter
  const f = {
    skjær:         $('#svc_skjær'),        // checkbox
    fres:          $('#svc_fres'),         // checkbox
    forstilling:   $('#svc_forstilling'),  // checkbox
    oljeForan:     $('#svc_olje_foran'),   // checkbox
    oljeBak:       $('#svc_olje_bak'),     // checkbox
    oljeEtterfylt: $('#svc_olje_etterfylt'),// checkbox
    dieselFylt:    $('#svc_diesel'),       // checkbox
    kasserGrus:    $('#svc_kasser'),       // input text/number
    annet:         $('#svc_annet')         // textarea
  };

  // Trygg lesing av felt
  function valBool(el){ return !!(el && el.checked); }
  function valStr(el){ return (el && (el.value||'').trim()) || ''; }

  function setMsg(txt, ok=true){
    if(!elMsg) return;
    elMsg.textContent = txt;
    elMsg.style.color = ok ? 'var(--ok,#22c55e)' : 'var(--err,#ef4444)';
  }

  /* --------- Bygg service-payload --------- */
  function buildServiceRecord(){
    return {
      type: 'service',
      at: nowISO(),
      atLabel: todayNo(),
      by: (window.S && S.driver) ? S.driver : 'driver',
      mode: (window.S && S.mode) ? S.mode : 'snow',
      items: {
        skjær_smurt:       valBool(f.skjær),
        fres_smurt:        valBool(f.fres),
        forstilling_smurt: valBool(f.forstilling),

        olje_sjekket_foran: valBool(f.oljeForan),
        olje_sjekket_bak:   valBool(f.oljeBak),
        olje_etterfylt:     valBool(f.oljeEtterfylt),

        diesel_fylt:     valBool(f.dieselFylt),
        ant_kasser_grus: valStr(f.kasserGrus),
        annet:           valStr(f.annet)
      }
    };
  }

  /* --------- Lagre til JSONBin --------- */
  async function saveServiceToCloud(record){
    if(!window.JSONBIN) throw new Error('JSONBIN util mangler (del-d.js må lastes før Service.js)');
    // Hent fersk sky
    const cloud = await JSONBIN.getLatest();
    // Sikre struktur
    if(!cloud.snapshot)     cloud.snapshot={addresses:[]};
    if(!cloud.statusSnow)   cloud.statusSnow={};
    if(!cloud.statusGrit)   cloud.statusGrit={};
    if(!cloud.serviceLogs)  cloud.serviceLogs=[];
    // Legg inn denne service-registreringen
    cloud.serviceLogs.push(record);
    // Sett metadata
    cloud.updated = Date.now();
    cloud.by      = (window.S && S.driver) ? S.driver : 'driver';
    // Lagre
    await JSONBIN.putRecord(cloud);
    // Oppdater også lokal S.cloud hvis den finnes
    if(window.S){ S.cloud = cloud; }
    return cloud;
  }

  /* --------- Bygg kombinert CSV (service + status) --------- */
  function buildCombinedCsv(cloud, serviceRec){
    const rows = [];
    // Tittel
    rows.push(['Brøyterapport', todayNo()]);
    rows.push([]);

    // SERVICE-seksjon
    rows.push(['SERVICE', 'Tidspunkt', 'Sjåfør', 'Modus']);
    rows.push(['', serviceRec.atLabel || '', serviceRec.by || '', serviceRec.mode==='grit'?'Grus':'Snø']);
    rows.push(['Skjær smurt', serviceRec.items.skjær_smurt ? 'Ja':'Nei']);
    rows.push(['Fres smurt', serviceRec.items.fres_smurt ? 'Ja':'Nei']);
    rows.push(['Forstilling smurt', serviceRec.items.forstilling_smurt ? 'Ja':'Nei']);
    rows.push(['Olje sjekket foran', serviceRec.items.olje_sjekket_foran ? 'Ja':'Nei']);
    rows.push(['Olje sjekket bak',   serviceRec.items.olje_sjekket_bak ? 'Ja':'Nei']);
    rows.push(['Olje etterfylt',     serviceRec.items.olje_etterfylt ? 'Ja':'Nei']);
    rows.push(['Diesel fylt',        serviceRec.items.diesel_fylt ? 'Ja':'Nei']);
    rows.push(['Antall kasser grus', String(serviceRec.items.ant_kasser_grus||'')]);
    rows.push(['Annet',              String(serviceRec.items.annet||'')]);
    rows.push([]);

    // STATUS-seksjon – begge runder
    rows.push(['#','Adresse','Oppdrag','Stikker (sesong)','Koordinater','Status','Start','Ferdig','Utført av','Notat']);

    const addrs = Array.isArray(cloud?.snapshot?.addresses) ? cloud.snapshot.addresses : [];
    const bagSnow = cloud.statusSnow || {};
    const bagGrit = cloud.statusGrit || {};

    addrs.forEach((a,i)=>{
      const coord=a.coords||'';
      // Snø (hvis ikke eksplisitt skrudd av)
      if(!(a.flags && a.flags.snow===false)){
        const s=bagSnow[a.name]||{};
        rows.push([
          String(i+1), a.name, 'Snø', (a.stakes!==''?a.stakes:''), coord,
          STATE_LABEL[s.state||'not_started'],
          fmtTime(s.startedAt), fmtTime(s.finishedAt), s.driver||'', (s.note||'').toString().replace(/\s+/g,' ').trim()
        ]);
      }
      // Grus (hvis på)
      if(a.flags && a.flags.grit){
        const s=bagGrit[a.name]||{};
        rows.push([
          String(i+1), a.name, 'Grus', (a.stakes!==''?a.stakes:''), coord,
          STATE_LABEL[s.state||'not_started'],
          fmtTime(s.startedAt), fmtTime(s.finishedAt), s.driver||'', (s.note||'').toString().replace(/\s+/g,' ').trim()
        ]);
      }
    });

    // CSV-escape
    const csv = rows.map(r=> r.map(x => `"${String(x??'').replace(/"/g,'""')}"`).join(',') ).join('\n');
    return csv;
  }

  function downloadBlob(dataStr, mime, filename){
    const blob = new Blob([dataStr], {type: mime});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
    return blob; // return blob for potential share
  }

  async function offerEmailShare(cloud, serviceRec){
    // Foreslå e-post
    const prev = localStorage.getItem('SERV_EMAIL') || 'oysgjer@gmail.com';
    const want = confirm('Vil du sende rapporten på e-post nå?');
    if(!want) return;

    let email = prompt('E-postadresse for rapport (kan endres senere):', prev || '');
    if(!email) return;
    localStorage.setItem('SERV_EMAIL', email.trim());

    // Bygg CSV
    const csv = buildCombinedCsv(cloud, serviceRec);
    const filename = `Broeyterapport_${new Date().toISOString().slice(0,10)}.csv`;
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const file = new File([blob], filename, {type:'text/csv'});

    // 1) Prøv å dele med vedlegg hvis mulig (best på mobil)
    try{
      if(navigator.canShare && navigator.canShare({ files:[file] })){
        await navigator.share({
          files:[file],
          title:'Brøyterapport',
          text:`Rapport generert ${todayNo()}.`
        });
        setMsg('✉️ Rapport ble delt via Del-ark.');
        return;
      }
    }catch(e){
      // fall back under
    }

    // 2) Ellers: last ned CSV lokalt + åpne mailto med ferdig utfylt tekst
    downloadBlob(csv, 'text/csv;charset=utf-8', filename);

    const subject = encodeURIComponent(`Brøyterapport ${new Date().toLocaleDateString('no-NO')}`);
    const bodyTxt = [
      `Hei,`,
      ``,
      `Vedlagt/lastet ned: ${filename}`,
      `Generert: ${todayNo()}`,
      ``,
      `Service-oppsummering:`,
      `- Skjær smurt: ${serviceRec.items.skjær_smurt?'Ja':'Nei'}`,
      `- Fres smurt: ${serviceRec.items.fres_smurt?'Ja':'Nei'}`,
      `- Forstilling smurt: ${serviceRec.items.forstilling_smurt?'Ja':'Nei'}`,
      `- Olje sjekket foran: ${serviceRec.items.olje_sjekket_foran?'Ja':'Nei'}`,
      `- Olje sjekket bak: ${serviceRec.items.olje_sjekket_bak?'Ja':'Nei'}`,
      `- Olje etterfylt: ${serviceRec.items.olje_etterfylt?'Ja':'Nei'}`,
      `- Diesel fylt: ${serviceRec.items.diesel_fylt?'Ja':'Nei'}`,
      `- Antall kasser grus: ${serviceRec.items.ant_kasser_grus||'-'}`,
      `- Annet: ${serviceRec.items.annet||'-'}`,
      ``,
      `PS: Noen e-post-apper tillater ikke automatisk vedlegg via mailto.`,
      `CSV-filen er derfor også lastet ned i nettleseren – legg den ved manuelt om nødvendig.`,
    ].join('\n');

    // Åpne mailklient
    const href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${encodeURIComponent(bodyTxt)}`;
    window.location.href = href;
    setMsg('✉️ Åpnet e-postutkast. CSV er lastet ned – legg ved om nødvendig.');
  }

  /* --------- Hoved-klikkløp --------- */
  async function onSubmit(){
    try{
      setMsg('Lagrer service…', true);
      const rec = buildServiceRecord();
      const cloud = await saveServiceToCloud(rec);

      setMsg('✅ Service registrert');
      // Tilby e-post-utsendelse
      await offerEmailShare(cloud, rec);
    }catch(err){
      console.error(err);
      setMsg('Feil ved lagring av service: '+(err.message||err), false);
      alert('Feil ved lagring: ' + (err.message||err));
    }
  }

  // Wire knappen
  btnSend && btnSend.addEventListener('click', (e)=>{
    e.preventDefault();
    onSubmit();
  });

})();