// docs/js/Service.js
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);

  // --- helpers
  function settings(){
    try{ return JSON.parse(localStorage.getItem('BRYT_SETTINGS')) || {}; }catch{ return {}; }
  }
  function lastRunCtx(){
    try{ return JSON.parse(localStorage.getItem('BRYT_LAST_RUN_CTX')) || {}; }catch{ return {}; }
  }
  function addresses(){
    const raw = (window.Sync?.getCache?.().addresses || []);
    return Array.isArray(raw) ? raw : Object.values(raw);
  }
  function getStatus(){ return (window.Sync?.getCache?.().status || {}); }

  function labelForRound(dIso){
    const d = new Date(dIso || Date.now());
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const key = `BRYT_SEQ_${d.getFullYear()}-${mm}-${dd}`;
    const next = (parseInt(localStorage.getItem(key)||'0',10) || 0) + 1;
    localStorage.setItem(key, String(next));
    return {label: `${mm}.${dd} (runde ${next})`, seqKey:key, seq:next};
  }

  function pickRoundsInWindow(addrId, lane, driver, tStart, tEnd){
    const s = getStatus()[addrId]?.[lane];
    if (!s || !Array.isArray(s.rounds)) return null;
    const sTs = Date.parse(tStart), eTs = Date.parse(tEnd);
    const inWin = s.rounds.filter(r => {
      const when = r.done || r.start;
      if (!when) return false;
      const ts = Date.parse(when);
      return (r.by || '') === driver && ts >= sTs && ts <= eTs;
    });
    if (!inWin.length) return null;
    const r = inWin[inWin.length-1];
    return {
      action: r.done ? 'finish' : 'unknown',
      started_at: r.start || null,
      finished_at: r.done || null
    };
  }

  function computeReport(){
    const ctx = lastRunCtx();
    const driver = ctx.driver || settings().driver || 'Ukjent';
    const lane   = ctx.lane || 'snow';
    const tStart = ctx.start_at || sessionStorage.getItem('RUN_START') || new Date().toISOString();
    const tEnd   = ctx.end_at   || sessionStorage.getItem('RUN_END')   || new Date().toISOString();

    const nameInfo = labelForRound(tStart);
    const rows = [];
    let done = 0, skipped = 0, blocked = 0, timeDone = 0;

    for (const a of addresses()){
      if (!(a?.tasks?.[lane])) continue;
      const picked = pickRoundsInWindow(a.id, lane, driver, tStart, tEnd);
      if (!picked) continue;

      let action = picked.action;
      const laneObj = getStatus()[a.id]?.[lane];
      if (laneObj?.state === 'hoppet') action = 'skip';
      if (laneObj?.state === 'blokkert') action = 'block';

      const dur = (picked.started_at && picked.finished_at)
        ? (Date.parse(picked.finished_at) - Date.parse(picked.started_at))
        : 0;

      rows.push({
        id: a.id, name: a.name || '',
        action, started_at: picked.started_at || null,
        finished_at: picked.finished_at || null,
        duration_ms: dur,
        note: (a.note || '')
      });

      if (action === 'finish') { done++; timeDone += dur; }
      else if (action === 'skip') skipped++;
      else if (action === 'block') blocked++;
    }

    const rep = {
      version: 'v1',
      round: {
        label: nameInfo.label,
        driver, lane,
        start_at: tStart, end_at: tEnd,
        duration_ms: (Date.parse(tEnd) - Date.parse(tStart))
      },
      summary: {
        addresses_total: addresses().filter(a => a?.tasks?.[lane]).length,
        addresses_done: done,
        addresses_skipped: skipped,
        addresses_blocked: blocked,
        time_done_ms: timeDone,
        avg_per_address_ms: rows.length ? Math.round(timeDone / Math.max(done,1)) : 0
      },
      addresses: rows,
      attachments: {
        images_count: 0,
        images_note: 'Bilder lagres på telefonen og ettersendes pr. e-post.'
      }
    };

    return rep;
  }

  // --- downloads (kun ved knappetrykk)
  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  async function saveJSON(rep){
    const safe = rep.round.label.replace(/\s+/g,'_').replace(/[()]/g,'');
    const blob = new Blob([JSON.stringify(rep, null, 2)], {type: 'application/json'});
    downloadBlob(blob, `rapport_${safe}.json`);
  }

  async function savePDF(rep){
    // krever jsPDF + html2canvas lagt inn via CDN i index.html (ingen auto)
    const JSPDF = window.jspdf?.jsPDF;
    if (!JSPDF || !window.html2canvas){
      alert('PDF-bibliotek mangler. Legg til jsPDF og html2canvas i index.html først.');
      return;
    }

    const safe = rep.round.label.replace(/\s+/g,'_').replace(/[()]/g,'');
    const wrap = document.createElement('div');
    wrap.id = 'pdf_wrap_tmp';
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;color:#111;padding:24px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto;';
    wrap.innerHTML = `
      <h1 style="margin:0 0 8px 0;">Service-rapport</h1>
      <div style="font-size:14px;margin-bottom:12px;">${rep.round.label} – Sjåfør: <b>${rep.round.driver}</b> – Spor: <b>${rep.round.lane==='grit'?'Grus':'Snø'}</b></div>
      <div style="font-size:13px;margin-bottom:16px;">
        Start: ${new Date(rep.round.start_at).toLocaleString()}<br>
        Slutt: ${new Date(rep.round.end_at).toLocaleString()}<br>
        Varighet: ~${Math.round(rep.round.duration_ms/60000)} min
      </div>
      <h3 style="margin:8px 0;">Oppsummering</h3>
      <ul style="font-size:13px;line-height:1.6;">
        <li>Adresser totalt: ${rep.summary.addresses_total}</li>
        <li>Fullført: ${rep.summary.addresses_done}, Hoppet: ${rep.summary.addresses_skipped}, Blokkert: ${rep.summary.addresses_blocked}</li>
        <li>Arbeidstid (fullførte): ~${Math.round(rep.summary.time_done_ms/60000)} min
            (≈ ${rep.summary.avg_per_address_ms} ms pr adr)</li>
      </ul>
      <h3 style="margin:12px 0 6px;">Detaljer</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-size:12px;width:100%;">
        <thead>
          <tr style="background:#f3f4f6"><th style="text-align:left;">Adresse</th><th>Handling</th><th>Start</th><th>Slutt</th><th>Varighet</th></tr>
        </thead>
        <tbody>
          ${rep.addresses.map(a=>`
            <tr>
              <td>${a.name}</td>
              <td>${a.action}</td>
              <td>${a.started_at?new Date(a.started_at).toLocaleTimeString():'–'}</td>
              <td>${a.finished_at?new Date(a.finished_at).toLocaleTimeString():'–'}</td>
              <td>${a.duration_ms?Math.round(a.duration_ms/1000)+'s':'–'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="font-size:12px;color:#444;margin-top:10px;">
        Bilder: ${rep.attachments.images_count} (lagres på telefonen og ettersendes)
      </div>
    `;
    document.body.appendChild(wrap);

    const doc = new JSPDF({unit:'pt', format:'a4'});
    await doc.html(wrap, { callback: (d)=>{
      d.save(`rapport_${safe}.pdf`);
      document.body.removeChild(wrap);
    }, x: 24, y: 24, html2canvas: { scale: 0.8 }});
  }

  async function pushToJSONBin(rep){
    const statusEl = $('#svc_status');
    try{
      const binId = '68e89e3443b1c97be9611c48'; // Report-bin (privat)
      const apiKey = (window.Sync?.getConfig?.() || {}).apiKey || localStorage.getItem('BRYT_REPORTS_MASTER_KEY') || '';
      if (!apiKey) throw new Error('Mangler Master Key (Admin).');

      const latest = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: {'X-Master-Key': apiKey, 'cache':'no-store'}
      }).then(r=>r.json());
      let arr = Array.isArray(latest?.record) ? latest.record : [];
      arr.push({type:'service_report', t:new Date().toISOString(), data:rep});
      const put = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: {'X-Master-Key': apiKey, 'Content-Type': 'application/json'},
        body: JSON.stringify(arr)
      });
      if (!put.ok) throw new Error(`JSONBin PUT ${put.status}`);
      if (statusEl) statusEl.textContent = `Lagret til JSONBin: ${rep.round.label}`;
    }catch(e){
      console.warn('JSONBin lagring feilet:', e);
      if (statusEl) statusEl.textContent = `Feil ved lagring til JSONBin: ${String(e.message||e)}`;
    }
  }

  // --- UI wiring
  function ensureToolsUI(){
    // Ikke rør din eksisterende Service-HTML; vi bare legger til en liten verktøylinje under #svc_card
    const card = $('#svc_card');
    if (!card) return;

    if (!$('#svc_tools')){
      const box = document.createElement('div');
      box.id = 'svc_tools';
      box.style.marginTop = '12px';
      box.innerHTML = `
        <div class="btn-grid" style="margin-top:10px;">
          <button id="svc_save_bin" class="btn">Lagre rapport til JSONBin</button>
          <button id="svc_pdf" class="btn">Last ned PDF</button>
          <button id="svc_json" class="btn">Last ned JSON</button>
        </div>
      `;
      card.appendChild(box);
    }
  }

  function wire(){
    ensureToolsUI();

    // Bruk din eksisterende knapp "Generer rapport nå" til å LAGRE TIL JSONBIN (kun ved trykk)
    const gen = $('#svc_generate');
    if (gen && !gen.dataset.wired){
      gen.dataset.wired = '1';
      gen.addEventListener('click', async ()=>{
        const rep = computeReport();
        window.__BRYT_LAST_REPORT__ = rep; // gjør klar for nedlasting-knappene
        await pushToJSONBin(rep);
      });
    }

    // Ekstra knapper (frivillig å bruke)
    const k1 = $('#svc_save_bin'), k2 = $('#svc_pdf'), k3 = $('#svc_json');
    if (k1 && !k1.dataset.wired){
      k1.dataset.wired = '1';
      k1.addEventListener('click', async ()=>{
        const rep = window.__BRYT_LAST_REPORT__ || computeReport();
        await pushToJSONBin(rep);
      });
    }
    if (k2 && !k2.dataset.wired){
      k2.dataset.wired = '1';
      k2.addEventListener('click', async ()=>{
        const rep = window.__BRYT_LAST_REPORT__ || computeReport();
        await savePDF(rep);
      });
    }
    if (k3 && !k3.dataset.wired){
      k3.dataset.wired = '1';
      k3.addEventListener('click', async ()=>{
        const rep = window.__BRYT_LAST_REPORT__ || computeReport();
        await saveJSON(rep);
      });
    }

    // Vi gjør INGENTING automatisk når man åpner Service.
  }

  document.addEventListener('DOMContentLoaded', wire);
})();