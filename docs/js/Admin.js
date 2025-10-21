// js/Admin.js
(() => {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const readJSON  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

  const K_ADMIN   = 'BRYT_ADMIN';          // { season, addresses[] } (se schema)
  const K_ADDRSRC = 'BRYT_ADDR_CACHE';     // valgfri cache fra Sync, hvis finnes

  function loadAdmin() {
    let data = readJSON(K_ADMIN, null);
    if (!data) {
      // Førstegangs-seed: bruk ev. Sync-cache om den finnes, ellers tom liste
      let seedAddrs = [];
      // prøv å hente addresser fra Sync sin cache
      if (window.Sync && Array.isArray(window.Sync.__addrCache)) {
        seedAddrs = window.Sync.__addrCache.map((a, i) => ({
          id: a.id || ('addr_'+i),
          name: a.name || a.adresse || ('Adresse '+(i+1)),
          lat: a.lat ?? null,
          lon: a.lon ?? null,
          tasks: { snow: true, gravel: false },
          pins: {}
        }));
      }
      data = { season: deriveSeason(), addresses: seedAddrs };
      writeJSON(K_ADMIN, data);
    }
    return data;
  }

  function saveAdmin(data) { writeJSON(K_ADMIN, data); }

  function deriveSeason(d=new Date()) {
    // Enkel sesongstreng: "YYYY-YY" (høst->vår)
    const y = d.getFullYear();
    const month = d.getMonth()+1;
    if (month >= 7) return `${y}-${String((y+1)%100).padStart(2,'0')}`;
    return `${y-1}-${String(y%100).padStart(2,'0')}`;
  }

  function render() {
    if (location.hash !== '#admin') return;
    const root = $('#admin');
    if (!root) return;

    const data = loadAdmin();

    root.innerHTML = `
      <h1>Admin</h1>

      <div class="card" style="margin-bottom:14px">
        <div class="row" style="justify-content:space-between; align-items:center">
          <div><strong>Aktiv sesong:</strong> <span id="adm_season_lbl">${data.season}</span></div>
          <div class="row" style="gap:8px">
            <button class="btn-ghost" id="btn_copy_prev">Kopier pinner fra forrige sesong</button>
            <button class="btn" id="btn_new_season">Start ny sesong</button>
          </div>
        </div>
      </div>

      <div class="field">
        <span>Søk</span>
        <input id="adm_search" class="input" placeholder="Filtrer adresser..." />
      </div>

      <div class="card" style="overflow:auto">
        <table style="width:100%; border-collapse:separate; border-spacing:0 8px">
          <thead style="position:sticky; top:0; background:var(--surface)">
            <tr>
              <th style="text-align:left; padding:8px">Adresse</th>
              <th>Snø</th>
              <th>Grus</th>
              <th style="width:160px">Brøytepinner<br><small>${data.season}</small></th>
              <th style="width:1%"></th>
            </tr>
          </thead>
          <tbody id="adm_tbody"></tbody>
        </table>
      </div>

      <div class="row" style="margin-top:12px; gap:8px">
        <button class="btn" id="btn_add">Legg til adresse</button>
        <button class="btn-ghost" id="btn_save">Lagre</button>
      </div>
    `;

    const tbody = $('#adm_tbody');

    function drawRows(filter='') {
      tbody.innerHTML = '';
      const term = filter.trim().toLowerCase();
      data.addresses
        .filter(a => !term || (a.name||'').toLowerCase().includes(term))
        .forEach((a, idx) => {
          const pins = a.pins?.[data.season] ?? '';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="padding:6px 8px">
              <input data-k="name" class="input" value="${a.name||''}" />
              <div class="row" style="gap:8px; margin-top:6px">
                <input data-k="lat" class="input" placeholder="lat" style="max-width:140px" value="${a.lat??''}">
                <input data-k="lon" class="input" placeholder="lon" style="max-width:140px" value="${a.lon??''}">
              </div>
            </td>
            <td style="text-align:center"><input type="checkbox" data-k="snow" ${a.tasks?.snow?'checked':''}></td>
            <td style="text-align:center"><input type="checkbox" data-k="gravel" ${a.tasks?.gravel?'checked':''}></td>
            <td style="text-align:center">
              <input data-k="pins" class="input" inputmode="numeric" style="max-width:120px; text-align:center" value="${pins}">
            </td>
            <td style="text-align:right; padding-right:8px">
              <button class="btn-ghost" data-act="del">Slett</button>
            </td>
          `;
          // Endrings-lyttere
          tr.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
              const k = inp.dataset.k;
              if (k === 'name') a.name = inp.value;
              if (k === 'lat')  a.lat  = inp.value ? Number(inp.value) : null;
              if (k === 'lon')  a.lon  = inp.value ? Number(inp.value) : null;
              if (k === 'snow') a.tasks = { ...(a.tasks||{}), snow: inp.checked };
              if (k === 'gravel') a.tasks = { ...(a.tasks||{}), gravel: inp.checked };
              if (k === 'pins') {
                a.pins = a.pins || {};
                a.pins[data.season] = inp.value ? Number(inp.value) : 0;
              }
            });
          });
          tr.querySelector('[data-act="del"]').addEventListener('click', () => {
            if (confirm(`Slette “${a.name}”?`)) {
              data.addresses.splice(idx, 1);
              drawRows($('#adm_search').value||'');
            }
          });
          tbody.appendChild(tr);
        });
    }

    // init render
    drawRows();

    // søk
    $('#adm_search').addEventListener('input', (e) => drawRows(e.target.value));

    // legg til
    $('#btn_add').addEventListener('click', () => {
      data.addresses.push({
        id: 'addr_' + Math.random().toString(36).slice(2,8),
        name: '',
        lat: null, lon: null,
        tasks: { snow:true, gravel:false },
        pins: {}
      });
      drawRows($('#adm_search').value||'');
    });

    // lagre lokalt (+ hook for skylagring senere)
    $('#btn_save').addEventListener('click', async () => {
      saveAdmin(data);
      try {
        // Hvis Sync senere får metode for å lagre config, kan vi kalle den her:
        if (window.Sync && typeof window.Sync.saveAdminConfig === 'function') {
          await window.Sync.saveAdminConfig(data);
        }
        alert('Lagret.');
      } catch (e) {
        console.warn('Sky-lagring feilet:', e);
        alert('Lagret lokalt (sky-lagring ikke aktiv).');
      }
    });

    // ny sesong
    $('#btn_new_season').addEventListener('click', () => {
      const next = prompt('Ny sesong (f.eks "2025-26"):', deriveSeason());
      if (!next) return;
      data.season = next;
      $('#adm_season_lbl').textContent = data.season;
      saveAdmin(data);
      drawRows($('#adm_search').value||'');
    });

    // kopier pinner fra forrige sesong
    $('#btn_copy_prev').addEventListener('click', () => {
      const s = data.season;
      const [y1, y2] = s.split('-').map(Number);
      const prev = `${(y1-1)}-${String(y1%100).padStart(2,'0')}`;
      let changed = 0;
      data.addresses.forEach(a => {
        if (!a.pins) a.pins = {};
        if (a.pins[prev] != null && a.pins[s] == null) {
          a.pins[s] = a.pins[prev];
          changed++;
        }
      });
      saveAdmin(data);
      drawRows($('#adm_search').value||'');
      alert(changed ? `Kopierte pinner for ${changed} adresser.` : 'Ingenting å kopiere.');
    });
  }

  // re-render ved navigasjon
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();