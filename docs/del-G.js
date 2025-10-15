/* ===== del-G.js (ADMIN) ===== */
(() => {
  if (!window.Core) { console.warn("Del C må lastes før Del G."); return; }
  const { Core } = window;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})) {
      if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
      else el[k] = v;
    }
    kids.flat().forEach(k => {
      if (k == null) return;
      el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    });
    return el;
  }

  function timeAgo(ts){
    if (!ts) return "—";
    const s = Math.max(0, Math.floor((Date.now()-ts)/1000));
    if (s < 60)  return `${s}s siden`;
    const m = Math.floor(s/60);
    if (m < 60)  return `${m}m siden`;
    const h = Math.floor(m/60);
    return `${h}t siden`;
  }

  function equipPretty(eq){
    if (!eq) return "—";
    const names = [];
    if (eq.plog) names.push(Core.equipLabel("plog"));
    if (eq.fres) names.push(Core.equipLabel("fres"));
    if (eq.stro) names.push(Core.equipLabel("stro"));
    return names.join(", ") || "—";
  }

  function renderStatusList(list){
    const cont = Core.qs("#adminStatusList");
    if (!cont) return;
    cont.innerHTML = "";
    if (!list || list.length === 0) {
      cont.appendChild(h("div",{class:"muted"},"Ingen aktive statuser."));
      return;
    }
    list.forEach(s=>{
      const row=h("div",{class:"admin-status-row"},
        h("div",{class:"admin-status-main"},
          h("div",{class:"admin-status-name"},s.name||"Ukjent"),
          h("div",{class:"admin-status-sub"},
            `Sist: ${timeAgo(s.ts)} • Retning: ${s.direction||"—"} • Utstyr: ${equipPretty(s.equipment)}`
          ),
          h("div",{class:"admin-status-sub"},`Adresse: ${s.current||"—"}`)
        ),
        h("div",{class:"admin-status-progress"},
          h("div",{class:"bar"},h("div",{class:"fill",style:`width:${Math.max(0,Math.min(100,Number(s.progress||0)))}%`})),
          h("div",{class:"pct"},`${Math.round(s.progress||0)}%`)
        )
      );
      cont.appendChild(row);
    });
  }

  function ensureStyles(){
    if (document.getElementById("admin-status-css")) return;
    const css=`
      #adminStatusBox{border:1px solid #333;border-radius:10px;padding:12px;margin:8px 0 16px;background:#161616}
      #adminStatusBox .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
      #adminStatusList{display:flex;flex-direction:column;gap:10px}
      .admin-status-row{display:flex;justify-content:space-between;gap:16px;align-items:center;border:1px solid #2a2a2a;border-radius:8px;padding:10px;background:#0e0e0e}
      .admin-status-name{font-weight:700}
      .admin-status-sub{font-size:12px;color:#a7a7a7;margin-top:2px}
      .admin-status-progress{min-width:180px;display:flex;align-items:center;gap:8px}
      .admin-status-progress .bar{flex:1;height:8px;background:#222;border-radius:6px;overflow:hidden}
      .admin-status-progress .fill{height:100%;background:linear-gradient(90deg,#00c853,#64dd17)}
      .admin-status-progress .pct{font-size:12px;color:#ddd;min-width:32px;text-align:right}
      .btn{cursor:pointer;border:none;border-radius:6px;padding:6px 10px}
      .btn.secondary{background:#2b2b2b;color:#ddd}
    `;
    const el=document.createElement("style");
    el.id="admin-status-css"; el.textContent=css;
    document.head.appendChild(el);
  }

  function mountAdminStatus(){
    const sec=Core.qs("#admin"); if(!sec)return;
    ensureStyles();
    let box=Core.qs("#adminStatusBox");
    if(!box){
      box=h("div",{id:"adminStatusBox"},
        h("div",{class:"hdr"},
          h("div",{style:"font-weight:700"},"Felles status (live)"),
          h("button",{class:"btn secondary",id:"btnManualRefresh"},"Oppdater nå")
        ),
        h("div",{id:"adminStatusList"})
      );
      sec.prepend(box);
      Core.qs("#btnManualRefresh")?.addEventListener("click",()=>Core.status.startPolling(renderStatusList));
    }
    try{
      Core.status.startHeartbeat();
      Core.status.startPolling(renderStatusList);
    }catch(e){console.warn("Kunne ikke starte polling:",e);}
  }

  document.addEventListener("DOMContentLoaded",mountAdminStatus);
  document.addEventListener("click",ev=>{
    const t=ev.target;
    if(t&&t.matches("nav button")&&(t.textContent||"").trim().toLowerCase()==="admin")
      setTimeout(mountAdminStatus,0);
  });
})();