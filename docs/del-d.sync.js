/* === Del D: Synk, vær, logging, foto ============================== */

const H = window.BroyteHelpers;
if(!H){ console.error("Del C må lastes først"); }

/* ——— JSONBin I/O ——— */
async function binGet(bin){
  const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}/latest`,{headers:H.headers()});
  if(!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.record || j;
}
async function binPut(bin,data){
  const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}`,{
    method:"PUT",headers:H.headers(),body:JSON.stringify(data)
  });
  if(!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.record || j;
}

/* ——— Synk ——— */
async function syncNow(){
  try{
    $("syncBtn")?.setAttribute("disabled","true");
    $("syncStatus") && ($("syncStatus").textContent="Synkroniserer...");
    const out = H.state;
    const res = await binPut(window.BROYTE_CFG.BINS.MASTER, out);
    H.state.lastSyncAt = Date.now();
    H.state.lastSyncBy = H.displayName();
    H.save();
    $("syncStatus") && ($("syncStatus").textContent="Synk fullført ✔");
    console.log("Synk OK", res);
  }catch(e){
    console.error("Synk-feil", e);
    alert("Synk-feil: "+e.message);
  }finally{
    $("syncBtn")?.removeAttribute("disabled");
  }
}

/* ——— Værvarsel (Open-Meteo) ——— */
async function updateWeather(){
  const c = $("weatherNow"), t = $("weatherTimeline");
  if(!c||!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude,longitude}=pos.coords;
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,snowfall,precipitation&forecast_days=1&timezone=auto`;
    const res=await fetch(url); const j=await res.json();
    const h=new Date().getHours(); const T=j.hourly;
    const temp=T.temperature_2m[h];
    const snow=T.snowfall[h];
    c.textContent=`Nå: ${temp}°C ${snow>0?"❄ "+snow.toFixed(1)+" mm":"–"}`;
    t.innerHTML="";
    for(let i=1;i<=3;i++){
      const ti=(h+i)%24;
      const slot=document.createElement("div");
      slot.className="slot";
      slot.textContent=`${ti}:00  ${T.temperature_2m[ti]}°C  ${T.snowfall[ti]>0?"❄"+T.snowfall[ti].toFixed(1):""}`;
      t.appendChild(slot);
    }
  },()=>{ c.textContent="Ingen posisjon"; });
}

/* ——— Foto ——— */
async function takePhoto(){
  try{
    const input=document.createElement("input");
    input.type="file"; input.accept="image/*"; input.capture="environment";
    return new Promise((ok,fail)=>{
      input.onchange=()=>ok(input.files[0]);
      input.onerror=fail;
      input.click();
    });
  }catch(e){ console.error(e); return null; }
}

/* ——— Logger ——— */
function logAction(type,msg){
  const entry={
    t:Date.now(),
    who:H.displayName(),
    type, msg
  };
  H.state.dayLog.entries.push(entry);
  H.save();
  console.log("Log:", entry);
}

/* ——— Eksport HTML-rapport ——— */
async function exportReport(){
  const d=new Date();
  const html=["<html><head><meta charset='utf-8'><title>Rapport</title></head><body>"];
  html.push(`<h1>Brøyterapport ${d.toLocaleString("no-NO")}</h1>`);
  html.push(`<p>Utført av: ${H.displayName()}</p>`);
  html.push("<ul>");
  for(const s of H.state.stops){
    if(s.f){
      html.push(`<li><b>${H.esc(s.n)}</b> – ${H.esc(s.t)} (${s.pinsCount||0} stikker)</li>`);
    }
  }
  html.push("</ul>");
  html.push("<h3>Logg</h3><ul>");
  for(const e of H.state.dayLog.entries){
    html.push(`<li>${H.fmtDT(e.t)} – ${H.esc(e.msg)}</li>`);
  }
  html.push("</ul></body></html>");
  const blob=new Blob([html.join("")],{type:"text/html"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`broeyting_rapport_${H.dateKey(new Date())}.html`;
  a.click();
}

/* ——— Eksporter ——— */
window.BroyteSync = {
  binGet,binPut,syncNow,updateWeather,takePhoto,logAction,exportReport
};