/* ---------------------------------------------------------
   EchoVerse Adventure — adventure.js
   - Energy system (Give/Take/Suck/Share)
   - Insight quests (modal)
   - Local progress + “Go to Track” jump into index.html
--------------------------------------------------------- */

(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const defer = (fn) => {
    try {
      if (typeof queueMicrotask === "function") return queueMicrotask(fn);
      return setTimeout(fn, 0);
    } catch {
      return setTimeout(fn, 0);
    }
  };

  // ---- Embed mode (opened inside the player overlay) ----
  const params = (() => {
    try { return new URLSearchParams(window.location.search || ""); }
    catch { return new URLSearchParams(); }
  })();
  const isEmbed = params.has("embed") || (() => {
    try { return window.self !== window.top; }
    catch { return true; }
  })();

  function postToParent(message){
    if (!isEmbed) return false;
    try {
      window.parent.postMessage(message, window.location.origin);
      return true;
    } catch {
      return false;
    }
  }

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

  // In embed mode, don't navigate away from the player; ask parent to close.
  $("#playerLink")?.addEventListener("click", (e)=>{
    if (!isEmbed) return;
    e.preventDefault();
    postToParent({ type: "ev:close_adventure" });
  });

  // ---- Energy System ----
  const energy = { give: 0, take: 0, suck: 0, share: 0 };
  const meterText = $("#meterText");
  const meterFill = $("#meterFill");

  function emitEnergyBurst(type, sourceEl){
    try {
      const r = sourceEl?.getBoundingClientRect?.();
      const x = r ? (r.left + r.width / 2) : (window.innerWidth / 2);
      const y = r ? (r.top + r.height / 2) : (window.innerHeight * 0.25);
      window.dispatchEvent(new CustomEvent("ev:energy", { detail: { type, x, y } }));
    } catch {
      // ignore
    }
  }

  function bounceBtn(btn){
    try{
      btn.animate([
        { transform: "scale(1)" },
        { transform: "scale(0.96)" },
        { transform: "scale(1.03)" },
        { transform: "scale(1)" }
      ], { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)" });
    } catch {
      // ignore
    }
  }

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
      bounceBtn(btn);
      emitEnergyBurst(type, btn);
    });
  });
  renderEnergy();

  // Micro-interactions: a subtle bounce on other buttons too.
  document.addEventListener("click", (e)=>{
    const btn = e.target?.closest?.(".btn");
    if (!btn) return;
    if (btn.hasAttribute("data-energy")) return;
    bounceBtn(btn);
  }, { passive: true });

  // ---- Quest Modal ----
  const PROG_KEY = "echoverseProgress";
  const modal = $("#questModal");
  const qTitle = $("#questTitle");
  const qDesc = $("#questDesc");
  const qStage = $("#questStage");
  const qStatus = $("#questStatus");
  const qClose = $("#questClose");
  const qReset = $("#questReset");
  const qComplete = $("#questComplete");
  const qGo = $("#questGo");
  const qBanner = $("#questBanner");
  const qSigil = $("#questSigil");
  const qKicker = $("#questKicker");
  const qSceneText = $("#questSceneText");

  const sceneFx = { a1: "", a2: "" };

  let activeInsight = null;
  let cleanupQuest = null;
  let lastFocus = null;

  function openModal(){
    if (!modal) return;
    lastFocus = document.activeElement;
    document.documentElement.classList.add("ev-modal-open");
    document.body.classList.add("ev-modal-open");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      const target = qClose || modal.querySelector("[role='dialog']") || modal;
      target?.focus?.();
    });
  }
  function closeModal(){
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("ev-modal-open");
    document.body.classList.remove("ev-modal-open");
    clearStage();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }


  function setStatus(msg){
    if (!qStatus) return;
    qStatus.textContent = msg || "";
  }
  function setCompleteEnabled(on){
    if (!qComplete) return;
    qComplete.disabled = !on;
    qComplete.style.opacity = on ? "1" : ".55";
    qComplete.style.cursor = on ? "pointer" : "not-allowed";
  }
  function clearStage(){
    if (cleanupQuest) { try{ cleanupQuest(); }catch(_e){} }
    cleanupQuest = null;
    if (qStage) qStage.innerHTML = "";
    setStatus("");
    setCompleteEnabled(false);
    if (qReset) qReset.style.display = "none";
  }

  const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));

  // Minimal inline sigils (currentColor)
  const Sigils = {
    triad:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M32 6 52 14v18c0 14-9 24-20 28C21 56 12 46 12 32V14L32 6Zm0 10-12 5v11c0 9 5.6 16.7 12 19.8 6.4-3.1 12-10.8 12-19.8V21L32 16Z"/></svg>`,
    wave:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M10 34c8-10 14 10 22 0s14 10 22 0v6c-8 10-14-10-22 0s-14-10-22 0v-6Z"/><path fill="currentColor" d="M50 14l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" opacity=".55"/></svg>`,
    cord:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M14 18c10 0 10 10 20 10s10-10 20-10v6c-10 0-10 10-20 10S24 24 14 24v-6Z"/><path fill="currentColor" d="M31 18h2v28h-2V18Z"/><path fill="currentColor" d="M28 32l4-4 4 4-4 4-4-4Z"/></svg>`,
    ring:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M32 10c12.15 0 22 9.85 22 22S44.15 54 32 54 10 44.15 10 32 19.85 10 32 10Zm0 6c-8.84 0-16 7.16-16 16s7.16 16 16 16 16-7.16 16-16-7.16-16-16-16Z"/></svg>`,
    flame:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M30 6c6 6 8 10 8 14 0 4.5-3.5 8-8 8s-8-3.5-8-8c0-4 2-8 8-14Z"/><path fill="currentColor" d="M28 30h4v22c0 3.3-2.7 6-6 6h-2v-4h2c1.1 0 2-.9 2-2V30Z"/></svg>`,
    eye:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M32 14c14 0 24 18 24 18S46 50 32 50 8 32 8 32s10-18 24-18Zm0 8c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10Z"/><path fill="currentColor" d="M32 26a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>`,
    twin:`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M24 10c6 6 8 10 8 14 0 4.5-3.5 8-8 8s-8-3.5-8-8c0-4 2-8 8-14Z"/><path fill="currentColor" d="M40 10c6 6 8 10 8 14 0 4.5-3.5 8-8 8s-8-3.5-8-8c0-4 2-8 8-14Z"/><path fill="currentColor" d="M32 34l4 6-4 6-4-6 4-6Z"/></svg>`
  };

  // Scene dressing + animated sigils for the quest modal
  const QUESTS = {
    "1": {
      kicker: "Awakening Signal",
      scene: "Three sparks want alignment. Find the first stable shape and the field stops wobbling.",
      a1: "#ff2bd6",
      a2: "#26e6ff",
      paths: [
        { d: "M60 34 L85 79 L35 79 Z", delay: 0.0, width: 4.2 },
        { d: "M60 44 L76 73 L44 73 Z", delay: 0.08, width: 3.2 }
      ]
    },
    "2": {
      kicker: "Signal Lock",
      scene: "Inside the static, a clean tone appears. Tune to it—then hold steady until it locks.",
      a1: "#26e6ff",
      a2: "#ffffff",
      paths: [
        { d: "M24 62 C34 44 46 80 60 62 C74 44 86 80 96 62", delay: 0.0, width: 4.0 },
        { d: "M24 72 C34 54 46 90 60 72 C74 54 86 90 96 72", delay: 0.10, width: 3.2 }
      ]
    },
    "3": {
      kicker: "Cut the Cord",
      scene: "A cord tugs for reaction. Cut clean—no receipts, no rope—just freedom.",
      a1: "#ffcc66",
      a2: "#ff2bd6",
      paths: [
        { d: "M38 38 L82 82", delay: 0.0, width: 4.4 },
        { d: "M82 38 L38 82", delay: 0.08, width: 4.4 },
        { d: "M34 60 L86 60", delay: 0.18, width: 2.8, opacity: 0.8 }
      ]
    },
    "4": {
      kicker: "Green Battery",
      scene: "Charge from within. Hold until full—then release without losing it.",
      a1: "#6bffb0",
      a2: "#26e6ff",
      paths: [
        { d: "M46 40 H74 V84 H46 Z", delay: 0.0, width: 3.9 },
        { d: "M52 34 H68", delay: 0.12, width: 3.9 },
        { d: "M60 46 L52 64 H63 L56 82", delay: 0.20, width: 3.6 }
      ]
    },
    "5": {
      kicker: "Focus = Fire",
      scene: "Ignite the spark. Stay inside the ring until attention becomes heat—and heat becomes direction.",
      a1: "#ff7a18",
      a2: "#ffcc66",
      paths: [
        { d: "M60 34 A26 26 0 1 1 59.9 34", delay: 0.0, width: 3.6, opacity: 0.9 },
        { d: "M60 44 C54 52 54 62 60 68 C66 62 66 52 60 44 Z", delay: 0.12, width: 3.6 }
      ]
    },
    "6": {
      kicker: "Observer Mode",
      scene: "Hold still long enough to see the pattern without becoming it. Clarity arrives quietly.",
      a1: "#ffcc66",
      a2: "#2b6bff",
      paths: [
        { d: "M26 60 C36 42 84 42 94 60 C84 78 36 78 26 60 Z", delay: 0.0, width: 3.9 },
        { d: "M60 52 A8 8 0 1 0 60 68 A8 8 0 1 0 60 52", delay: 0.12, width: 3.6 }
      ]
    },
    "7": {
      kicker: "Co‑Creator",
      scene: "Two currents meet. Match values, then merge—clean exchange, no control, all momentum.",
      a1: "#ff4fd8",
      a2: "#7dffdf",
      paths: [
        { d: "M34 60 C34 48 48 48 60 60 C72 72 86 72 86 60 C86 48 72 48 60 60 C48 72 34 72 34 60 Z", delay: 0.0, width: 3.7 },
        { d: "M60 46 V74", delay: 0.12, width: 3.0, opacity: 0.85 }
      ]
    },
    "8": {
      kicker: "Compassion Signal",
      scene: "Pick a bright intention. Seal it—then carry it like a lantern into the next moment.",
      a1: "#7dffdf",
      a2: "#ffcc66",
      paths: [
        { d: "M60 84 C44 76 34 64 34 52 C34 44 40 38 48 38 C54 38 58 42 60 46 C62 42 66 38 72 38 C80 38 86 44 86 52 C86 64 76 76 60 84 Z", delay: 0.0, width: 3.7 },
        { d: "M60 32 V44", delay: 0.14, width: 3.0, opacity: 0.85 }
      ]
    },
    "9": {
      kicker: "Final Glyph",
      scene: "The pattern returns. Watch it, then repeat it—one clean step at a time.",
      a1: "#26e6ff",
      a2: "#ff2bd6",
      paths: [
        { d: "M60 30 C42 30 36 46 50 56 C64 66 58 86 40 86", delay: 0.0, width: 3.8 },
        { d: "M60 30 C78 30 84 46 70 56 C56 66 62 86 80 86", delay: 0.10, width: 3.8 },
        { d: "M44 60 H76", delay: 0.22, width: 3.0, opacity: 0.85 }
      ]
    }
  };

  function questSigilSVG(id){
    const q = QUESTS[String(id)] || {};
    const a1 = q.a1 || "#ff2bd6";
    const a2 = q.a2 || "#26e6ff";
    const paths = Array.isArray(q.paths) ? q.paths : [];
    const uid = `evq_${String(id).replace(/[^0-9a-z]/gi, "") || "x"}`;
    const grad = `${uid}_g`;
    const glow = `${uid}_f`;

    const pMarkup = paths.map((p, i)=>{
      const delay = Number.isFinite(p.delay) ? p.delay : (i * 0.08);
      const opacity = Number.isFinite(p.opacity) ? p.opacity : 0.95;
      const width = Number.isFinite(p.width) ? p.width : 3.8;
      const d = String(p.d || "").trim();
      if (!d) return "";
      return `<path class="ev-draw" d="${d}" pathLength="100" style="animation-delay:${delay}s;opacity:${opacity};stroke-width:${width}"></path>`;
    }).join("");

    return `
      <svg class="ev-quest-sigil" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${a1}"/>
            <stop offset="1" stop-color="${a2}"/>
          </linearGradient>
          <filter id="${glow}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" result="b"/>
            <feColorMatrix in="b" type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 .70 0" result="g"/>
            <feMerge>
              <feMergeNode in="g"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <circle cx="60" cy="60" r="46" fill="none" stroke="url(#${grad})" stroke-width="2.6" opacity=".55"/>
        <g class="ev-spin">
          <circle class="ev-dash" cx="60" cy="60" r="46" fill="none" stroke="url(#${grad})" stroke-width="3.4"/>
          <circle cx="60" cy="14" r="2.7" fill="url(#${grad})"/>
          <circle cx="60" cy="14" r="10" fill="url(#${grad})" opacity=".12"/>
        </g>

        <g filter="url(#${glow})" stroke="url(#${grad})" fill="none" stroke-linecap="round" stroke-linejoin="round">
          ${pMarkup}
        </g>

        <g class="ev-core">
          <circle cx="60" cy="60" r="3.2" fill="url(#${grad})" opacity=".90"/>
          <circle cx="60" cy="60" r="11" fill="url(#${grad})" opacity=".10"/>
        </g>
      </svg>
    `;
  }

  function stageBurstAt(clientX, clientY){
    if (!qStage) return;
    const r = qStage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = clamp(clientX - r.left, 0, r.width);
    const y = clamp(clientY - r.top, 0, r.height);
    const el = document.createElement("span");
    el.className = "qburst";
    el.style.left = x + "px";
    el.style.top = y + "px";
    if (sceneFx.a1) el.style.setProperty("--b1", sceneFx.a1);
    if (sceneFx.a2) el.style.setProperty("--b2", sceneFx.a2);
    qStage.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch {} }, 720);
  }

  function celebrateStage(){
    if (!qStage) return;
    const r = qStage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.45;
    const rx = r.width * 0.18;
    const ry = r.height * 0.16;
    for (let i = 0; i < 7; i++){
      const a = (Math.PI * 2 * i) / 7;
      stageBurstAt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    stageBurstAt(cx, cy);
  }

  function applyQuestScene(id){
    const q = QUESTS[String(id)];
    if (!q || !qStage || !qBanner || !qSigil || !qKicker || !qSceneText) return;

    sceneFx.a1 = q.a1 || "";
    sceneFx.a2 = q.a2 || "";

    try{
      qStage.dataset.scene = String(id);
      qStage.style.setProperty("--scene-a1", q.a1 || "");
      qStage.style.setProperty("--scene-a2", q.a2 || "");
      qBanner.style.setProperty("--scene-a1", q.a1 || "");
      qBanner.style.setProperty("--scene-a2", q.a2 || "");
    } catch {}

    qKicker.textContent = q.kicker || "Signal Scene";
    qSceneText.textContent = q.scene || "";
    qSigil.innerHTML = questSigilSVG(id);
    qBanner.setAttribute("aria-hidden", "false");
  }

  // Ambient click feedback while the modal is open.
  qStage?.addEventListener("pointerdown", (e)=>{
    try{
      if (!modal || !modal.classList.contains("open")) return;
      stageBurstAt(e.clientX, e.clientY);
    } catch {
      // ignore
    }
  }, { passive: true });

  
  // Gate 1 — Align the Sparks (drag 3 sparks into glowing triangle)
  // This is a true drag-and-drop puzzle (no manual complete).
  function buildGate1AlignSparksQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="g1-puzzle" aria-label="Align the sparks puzzle">
        <div class="g1-target" aria-hidden="true"></div>
        <div class="g1-orb" data-orb="1" style="left: 10%; top: 70%;" aria-label="Spark 1" role="button" tabindex="0"></div>
        <div class="g1-orb" data-orb="2" style="left: 70%; top: 75%;" aria-label="Spark 2" role="button" tabindex="0"></div>
        <div class="g1-orb" data-orb="3" style="left: 45%; top: 20%;" aria-label="Spark 3" role="button" tabindex="0"></div>
        <p class="g1-hint">Drag the three sparks into the glowing triangle. Let the shape settle.</p>
      </div>
    `;

    const puzzle = $(".g1-puzzle", qStage);
    const target = $(".g1-target", qStage);
    const orbs = $$(".g1-orb", qStage);

    if (!puzzle || !target || !orbs.length) return ()=>{};

    // Hide manual completion — this gate auto-completes
    if (qComplete) qComplete.style.display = "none";

    let draggingOrb = null;
    let offsetX = 0;
    let offsetY = 0;

    const rect = (el)=> el.getBoundingClientRect();

    function isOrbInsideTarget(orbRect, targetRect){
      const cx = orbRect.left + orbRect.width / 2;
      const cy = orbRect.top + orbRect.height / 2;
      return (
        cx > targetRect.left &&
        cx < targetRect.right &&
        cy > targetRect.top &&
        cy < targetRect.bottom
      );
    }

    function completeGate1(){
      if (puzzle.classList.contains("g1-solved")) return;
      puzzle.classList.add("g1-solved");
      setStatus("Triangle aligned. Signal unlocked.");
      setCompleteEnabled(true);

      // auto-complete after a short delay
      setTimeout(() => {
        if (!activeInsight) return;
        activeInsight.classList.add("unlocked");
        saveProgress();
        emitInsightUnlocked(activeInsight.dataset.insight || "1");
        closeModal();
      }, 650);
    }

    function checkSolved(){
      const targetRect = rect(target);
      const allInside = orbs.every(orb => isOrbInsideTarget(rect(orb), targetRect));
      if (allInside) completeGate1();
      else {
        setStatus("Place all three sparks.");
        setCompleteEnabled(false);
      }
    }

    function onDown(e){
      const orb = e.currentTarget;
      draggingOrb = orb;
      const r = orb.getBoundingClientRect();
      offsetX = e.clientX - r.left;
      offsetY = e.clientY - r.top;
      orb.setPointerCapture?.(e.pointerId);
      orb.classList.add("dragging");
      e.preventDefault();
    }

    function onMove(e){
      if (!draggingOrb || draggingOrb !== e.currentTarget) return;
      const puzzleRect = rect(puzzle);
      let x = e.clientX - puzzleRect.left - offsetX;
      let y = e.clientY - puzzleRect.top - offsetY;

      const maxX = puzzleRect.width - draggingOrb.offsetWidth;
      const maxY = puzzleRect.height - draggingOrb.offsetHeight;
      x = clamp(x, 0, maxX);
      y = clamp(y, 0, maxY);

      // Keep px positioning for smoother drag
      draggingOrb.style.left = x + "px";
      draggingOrb.style.top  = y + "px";

      checkSolved();
      e.preventDefault();
    }

    function onUp(e){
      const orb = e.currentTarget;
      orb.classList.remove("dragging");
      draggingOrb = null;
      try { orb.releasePointerCapture?.(e.pointerId); } catch(_e){}
      checkSolved();
      e.preventDefault();
    }

    // Accessibility: keyboard nudges
    function onKey(e){
      const orb = e.currentTarget;
      const step = (e.shiftKey ? 16 : 6);
      const puzzleRect = rect(puzzle);

      const curL = parseFloat(orb.style.left || "0");
      const curT = parseFloat(orb.style.top  || "0");

      let x = curL, y = curT;
      if (e.key === "ArrowLeft") x -= step;
      else if (e.key === "ArrowRight") x += step;
      else if (e.key === "ArrowUp") y -= step;
      else if (e.key === "ArrowDown") y += step;
      else return;

      const maxX = puzzleRect.width - orb.offsetWidth;
      const maxY = puzzleRect.height - orb.offsetHeight;
      orb.style.left = clamp(x, 0, maxX) + "px";
      orb.style.top  = clamp(y, 0, maxY) + "px";
      checkSolved();
      e.preventDefault();
    }

    orbs.forEach(orb => {
      // convert % to px once for consistent dragging
      const pr = rect(puzzle);
      const or = rect(orb);
      const leftPct = parseFloat((orb.style.left||"0").replace("%",""))/100;
      const topPct  = parseFloat((orb.style.top||"0").replace("%",""))/100;
      if (pr.width && pr.height){
        orb.style.left = (leftPct * (pr.width - or.width)) + "px";
        orb.style.top  = (topPct * (pr.height - or.height)) + "px";
      }
      orb.addEventListener("pointerdown", onDown);
      orb.addEventListener("pointermove", onMove);
      orb.addEventListener("pointerup", onUp);
      orb.addEventListener("pointercancel", onUp);
      orb.addEventListener("keydown", onKey);
    });

    // Kick status
    setStatus("Place all three sparks.");
    setCompleteEnabled(false);

    // Cleanup
    return ()=> {
      if (qComplete) qComplete.style.display = "";
      orbs.forEach(orb=>{
        orb.removeEventListener("pointerdown", onDown);
        orb.removeEventListener("pointermove", onMove);
        orb.removeEventListener("pointerup", onUp);
        orb.removeEventListener("pointercancel", onUp);
        orb.removeEventListener("keydown", onKey);
      });
    };
  }

function buildTriangleQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `<div class="qhelp">Drag the three sparks onto the three target nodes to form a triangle.</div>`;
    const stage = document.createElement("div");
    stage.style.position="relative";
    stage.style.height="170px";
    stage.style.marginTop="10px";
    qStage.appendChild(stage);

    const targets = [
      {x: "50%", y:"28%"},
      {x: "26%", y:"72%"},
      {x: "74%", y:"72%"},
    ].map((t,i)=>{
      const el=document.createElement("div");
      el.className="qtarget";
      el.style.left=`calc(${t.x} - 12px)`;
      el.style.top=`calc(${t.y} - 12px)`;
      el.dataset.idx=String(i);
      stage.appendChild(el);
      return el;
    });

    const sparks = [0,1,2].map(i=>{
      const s=document.createElement("div");
      s.className="qspark";
      s.style.left = (14 + i*26) + "%";
      s.style.top = "118px";
      s.dataset.placed="";
      stage.appendChild(s);
      return s;
    });

    let active=null, offX=0, offY=0;

    function checkDone(){
      const ok = sparks.every(s => s.dataset.placed !== "");
      if (ok){
        setStatus("Triangle aligned. Signal unlocked.");
        setCompleteEnabled(true);
      } else {
        setStatus("Place all three sparks.");
        setCompleteEnabled(false);
      }
    }

    function syncTargets(){
      targets.forEach(t=>t.classList.remove("filled"));
      sparks.forEach(sp=>{
        if (sp.dataset.placed){
          const t=targets.find(tt=>tt.dataset.idx===sp.dataset.placed);
          if (t) t.classList.add("filled");
        }
      });
    }

    function placeIfNear(spark){
      const sr = spark.getBoundingClientRect();
      const sx = sr.left + sr.width/2;
      const sy = sr.top + sr.height/2;
      let best=null, bestD=1e12;
      targets.forEach(t=>{
        const tr=t.getBoundingClientRect();
        const tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
        const d=(sx-tx)*(sx-tx) + (sy-ty)*(sy-ty);
        if (d<bestD){ bestD=d; best=t; }
      });
      const snapDist = 48*48;
      if (best && bestD < snapDist){
        const tr=best.getBoundingClientRect();
        const pr=stage.getBoundingClientRect();
        const left = ( (tr.left+tr.width/2) - pr.left ) - 8;
        const top  = ( (tr.top+tr.height/2) - pr.top ) - 8;
        spark.style.left = left + "px";
        spark.style.top  = top + "px";
        spark.dataset.placed = best.dataset.idx;
      } else {
        spark.dataset.placed = "";
      }
      syncTargets();
      checkDone();
    }

    function down(e){
      const t=e.target;
      if (!t.classList.contains("qspark")) return;
      active=t;
      const r=t.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      t.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function move(e){
      if (!active) return;
      const pr=stage.getBoundingClientRect();
      const x = clamp(e.clientX - pr.left - offX, 0, pr.width-16);
      const y = clamp(e.clientY - pr.top  - offY, 0, pr.height-16);
      active.style.left = x + "px";
      active.style.top  = y + "px";
      active.dataset.placed = "";
      syncTargets();
      checkDone();
      e.preventDefault();
    }
    function up(e){
      if (!active) return;
      placeIfNear(active);
      active=null;
      e.preventDefault();
    }

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    setStatus("Place all three sparks.");
    setCompleteEnabled(false);

    return ()=> {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    };
  }

  function buildTuneQuest(){
    if (!qStage) return ()=>{};
    const target = 62 + Math.floor(Math.random()*28); // 62-89
    let hold=0, raf=0, last=0;

    qStage.innerHTML = `
      <div class="qhelp">Inside the static, a clean tone appears. Tune the dial until the signal locks—hold steady for 1 second.</div>
      <div class="qdial">
        <div class="qchip">Target: <span class="mono">${target}</span> Hz</div>
        <input id="dial" type="range" min="40" max="110" value="70" />
        <div class="qprogress" aria-label="Lock progress"><div id="lockFill"></div></div>
      </div>
    `;
    const dial = $("#dial", qStage);
    const fill = $("#lockFill", qStage);

    function step(ts){
      if (!last) last=ts;
      const dt = (ts-last)/1000; last=ts;
      const v = Number(dial.value);
      const ok = Math.abs(v - target) <= 2;
      if (ok) hold = Math.min(1, hold + dt/1.0);
      else hold = Math.max(0, hold - dt/0.7);
      if (fill) fill.style.width = Math.round(hold*100) + "%";

      if (hold >= 1){
        setStatus("Signal locked. Static turns into guidance.");
        setCompleteEnabled(true);
      } else {
        setStatus(ok ? "Hold steady…" : "Find the frequency.");
        setCompleteEnabled(false);
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return ()=> { if (raf) cancelAnimationFrame(raf); };
  }

  function buildSwipeCutQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">A cord tugs for reaction. Swipe across it three times to sever it—clean cut.</div>
      <canvas class="qcanvas" id="ropeCanvas" aria-label="Swipe-to-cut canvas"></canvas>
      <div class="qchip" style="margin-top:10px">Cuts: <span id="cuts" class="mono">0</span>/3</div>
    `;
    const c = $("#ropeCanvas", qStage);
    const cutsEl = $("#cuts", qStage);
    const ctx = c.getContext("2d");
    let cuts=0;
    const cutSeg=[false,false,false];
    let drawing=false;
    let lastPt=null;

    function size(){
      const r=c.getBoundingClientRect();
      // If the modal isn't visible yet, r will be 0x0. Defer.
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(r.width * dpr);
      c.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      draw();
    }

    function draw(){
      const w=c.getBoundingClientRect().width;
      const h=c.getBoundingClientRect().height;
      ctx.clearRect(0,0,w,h);
      const y=h/2;
      // background rope
      ctx.lineCap="round";
      ctx.lineWidth=7;
      ctx.strokeStyle="rgba(255,255,255,.18)";
      ctx.beginPath();
      ctx.moveTo(16,y);
      ctx.lineTo(w-16,y);
      ctx.stroke();

      // segments
      const segW=(w-32)/3;
      for(let i=0;i<3;i++){
        const x0=16+i*segW;
        ctx.lineWidth=10;
        ctx.strokeStyle=cutSeg[i] ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.28)";
        ctx.beginPath();
        ctx.moveTo(x0+12,y);
        ctx.lineTo(x0+segW-12,y);
        ctx.stroke();

        if (cutSeg[i]){
          ctx.lineWidth=2;
          ctx.strokeStyle="rgba(255,255,255,.10)";
          ctx.beginPath();
          ctx.moveTo(x0+segW/2,y-22);
          ctx.lineTo(x0+segW/2,y+22);
          ctx.stroke();
        }
      }

      // swipe zone
      ctx.setLineDash([7,7]);
      ctx.lineWidth=1;
      ctx.strokeStyle="rgba(255,255,255,.10)";
      ctx.strokeRect(16, y-28, w-32, 56);
      ctx.setLineDash([]);
    }

    function pt(e){
      const r=c.getBoundingClientRect();
      return {x: e.clientX - r.left, y: e.clientY - r.top};
    }
    function segForX(x){
      const w=c.getBoundingClientRect().width;
      const segW=(w-32)/3;
      const rel = x-16;
      return clamp(Math.floor(rel/segW), 0, 2);
    }

    function tryCut(p0,p1){
      if (!p0 || !p1) return;
      const h=c.getBoundingClientRect().height;
      const y=h/2;
      const minY=Math.min(p0.y,p1.y), maxY=Math.max(p0.y,p1.y);
      if (y < minY-10 || y > maxY+10) return;
      const minX=Math.min(p0.x,p1.x), maxX=Math.max(p0.x,p1.x);
      // must cross at least 40px horizontally
      if ((maxX-minX) < 40) return;
      const midX = (p0.x+p1.x)/2;
      const idx = segForX(midX);
      if (!cutSeg[idx]){
        cutSeg[idx]=true;
        cuts++;
        if (cutsEl) cutsEl.textContent=String(cuts);
        draw();
        if (cuts>=3){
          setStatus("Cord severed. You keep your power.");
          setCompleteEnabled(true);
        } else {
          setStatus("Good cut. Keep going.");
          setCompleteEnabled(false);
        }
      }
    }

    function down(e){
      drawing=true;
      lastPt=pt(e);
      c.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function move(e){
      if (!drawing) return;
      const cur=pt(e);
      tryCut(lastPt, cur);
      lastPt=cur;
      e.preventDefault();
    }
    function up(e){
      drawing=false;
      lastPt=null;
      e.preventDefault();
    }

    window.addEventListener("resize", size);
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    // Defer first layout pass until after modal paint
    requestAnimationFrame(()=>{ requestAnimationFrame(size); });
    setStatus("Swipe across each segment.");
    setCompleteEnabled(false);

    return ()=> {
      window.removeEventListener("resize", size);
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }

  function buildHoldChargeQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">Charge from within. Press and hold to reach 100%. Releasing early resets—steady hands.</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="holdBtn" type="button">Hold to Charge</button>
        <span class="qchip">Charge: <span id="pct" class="mono">0</span>%</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;
    const btn=$("#holdBtn", qStage);
    const pct=$("#pct", qStage);
    const fill=$("#fill", qStage);
    let holding=false, val=0, raf=0, last=0, complete=false;

    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (complete) {
        val = 1;
      } else if (holding) {
        val = Math.min(1, val + dt/1.4);
      } else {
        val = 0;
      }
      const p=Math.round(val*100);
      if (pct) pct.textContent=String(p);
      if (fill) fill.style.width = p+"%";
      if (p>=100){
        complete = true;
        holding = false;
        btn.classList.remove("active");
        btn.disabled = true;
        btn.textContent = "Charged";
        setStatus("Fully charged. You generate clean energy. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else if (complete){
        setStatus("Fully charged. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        setStatus(holding ? "Charging…" : "Press and hold to charge.");
        setCompleteEnabled(false);
      }
      raf=requestAnimationFrame(step);
    }

    function start(){
      holding=true;
      btn.classList.add("active");
    }
    function stop(){
      holding=false;
      btn.classList.remove("active");
    }

    btn.addEventListener("pointerdown", (e)=>{ start(); btn.setPointerCapture?.(e.pointerId); e.preventDefault(); });
    btn.addEventListener("pointerup", (e)=>{ stop(); e.preventDefault(); });
    btn.addEventListener("pointercancel", (e)=>{ stop(); e.preventDefault(); });
    btn.addEventListener("pointerleave", ()=>{ if (holding) stop(); });

    raf=requestAnimationFrame(step);
    setStatus("Press and hold to charge. Once full, you can release and tap Complete.");
    setCompleteEnabled(false);

    return ()=>{ if (raf) cancelAnimationFrame(raf); };
  }

  function buildFocusRingQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">Strike the spark. Ignite the match, then keep your pointer inside the ring for 3 seconds.</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="ignite" type="button">Ignite</button>
        <span class="qchip">Focus: <span id="sec" class="mono">0.0</span>s / 3.0s</span>
      </div>
      <canvas class="qcanvas" id="ringCanvas" aria-label="Focus ring"></canvas>
    `;
    const ignite=$("#ignite", qStage);
    const secEl=$("#sec", qStage);
    const c=$("#ringCanvas", qStage);
    const ctx=c.getContext("2d");

    let armed=false, inside=false, hold=0, raf=0, last=0, complete=false;
    let ring={x:0,y:0,r:60};

    function size(){
      const r=c.getBoundingClientRect();
      const dpr=Math.min(2, window.devicePixelRatio||1);
      c.width=Math.floor(r.width*dpr);
      c.height=Math.floor(r.height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ring.x=r.width/2; ring.y=r.height/2; ring.r=Math.min(70, Math.min(r.width,r.height)/3);
      draw();
    }
    function draw(){
      const w=c.getBoundingClientRect().width;
      const h=c.getBoundingClientRect().height;
      ctx.clearRect(0,0,w,h);
      // glow ring
      ctx.lineWidth=5;
      ctx.strokeStyle=armed ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.16)";
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI*2); ctx.stroke();

      // inner
      ctx.fillStyle="rgba(0,0,0,.10)";
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r-10, 0, Math.PI*2); ctx.fill();

      // flame dot
      ctx.fillStyle= armed ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.18)";
      ctx.beginPath(); ctx.arc(ring.x, ring.y-ring.r+18, 5, 0, Math.PI*2); ctx.fill();
    }

    function pt(e){
      const r=c.getBoundingClientRect();
      return {x:e.clientX-r.left, y:e.clientY-r.top};
    }
    function inRing(p){
      const dx=p.x-ring.x, dy=p.y-ring.y;
      return (dx*dx+dy*dy) <= (ring.r-6)*(ring.r-6);
    }

    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (complete) {
        hold = 3;
      } else if (armed && inside) {
        hold = Math.min(3, hold+dt);
      } else {
        hold = Math.max(0, hold-dt*1.2);
      }
      if (secEl) secEl.textContent = hold.toFixed(1);

      if (hold>=3){
        complete = true;
        setStatus("Focus achieved. Fire becomes direction. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        setStatus(!armed ? "Ignite first." : (inside ? "Hold focus…" : "Stay inside the ring."));
        setCompleteEnabled(false);
      }
      raf=requestAnimationFrame(step);
    }

    ignite.addEventListener("click", ()=>{ armed=true; hold=0; draw(); });

    function move(e){
      if (!armed) return;
      inside = inRing(pt(e));
    }

    window.addEventListener("resize", size);
    c.addEventListener("pointermove", move);

    // Defer first layout pass until after modal paint
    requestAnimationFrame(()=>{ requestAnimationFrame(size); });
    raf=requestAnimationFrame(step);

    return ()=>{ window.removeEventListener("resize", size); c.removeEventListener("pointermove", move); if (raf) cancelAnimationFrame(raf); };
  }

  function buildObserverHoldQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">Become the observer. Press and hold the eye for 2 seconds—stay still (no big movement).</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="eyeHold" type="button" aria-label="Hold the eye">${Sigils.eye}</button>
        <span class="qchip">Stillness: <span id="still" class="mono">0.0</span>s / 2.0s</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;
    const btn=$("#eyeHold", qStage);
    const still=$("#still", qStage);
    const fill=$("#fill", qStage);

    let holding=false, t=0, raf=0, last=0, complete=false;
    let startX=0,startY=0;
    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (complete) {
        t = 2;
      } else if (holding) {
        t = Math.min(2, t+dt);
      } else {
        t = Math.max(0, t-dt*1.3);
      }
      if (still) still.textContent=t.toFixed(1);
      if (fill) fill.style.width = Math.round((t/2)*100)+"%";
      if (t>=2){
        complete = true;
        holding = false;
        setStatus("Observer mode unlocked. You notice the pattern. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        setStatus(holding ? "Hold still…" : "Press and hold.");
        setCompleteEnabled(false);
      }
      raf=requestAnimationFrame(step);
    }
    function down(e){
      if (complete) return;
      holding=true; t=0;
      startX=e.clientX; startY=e.clientY;
      btn.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function move(e){
      if (!holding || complete) return;
      const dx=Math.abs(e.clientX-startX), dy=Math.abs(e.clientY-startY);
      if (dx>22 || dy>22){ holding=false; t=0; }
    }
    function up(e){ holding=false; e.preventDefault(); }

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);

    raf=requestAnimationFrame(step);
    return ()=>{ if (raf) cancelAnimationFrame(raf); };
  }

  function buildCoCreatorQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">Two currents, one value. Bring both sliders to the same number, then tap Merge.</div>
      <div class="qrow" style="margin-top:10px">
        <span class="qchip">A</span><input id="a" type="range" min="0" max="100" value="25">
        <span class="qchip">B</span><input id="b" type="range" min="0" max="100" value="75">
      </div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="merge" type="button">Merge</button>
        <span class="qchip">Δ <span id="delta" class="mono">50</span></span>
      </div>
    `;
    const a=$("#a", qStage), b=$("#b", qStage), merge=$("#merge", qStage), delta=$("#delta", qStage);
    function update(){
      const d=Math.abs(Number(a.value)-Number(b.value));
      if (delta) delta.textContent=String(d);
      merge.disabled = d>3;
      merge.style.opacity = d>3 ? ".55" : "1";
    }
    a.addEventListener("input", update);
    b.addEventListener("input", update);
    merge.addEventListener("click", ()=>{
      setStatus("Merged. Co-creation begins.");
      setCompleteEnabled(true);
    });
    update();
    setStatus("Match the sliders (Δ ≤ 3).");
    setCompleteEnabled(false);
    return ()=>{};
  }

  function buildIntentionQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">Choose a north star. Pick an intention, then hold to seal it.</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn" data-intent="clarity" type="button">Clarity</button>
        <button class="qbtn" data-intent="courage" type="button">Courage</button>
        <button class="qbtn" data-intent="kindness" type="button">Kindness</button>
      </div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="seal" type="button" disabled>Hold to Seal</button>
        <span class="qchip">Seal <span id="pct" class="mono">0</span>%</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;
    let chosen="";
    const buttons=$$("[data-intent]", qStage);
    const seal=$("#seal", qStage);
    const pct=$("#pct", qStage);
    const fill=$("#fill", qStage);

    buttons.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        buttons.forEach(b=>b.classList.remove("primary"));
        btn.classList.add("primary");
        chosen = btn.dataset.intent;
        seal.disabled=false;
        setStatus(`Selected: ${chosen}. Hold to seal.`);
      });
    });

    let holding=false, val=0, raf=0, last=0, complete=false;
    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (complete) {
        val = 1;
      } else if (holding) {
        val = Math.min(1, val + dt/1.0);
      } else {
        val = Math.max(0, val - dt*1.8);
      }
      const p=Math.round(val*100);
      if (pct) pct.textContent=String(p);
      if (fill) fill.style.width=p+"%";
      if (p>=100){
        complete = true;
        holding = false;
        seal.disabled = true;
        seal.textContent = "Sealed";
        setStatus("Intention sealed. Walk in alignment. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        if (!chosen) setStatus("Pick an intention.");
        setCompleteEnabled(false);
      }
      raf=requestAnimationFrame(step);
    }

    seal.addEventListener("pointerdown",(e)=>{ if (!chosen) return; holding=true; seal.setPointerCapture?.(e.pointerId); e.preventDefault(); });
    seal.addEventListener("pointerup",(e)=>{ holding=false; e.preventDefault(); });
    seal.addEventListener("pointercancel",(e)=>{ holding=false; e.preventDefault(); });

    raf=requestAnimationFrame(step);
    setStatus("Pick an intention.");
    setCompleteEnabled(false);
    return ()=>{ if (raf) cancelAnimationFrame(raf); };
  }

  function buildSequenceQuest(){
    if (!qStage) return ()=>{};
    const pool=[Sigils.triad,Sigils.wave,Sigils.cord,Sigils.ring,Sigils.flame,Sigils.eye,Sigils.twin];
    const seq=[0,0,0,0].map(()=> Math.floor(Math.random()*pool.length));
    let idx=0;
    qStage.innerHTML = `
      <div class="qhelp">Watch the glyph, then repeat it. Tap the sigils in order.</div>
      <div class="qsigils" id="sigils" style="margin-top:10px"></div>
      <div class="qchip" style="margin-top:10px">Step: <span id="step" class="mono">0</span>/4</div>
    `;
    const wrap=$("#sigils", qStage);
    const stepEl=$("#step", qStage);
    const sigEls = pool.map((svg, i)=>{
      const el=document.createElement("div");
      el.className="qsigil";
      el.innerHTML=svg;
      el.dataset.i=String(i);
      wrap.appendChild(el);
      return el;
    });

    function flash(i){
      sigEls[i].classList.add("active");
      setTimeout(()=>sigEls[i].classList.remove("active"), 260);
    }
    // play sequence
    let t=0;
    seq.forEach((s, k)=>{ setTimeout(()=>flash(s), 400 + k*520); t=400 + k*520; });
    setTimeout(()=>setStatus("Your turn."), t+520);

    function onTap(e){
      const el=e.currentTarget;
      const i=Number(el.dataset.i);
      if (i === seq[idx]){
        idx++;
        if (stepEl) stepEl.textContent=String(idx);
        flash(i);
        if (idx>=4){
          setStatus("Pattern complete. You stay in the flow.");
          setCompleteEnabled(true);
        } else {
          setStatus("Good. Next.");
          setCompleteEnabled(false);
        }
      } else {
        idx=0;
        if (stepEl) stepEl.textContent="0";
        setStatus("Reset. Breathe, then try again.");
        setCompleteEnabled(false);
      }
    }
    sigEls.forEach(el=>el.addEventListener("click", onTap));

    setStatus("Watch first…");
    setCompleteEnabled(false);

    return ()=>{ sigEls.forEach(el=>el.removeEventListener("click", onTap)); };
  }

  function setupQuest(insightId){
    clearStage();
    const id = String(insightId || "");
    applyQuestScene(id);
    const unlocked = activeInsight?.classList.contains("unlocked");
    if (unlocked){
      setStatus("Already completed. You can reset this Signal if you want to replay it.");
      setCompleteEnabled(true);
      if (qReset) qReset.style.display = "inline-flex";
      return;
    }
    switch(id){
      case "1": cleanupQuest = buildGate1AlignSparksQuest(); break;
      case "2": cleanupQuest = buildTuneQuest(); break;
      case "3": cleanupQuest = buildSwipeCutQuest(); break;
      case "4": cleanupQuest = buildHoldChargeQuest(); break;
      case "5": cleanupQuest = buildFocusRingQuest(); break;
      case "6": cleanupQuest = buildObserverHoldQuest(); break;
      case "7": cleanupQuest = buildCoCreatorQuest(); break;
      case "8": cleanupQuest = buildIntentionQuest(); break;
      case "9": cleanupQuest = buildSequenceQuest(); break;
      default:
        setStatus("Tap Complete when you're ready.");
        setCompleteEnabled(true);
    }
  }

  function saveProgress(){
    const unlocked = $$(".insight.unlocked").map(card => card.dataset.insight);
    localStorage.setItem(PROG_KEY, JSON.stringify(unlocked));
  }
  function emitProgressUpdate(){
    try{
      const unlocked = $$(".insight.unlocked")
        .map(card => String(card.dataset.insight || ""))
        .filter(Boolean);
      window.dispatchEvent(new CustomEvent("ev:progress", { detail: { unlocked } }));
      const pill = document.getElementById("constellationPill");
      if (pill) pill.textContent = `Constellation: ${unlocked.length}/9`;
    } catch {
      // ignore
    }
  }
  function emitInsightUnlocked(insightId){
    emitProgressUpdate();
    celebrateStage();
    try{
      window.dispatchEvent(new CustomEvent("ev:insightUnlocked", { detail: { id: String(insightId) } }));
    } catch {
      // ignore
    }
  }
  function loadProgress(){
    const unlocked = JSON.parse(localStorage.getItem(PROG_KEY) || "[]");
    unlocked.forEach(id=>{
      const card = $(`.insight[data-insight="${id}"]`);
      if (card) card.classList.add("unlocked");
    });
  }

  loadProgress();
  // Defer so the skyfield module has time to attach listeners.
  defer(emitProgressUpdate);

  $$(".insight").forEach(card=>{
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    const label = $(".iname", card)?.textContent?.trim();
    if (label) card.setAttribute("aria-label", `Open quest: ${label}`);
    card.addEventListener("keydown", (e)=>{
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
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
          // Still let people jump to the player, even if the gate isn't tied to a specific track
          qGo.style.display = "inline-flex";
          qGo.dataset.track = "";
          qGo.textContent = "Go to Player";
        }
      }

      // Open first so canvas-based quests can measure correctly
      openModal();
      requestAnimationFrame(()=> setupQuest(card.dataset.insight));
    });
  });

  qClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e)=>{ if (e.target === modal) closeModal(); });
  window.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeModal(); });

  qComplete?.addEventListener("click", ()=>{
    if (qComplete?.disabled) return;
    if (activeInsight){
      const wasUnlocked = activeInsight.classList.contains("unlocked");
      if (!wasUnlocked){
        activeInsight.classList.add("unlocked");
        saveProgress();
        emitInsightUnlocked(activeInsight.dataset.insight || "");
      } else {
        emitProgressUpdate();
        celebrateStage();
      }
      setStatus(wasUnlocked ? "Already completed." : "Completed.");
      setCompleteEnabled(true);
    }
    // Tiny delay so the burst feedback is visible.
    setTimeout(closeModal, 240);
  });

  // Reset a single gate
  qReset?.addEventListener("click", ()=>{
    if (!activeInsight) return;
    activeInsight.classList.remove("unlocked");
    saveProgress();
    emitProgressUpdate();
    // Rebuild the quest interaction immediately
    requestAnimationFrame(()=> setupQuest(activeInsight.dataset.insight));
  });

  qGo?.addEventListener("click", ()=>{
    const trackId = qGo.dataset.track || "";
    if (trackId) localStorage.setItem("ev_track", trackId);
    closeModal();
    if (postToParent({ type: "ev:go_to_track", trackId })) return;
    window.location.href = "./index.html";
  });

  // Reset all progress
  $("#resetAll")?.addEventListener("click", ()=>{
    if (!confirm("Reset all progress?")) return;
    localStorage.removeItem(PROG_KEY);
    $$(".insight.unlocked").forEach(el=>el.classList.remove("unlocked"));
    emitProgressUpdate();
  });
})();



/* =========================================================
   EV_SKYFIELD — Persistent Starfield + Progress Constellation
   - Persistent stars: visible, pulsing, slow drift, star-shapes
   - Progress pattern: unlocked insights form a ring constellation
   - Energy actions: “Give/Take/Suck/Share” spawn color bursts
   - Celebrations: unlocking an insight triggers a bigger burst
========================================================= */
(function(){
  const SKY_TAG = "EV_SKYFIELD";
  if (window[SKY_TAG]) return;
  window[SKY_TAG] = true;

  const TOTAL_INSIGHTS = 9;
  const PROG_KEY = "echoverseProgress";

  const ENERGY_PRESETS = {
    give:  { hue: 200, sat: 95, light: 70 },
    take:  { hue: 45,  sat: 95, light: 72 },
    suck:  { hue: 262, sat: 72, light: 56 },
    share: { hue: 305, sat: 95, light: 72 }
  };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function rand(min,max){ return min + Math.random()*(max-min); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t){
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
  }

  function init(){
    const canvas = document.getElementById("sky");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha:true });

    const reducedMotion = (() => {
      try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
      catch { return false; }
    })();

    let w=0,h=0,dpr=1;
    let bgStars=[];
    let particles=[];
    let shockwaves=[];
    let unlocked = new Set();
    const unlockAt = new Map(); // id -> timestamp

    const mouse = { x: 0, y: 0, has: false };
    let lastNow = performance.now();
    let t0 = lastNow;

    function setUnlocked(list){
      unlocked = new Set((list || []).map(v => String(v)));
    }

    function readProgress(){
      try{
        const list = JSON.parse(localStorage.getItem(PROG_KEY) || "[]");
        if (Array.isArray(list)) setUnlocked(list);
      } catch {
        // ignore
      }
    }

    function resize(){
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.width = Math.floor(w*dpr);
      canvas.height = Math.floor(h*dpr);
      canvas.style.width = w+"px";
      canvas.style.height = h+"px";
      ctx.setTransform(dpr,0,0,dpr,0,0);
      buildStars();
    }

    function buildStars(){
      const area = w*h;
      const count = clamp(Math.round(area/14500), 90, 220);
      bgStars = [];
      for(let i=0;i<count;i++){
        const r = rand(0.8, 2.2);
        const b = rand(0.55, 1.0);
        const hue = rand(190, 320);
        const depth = rand(0.35, 1.0);
        const speed = lerp(2.2, 8.5, depth) * 0.22; // slow drift (px/s)
        const isStarShape = Math.random() < (r > 1.4 ? 0.8 : 0.38);
        bgStars.push({
          x: rand(0,w),
          y: rand(0,h),
          r,
          b,
          tw: rand(0.35, 1.25),
          ph: rand(0, Math.PI*2),
          hue,
          depth,
          vx: rand(-speed, speed),
          vy: rand(-speed, speed),
          rot: rand(0, Math.PI*2),
          vr: rand(-0.18, 0.18) * 0.18,
          star: isStarShape
        });
      }
    }

    function getPattern(){
      const minDim = Math.min(w, h);
      const cx = w * 0.5;
      const cy = clamp(h * 0.32, 120, 230);
      const ringR = clamp(minDim * 0.17, 70, 160);
      return { cx, cy, ringR };
    }

    function insightPos(id, tt){
      const { cx, cy, ringR } = getPattern();
      const a0 = -Math.PI/2;
      const ang = a0 + (id - 1) * (Math.PI * 2 / TOTAL_INSIGHTS);
      const breathe = 1 + 0.028*Math.sin(tt*0.9);
      return {
        x: cx + Math.cos(ang) * ringR * breathe,
        y: cy + Math.sin(ang) * ringR * breathe,
        ang
      };
    }

    function drawStarShape(x, y, rOuter, hue, alpha, rotation){
      const points = 5;
      const rInner = rOuter * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.beginPath();
      for(let i=0;i<points*2;i++){
        const r = (i % 2 === 0) ? rOuter : rInner;
        const a = (i * Math.PI) / points;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 96%, 72%, ${alpha})`;
      ctx.fill();
      ctx.restore();
    }

    function drawBackground(tt){
      ctx.clearRect(0,0,w,h);
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0, "rgba(8, 10, 18, 0.92)");
      g.addColorStop(0.45, "rgba(6, 6, 18, 0.85)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.92)");
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      const v = ctx.createRadialGradient(w*0.5, h*0.35, 0, w*0.5, h*0.6, Math.max(w,h)*0.8);
      v.addColorStop(0, "rgba(255,255,255,0.035)");
      v.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = v;
      ctx.fillRect(0,0,w,h);
    }

    function updateAndDrawStars(tt, dt){
      const px = mouse.has ? (mouse.x - w/2) * 0.02 : 0;
      const py = mouse.has ? (mouse.y - h/2) * 0.02 : 0;
      const margin = 30;

      for(const s of bgStars){
        if (!reducedMotion){
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          if (s.x < -margin) s.x = w + margin;
          if (s.x > w + margin) s.x = -margin;
          if (s.y < -margin) s.y = h + margin;
          if (s.y > h + margin) s.y = -margin;
        }

        const tw = 0.72 + 0.28*Math.sin(tt*s.tw + s.ph);
        const alpha = clamp(s.b * tw, 0.14, 1);
        const x = s.x + px * s.depth;
        const y = s.y + py * s.depth;
        const r = s.r * (0.92 + 0.18*tw);

        if (s.star){
          drawStarShape(x, y, r*1.55, s.hue, alpha*0.52, s.rot);
        } else {
          ctx.beginPath();
          ctx.fillStyle = `hsla(${s.hue}, 95%, 72%, ${alpha*0.50})`;
          ctx.arc(x, y, r*1.15, 0, Math.PI*2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 95%, 75%, ${alpha*0.10})`;
        ctx.arc(x, y, r*5.2, 0, Math.PI*2);
        ctx.fill();
      }
    }

    function drawProgressConstellation(tt){
      const { cx, cy, ringR } = getPattern();
      const ringPulse = 0.65 + 0.35*Math.sin(tt*1.6);

      // Center star + aura
      drawStarShape(cx, cy, 4.6 + 0.35*Math.sin(tt*2.1), 260, 0.45 + 0.10*ringPulse, tt*0.4);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.05*ringPulse})`;
      ctx.arc(cx, cy, 18 + 2.5*ringPulse, 0, Math.PI*2);
      ctx.fill();

      // Ring guide
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.02*ringPulse})`;
      ctx.lineWidth = 1;
      ctx.arc(cx, cy, ringR, 0, Math.PI*2);
      ctx.stroke();

      const positions = [];
      for(let i=1;i<=TOTAL_INSIGHTS;i++){
        positions[i] = insightPos(i, tt);
      }

      // Center spokes (unlocked only)
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for(let i=1;i<=TOTAL_INSIGHTS;i++){
        if (!unlocked.has(String(i))) continue;
        const p = positions[i];
        const hue = 195 + (i-1) * (130/(TOTAL_INSIGHTS-1));
        const a = 0.10 + 0.08*ringPulse;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${hue}, 95%, 74%, ${a})`;
        ctx.lineWidth = 1.15;
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // Ring segments (only where both ends unlocked)
      for(let i=1;i<=TOTAL_INSIGHTS;i++){
        const j = (i % TOTAL_INSIGHTS) + 1;
        if (!unlocked.has(String(i)) || !unlocked.has(String(j))) continue;
        const a = 0.08 + 0.07*ringPulse;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 1.1;
        ctx.moveTo(positions[i].x, positions[i].y);
        ctx.lineTo(positions[j].x, positions[j].y);
        ctx.stroke();
      }

      // Stars
      for(let i=1;i<=TOTAL_INSIGHTS;i++){
        const id = String(i);
        const p = positions[i];
        const isUnlocked = unlocked.has(id);
        const hue = 195 + (i-1) * (130/(TOTAL_INSIGHTS-1));
        const baseA = isUnlocked ? (0.62 + 0.14*ringPulse) : (0.02 + 0.01*ringPulse);
        const baseR = isUnlocked ? 4.1 : 1.4;

        let pop = 1;
        const unlockedAt = unlockAt.get(id);
        if (unlockedAt){
          const s = clamp((performance.now() - unlockedAt) / 900, 0, 1);
          pop = 1 + 0.25 * easeOutBack(s);
          if (s >= 1) unlockAt.delete(id);
        }

        drawStarShape(p.x, p.y, baseR*pop, hue, baseA, tt*0.5 + p.ang*0.5);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, 95%, 75%, ${baseA*0.10})`;
        ctx.arc(p.x, p.y, (baseR*pop)*7.0, 0, Math.PI*2);
        ctx.fill();
      }
    }

    function spawnShockwave(x, y, hue, sat, light){
      shockwaves.push({
        x, y,
        r: 0,
        life: 0,
        max: rand(720, 980),
        hue, sat, light
      });
      if (shockwaves.length > 14) shockwaves.shift();
    }

    function spawnBurst(x, y, preset, scale=1){
      const p = preset || { hue: 260, sat: 90, light: 70 };
      const count = Math.round(rand(16, 24) * scale);
      for(let i=0;i<count;i++){
        const a = rand(0, Math.PI*2);
        const sp = rand(32, 130) * (0.45 + 0.55*scale);
        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp;
        particles.push({
          x, y,
          vx, vy,
          drag: rand(0.985, 0.994),
          hue: p.hue + rand(-10, 10),
          sat: p.sat,
          light: p.light + rand(-6, 6),
          life: 0,
          max: rand(1400, 2300) * (0.9 + 0.35*scale),
          r: rand(1.1, 2.6) * (0.8 + 0.4*scale)
        });
      }
      if (particles.length > 240) particles.splice(0, particles.length - 240);
    }

    function spawnCelebrateInsight(id){
      const i = clamp(Number(id) || 1, 1, TOTAL_INSIGHTS);
      const tt = (performance.now() - t0)/1000;
      const pos = insightPos(i, tt);
      const hue = 195 + (i-1) * (130/(TOTAL_INSIGHTS-1));
      unlockAt.set(String(i), performance.now());
      spawnBurst(pos.x, pos.y, { hue, sat: 95, light: 74 }, 2.05);
      spawnShockwave(pos.x, pos.y, hue, 95, 74);
    }

    function updateParticles(dt){
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.life += dt * 1000;
        if (p.life >= p.max){ particles.splice(i,1); continue; }
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for(let i=shockwaves.length-1;i>=0;i--){
        const s = shockwaves[i];
        s.life += dt * 1000;
        if (s.life >= s.max){ shockwaves.splice(i,1); continue; }
        s.r = lerp(0, clamp(Math.min(w,h)*0.22, 90, 170), easeOutCubic(s.life / s.max));
      }
    }

    function drawParticleConnections(){
      if (particles.length < 2) return;
      const maxD = 92;
      const maxD2 = maxD*maxD;
      ctx.lineWidth = 1.0;
      for(let i=0;i<particles.length;i++){
        const a = particles[i];
        const aLife = 1 - a.life / a.max;
        if (aLife < 0.15) continue;
        for(let j=i+1;j<particles.length;j++){
          const b = particles[j];
          const bLife = 1 - b.life / b.max;
          if (bLife < 0.15) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx*dx + dy*dy;
          if (d2 > maxD2) continue;
          const d = Math.sqrt(d2);
          const t = 1 - d / maxD;
          const op = t * 0.22 * Math.min(aLife, bLife);
          if (op < 0.008) continue;
          const hue = (a.hue + b.hue) / 2;
          ctx.strokeStyle = `hsla(${hue}, 92%, 74%, ${op})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    function drawParticles(){
      for(const p of particles){
        const life = 1 - p.life / p.max;
        const alpha = clamp(life, 0, 1);
        const r = p.r * (0.88 + 0.12*Math.sin((p.life/1000)*6));
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha*0.75})`;
        ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${Math.min(92, p.light+12)}%, ${alpha*0.10})`;
        ctx.arc(p.x, p.y, r*6.0, 0, Math.PI*2);
        ctx.fill();
      }

      for(const s of shockwaves){
        const k = 1 - s.life / s.max;
        const a = clamp(k, 0, 1);
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${s.hue}, ${s.sat}%, ${s.light}%, ${a*0.22})`;
        ctx.lineWidth = 1.5;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.stroke();
      }
    }

    function render(now){
      const tt = (now - t0)/1000;
      const dt = clamp((now - lastNow) / 1000, 0, 0.05);
      lastNow = now;

      drawBackground(tt);
      updateAndDrawStars(tt, dt);
      drawProgressConstellation(tt);
      updateParticles(dt);
      drawParticleConnections();
      drawParticles();
      requestAnimationFrame(render);
    }

    function onMove(e){
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.has = true;
    }

    // Bridge: Energy actions + progress updates + celebrations
    window.addEventListener("ev:energy", (e)=>{
      const d = e?.detail || {};
      const type = String(d.type || "");
      const preset = ENERGY_PRESETS[type] || { hue: 260, sat: 92, light: 70 };
      const x = Number(d.x ?? (w/2));
      const y = Number(d.y ?? (h*0.25));
      spawnBurst(x, y, preset, 1.0);
      spawnShockwave(x, y, preset.hue, preset.sat, preset.light);
    });

    window.addEventListener("ev:progress", (e)=>{
      const list = e?.detail?.unlocked;
      if (Array.isArray(list)) setUnlocked(list);
    });

    window.addEventListener("ev:insightUnlocked", (e)=>{
      const id = e?.detail?.id;
      if (!id) return;
      unlocked.add(String(id));
      spawnCelebrateInsight(id);
    });

    // Boot state
    readProgress();
    window.addEventListener("resize", resize, { passive:true });
    window.addEventListener("mousemove", onMove, { passive:true });
    window.addEventListener("touchmove", (e)=>{
      if (!e.touches || !e.touches[0]) return;
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.has = true;
    }, { passive:true });

    resize();
    requestAnimationFrame(render);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();
