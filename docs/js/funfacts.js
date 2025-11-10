// funfacts.js — robust mount + daglig funfact
(function(){
  const FUNFACTS = [
    "En plog på 3 meter i 10 km/t flytter nær 30 tonn snø i minuttet.",
    "Snøkrystaller kan være sekskantede og hule – derfor pakker de seg rart.",
    "Litt silikon på skjæret gjør at snøen slipper lettere.",
    "Våt 5 cm snø tilsvarer over 50 liter vann per kvadratmeter.",
    "Hydraulikk liker det varmt – gi den et minutt før første løft.",
    "En Ariens 28” kan flytte over 75 tonn snø i timen.",
    "Smør fresen før du smører deg selv 😉",
    "Et tonn snø tar omtrent 2,5 kubikkmeter plass.",
    "En traktor på tomgang bruker 2–3 liter diesel i timen.",
    "Første snøplog i Norge ble tatt i bruk i 1922.",
    "Salt virker dårlig under –6 °C, men sand funker alltid.",
    "Vind gjør mer for snøfokk enn selve snømengden.",
    "Is tåler 12 tonn pr. m² hvis den er 20 cm tykk.",
    "Brøytestikker ble først laget av bambus før plast tok over.",
    "Snø reflekterer opptil 90 % av sollyset.",
    "En traktor på 5 tonn med kjetting gir over 25 000 N grep i bakken.",
    "Snøfnugg kan være 0,01 mm til over 10 mm.",
    "En vanlig brøyterute på 10 km kan inneholde 200 tonn snø etter ett snøfall.",
    "Kald diesel kan miste opptil 30 % effekt ved –20 °C.",
    "Snø brøytes mest effektivt ved 8–15 km/t.",
    "Godt lys på traktoren hjelper mer enn kaffe etter midnatt ☕️",
    "Hydraulikkolje bør være over 30 °C før full belastning.",
    "Når du hører knirk, er det kaldere enn –7 °C.",
    "Et 2 cm lag våt snø kan veie mer enn 5 cm tørrsnø.",
    // + mine nye:
    "Et brøyteblad på 3 meter flytter over 100 kubikkmeter snø per kilometer.",
    "Jo tørrere snøen er, desto lenger flyr den ut av fresen.",
    "Fres uten ørepropper én gang – og du husker dem neste gang.",
    "Et millimeterlag med is på ruta reduserer sikten med 80 %. ",
    "Diesel danner voks ved –10 °C hvis den ikke er vintertilsatt.",
    "En 200 hk traktor bruker rundt 20 liter diesel i timen under tung brøyting.",
    "Snø som ligger i én måned mister opptil 40 % av volumet sitt.",
    "En skje på 2,7 m brøyter omtrent 27 m² hvert sekund i 10 km/t.",
    "Ved 10 m/s vind flyttes snøen dobbelt så raskt som du kjører.",
    "Hydraulikkfilter bør byttes hver 500. driftstime – helst før vinterstart.",
    "Et brøyteblink på taket gjør deg 300 % mer synlig i mørket.",
    "Fuktig snø fryser lettere fast på stålsnitt enn på gummi.",
    "Stålskjær varer 3–4 ganger lenger med riktig trykk og vinkel.",
    "Vinterdiesel har lavere energiinnhold – derfor litt lavere effekt.",
    "Snø smelter raskere på asfalt enn grus, selv ved samme temperatur.",
    "En god brøyter ser værmeldingen som en utfordring, ikke en advarsel.",
    "Snøen veier mer når du har det travelt.",
    "Kjettinger bør strammes mens de er varme – ikke når de har frosset fast.",
    "Å justere vinkelen 5° kan redusere drivstofforbruket med 10 %. ",
    "Den som smører ofte, brøyter lenger."
  ];

  function getTodaysFunFact() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    let cachedDate = localStorage.getItem('funfact-date');
    let text = localStorage.getItem('funfact-text');
    if (cachedDate !== key || !text) {
      text = FUNFACTS[Math.floor(Math.random() * FUNFACTS.length)];
      localStorage.setItem('funfact-date', key);
      localStorage.setItem('funfact-text', text);
    }
    return text;
  }

  function mount() {
    let el = document.getElementById('funfact');
    if (!el) {
      // hvis utvikler har glemt å legge inn boksen: lag en og legg den under header
      const header = document.querySelector('header') || document.body;
      el = document.createElement('div');
      el.id = 'funfact';
      el.className = 'funfact';
      el.style.cssText = 'margin:10px 14px; padding:10px; background:#f2f4f7; border-radius:8px; font-style:italic;';
      header.parentNode.insertBefore(el, header.nextSibling);
    }
    el.textContent = getTodaysFunFact();
  }

  // kjør når DOM er klar, og én ekstra failsafe etter 1 sek for PWA-lastere
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once:true });
  } else {
    mount();
  }
  setTimeout(() => {
    const el = document.getElementById('funfact');
    if (el && !el.textContent) el.textContent = getTodaysFunFact();
  }, 1000);
})();