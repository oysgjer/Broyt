// js/sync.js
(() => {
  'use strict';

  // ====== KONFIG ======
  const BIN_ID  = '68e7b4d2ae596e708f0bde7d';
  const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const API_KEY = '$2a$10$luKLel7elCpJM4.REcwKOOsWlBK5Xv5lY2oN1BDYgbZbXA6ubT0W.'; // <---- BYTT DENNE

  // Keys i localStorage
  const K_ADDR_CACHE   = 'BRYT_ADDR_CACHE';   // [{ id, name, ... }]
  const K_STATUS_CACHE = 'BRYT_STATUS_CACHE'; // { [id]: {state, driver, ts, task} }
  const K_LAST_OK      = 'BRYT_SYNC_LAST_OK'; // ISO string

  // Små util’er
  const $ = (s,r=document)=>r.querySelector(s);
  const readJSON =(k,d)=>{try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch{ return d }};
  const writeJSON=(k,v)=> localStorage.setItem(k, JSON.stringify(v));

  // ====== Badge-oppdatering ======
  function setBadge(ok) {
    const el = $('#sync_badge');
    if (!el) return;
    const dot = el.querySelector('.dot') || el;
    el.textContent = '';
    const spanDot = document.createElement('span');
    spanDot.className = 'dot ' + (ok ? 'dot-ok' : 'dot-unknown');
    const text = document.createTextNode(' Synk: ' + (ok ? 'OK' : 'ukjent'));
    el.appendChild(spanDot);
    el.appendChild(text);
  }

  // ====== HTTP wrapper mot JSONBin ======
  async function binGetLatest() {
    const res = await fetch(`${API_URL}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    if (!res.ok) throw new Error(`JSONBin GET feilet: ${res.status}`);
    const j = await res.json();
    return j.record; // forventer { addresses:[...], status:{...} }
  }

  async function binPut(record) {
    // putter hele dokumentet
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY
      },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error(`JSONBin PUT feilet: ${res.status}`);
    const j = await res.json();
    return j.record;
  }

  // ====== Offentlige funksjoner ======
  async function ping() {
    try {
      // Et lett kall: HEAD mot latest støttes ikke av JSONBin,
      // så vi bruker en kort GET og avbryter hvis det tar for lang tid.
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 4500);
      const res = await fetch(`${API_URL}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': API_KEY },
        signal: ctrl.signal
      });
      clearTimeout(t);
      const ok = res.ok;
      setBadge(ok);
      if (ok) writeJSON(K_LAST_OK, new Date().toISOString());
      return ok;
    } catch {
      setBadge(false);
      return false;
    }
  }

  // Laster adresser – cache i localStorage, men oppdaterer fra sky ved behov
  async function loadAddresses({ force=false } = {}) {
    let addrs = readJSON(K_ADDR_CACHE, []);
    if (!force && addrs.length) return addrs;

    const rec = await binGetLatest();
    if (!rec || !Array.isArray(rec.addresses)) {
      throw new Error('Ugyldig JSONBin-innhold: mangler addresses[].');
    }
    addrs = rec.addresses;
    writeJSON(K_ADDR_CACHE, addrs);

    // Oppfrisk badge
    setBadge(true);
    return addrs;
  }

  // Leser status-map (id -> statusobjekt)
  async function getStatus({ fresh=false } = {}) {
    let stat = readJSON(K_STATUS_CACHE, {});
    if (!fresh && Object.keys(stat).length) return stat;

    const rec = await binGetLatest();
    const cloud = (rec && rec.status && typeof rec.status === 'object') ? rec.status : {};
    writeJSON(K_STATUS_CACHE, cloud);
    setBadge(true);
    return cloud;
  }

  // Setter status for én adresse (og skyver til sky)
  // payload: { state: 'venter'|'pågår'|'ferdig'|'hoppet'|'ikke-mulig',
  //            driver: 'Navn', task: 'Fjerne snø'|'Strøing', ts?: ISO }
  async function setStatus(addrId, payload) {
    // oppdater lokalt først
    const now = new Date().toISOString();
    const cur = readJSON(K_STATUS_CACHE, {});
    cur[addrId] = { ...(cur[addrId]||{}), ...payload, ts: payload.ts || now };
    writeJSON(K_STATUS_CACHE, cur);

    // forsøk sky
    try {
      const rec = await binGetLatest();
      const merged = {
        addresses: Array.isArray(rec.addresses) ? rec.addresses : readJSON(K_ADDR_CACHE, []),
        status: { ...(rec.status||{}), [addrId]: cur[addrId] }
      };
      await binPut(merged);
      setBadge(true);
      return true;
    } catch (e) {
      // stå offline – vi har lokalt cache; Work/Status kan fortsatt fungere
      console.warn('Kunne ikke lagre til sky. Bruker lokal cache.', e);
      setBadge(false);
      return false;
    }
  }

  function clearLocal(kind='all') {
    if (kind === 'addresses' || kind === 'all') localStorage.removeItem(K_ADDR_CACHE);
    if (kind === 'status'    || kind === 'all') localStorage.removeItem(K_STATUS_CACHE);
  }

  // Eksponer API
  window.Sync = {
    ping,
    loadAddresses,
    getStatus,
    setStatus,
    clearLocal
  };

  // Ping med en gang for å male badge riktig
  ping();

})();