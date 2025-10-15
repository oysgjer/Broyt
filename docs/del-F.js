(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del F."); return; }
  const C = Core;

  const Service = (window.Service = {
    init() { document.addEventListener("DOMContentLoaded", Service.render); },

    render() {
      const host = document.getElementById("service");
      if (!host) return;

      host.innerHTML = `
        <h2>Service</h2>
        <p>Huk av det som ble gjort etter runden.</p>

        <ul id="srvList" style="list-style:none;padding:0;margin:0 0 1rem 0;"></ul>
        <textarea id="srvNotes" placeholder="Notater …" style="width:100%;min-height:60px;margin-bottom:1rem;border-radius:8px;padding:6px;background:#1a1a1a;color:#fff;border:1px solid #333;"></textarea>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="srvSave" class="btn btn-green">💾 Lagre service</button>
          <button id="srvFinish" class="btn btn-blue">🧾 Fullfør runde (JSON)</button>
        </div>
      `;

      Service.paint();
      document.getElementById("srvSave").onclick = Service.save;
      document.getElementById("srvFinish").onclick = Service.finishRound;
    },

    items: [
      "Smurt fres",
      "Smurt plog",
      "Smurt forstilling",
      "",
      "Sjekket olje foran",
      "Sjekket olje bak",
      "Etterfylt olje",
      "Diesel fylt",
      "",
      "Annet"
    ],

    paint() {
      const host = document.getElementById("srvList");
      if (!host) return;
      const s = C.state.service || {};

      host.innerHTML = Service.items
        .map(txt => {
          if (txt === "") return `<li><hr style="border:none;border-top:1px solid #333;margin:6px 0"></li>`;
          const id = txt.toLowerCase().replace(/\s+/g, "_");
          return `
            <li style="margin:4px 0">
              <label><input type="checkbox" data-k="${id}" ${s[id] ? "checked" : ""}> ${C.esc(txt)}</label>
            </li>`;
        })
        .join("");

      host.querySelectorAll("input[type=checkbox]").forEach(ch => {
        ch.onchange = () => {
          const k = ch.dataset.k;
          C.state.service[k] = ch.checked;
          C.save();
        };
      });

      const notes = document.getElementById("srvNotes");
      notes.value = s.notes || "";
      notes.oninput = () => {
        C.state.service.notes = notes.value;
        C.save();
      };
    },

    save() {
      C.state.lastSyncAt = Date.now();
      C.save();
      alert("Service lagret!");
    },

    finishRound() {
      const data = {
        driver: C.displayName(),
        equipment: C.state.equipment,
        service: C.state.service,
        finishedAt: new Date().toISOString(),
        round: C.state.dayLog?.dateKey || C.dateKey()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `service_runde_${C.dateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  const style = document.createElement("style");
  style.textContent = `
    #srvList label { color:#fff; cursor:pointer; }
    #srvList input { margin-right:6px; }
    .btn { border:none; border-radius:10px; padding:8px 12px; font-weight:700; cursor:pointer; }
    .btn-green { background:#0f9d58; color:#fff; }
    .btn-blue { background:#0b66ff; color:#fff; }
  `;
  document.head.appendChild(style);

  Service.init();
})();