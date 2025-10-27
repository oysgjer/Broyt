BROYT — NAV-SHORTCUTS DELTA
================================

Dette er en minimal oppdatering som legger til:
- Navigasjon fra meny-ikonene ⛽ Diesel / 🪨 Grus / 🏠 Base direkte til Google Maps
- Hjelpefunksjoner i Admin for å lagre destinasjoner (lat/lon eller søketekst)

INNHOLD
-------
docs/js/nav-shortcuts.js
docs/js/admin-navshortcuts.js

HVA DU SKAL LEGGE TIL I HTML
----------------------------
1) MENYEN DIN (IKONER)
   I din eksisterende meny (der ikonene allerede er), legg til disse tre linjene (dersom de ikke finnes):

   <li><a href="index.html#work" data-shortcut="diesel">⛽ Diesel</a></li>
   <li><a href="index.html#work" data-shortcut="grus">🪨 Grus</a></li>
   <li><a href="index.html#work" data-shortcut="base">🏠 Base</a></li>

   (Vi rører ikke annet i menyen.)

2) LAST INN SKRIPTENE
   På alle sider som viser menyen (minst index.html, admin.html, reports.html),
   legg dette rett før </body>:

   <script src="js/nav-shortcuts.js?v=nav1" defer></script>
   <script src="js/admin-navshortcuts.js?v=nav1" defer></script>

3) ADMIN-SIDEN DIN
   Legg inn en liten seksjon (der du ønsker) for å konfigurere destinasjoner.
   Dette beholder alt annet du har fra før (adresse-register osv.).

   --------------------------------------------------------------
   <hr>
   <h2>Destinasjoner (snarveier)</h2>
   <p>Fyll inn lat/lon for nøyaktig navigering. Hvis de er tomme, brukes “Spørring”.</p>

   <h3>⛽ Diesel</h3>
   <label>Navn</label>
   <input id="ns_diesel_name" type="text" placeholder="f.eks. Esso Råholt">
   <label>Spørring</label>
   <input id="ns_diesel_query" type="text" placeholder="f.eks. Esso Råholt, Norge">
   <div style="display:flex;gap:8px;flex-wrap:wrap">
     <input id="ns_diesel_lat" type="number" step="any" placeholder="lat" style="flex:1">
     <input id="ns_diesel_lon" type="number" step="any" placeholder="lon" style="flex:1">
   </div>

   <h3>🪨 Grus</h3>
   <label>Navn</label>
   <input id="ns_grus_name" type="text" placeholder="f.eks. Sandtak Eidsvoll">
   <label>Spørring</label>
   <input id="ns_grus_query" type="text" placeholder="f.eks. Sandtak Eidsvoll, Norge">
   <div style="display:flex;gap:8px;flex-wrap:wrap">
     <input id="ns_grus_lat" type="number" step="any" placeholder="lat" style="flex:1">
     <input id="ns_grus_lon" type="number" step="any" placeholder="lon" style="flex:1">
   </div>

   <h3>🏠 Base</h3>
   <label>Navn</label>
   <input id="ns_base_name" type="text" placeholder="f.eks. Lager Hasler">
   <label>Spørring</label>
   <input id="ns_base_query" type="text" placeholder="f.eks. Haslervegen 1, 2034 Holter">
   <div style="display:flex;gap:8px;flex-wrap:wrap">
     <input id="ns_base_lat" type="number" step="any" placeholder="lat" style="flex:1">
     <input id="ns_base_lon" type="number" step="any" placeholder="lon" style="flex:1">
   </div>
   --------------------------------------------------------------

   Det er alt. admin-navshortcuts.js vil automatisk:
   - Lese inn feltene når admin-siden åpnes
   - Koble seg på knappen med id="admin_save_bins" hvis den finnes,
     slik at destinasjoner lagres sammen med resten av admin-innstillingene.

HVA DU BØR FJERNE (HVIS DU LA DET TIL TIDLIGERE)
-------------------------------------------------
- Hvis du tidligere la inn "js/menu-augment.js": fjern <script>-taggen for denne.
  (Vi ønsker at menyen din skal stå uendret – nav-shortcuts.js håndterer kun klikk.)

HVORDAN DET VIRKER
------------------
- Destinasjoner lagres i localStorage under BRYT_SETTINGS.navShortcuts.
- Ved klikk på menyikonene (⛽/🪨/🏠) leses destinasjonene og Google Maps åpnes.
- Hvis lat/lon er satt (begge), brukes "destination=lat,lon". Ellers brukes "destination=Spørring".

TEST
----
1) Gå til Admin → fyll inn minst én destinasjon (f.eks. Grus med spørring "Sandtak Eidsvoll, Norge") → Lagre.
2) Åpne meny → trykk 🪨 Grus → du skal bli sendt til Google Maps med riktig destinasjon.

CACHE / APP-MODUS
-----------------
Hvis du har appen installert (PWA), må du kanskje tømme cache eller bruke versjons-query (?v=nav1) på skriptene
for å se endringene med en gang.
