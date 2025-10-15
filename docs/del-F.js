/* ===== del-F.js (ADRESSE-REGISTER) ===== */
(()=>{
  const { $, getCatalog, setCatalog, state, save } = window.Core;

  function importFromCatalog(){
    const cat = getCatalog();
    state.stops = (cat.addresses||[])
      .filter(a=>a.active!==false)
      .map(a=>({
        n:a.name, t:a.task, two:a.twoDriverRec||false, pins:a.pinsCount||0, lock:a.pinsLocked||false,
        startAt:null,endAt:null,status:"ny"
      }));
    save();
    render();
    alert(`Importerte fra KATALOG: ${state.stops.length}`);
  }

  function addLocal(){
    const name = $("#arNewName").value.trim();
    const task = $("#arNewTask").value;
    const two  = $("#arNewTwo").checked;
    if(!name) return alert("Skriv inn et navn/adresse");
    // legg både i katalog og i runde
    const cat = getCatalog();
    cat.addresses.push({name, task, twoDriverRec:two, pinsCount:0, pinsLocked:false, active:true});
    setCatalog(cat);
    state.stops.push({ n:name, t:task, two, pins:0, lock:false, startAt:null,endAt:null,status:"ny" });
    save();
    $("#arNewName").value="";
    render();
  }

  function resetLocalStatus(){
    (state.stops||[]).forEach(s=>{s.startAt=s.endAt=null; s.status="ny";});
    save(); render();
  }

  function render(){
    $("#arCount").textContent = (state.stops||[]).length;
    const list=$("#arList"); list.innerHTML="";
    (state.stops||[]).forEach((s,i)=>{
      const d=document.createElement("div");
      d.className="card";
      d.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div><div style="font-weight:600">${s.n}</div><div class="muted" style="font-size:12px">${s.t||""}</div></div>
        <button class="btn red">Slett</button>
      </div>`;
      d.querySelector("button").onclick=()=>{
        if(!confirm("Slette adressen fra runden?")) return;
        state.stops.splice(i,1); save(); render();
      };
      list.append(d);
    });
  }

  function exportCatalog(){
    const cat = getCatalog();
    window.Core.download(`katalog_${Date.now()}.json`, JSON.stringify(cat,null,2));
  }
  function importCatalogFile(file){
    const r = new FileReader();
    r.onload = ()=>{
      try{
        const obj = JSON.parse(r.result);
        if(!Array.isArray(obj.addresses)) throw 0;
        setCatalog(obj);
        alert(`Katalog importert: ${obj.addresses.length} adresser`);
      }catch{ alert("Ugyldig JSON"); }
    };
    r.readAsText(file);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    $("#arImport").onclick = importFromCatalog;
    $("#arAdd").onclick = addLocal;
    $("#arResetLocal").onclick = resetLocalStatus;
    $("#arExport").onclick = exportCatalog;
    $("#arImportBtn").onclick = ()=>$("#arImportFile").click();
    $("#arImportFile").addEventListener("change", e=>{
      const f=e.target.files?.[0]; if(f) importCatalogFile(f);
      e.target.value="";
    });
    render();
  });
})();