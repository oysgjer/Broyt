// docs/js/Status.js
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function idFor(a, idx) {
    return a.id ?? a.ID ?? a.Id ?? a.name ?? String(a.index ?? idx);
  }
  function t(s){ // norsk
    switch ((s||"").toLowerCase()) {
      case "venter": return "Venter";
      case "pågår": return "Pågår";
      case "ferdig": return "Ferdig";
      case "hoppet": 
      case "hoppet over": return "Hoppet over";
      case "ikke mulig":
      case "ikkemulig": return "Ikke mulig";
      default: return "—";
    }
  }

  function summarize(arr, map){
    const sum = { venter:0, pågår:0, ferdig:0, hoppet:0, ikke:0 };
    for (let i=0;i<arr.length;i++){
      const st = (map[idFor(arr[i], i)]?.state || "venter").toLowerCase();
      if (st === "pågår") sum.pågår++;
      else if (st === "ferdig") sum.ferdig++;
      else if (st === "hoppet" || st==="hoppet over") sum.hoppet++;
      else if (st === "ikke mulig" || st==="ikkemulig") sum.ikke++;
      else sum.venter++;
    }
    return sum;
  }

  function render() {
    const sec = $("#status"); if (!sec || sec.hasAttribute("hidden")) return;

    const arr = window.Sync?.getAddresses() || [];
    const map = window.Sync?.getStatusMap() || {};

    // toppkort (enkelt – du kan style i CSS)
    let box = $("#stat_top");
    if (!box) {
      box = document.createElement("div");
      box.id = "stat_top";
      box.className = "card";
      sec.insertBefore(box, sec.children[1] || null);
    }

    const s = summarize(arr, map);
    box.innerHTML = `
      <div class="row" style="gap:8px; flex-wrap:wrap">
        <span class="btn-ghost">Ikke påbegynt: ${s.venter}</span>
        <span class="btn-ghost">Pågår: ${s.pågår}</span>
        <span class="btn-ghost">Ferdig: ${s.ferdig}</span>
        <span class="btn-ghost">Hoppet over: ${s.hoppet}</span>
        <span class="btn-ghost">Ikke mulig: ${s.ikke}</span>
      </div>
    `;

    // tabell
    let tbl = $("#stat_tbl");
    if (!tbl) {
      tbl = document.createElement("table");
      tbl.id = "stat_tbl";
      tbl.className = "card";
      tbl.style.width = "100%";
      tbl.innerHTML = `
        <thead><tr><th style="text-align:left">#</th><th style="text-align:left">Adresse</th><th style="text-align:left">Status</th><th style="text-align:left">Sjåfør</th></tr></thead>
        <tbody></tbody>
      `;
      sec.appendChild(tbl);
    }
    const tbody = tbl.querySelector("tbody");
    tbody.innerHTML = arr.map((a,i) => {
      const id = idFor(a,i);
      const st = map[id] || {};
      const name = a.name || a.adresse || a.Address || `Adresse ${i+1}`;
      return `<tr>
        <td>${i+1}</td>
        <td>${name}</td>
        <td>${t(st.state)}</td>
        <td>${st.driver || ""}</td>
      </tr>`;
    }).join("");
  }

  function init(){
    render();
    window.addEventListener("hashchange", render);
    window.Sync?.on(render);
  }
  document.addEventListener("DOMContentLoaded", init);
})();