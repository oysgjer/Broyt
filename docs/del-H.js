// --- del-H.js ---
// Sikker init: unngå "duplicate variable H"
window.H = window.H || {};

(function() {
  console.log("✅ del-H.js (katalog) lastet");

  // DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => document.querySelectorAll(sel);

  // --- Katalog-data ---
  H.catalog = {
    list: [],
    masterBin: "68e7833843b1c97be95ff286",   // hoved-katalog (offentlig)
    backupBin: "68e7b4d2ae596e708f0bde7d",   // backup
    apiKey: localStorage.getItem("broyte_api_key") || window.DEFAULT_JSONBIN_KEY || "",

    async load() {
      try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${this.masterBin}/latest`, {
          headers: { "X-Master-Key": this.apiKey }
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        this.list = json.record?.addresses || [];
        console.log("✅ Katalog hentet", this.list.length);
        this.render();
      } catch (err) {
        console.error("❌ Feil ved kataloghenting:", err);
        alert("Feil ved kataloghenting.");
      }
    },

    render() {
      const c = $("#catalogList");
      if (!c) return;
      c.innerHTML = "";
      if (!this.list.length) {
        c.innerHTML = "<p class='muted'>Ingen adresser i katalogen.</p>";
        return;
      }

      this.list.forEach((a, i) => {
        const row = document.createElement("div");
        row.className = "catalog-row";
        row.innerHTML = `
          <input class="addrName" value="${a.name}" data-i="${i}">
          <select class="taskSel" data-i="${i}">
            <option ${a.task==="Snø"?"selected":""}>Snø</option>
            <option ${a.task==="Snø og grus"?"selected":""}>Snø og grus</option>
            <option ${a.task==="Snø + brøytestikker"?"selected":""}>Snø + brøytestikker</option>
            <option ${a.task==="Snø og grus + brøytestikker"?"selected":""}>Snø og grus + brøytestikker</option>
          </select>
          <label>
            <input type="checkbox" class="multiChk" ${a.twoDrivers?"checked":""} data-i="${i}">
            2 sjåfører
          </label>
          <label>
            <input type="checkbox" class="activeChk" ${a.active!==false?"checked":""} data-i="${i}">
            Aktiv
          </label>
          <input type="number" min="0" value="${a.stikker||0}" class="stickCount" data-i="${i}" style="width:60px">
          <button class="delBtn" data-i="${i}">❌</button>
        `;
        c.appendChild(row);
      });
    },

    collect() {
      const names = $all(".addrName");
      const tasks = $all(".taskSel");
      const multi = $all(".multiChk");
      const active = $all(".activeChk");
      const sticks = $all(".stickCount");
      this.list = Array.from(names).map((n, i) => ({
        name: n.value.trim(),
        task: tasks[i].value,
        twoDrivers: multi[i].checked,
        active: active[i].checked,
        stikker: parseInt(sticks[i].value || "0")
      }));
    },

    async save() {
      this.collect();
      try {
        const payload = {
          version: "9.10",
          updated: Date.now(),
          addresses: this.list
        };
        const res = await fetch(`https://api.jsonbin.io/v3/b/${this.masterBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": this.apiKey
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(res.status);
        console.log("✅ Katalog lagret:", this.list.length);
        alert("Katalog lagret!");
      } catch (err) {
        console.error("❌ Feil ved lagring:", err);
        alert("Feil ved lagring (sjekk nøkkel).");
      }
    },

    async backup() {
      try {
        const payload = { ts: Date.now(), data: this.list };
        await fetch(`https://api.jsonbin.io/v3/b/${this.backupBin}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": this.apiKey
          },
          body: JSON.stringify(payload)
        });
        console.log("📦 Backup lagret");
      } catch (err) {
        console.warn("⚠️ Kunne ikke lagre backup:", err);
      }
    }
  };

  // --- Event Listeners ---
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t.matches("#loadCatalog")) H.catalog.load();
    if (t.matches("#saveCatalog")) H.catalog.save();
    if (t.matches("#backupCatalog")) H.catalog.backup();
    if (t.matches(".delBtn")) {
      const i = t.dataset.i;
      H.catalog.list.splice(i, 1);
      H.catalog.render();
    }
  });

})();