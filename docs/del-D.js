// Del-D (Admin) – redigerbar liste over adresser med sky-lagring og backup
(function(){
  const $ = (s) => document.querySelector(s);

  const API = window.APP_CFG?.API_BASE;
  const BIN = window.APP_CFG?.BIN_ID;

  const els = {
    sync:   $('#d_sync'),
    add:    $('#d_add'),
    save:   $('#d_save'),
    export: $('#d_export'),
    hint:   $('#d_hint'),
    tbody:  $('#d_tbody')
  };

  const S = {
    season: window.BroytState?.getSeason?.() || '',
    round:  window.BroytState?.getRound?.() || null,
    rows:   [] // [{name, group, active, equipment[], stikkerCount, ...rest}]
  };

  // --- Nett
  async function getLatest() {
    const r = await fetch(`${API}b/${BIN}/latest`, { cache:'no-store' });
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }
  async function putPayload(payload) {
    const r = await fetch(`${API}b/${BIN}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    const data = await r.json();
    return data && data.record ? data.record : data;
  }

  // --- Map
  function mapAddr(a) {
    return {
      name: a.name || '',
      group: a.group || '',
      active: a.active !== false,
      equipment: Array.isArray(a.equipment) ? a.equipment.slice() : [],
      stikkerCount: Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0,

      // bevar alt annet (status, tider, stikkerSeason, notes, doneBy, ...)
      __rest: { ...a }
    };
  }

  function render() {
    els.tbody.innerHTML = S.rows.map((row, i) => {
      const fres = row.equipment.includes('fres');
      const stro = row.equipment.includes('stro');

      return `
        <tr>
          <td>${i+1}</td>
          <td><input type="checkbox" data-i="${i}" data-k="active" ${row.active ? 'checked':''}></td>
          <td><input type="text" data-i="${i}" data-k="name" value="${escapeHtml(row.name)}" placeholder="Adresse/navn"></td>
          <td><input type="text" data-i="${i}" data-k="group" value="${escapeHtml(row.group)}" placeholder="Gruppe"></td>
          <td class="need-group">
            <label class="badge-need"><input type="checkbox" data-i="${i}" data-k="need_fres" ${fres?'checked':''}> Fres</label>
            <label class="badge-need"><input type="checkbox" data-i="${i}" data-k="need_stro" ${stro?'checked':''}> Strø</label>
          </td>
          <td><input type="number" min="0" step="1" data-i="${i}" data-k="stikkerCount" value="${row.stikkerCount}"></td>
        </tr>
      `;
    }).join('');

    // bind inputs
    els.tbody.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => onCellChange(inp));
      if (inp.type === 'checkbox') inp.addEventListener('change', () => onCellChange(inp));
    });
  }

  function onCellChange(inp) {
    const i = Number(inp.dataset.i);
    const key = inp.dataset.k;
    const row = S.rows[i];
    if (!row) return;

    if (key === 'name' || key === 'group') {
      row[key] = inp.value;
    } else if (key === 'stikkerCount') {
      row.stikkerCount = Math.max(0, parseInt(inp.value || '0', 10));
      inp.value = String(row.stikkerCount);
    } else if (key === 'active') {
      row.active = !!inp.checked;
    } else if (key === 'need_fres') {
      row.equipment = row.equipment || [];
      if (inp.checked && !row.equipment.includes('fres')) row.equipment.push('fres');
      if (!inp.checked) row.equipment = row.equipment.filter(x => x !== 'fres');
    } else if (key === 'need_stro') {
      row.equipment = row.equipment || [];
      if (inp.checked && !row.equipment.includes('stro')) row.equipment.push('stro');
      if (!inp.checked) row.equipment = row.equipment.filter(x => x !== 'stro');
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  async function sync() {
    try {
      els.hint.textContent = 'Henter…';
      const cloud = await getLatest();
      const arr = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];
      S.rows = arr.map(mapAddr);
      render();
      els.hint.textContent = `Lastet ${S.rows.length} adresser.`;
    } catch (e) {
      console.error(e);
      els.hint.textContent = 'Feil: ' + e.message;
      alert('Henting feilet: ' + e.message);
    }
  }

  function addRow() {
    S.rows.push({
      name:'', group:'', active:true, equipment:[], stikkerCount:0, __rest:{}
    });
    render();
    els.hint.textContent = `Lagt til ny rad (#${S.rows.length}).`;
  }

  function exportJson() {
    const data = S.rows.map(stripForExport);
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `broyt-adresser-${new Date().toISOString().slice(0,10)}.json`;
    a.href = url; a.click();
    URL.revokeObjectURL(url);
  }

  function stripForExport(r) {
    return {
      name: r.name, group: r.group, active: r.active,
      equipment: r.equipment, stikkerCount: r.stikkerCount
    };
  }

  function mergeForSave(cloudAddr, editedRows) {
    // slå opp på navn. (NB: hvis du endrer navn dramatisk, regnes det som "ny")
    const byName = (arr) => Object.fromEntries(arr.map(a => [a.name || '', a]));
    const C = byName(cloudAddr);
    const result = [];

    editedRows.forEach(ed => {
      const prev = C[ed.name] || null;
      const base = prev || {};
      // bygg ny adresse: bevar runtime-felt fra sky, men med admin-endringer:
      const out = {
        ...base,
        name: ed.name,
        group: ed.group,
        active: ed.active,
        equipment: ed.equipment || [],
        stikkerCount: Number(ed.stikkerCount || 0)
      };
      // bevar stikkerSeason/status m.m. fra base:
      if (base.stikkerSeason) out.stikkerSeason = base.stikkerSeason;
      if (base.status) out.status = base.status;
      if (base.doneBy) out.doneBy = base.doneBy;
      if (base.startedAt) out.startedAt = base.startedAt;
      if (base.finishedAt) out.finishedAt = base.finishedAt;
      if (base.notes) out.notes = base.notes;

      result.push(out);
    });

    return result;
  }

  async function save() {
    // Valider: navn må finnes for alle aktive
    const invalid = S.rows.find(r => r.active && !r.name.trim());
    if (invalid) {
      alert('Alle AKTIVE rader må ha navn.');
      return;
    }

    try {
      els.hint.textContent = 'Lagrer…';

      // 1) hent siste fra sky
      const cloud = await getLatest();
      const cloudList = Array.isArray(cloud) ? cloud
        : Array.isArray(cloud.addresses) ? cloud.addresses
        : (cloud.snapshot && Array.isArray(cloud.snapshot.addresses)) ? cloud.snapshot.addresses
        : [];

      // 2) bygg ny adresser-array ved å merge admin-endringer inn
      const nextAddresses = mergeForSave(cloudList, S.rows);

      // 3) lag backup av slank versjon av forrige
      const prevBackup = (Array.isArray(cloudList) ? cloudList : []).map(a => ({
        name: a.name || '', group: a.group || '', active: a.active !== false,
        equipment: Array.isArray(a.equipment) ? a.equipment : [],
        stikkerCount: Number(a.stikkerCount ?? a.stikker_target ?? a.stikkerAntall ?? 0) || 0
      }));

      const backups = Array.isArray(cloud.backups) ? cloud.backups.slice() : [];
      backups.push({
        at: Date.now(),
        by: (S.round?.driver?.name || 'admin'),
        season: S.season,
        addresses: prevBackup
      });
      // hold maks 5
      while (backups.length > 5) backups.shift();

      // 4) skriv til sky
      const payload = {
        version: window.APP_CFG?.APP_VER || '9.x',
        updated: Date.now(),
        by: (S.round?.driver?.name || 'admin'),
        season: S.season,
        addresses: nextAddresses,
        backups,
        // bevar ev. serviceLogs osv:
        serviceLogs: Array.isArray(cloud.serviceLogs) ? cloud.serviceLogs : []
      };
      await putPayload(payload);

      els.hint.textContent = `Publisert ${nextAddresses.length} adresser. Backup lagret (${backups.length}).`;
      alert('Endringer publisert.');
      // refetch for å vise "sanntid"
      sync();
    } catch (e) {
      console.error(e);
      els.hint.textContent = 'Feil: ' + e.message;
      alert('Lagring feilet: ' + e.message);
    }
  }

  // events
  els.sync.addEventListener('click', sync);
  els.add.addEventListener('click', addRow);
  els.export.addEventListener('click', exportJson);
  els.save.addEventListener('click', save);

  // boot
  sync();
})();