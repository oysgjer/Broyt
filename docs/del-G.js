/* ===== del-G.js (ADMIN) ===== */
(()=>{
  const { $, getCatalog, setCatalog, download } = window.Core;

  function render(){
    const cat = getCatalog();
    const box = $("#adList"); box.innerHTML="";
    (cat.addresses||[]).forEach((a,idx)=>{
      const row=document.createElement("div");
      row.className="card";
      row.innerHTML = `
        <div class="list">
          <input class="nm" type="text" value="${a.name}">
          <div class="row">
            <select class="task">
              <option ${sel(a.task,"Snø + brøytestikker")}>Snø + brøytestikker</option>
              <option ${sel(a.task,"Snø og grus + brøytestikker")}>Snø og grus + brøytestikker</option>
            </select>
            <label class="chk"><input class="two" type="checkbox" ${a.twoDriverRec?'checked':''}>2 sjåfører</label>
            <label class="chk"><input class="active" type="checkbox" ${a.active!==false?'checked':''}>Aktiv</label>
            <label class="chk"><input class="lock" type="checkbox" ${a.pinsLocked?'checked':''}>Lås pinner</label>
            <div class="row"><span class="muted">Pinner:</span><input class="pins" type="number" min="0" style="width:90px" value="${a.pinsCount||0}"></div>
            <button class="btn red rm">Slett</button>
          </div>
        </div>`;
      row.querySelector(".rm").onclick=()=>{
        if(!confirm("Slette adressen fra katalogen?")) return;
        cat.addresses.splice(idx,1); setCatalog(cat); render();
      };
      // endringer live:
      row.querySelector(".nm").oninput = e => { a.name=e.target.value; setCatalog(cat); };
      row.querySelector(".task").onchange = e => { a.task=e.target.value; setCatalog(cat); };
      row.querySelector(".two").onchange = e => { a.twoDriverRec=e.target.checked; setCatalog(cat); };
      row.querySelector(".active").onchange = e => { a.active=e.target.checked; setCatalog(cat); };
      row.querySelector(".lock").onchange = e => { a.pinsLocked=e.target.checked; setCatalog(cat); };
      row.querySelector(".pins").onchange = e => { a.pinsCount=Number(e.target.value)||0; setCatalog(cat); };
      box.append(row);
    });
  }
  const sel=(v,t)=> v===t?'selected':'';

  function saveCatalog(){
    // allerede lagret fortløpende – men vi kjører en “touch”
    const cat = getCatalog();
    setCatalog(cat);
    alert("Katalog lagret lokalt ✅");
  }
  function exportCatalog(){
    const cat = getCatalog();
    download(`katalog_${Date.now()}.json`, JSON.stringify(cat,null,2));
  }
  function importCatalog(file){
    const r=new FileReader();
    r.onload=()=>{
      try{
        const obj=JSON.parse(r.result); if(!Array.isArray(obj.addresses)) throw 0;
        setCatalog(obj); render(); alert(`Importert ${obj.addresses.length} adresser`);
      }catch{ alert("Ugyldig JSON");}
    };
    r.readAsText(file);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    $("#adSave").onclick = saveCatalog;
    $("#adExport").onclick = exportCatalog;
    $("#adImport").onclick = ()=> $("#adImportFile").click();
    $("#adImportFile").addEventListener("change", e=>{
      const f=e.target.files?.[0]; if(f) importCatalog(f); e.target.value="";
    });
    render();
  });

})();