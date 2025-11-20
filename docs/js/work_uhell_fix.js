// js/work_uhell_fix.js – Uhell-knapp + logging til hendelser/logg
(() => {
  const incidentBtn   = document.getElementById('act_incident');
  const modal         = document.getElementById('incidentModal');
  const txt           = document.getElementById('incidentText');
  const ctx           = document.getElementById('incidentContext');
  const inputPhotos   = document.getElementById('incidentPhotos');
  const cancelBtn     = document.getElementById('incidentCancel');
  const sendBtn       = document.getElementById('incidentSend');

  // Hvis noe mangler, gjør ingenting (unngå feil)
  if (!incidentBtn || !modal || !txt || !ctx || !cancelBtn || !sendBtn) return;

  // Hendelser-bin (samme som logg bruker)
  const HENDELSER_BIN = '68e89e3443b1c97be9611c48'; // endre hvis du har annet id

  function getDriverName() {
    return (
      localStorage.getItem('driverNameCanonical') ||
      localStorage.getItem('driverName') ||
      (document.getElementById('a_driver')?.value || '').trim() ||
      'Ukjent sjåfør'
    );
  }

  function getCurrentAddress() {
    const workSection = document.getElementById('work');
    const fromDataset = workSection ? {
      id:   workSection.dataset.addrId,
      name: workSection.dataset.addrName
    } : {};

    const nowText = (document.getElementById('b_now')?.textContent || '').trim();

    const addrId = fromDataset.id  ||
                   localStorage.getItem('currentAddrId')  ||
                   nowText ||
                   'UKJENT_ADRESSE';

    const addrName = fromDataset.name ||
                     localStorage.getItem('currentAddrName') ||
                     nowText ||
                     'Ukjent adresse';

    return { addrId, addrName };
  }

  function openModal() {
    const { addrName } = getCurrentAddress();
    ctx.textContent = addrName
      ? `Adresse: ${addrName}`
      : 'Adresse/posisjon hentes automatisk…';

    txt.value = '';
    if (inputPhotos) inputPhotos.value = '';
    modal.style.display = 'flex'; // bruker flex for å sentrere
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  async function fetchLatestArray(binId, key) {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': key }
    });
    if (!res.ok) throw new Error('Feil ved henting av hendelser');
    const data = await res.json();
    const record = data.record;
    return Array.isArray(record) ? record : [];
  }

  async function saveArray(binId, key, arr) {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': key
      },
      body: JSON.stringify(arr)
    });
    if (!res.ok) throw new Error('Feil ved lagring av uhell');
  }

  async function sendIncident() {
    const note = txt.value.trim();
    if (!note) {
      alert('Skriv en kort beskrivelse av uhellet først.');
      return;
    }

    const xKey =
      localStorage.getItem('xMasterKey') ||
      localStorage.getItem('X-Master-Key');

    if (!xKey) {
      alert('Mangler X-Master-Key. Gå til Admin og legg inn nøkkelen først.');
      return;
    }

    const { addrId, addrName } = getCurrentAddress();

    const entry = {
      type: 'uhell',
      at: new Date().toISOString(),
      by: getDriverName(),
      addressId: addrId,
      addressName: addrName,
      note
    };

    sendBtn.disabled = true;
    const oldLabel = sendBtn.textContent;
    sendBtn.textContent = 'Sender…';

    try {
      const arr = await fetchLatestArray(HENDELSER_BIN, xKey);
      arr.push(entry);
      await saveArray(HENDELSER_BIN, xKey, arr);

      closeModal();

      const hadPhotos =
        inputPhotos && inputPhotos.files && inputPhotos.files.length > 0;

      let msg = 'Uhell er logget i rapporten.';
      msg += '\n\nDersom du har tatt bilder av uhellet, send dem på e-post til:\npost@romeriketrefelling.no\n\nHusk å skrive adresse og tidspunkt.';
      if (hadPhotos) {
        msg += '\n\n(Bildene lagres ikke i appen – de må legges ved i e-posten.)';
      }

      alert(msg);
    } catch (err) {
      console.error(err);
      alert('Klarte ikke å lagre uhell. Sjekk nettverk og prøv igjen.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = oldLabel;
    }
  }

  // Koble knapper
  incidentBtn.addEventListener('click', openModal);
  cancelBtn.addEventListener('click', closeModal);

  // Klikk utenfor dialogen lukker den
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Send uhell
  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendIncident();
  });
})();