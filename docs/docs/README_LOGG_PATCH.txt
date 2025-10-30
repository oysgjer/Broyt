README – Logg-knapp & vær ikon fix
===================================

1) Legg til disse to linjene i docs/index.html:

  I <head>:
    <link rel="stylesheet" href="css/wx_fix.css">

  Før </body> (etter andre .js-filer):
    <script src="js/admin_logg_inject.js?v=1" defer></script>

2) Hard refresh (Ctrl/Cmd + Shift + R).

3) Åpne Admin – du skal nå se knappen: "🧾 Åpne Logg (A4)".
   Klikk → åpner docs/logg.html (printvennlig logg).

Tips:
- Hvis du bruker partials og ikke ser endringen, bump versjon på admin-partial-include:
  data-include="partials/admin.html?v=2"
