// docs/js/service_capture_email.js — gjør om #service til PDF og deler på e-post (Share API) eller laster ned + åpner mailto
(function(){
  // Dynamisk loader for html2canvas og jsPDF hvis de ikke finnes
  function loadScript(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = src; s.defer = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function ensureLibs(){
    if (!window.html2canvas){
      await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    }
    if (!window.jspdf || !window.jspdf.jsPDF){
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    }
  }

  const A4_W = 210, A4_H = 297; // mm
  function mmFromPx(px, dpi=96){ return (px / dpi) * 25.4; }

  async function sectionToCanvas(){
    const root = document.getElementById('service');
    if (!root) throw new Error('Fant ikke #service-seksjonen');
    const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    return canvas;
  }

  async function canvasToPdfBlob(canvas){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    const imgData = canvas.toDataURL('image/png');
    const pxW = canvas.width, pxH = canvas.height;
    const mmW = A4_W - 20; // 10 mm marg
    const mmH = mmFromPx(pxH * (mmW / mmFromPx(pxW))); // proporsjonalt høyde
    if (mmH <= (A4_H - 20)) {
      pdf.addImage(imgData, 'PNG', 10, 10, mmW, mmH);
    } else {
      // fallback: fyll hele siden (enkel skalering)
      pdf.addImage(imgData, 'PNG', 5, 5, A4_W - 10, A4_H - 10);
    }
    return pdf.output('blob');
  }

  function nowStamp(){
    const d = new Date();
    const pad = (n)=> (n<10?'0':'')+n;
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  async function sharePdf(blob, filename, subject, body){
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files:[file] })){
      await navigator.share({ files:[file], title: subject, text: body });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1500);

    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\nVedlegg: ' + filename)}`;
    window.location.href = mailto;
  }

  async function doCaptureAndSend(){
    await ensureLibs();
    const name = (document.getElementById('svc_driver_name')?.textContent ||
                  localStorage.getItem('DRIVER_NAME') || 'Ukjent').trim();
    const ts = nowStamp();
    const filename = `Service_${name || 'Ukjent'}_${ts}.pdf`;
    const subject = `Service – ${name || 'Ukjent'} – ${ts}`;
    const body = `Service-rapport for ${name || 'Ukjent'}.\n\nGenerert fra appen.`;

    const canvas = await sectionToCanvas();
    const blob = await canvasToPdfBlob(canvas);
    await sharePdf(blob, filename, subject, body);
  }

  function bindButtons(){
    const mailBtn = document.getElementById('svc_mail');
    if (mailBtn && !mailBtn.dataset._mailBound){
      mailBtn.dataset._mailBound = '1';
      mailBtn.addEventListener('click', (e)=>{ e.preventDefault(); doCaptureAndSend(); });
    }

    // Finn "Lagre service" dersom den finnes
    // 1) #svc_save
    let saveBtn = document.getElementById('svc_save');
    // 2) første knapp i #service som inneholder "Lagre service"
    if (!saveBtn){
      const candidates = Array.from(document.querySelectorAll('#service button, #service .btn'));
      saveBtn = candidates.find(b => (b.textContent||'').toLowerCase().includes('lagre service'));
    }
    if (saveBtn && !saveBtn.dataset._svcBound){
      saveBtn.dataset._svcBound = '1';
      saveBtn.addEventListener('click', ()=>{
        // vent litt slik at din egen lagring får gjøre seg ferdig
        setTimeout(doCaptureAndSend, 250);
      });
    }
  }

  function init(){
    bindButtons();
    // Mutasjonsobservatør i tilfelle Service bygges dynamisk
    const mo = new MutationObserver(bindButtons);
    mo.observe(document.body, {subtree:true, childList:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();