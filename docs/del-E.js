/* ===== del-E.js (SERVICE) ===== */
(()=>{
  const { $, state, save, download, dateKey } = window.Core;

  function read(){
    return {
      fres:       $("#svFres").checked,
      skjaer:     $("#svSkjaer").checked,
      forstilling:$("#svForst").checked,
      oljeF:      $("#svOljeF").checked,
      oljeB:      $("#svOljeB").checked,
      etter:      $("#svEtter").checked,
      diesel:     $("#svDiesel").checked,
      other:      $("#svOther").checked,
      notes:      $("#svNotes").value.trim(),
      at: Date.now()
    };
  }

  function saveService(){
    const rec = read();
    state.serviceHistory = state.serviceHistory || [];
    state.serviceHistory.push(rec);
    save();
    alert("Service lagret lokalt ✅");
  }

  function finishRound(){
    const data = {
      date: dateKey(new Date()),
      driver: state.customName || state.role,
      direction: state.direction,
      equipment: state.equipment,
      stops: state.stops,
      serviceHistory: state.serviceHistory||[]
    };
    download(`runde_${data.date}.json`, JSON.stringify(data,null,2));
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    $("#svSave").onclick = saveService;
    $("#svFinish").onclick = finishRound;
  });
})();