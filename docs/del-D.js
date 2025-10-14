// del-D.js – logikk for "Under arbeid"
console.log("✅ del-D.js lastet");

if (!window.Core) console.warn("⚠️ Del C må lastes først for Del D.");

// Når siden vises
document.addEventListener("DOMContentLoaded", async () => {
  const section = document.querySelector("#workList");
  if (!section) return;

  // Hent adresser fra katalog
  const katalog = await Core.fetchCatalog();
  if (!Array.isArray(katalog) || katalog.length === 0) {
    section.innerHTML = "<p>Ingen adresser tilgjengelig.</p>";
    return;
  }

  // Bygg liste
  section.innerHTML = "";
  katalog.forEach((adr, i) => {
    const div = document.createElement("div");
    div.className = "adr";
    div.innerHTML = `
      <strong>${adr.navn || adr.name || "Ukjent adresse"}</strong><br>
      ${adr.type || "Snø og grus"}<br>
      <button data-i="${i}" class="startBtn">Start jobb</button>
    `;
    section.appendChild(div);
  });

  // Start knapp
  section.addEventListener("click", e => {
    if (e.target.classList.contains("startBtn")) {
      const idx = e.target.dataset.i;
      const adr = katalog[idx];
      alert(`Starter arbeid på ${adr.navn || adr.name}`);
    }
  });
});