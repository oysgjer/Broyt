// Work.js (delta) – adds actUhell() that uses settings().incidentEmail for mailto
(function(){
  // helper accessors (reuse existing if present)
  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  function settings(){ return RJ('BRYT_SETTINGS', { incidentEmail:'' }); }

  // Attach once DOM is ready, if button exists
  function wireIncident(){
    const btn = document.getElementById('act_incident');
    if (!btn) return;
    btn.addEventListener('click', async ()=>{
      // Ask for (optional) image – limited to capture via file input for web
      const file = await pickImage();
      const note = prompt('Skriv merknad for uhell (valgfritt):','') || '';
      const to = (settings().incidentEmail || '').trim() || 'drift@example.com';
      const when = new Date().toLocaleString('nb-NO');
      const body = [
        'Uhell rapportert fra Brøyt-appen.',
        '',
        `Tidspunkt: ${when}`,
        note ? `Merknad: ${note}` : null,
        '',
        'Bilder må ettersendes fra kamerarullen.'
      ].filter(Boolean).join('\n');

      const subject = encodeURIComponent('Uhell rapportert');
      const bodyEnc = encodeURIComponent(body);
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${bodyEnc}`;
      // Open email client
      location.href = mailto;

      // Simple toast/alert
      setTimeout(()=>{
        alert('Uhell registrert og sendt som e‑postkladd. Husk å ettersende bilder fra telefonen.');
      }, 300);
    });
  }

  function pickImage(){
    return new Promise(resolve=>{
      const input = document.createElement('input');
      input.type='file';
      input.accept='image/*';
      input.capture='environment';
      input.onchange = ()=> resolve(input.files && input.files[0] ? input.files[0] : null);
      input.click();
    });
  }

  document.addEventListener('DOMContentLoaded', wireIncident);
})();