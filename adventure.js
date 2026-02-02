/* ---------------------------------------------------------
   EchoVerse Adventure — adventure.js
   - Energy system (Give/Take/Suck/Share)
   - Insight quests (modal)
   - Local progress + “Go to Track” jump into index.html
--------------------------------------------------------- */

(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---- Theme (shared with player) ----
  let theme = localStorage.getItem("ev_theme") || "anti";
  function setTheme(t){
    theme = t;
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("ev_theme", theme);
    const label = $("#themeLabel");
    if (label) label.textContent = theme === "love" ? "Love" : "Anti-Love";
  }
  setTheme(theme);
  $("#themeBtn")?.addEventListener("click", ()=> setTheme(theme === "anti" ? "love" : "anti"));

  // ---- Energy System ----
  const energy = { give: 0, take: 0, suck: 0, share: 0 };
  const meterText = $("#meterText");
  const meterFill = $("#meterFill");

  function renderEnergy(){
    if (meterText) meterText.textContent =
      `Given: ${energy.give} • Taken: ${energy.take} • Sucked: ${energy.suck} • Shared: ${energy.share}`;

    const total = energy.give + energy.take + energy.suck + energy.share;
    const percent = Math.min(100, (total / 20) * 100);
    if (meterFill) meterFill.style.width = percent + "%";
  }

  $$("[data-energy]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const type = btn.getAttribute("data-energy");
      if (!type || energy[type] === undefined) return;
      energy[type] += 1;
      renderEnergy();
    });
  });
  renderEnergy();

  // ---- Local messages (local-only) ----
  const MSG_KEY = "ev_adventure_msgs_v1";
  const msgList = $("#msgList");
  const msgInput = $("#msgInput");

  function getMsgs(){
    try { return JSON.parse(localStorage.getItem(MSG_KEY) || "[]"); }
    catch { return []; }
  }
  function setMsgs(arr){
    localStorage.setItem(MSG_KEY, JSON.stringify(arr.slice(0, 50)));
  }
  function renderMsgs(){
    if (!msgList) return;
    const msgs = getMsgs();
    if (!msgs.length){
      msgList.innerHTML = `<div class="small">No messages yet. Drop a synchronicity.</div>`;
      return;
    }
    msgList.innerHTML = msgs.map(m => `<div class="small" style="margin-bottom:8px">• ${escapeHtml(m)}</div>`).join("");
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  $("#msgAdd")?.addEventListener("click", ()=>{
    const v = (msgInput?.value || "").trim();
    if (!v) return;
    const msgs = getMsgs();
    msgs.unshift(v);
    setMsgs(msgs);
    if (msgInput) msgInput.value = "";
    renderMsgs();
  });
  $("#msgClear")?.addEventListener("click", ()=>{
    localStorage.removeItem(MSG_KEY);
    renderMsgs();
  });
  msgInput?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") $("#msgAdd")?.click();
  });
  renderMsgs();

  // ---- Quest Modal ----
  const PROG_KEY = "echoverseProgress";
  const modal = $("#questModal");
  const qTitle = $("#questTitle");
  const qDesc = $("#questDesc");
  const qClose = $("#questClose");
  const qComplete = $("#questComplete");
  const qGo = $("#questGo");

  let activeInsight = null;

  function openModal(){
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function saveProgress(){
    const unlocked = $$(".insight.unlocked").map(card => card.dataset.insight);
    localStorage.setItem(PROG_KEY, JSON.stringify(unlocked));
  }
  function loadProgress(){
    const unlocked = JSON.parse(localStorage.getItem(PROG_KEY) || "[]");
    unlocked.forEach(id=>{
      const card = $(`.insight[data-insight="${id}"]`);
      if (card) card.classList.add("unlocked");
    });
  }

  loadProgress();

  $$(".insight").forEach(card=>{
    card.addEventListener("click", ()=>{
      activeInsight = card;
      const name = $(".iname", card)?.textContent?.trim() || "Quest";
      const quest = $(".quest", card)?.textContent?.trim() || "Complete the mini-quest.";
      const trackId = card.getAttribute("data-track") || "";

      if (qTitle) qTitle.textContent = name;
      if (qDesc) qDesc.textContent = quest;

      if (qGo){
        if (trackId) {
          qGo.style.display = "inline-flex";
          qGo.dataset.track = trackId;
        } else {
          qGo.style.display = "none";
          qGo.dataset.track = "";
        }
      }

      openModal();
    });
  });

  qClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e)=>{ if (e.target === modal) closeModal(); });
  window.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeModal(); });

  qComplete?.addEventListener("click", ()=>{
    if (activeInsight){
      activeInsight.classList.add("unlocked");
      saveProgress();
    }
    closeModal();
  });

  qGo?.addEventListener("click", ()=>{
    const trackId = qGo.dataset.track || "";
    if (trackId) localStorage.setItem("ev_track", trackId);
    window.location.href = "./index.html";
  });
})();
