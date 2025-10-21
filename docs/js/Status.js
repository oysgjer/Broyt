// ===== STATUS – summerer og viser tabell =====
(() => {
  const sumBox = $('#status_summary');
  const tbody  = $('#status_tbody');

  function summarize() {
    const bag   = statusStore();
    const list  = window.S.addresses || [];
    const c = { none:0, start:0, done:0, skip:0, blocked:0 };

    for (const a of list) {
      const st = bag[a.id]?.state || 'none';
      if (c[st] != null) c[st]++; else c.none++;
    }
    return c;
  }

  function render() {
    const list = window.S.addresses || [];
    const bag  = statusStore();

    const c = summarize();
    if (sumBox) {
      sumBox.textContent = `Ikke påbegynt: ${c.none}  •  Pågår: ${c.start}  •  Ferdig: ${c.done}  •  Hoppet: ${c.skip}  •  Ikke mulig: ${c.blocked}`;
    }

    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach((a, i) => {
      const st = bag[a.id]?.state || '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${a.name}</td>
        <td>${a.task||'—'}</td>
        <td>${st}</td>
        <td><button class="btn-ghost btn-sm" data-goto="${a.id}">Gå til</button></td>
      `;
      tbody.appendChild(tr);
    });

    // “Gå til” – åpne Under arbeid på valgt adresse
    $$('#status_tbody [data-goto]').forEach(b=>{
      b.addEventListener('click', (e)=>{
        const id = e.currentTarget.getAttribute('data-goto');
        if (!id) return;
        sessionStorage.setItem('BRYT_CURR_ID', id);
        showPage('work');
      });
    });
  }

  document.addEventListener('round-started', render);
  document.addEventListener('page:shown', (e) => { if (e.detail.id === 'status') render(); });

  if ((location.hash||'#').includes('status')) render();
})();