
// js/logging.js
(() => {
  'use strict';

  const REPORTS_BIN_ID = '68e89e3443b1c97be9611c48';
  const API_BASE = `https://api.jsonbin.io/v3/b/${REPORTS_BIN_ID}`;
  const K_QUEUE = 'BRYT_REPORTS_QUEUE';
  const K_KEY   = 'BRYT_REPORTS_MASTER_KEY';

  const RJ = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };
  const WJ = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  function tzOffsetStr(d=new Date()){
    const off = -d.getTimezoneOffset(); // in minutes, east positive
    const sgn = off>=0 ? '+' : '-';
    const abso = Math.abs(off);
    const hh = String(Math.floor(abso/60)).padStart(2,'0');
    const mm = String(abso%60).padStart(2,'0');
    return `${sgn}${hh}:${mm}`;
  }

  function getKey(){ return localStorage.getItem(K_KEY) || ''; }
  function setKey(v){ localStorage.setItem(K_KEY, v||''); }

  function enqueue(evt){
    const q = RJ(K_QUEUE, []);
    q.push(evt);
    WJ(K_QUEUE, q);
  }

  async function fetchLatest(){
    const res = await fetch(`${API_BASE}/latest`, {
      headers: {
        'X-Master-Key': getKey(),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`GET latest failed ${res.status}`);
    const j = await res.json();
    // v3 returns {record: <data>, metadata: {...}}
    return j.record || [];
  }

  async function putAll(arr){
    const res = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        'X-Master-Key': getKey(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(arr)
    });
    if (!res.ok) throw new Error(`PUT failed ${res.status}`);
    return res.json();
  }

  async function sync(){
    const key = getKey();
    const q = RJ(K_QUEUE, []);
    if (!key || !q.length) return {sent:0, pending:q.length};
    try{
      const latest = await fetchLatest();
      const next = latest.concat(q);
      await putAll(next);
      WJ(K_QUEUE, []);
      return {sent:q.length, pending:0};
    }catch(e){
      console.warn('Reports sync failed:', e);
      return {sent:0, pending:q.length, error:String(e)};
    }
  }

  function uuid(){
    return crypto?.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
        const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8); return v.toString(16);
      });
  }

  async function logEvent(evt, opts={}){
    const base = {
      id: uuid(),
      t: new Date().toISOString(),
      tz: tzOffsetStr(),
      device_id: navigator.userAgent.slice(0,120)
    };
    const rec = {...base, ...evt};
    enqueue(rec);
    if (!opts.dry) {
      // fire-and-forget
      sync();
    }
    return rec;
  }

  async function testReady(){
    return { hasKey: !!getKey(), pending: (RJ(K_QUEUE,[])||[]).length };
  }

  window.Reports = {
    logEvent, sync, setKey, getKey, testReady
  };
})();
