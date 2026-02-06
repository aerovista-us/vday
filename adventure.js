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
  const TOTAL_INSIGHTS = 9;
  const PROG_KEY = "echoverseProgress";
  const NOTES_KEY = "echoverseNotes_v1";
  const STATS_KEY = "echoverseStats_v1"; // Completion times, attempts, etc.
  const modal = $("#questModal");
  const qTitle = $("#questTitle");
  const qDesc = $("#questDesc");
  const qStage = $("#questStage");
  const qStatus = $("#questStatus");
  const qClose = $("#questClose");
  const qReset = $("#questReset");
  const qComplete = $("#questComplete");
  const qNext = $("#questNext");
  const qGo = $("#questGo");
  const qBanner = $("#questBanner");
  const qSigil = $("#questSigil");
  const qKicker = $("#questKicker");
  const qSceneText = $("#questSceneText");
  const qNotes = $("#questNotes");
  const qNoteStatus = $("#questNoteStatus");
  const qNoteClear = $("#questNoteClear");
  const qSignalChip = $("#questSignalChip");
  const qTrackChip = $("#questTrackChip");

  const continueBtn = $("#continueBtn");
  const nextHint = $("#nextHint");

  const sceneFx = { a1: "", a2: "" };

  let activeInsight = null;
  let cleanupQuest = null;
  let lastFocus = null;
  const activeCleanups = new Set();
  let questSetupInProgress = false;
  let notes = (() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      const obj = JSON.parse(raw || "{}");
      if (!obj || typeof obj !== "object") return {};
      const out = {};
      for (const k of Object.keys(obj)){
        const v = obj[k];
        if (typeof v === "string") out[String(k)] = v;
        else if (v && typeof v.text === "string") out[String(k)] = v.text;
      }
      return out;
    } catch {
      return {};
    }
  })();
  let noteSaveTimer = 0;

  function openModal(){
    if (!modal) return;
    const wasOpen = modal.classList.contains("open");
    if (!wasOpen) lastFocus = document.activeElement;
    document.documentElement.classList.add("ev-modal-open");
    document.body.classList.add("ev-modal-open");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (!wasOpen){
      requestAnimationFrame(() => {
        const target = qClose || modal.querySelector("[role='dialog']") || modal;
        target?.focus?.();
      });
    }
  }
  function closeModal(){
    if (!modal) return;
    flushNoteDebounce();
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("ev-modal-open");
    document.body.classList.remove("ev-modal-open");
    clearStage(); // This will run all cleanups
    activeInsight = null;
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }


  function setStatus(msg){
    if (!qStatus) return;
    qStatus.textContent = msg || "";
    qStatus.style.color = '';
  }

  function handleQuestError(error, context){
    console.error(`Quest error in ${context}:`, error);
    
    // Show user-friendly message
    const errorMsg = getErrorMessage(error);
    setStatus(`Something went wrong. ${errorMsg}`);
    if (qStatus) qStatus.style.color = 'var(--accent3)';
    
    // Log for debugging (could send to analytics)
    if (window.evAnalytics) {
      try {
        window.evAnalytics.track('quest_error', {
          context,
          error: error.message,
          stack: error.stack
        });
      } catch {}
    }
  }

  function getErrorMessage(error){
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      return 'Storage is full. Please clear some space.';
    }
    if (error.name === 'TypeError') {
      return 'Quest interaction failed. Try refreshing.';
    }
    return 'An unexpected error occurred.';
  }
  function setCompleteEnabled(on){
    if (!qComplete) return;
    qComplete.disabled = !on;
    qComplete.style.opacity = on ? "1" : ".55";
    qComplete.style.cursor = on ? "pointer" : "not-allowed";
  }
  function clearStage(){
    // Run all active cleanups
    activeCleanups.forEach(fn => { 
      try { fn(); } catch(_e) {} 
    });
    activeCleanups.clear();
    
    if (cleanupQuest) { 
      try{ cleanupQuest(); }catch(_e){} 
    }
    cleanupQuest = null;
    if (qStage) qStage.innerHTML = "";
    setStatus("");
    if (qComplete) {
      qComplete.textContent = "Complete Quest";
      qComplete.style.display = "";
    }
    setCompleteEnabled(false);
    if (qReset) qReset.style.display = "none";
    if (qNext) qNext.style.display = "none";
  }

  function unlockedCount(){
    try { return $$(".insight.unlocked").length; } catch { return 0; }
  }

  function renderQuestHud(){
    try{
      if (!qSignalChip) return;
      const id = activeId();
      const total = TOTAL_INSIGHTS;
      const n = unlockedCount();
      const isUnlocked = !!id && !!activeInsight && activeInsight.classList.contains("unlocked");
      qSignalChip.textContent =
        `Signal ${id || "—"}/${total} • Constellation ${n}/${total}` + (isUnlocked ? " • Unlocked" : "");

      if (!qTrackChip) return;
      const raw = activeInsight ? String($(".connect", activeInsight)?.textContent || "").trim() : "";
      const txt = raw.replace(/^🎵\\s*/, "").replace(/^Track Connection:\\s*/i, "Track: ");
      if (txt){
        qTrackChip.style.display = "inline-flex";
        qTrackChip.textContent = txt;
      } else {
        qTrackChip.style.display = "none";
      }
    } catch {
      // ignore
    }
  }

  function activeId(){
    try { return String(activeInsight?.dataset?.insight || ""); }
    catch { return ""; }
  }

  function persistNotes(){
    try { 
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); 
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('Storage quota exceeded for notes');
        showStorageWarning('notes');
      }
    }
  }

  function showStorageWarning(type){
    // Show user-friendly warning
    const msg = type === 'notes' 
      ? 'Storage is full. Your notes may not be saved. Consider clearing old data or exporting your progress.'
      : 'Storage is full. Your progress may not be saved. Consider clearing old data.';
    if (qStatus) {
      const prev = qStatus.textContent;
      qStatus.textContent = msg;
      qStatus.style.color = 'var(--accent3)';
      setTimeout(() => {
        if (qStatus) {
          qStatus.textContent = prev;
          qStatus.style.color = '';
        }
      }, 5000);
    }
  }

  function ensureNoteBadge(card){
    if (!card) return;
    if (card.querySelector(".noteBadge")) return;
    const el = document.createElement("div");
    el.className = "noteBadge";
    el.textContent = "📝";
    el.setAttribute("aria-hidden", "true");
    card.appendChild(el);
  }

  function refreshNoteBadges(){
    $$(".insight").forEach(card=>{
      ensureNoteBadge(card);
      const id = String(card.dataset.insight || "");
      const text = String(notes[id] || "");
      const has = text.trim().length > 0;
      card.classList.toggle("has-note", has);
      if (has){
        const snippet = text.trim().replace(/\s+/g, " ");
        card.title = snippet.length > 110 ? (snippet.slice(0, 110) + "…") : snippet;
      } else if (card.title) {
        card.title = "";
      }
    });
  }

  function notePrompt(id){
    const q = QUESTS[String(id)] || {};
    return String(q.prompt || "What did you notice?");
  }

  function loadNoteUI(){
    if (!qNotes) return;
    const id = activeId();
    if (!id) return;
    qNotes.placeholder = notePrompt(id);
    const val = String(notes[id] || "");
    qNotes.value = val;
    if (qNoteStatus) qNoteStatus.textContent = val.trim() ? "Saved on this device." : "Optional. Saved on this device.";
  }

  function saveNoteNow(){
    if (!qNotes) return;
    const id = activeId();
    if (!id) return;
    const text = String(qNotes.value || "").slice(0, 1400);
    const trimmed = text.trim();
    if (trimmed) notes[id] = text;
    else delete notes[id];
    persistNotes();
    refreshNoteBadges();
    if (qNoteStatus) qNoteStatus.textContent = trimmed ? "Saved on this device." : "Cleared.";
  }

  function scheduleNoteSave(){
    if (!qNotes) return;
    if (noteSaveTimer) { try { clearTimeout(noteSaveTimer); } catch {} }
    if (qNoteStatus) qNoteStatus.textContent = "Saving…";
    noteSaveTimer = setTimeout(() => {
      noteSaveTimer = 0;
      saveNoteNow();
    }, 260);
  }

  function flushNoteDebounce(){
    if (!noteSaveTimer) return;
    try { clearTimeout(noteSaveTimer); } catch {}
    noteSaveTimer = 0;
    saveNoteNow();
  }

  function getNextLockedId(){
    for (let i = 1; i <= TOTAL_INSIGHTS; i++){
      const card = $(`.insight[data-insight="${i}"]`);
      if (!card) continue;
      if (!card.classList.contains("unlocked")) return String(i);
    }
    return "";
  }

  function updateNextUp(){
    const nextId = getNextLockedId();
    $$(".insight").forEach(card=>{
      const id = String(card.dataset.insight || "");
      card.classList.toggle("next-up", !!nextId && id === nextId);
    });

    if (continueBtn){
      if (nextId){
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue Journey";
      } else {
        continueBtn.disabled = true;
        continueBtn.textContent = "Journey Complete";
      }
    }

    if (nextHint){
      if (nextId){
        const card = $(`.insight[data-insight="${nextId}"]`);
        const name = $(".iname", card)?.textContent?.trim() || `Signal ${nextId}`;
        nextHint.textContent = `Next up: ${name}`;
      } else {
        nextHint.textContent = "Constellation complete. Replay any Signal or reset to begin again.";
      }
    }
  }

  function updateModalNext(){
    if (!qNext) return;
    if (!modal || !modal.classList.contains("open")) { qNext.style.display = "none"; return; }
    const curId = activeId();
    const curUnlocked = !!curId && activeInsight?.classList.contains("unlocked");
    if (!curUnlocked) { qNext.style.display = "none"; return; }
    const nextId = getNextLockedId();
    if (!nextId || nextId === curId) { qNext.style.display = "none"; return; }
    qNext.style.display = "inline-flex";
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
      scene: "Three sparks jitter on the edge of form. When you lock the triangle, the whole field steadies.",
      prompt: "What shifted when the shape finally held?",
      tip: "Move slow; snapping happens near the center of the glow.",
      a1: "#ff2bd6",
      a2: "#26e6ff",
      paths: [
        { d: "M60 34 L85 79 L35 79 Z", delay: 0.0, width: 4.2 },
        { d: "M60 44 L76 73 L44 73 Z", delay: 0.08, width: 3.2 }
      ]
    },
    "2": {
      kicker: "Worldview Signal",
      scene: "Old maps crack. Rotate the fragments until the lens clicks into one clear circle.",
      prompt: "Which old map are you releasing?",
      tip: "Every tap turns 90°. Align arcs first; details follow.",
      a1: "#26e6ff",
      a2: "#ffffff",
      paths: [
        { d: "M60 34 A26 26 0 1 1 59.9 34", delay: 0.0, width: 3.8, opacity: 0.9 },
        { d: "M60 34 L60 86", delay: 0.12, width: 3.2, opacity: 0.85 },
        { d: "M34 60 L86 60", delay: 0.22, width: 3.2, opacity: 0.85 }
      ]
    },
    "3": {
      kicker: "Energy Field Signal",
      scene: "Reality is living field. Tune the frequency until the aura stabilizes—then hold steady as it locks.",
      prompt: "Where do you feel the energy field most clearly right now?",
      tip: "Stay within ±2 Hz for one full second.",
      a1: "#ffcc66",
      a2: "#ff2bd6",
      paths: [
        { d: "M24 62 C34 44 46 80 60 62 C74 44 86 80 96 62", delay: 0.0, width: 4.0 },
        { d: "M24 72 C34 54 46 90 60 72 C74 54 86 90 96 72", delay: 0.10, width: 3.2 }
      ]
    },
    "4": {
      kicker: "Control Pattern Signal",
      scene: "A hook tries to harvest your attention. Wait for the anomaly, then break the pattern—clean, not frantic.",
      prompt: "What control pattern hooks you most often?",
      tip: "Don’t chase. Let the anomaly appear, then strike once.",
      a1: "#6bffb0",
      a2: "#26e6ff",
      paths: [
        { d: "M44 44 H76 V76 H44 Z", delay: 0.0, width: 3.8 },
        { d: "M44 60 H76", delay: 0.12, width: 3.2, opacity: 0.85 },
        { d: "M60 44 V76", delay: 0.22, width: 3.2, opacity: 0.85 }
      ]
    },
    "5": {
      kicker: "Inner Connection Signal",
      scene: "Power returns when you reconnect inside. Hold to kindle the green ember—steady hands, quiet mind.",
      prompt: "What clean source recharges you fastest?",
      tip: "Hold until it’s lit. Releasing early resets.",
      a1: "#ff7a18",
      a2: "#ffcc66",
      paths: [
        { d: "M60 34 A26 26 0 1 1 59.9 34", delay: 0.0, width: 3.6, opacity: 0.9 },
        { d: "M60 44 C54 52 54 62 60 68 C66 62 66 52 60 44 Z", delay: 0.12, width: 3.6 }
      ]
    },
    "6": {
      kicker: "Clearing Signal",
      scene: "Old cords keep the field heavy. Swipe to sever the rope—no receipts, no debate, clean cut.",
      prompt: "What cord are you cutting clean today?",
      tip: "Big horizontal swipes cut. Small scratches don’t.",
      a1: "#ffcc66",
      a2: "#2b6bff",
      paths: [
        { d: "M38 38 L82 82", delay: 0.0, width: 4.4 },
        { d: "M82 38 L38 82", delay: 0.08, width: 4.4 },
        { d: "M34 60 L86 60", delay: 0.18, width: 2.8, opacity: 0.8 }
      ]
    },
    "7": {
      kicker: "Synchronicity Signal",
      scene: "A sign flickers at the edge of your vision. Ignite it, then stay inside the ring—steady beats speed.",
      prompt: "What sign keeps repeating lately?",
      tip: "Ignite first, then keep your touch inside the ring for 3 seconds.",
      a1: "#ff4fd8",
      a2: "#7dffdf",
      paths: [
        { d: "M60 32 L66 50 L84 50 L69 61 L74 78 L60 68 L46 78 L51 61 L36 50 L54 50 Z", delay: 0.0, width: 3.6, opacity: 0.95 },
        { d: "M34 74 C46 60 52 90 60 74 C68 60 74 90 86 74", delay: 0.14, width: 3.0, opacity: 0.85 }
      ]
    },
    "8": {
      kicker: "Uplift Signal",
      scene: "Lifting others lifts you too. Choose one message, then send it clean—no strings, no performance.",
      prompt: "Who could use a small uplift right now?",
      tip: "Pick one message. Hold to send; releasing early fades.",
      a1: "#7dffdf",
      a2: "#ffcc66",
      paths: [
        { d: "M60 84 C44 76 34 64 34 52 C34 44 40 38 48 38 C54 38 58 42 60 46 C62 42 66 38 72 38 C80 38 86 44 86 52 C86 64 76 76 60 84 Z", delay: 0.0, width: 3.7 },
        { d: "M60 32 V44", delay: 0.14, width: 3.0, opacity: 0.85 }
      ]
    },
    "9": {
      kicker: "Co‑Creation Signal",
      scene: "The future forms through synchronized attention. Watch the glyph, then assemble it—one clean step at a time.",
      prompt: "What would you build with clean exchange?",
      tip: "Watch once. Then tap in order. If you miss, breathe and restart.",
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

  function stageBurstForEl(el){
    if (!el) return;
    try{
      const r = el.getBoundingClientRect();
      stageBurstAt(r.left + r.width / 2, r.top + r.height / 2);
    } catch {
      // ignore
    }
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

  // Touch event validation helper
  function isValidTouch(e) {
    // Ignore multi-touch
    if (e.touches && e.touches.length > 1) return false;
    // Ignore if target is not the quest stage or its children
    if (!qStage || !qStage.contains(e.target)) return false;
    return true;
  }

  // Touch delay to prevent accidental triggers
  let lastTouchTime = 0;
  const TOUCH_DELAY = 100; // ms

  function shouldProcessTouch() {
    const now = Date.now();
    if (now - lastTouchTime < TOUCH_DELAY) {
      return false;
    }
    lastTouchTime = now;
    return true;
  }

  // Ambient click feedback while the modal is open.
  qStage?.addEventListener("pointerdown", (e)=>{
    try{
      if (!modal || !modal.classList.contains("open")) return;
      if (!isValidTouch(e)) return;
      stageBurstAt(e.clientX, e.clientY);
    } catch (err) {
      handleQuestError(err, 'ambient_click');
    }
  }, { passive: true });

  
  // Gate 1 — Align the Sparks (drag 3 sparks into glowing triangle)
  // This is a true drag-and-drop puzzle (no manual complete).
  function buildGate1AlignSparksQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="g1-puzzle" role="application" aria-label="Align the sparks puzzle">
        <div class="g1-target" aria-hidden="true"></div>
        <div class="g1-orb" data-orb="1" style="left: 10%; top: 70%;" aria-label="Spark 1 - Drag into triangle" role="button" tabindex="0"></div>
        <div class="g1-orb" data-orb="2" style="left: 70%; top: 75%;" aria-label="Spark 2 - Drag into triangle" role="button" tabindex="0"></div>
        <div class="g1-orb" data-orb="3" style="left: 45%; top: 20%;" aria-label="Spark 3 - Drag into triangle" role="button" tabindex="0"></div>
        <p class="g1-hint">Drag the three sparks into the glowing triangle. Let the shape settle. Use arrow keys for keyboard navigation.</p>
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

      // auto-complete after a short delay (increased for better UX)
      setTimeout(() => {
        if (!activeInsight) return;
        activeInsight.classList.add("unlocked");
        saveProgress();
        emitInsightUnlocked(activeInsight.dataset.insight || "1");
        closeModal();
      }, 1200);
    }

    function checkSolved(){
      const targetRect = rect(target);
      const insideCount = orbs.filter(orb => isOrbInsideTarget(rect(orb), targetRect)).length;
      const allInside = insideCount === 3;
      
      if (allInside) {
        completeGate1();
      } else {
        // Show progress
        if (insideCount > 0) {
          setStatus(`Place all three sparks. (${insideCount}/3)`);
          // Small celebration for each orb placed
          orbs.forEach((orb, i) => {
            if (isOrbInsideTarget(rect(orb), targetRect) && !orb.dataset.celebrated) {
              orb.dataset.celebrated = 'true';
              stageBurstForEl(orb);
            }
          });
        } else {
          setStatus("Place all three sparks.");
        }
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

  function buildLensRotateQuest(){
    if (!qStage) return ()=>{};
    const base = [0, -90, 90, 180];
    const pickTurn = ()=> [0, 90, 180, 270][Math.floor(Math.random() * 4)];
    const rots = [0, 1, 2, 3].map(() => pickTurn());
    if (rots.every(r => r === 0)) rots[0] = 90;

    let celebrated = false;
    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Rebuild the lens by rotating fragments (90° per tap). When all four lock, the worldview widens.</div>
      <div class="qlensWrap">
        <div class="qlens" id="lensGrid" role="group" aria-label="Lens fragments - Tap to rotate each piece 90 degrees"></div>
        <div class="qrow" style="margin-top:10px; justify-content:space-between; align-items:center">
          <span class="qchip">Aligned: <span id="aligned" class="mono">0</span>/4</span>
          <span class="qchip">Tap to rotate</span>
        </div>
      </div>
    `;

    const grid = $("#lensGrid", qStage);
    const alignedEl = $("#aligned", qStage);
    if (!grid) return ()=>{};

    const pieceSvg = `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M80 0 A80 80 0 0 0 0 80" fill="none" stroke="currentColor" stroke-width="6" opacity=".62" stroke-linecap="round"/>
        <path d="M28 28 L90 90" fill="none" stroke="currentColor" stroke-width="4" opacity=".85" stroke-linecap="round"/>
        <circle cx="30" cy="30" r="3.5" fill="currentColor" opacity=".78"/>
      </svg>
    `;

    const pieces = rots.map((rot, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lensPiece";
      btn.setAttribute("aria-label", `Rotate fragment ${i + 1}`);
      btn.dataset.i = String(i);
      btn.style.setProperty("--base", `${base[i]}deg`);
      btn.style.setProperty("--rot", `${rot}deg`);
      btn.innerHTML = `<span class="frag" aria-hidden="true">${pieceSvg}</span>`;
      grid.appendChild(btn);
      return btn;
    });

    const norm = (deg) => {
      const n = ((deg % 360) + 360) % 360;
      const snapped = Math.round(n / 90) * 90;
      return ((snapped % 360) + 360) % 360;
    };
    const getRot = (el) => {
      const v = String(el.style.getPropertyValue("--rot") || "0").trim().replace("deg", "");
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const setRot = (el, deg) => el.style.setProperty("--rot", `${norm(deg)}deg`);

    function render(){
      const aligned = pieces.filter(p => norm(getRot(p)) === 0).length;
      if (alignedEl) alignedEl.textContent = String(aligned);
      if (aligned >= 4){
        pieces.forEach(p => p.classList.add("solved"));
        if (!celebrated) { 
          celebrated = true; 
          celebrateStage(); 
        }
        setStatus("Lens rebuilt. A wider view appears. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        pieces.forEach(p => {
          const isAligned = norm(getRot(p)) === 0;
          p.classList.toggle("solved", isAligned);
          // Remove solved class if not aligned
          if (!isAligned) p.classList.remove("solved");
        });
        if (aligned > 0) {
          setStatus(`Rotate fragments until the lens aligns. (${aligned}/4 aligned)`);
        } else {
          setStatus("Rotate fragments until the lens aligns.");
        }
        setCompleteEnabled(false);
      }
    }

    function onRotate(e){
      const btn = e.currentTarget;
      const oldRot = getRot(btn);
      setRot(btn, oldRot + 90);
      stageBurstAt(e.clientX, e.clientY);
      
      // Small celebration when piece aligns
      if (norm(getRot(btn)) === 0 && norm(oldRot) !== 0) {
        stageBurstForEl(btn);
      }
      
      render();
    }
    pieces.forEach(p => p.addEventListener("click", onRotate));

    render();
    return ()=> { pieces.forEach(p => p.removeEventListener("click", onRotate)); };
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
    let wasOk = false;
    let celebrated = false;

    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Tune the dial until the aura stabilizes, then hold steady for 1 full second.</div>
      <div class="qdial" role="group" aria-label="Frequency tuning">
        <div class="qrow" style="justify-content:space-between; margin-bottom:8px">
          <div class="qchip">Target: <span class="mono">${target}</span> Hz</div>
          <div class="qchip">Current: <span id="currentHz" class="mono" aria-live="polite">70</span> Hz</div>
        </div>
        <input id="dial" type="range" min="40" max="110" value="70" aria-label="Frequency dial" aria-valuemin="40" aria-valuemax="110" aria-valuenow="70" />
        <div class="qrow" style="margin-top:8px; gap:8px">
          <button class="qbtn" id="fineDown" type="button" aria-label="Decrease frequency by 1 Hz">-1</button>
          <div class="qprogress" style="flex:1" role="progressbar" aria-label="Lock progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="lockFill"></div></div>
          <button class="qbtn" id="fineUp" type="button" aria-label="Increase frequency by 1 Hz">+1</button>
        </div>
      </div>
    `;
    const dial = $("#dial", qStage);
    const fill = $("#lockFill", qStage);
    const currentHz = $("#currentHz", qStage);
    const fineDown = $("#fineDown", qStage);
    const fineUp = $("#fineUp", qStage);

    // Fine adjustment buttons
    fineDown?.addEventListener("click", () => {
      dial.value = Math.max(40, Number(dial.value) - 1);
      dial.dispatchEvent(new Event("input"));
    });
    fineUp?.addEventListener("click", () => {
      dial.value = Math.min(110, Number(dial.value) + 1);
      dial.dispatchEvent(new Event("input"));
    });

    // Update current value display
    dial?.addEventListener("input", () => {
      const val = String(dial.value);
      if (currentHz) {
        currentHz.textContent = val;
        currentHz.setAttribute('aria-label', `Current frequency: ${val} Hz`);
      }
      dial.setAttribute('aria-valuenow', val);
    });

    let gracePeriod = 0;
    function step(ts){
      if (!last) last=ts;
      const dt = (ts-last)/1000; last=ts;
      const v = Number(dial.value);
      const ok = Math.abs(v - target) <= 2;
      if (ok && !wasOk) {
        stageBurstForEl(dial);
        gracePeriod = 0.2; // Grace period when entering range
      }
      wasOk = ok;
      
      if (ok) {
        hold = Math.min(1, hold + dt/1.0);
        gracePeriod = 0.2; // Reset grace period while in range
      } else {
        // Use grace period before decay starts
        if (gracePeriod > 0) {
          gracePeriod = Math.max(0, gracePeriod - dt);
        } else {
          hold = Math.max(0, hold - dt/1.5); // Slower decay (was 0.7s, now 1.5s)
        }
      }
      if (fill) {
        const pct = Math.round(hold*100);
        fill.style.width = pct + "%";
        fill.parentElement?.setAttribute('aria-valuenow', String(pct));
      }

      if (hold >= 1){
        if (!celebrated) { celebrated = true; celebrateStage(); }
        setStatus("Signal locked. Static turns into guidance.");
        setCompleteEnabled(true);
      } else {
        setStatus(ok ? "Hold steady…" : "Find the frequency.");
        setCompleteEnabled(false);
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return ()=> { 
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  }

  function buildPatternBreakQuest(){
    if (!qStage) return ()=>{};
    const goal = 3;
    let hits = 0;
    let drain = 1;
    let hot = -1;
    let running = true;
    let beatTimer = 0;
    let baseDelay = 1200; // Start at 1200ms, decrease by 50ms each hit

    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Tap the anomaly before it moves. Break the pattern three times without getting pulled into panic.</div>
      <div class="qrow qpatternMeta" style="margin-top:10px; align-items:center">
        <div class="qprogress qdrain" aria-label="Drain meter"><div id="drainFill"></div></div>
        <span class="qchip">Breaks: <span id="hits" class="mono">0</span>/${goal}</span>
      </div>
      <div class="qpattern" id="patternGrid" role="group" aria-label="Control pattern grid"></div>
    `;

    const fill = $("#drainFill", qStage);
    const hitsEl = $("#hits", qStage);
    const grid = $("#patternGrid", qStage);
    if (!grid) return ()=>{};

    const nodes = Array.from({ length: 9 }).map((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qnode";
      b.dataset.i = String(i);
      b.setAttribute("aria-label", `Node ${i + 1}`);
      b.innerHTML = `<span class="dot" aria-hidden="true"></span>`;
      grid.appendChild(b);
      return b;
    });

    function updateUI(){
      if (fill) fill.style.width = Math.round(drain * 100) + "%";
      if (hitsEl) hitsEl.textContent = String(hits);
    }

    function setHot(next){
      hot = next;
      nodes.forEach((n, i) => n.classList.toggle("hot", i === hot));
    }

    function pickHot(){
      let next = hot;
      while (next === hot) next = Math.floor(Math.random() * nodes.length);
      setHot(next);
    }

    function nextBeat(){
      if (!running) return;
      pickHot();
      // Progressive timing: start slower, get faster
      const delay = baseDelay - (hits * 50);
      beatTimer = setTimeout(() => {
        if (!running) return;
        // missed the anomaly
        drain = Math.max(0, drain - 0.22);
        if (drain <= 0){
          hits = 0;
          drain = 1;
          baseDelay = 1200; // Reset timing
          setStatus("Reset. Breathe. Break the pattern without feeding it.");
        } else {
          setStatus("Don't chase—wait, then act clean.");
        }
        updateUI();
        setCompleteEnabled(false);
        nextBeat();
      }, delay);
    }

    function complete(){
      running = false;
      try { clearTimeout(beatTimer); } catch {}
      setHot(-1);
      celebrateStage();
      setStatus("Pattern broken. You keep your power. Tap Complete to unlock.");
      setCompleteEnabled(true);
      baseDelay = 1200; // Reset for next time
    }

    function onTap(e){
      const i = Number(e.currentTarget.dataset.i);
      if (!running) return;

      if (i === hot){
        try { clearTimeout(beatTimer); } catch {}
        hits = Math.min(goal, hits + 1);
        drain = Math.min(1, drain + 0.18);
        stageBurstAt(e.clientX, e.clientY);
        updateUI();

        if (hits >= goal){
          complete();
          return;
        }

        setStatus(`Good. Break it again. (${hits}/${goal})`);
        setCompleteEnabled(false);
        nextBeat();
        return;
      }

      // wrong node - only drain, don't reduce hits as harshly
      drain = Math.max(0, drain - 0.14);
      // Don't reduce hits on wrong tap, just drain energy
      setStatus("That's the hook. Exit clean.");
      setCompleteEnabled(false);
      updateUI();
    }

    nodes.forEach(n => n.addEventListener("click", onTap));
    updateUI();
    setStatus("Tap the anomaly before it moves.");
    setCompleteEnabled(false);
    nextBeat();

    return ()=> {
      running = false;
      try { clearTimeout(beatTimer); } catch {}
      nodes.forEach(n => n.removeEventListener("click", onTap));
    };
  }

  function buildSwipeCutQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Swipe across the cord to sever it—three clean cuts. No receipts. No debate.</div>
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
      if (!r.width || !r.height) {
        // Retry after a short delay
        setTimeout(() => requestAnimationFrame(size), 100);
        return;
      }
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
          // Cut mark - more visible
          ctx.lineWidth=3;
          ctx.strokeStyle="rgba(255,255,255,.25)";
          ctx.beginPath();
          ctx.moveTo(x0+segW/2,y-24);
          ctx.lineTo(x0+segW/2,y+24);
          ctx.stroke();
          
          // Particles at cut point
          ctx.fillStyle="rgba(255,255,255,.15)";
          for(let j=0;j<5;j++){
            const angle = (Math.PI*2*j)/5;
            const px = x0+segW/2 + Math.cos(angle)*8;
            const py = y + Math.sin(angle)*8;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI*2);
            ctx.fill();
          }
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
      // must cross at least responsive threshold (screen width / 10, min 40px)
      const threshold = Math.max(40, c.getBoundingClientRect().width / 10);
      if ((maxX-minX) < threshold) return;
      const midX = (p0.x+p1.x)/2;
      const idx = segForX(midX);
      if (!cutSeg[idx]){
        cutSeg[idx]=true;
        cuts++;
        if (cutsEl) cutsEl.textContent=String(cuts);
        try{
          const cr = c.getBoundingClientRect();
          stageBurstAt(cr.left + midX, cr.top + y);
          // Add haptic feedback if supported
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        } catch {}
        draw();
        if (cuts>=3){
          celebrateStage();
          setStatus("Cord severed. You keep your power.");
          setCompleteEnabled(true);
        } else {
          setStatus(`Good cut. Keep going. (${cuts}/3)`);
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

    // Use ResizeObserver for better responsiveness
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(size);
      });
      resizeObserver.observe(qStage);
    } else {
      // Fallback to window resize
      window.addEventListener("resize", size);
    }
    
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    // Defer first layout pass until after modal paint
    requestAnimationFrame(()=>{ requestAnimationFrame(size); });
    setStatus("Swipe across each segment.");
    setCompleteEnabled(false);

    return ()=> {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", size);
      }
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }

  function buildHoldChargeQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Press and hold to ignite the green ember. Releasing early resets—steady hands.</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="holdBtn" type="button">Hold to Ignite</button>
        <span class="qchip">Ember: <span id="pct" class="mono">0</span>%</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;
    const btn=$("#holdBtn", qStage);
    const pct=$("#pct", qStage);
    const fill=$("#fill", qStage);
    let holding=false, val=0, raf=0, last=0, complete=false;
    let mark = 0;
    let gracePeriod = 0;

    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (complete) {
        val = 1;
      } else if (holding) {
        val = Math.min(1, val + dt/1.4);
        gracePeriod = 0.3; // Reset grace period while holding
      } else {
        // Use grace period before reset
        if (gracePeriod > 0) {
          gracePeriod = Math.max(0, gracePeriod - dt);
        } else {
          val = 0;
        }
      }
      const p=Math.round(val*100);
      if (pct) pct.textContent=String(p);
      if (fill) {
        fill.style.width = p+"%";
        fill.parentElement?.setAttribute('aria-valuenow', String(p));
      }
      if (!complete && holding && p >= mark + 25){
        mark = Math.min(100, Math.floor(p / 25) * 25);
        stageBurstForEl(btn);
      }
      if (!holding && !complete && p === 0 && gracePeriod === 0) mark = 0;
      if (p>=100){
        complete = true;
        holding = false;
        btn.classList.remove("active");
        btn.disabled = true;
        btn.textContent = "Lit";
        celebrateStage();
        setStatus("Ember lit. Your field stabilizes from the inside. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else if (complete){
        setStatus("Ember lit. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        setStatus(holding ? "Igniting…" : "Press and hold to ignite.");
        setCompleteEnabled(false);
      }
      raf=requestAnimationFrame(step);
    }

    function start(){
      holding=true;
      btn.classList.add("active");
      stageBurstForEl(btn);
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
    setStatus("Press and hold to ignite. Once lit, you can release and tap Complete.");
    setCompleteEnabled(false);

    return ()=>{ 
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  }

  function buildFocusRingQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Ignite the sign, then keep your touch inside the ring for 3 seconds. Don’t chase—stay steady.</div>
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
      if (!r.width || !r.height) {
        // Retry after a short delay
        setTimeout(() => requestAnimationFrame(size), 100);
        return;
      }
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
      
      // Outer ring outline for better visibility
      ctx.lineWidth=2;
      ctx.strokeStyle="rgba(255,255,255,.12)";
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r+3, 0, Math.PI*2); ctx.stroke();
      
      // Main glow ring (thicker for visibility)
      ctx.lineWidth=6;
      ctx.strokeStyle=armed ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.22)";
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI*2); ctx.stroke();

      // Inner safe zone indicator
      ctx.fillStyle="rgba(0,0,0,.10)";
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r-10, 0, Math.PI*2); ctx.fill();
      
      // Inside/outside indicator
      if (armed) {
        ctx.fillStyle = inside ? "rgba(0,255,0,.15)" : "rgba(255,0,0,.10)";
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r-8, 0, Math.PI*2); ctx.fill();
      }

      // Flame dot
      ctx.fillStyle= armed ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.22)";
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
        hold = Math.max(0, hold-dt*0.8); // Slower decay (was 1.2x)
      }
      if (secEl) secEl.textContent = hold.toFixed(1);

      if (hold>=3){
        complete = true;
        celebrateStage();
        setStatus("Sign held. The path clarifies. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        setStatus(!armed ? "Ignite the sign first." : (inside ? "Hold steady…" : "Stay inside the ring."));
        setCompleteEnabled(false);
      }
      
      // Update ring visual based on focus state
      if (armed) {
        draw();
      }
      
      raf=requestAnimationFrame(step);
    }

    ignite.addEventListener("click", (e)=>{ armed=true; hold=0; draw(); stageBurstAt(e.clientX, e.clientY); });

    function move(e){
      if (!armed) return;
      inside = inRing(pt(e));
    }
    function down(e){
      if (!armed) return;
      inside = inRing(pt(e));
      c.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function up(e){
      inside = false;
      e.preventDefault();
    }

    // Use ResizeObserver for better responsiveness
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(size);
      });
      resizeObserver.observe(qStage);
    } else {
      // Fallback to window resize
      window.addEventListener("resize", size);
    }
    
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    // Defer first layout pass until after modal paint
    requestAnimationFrame(()=>{ requestAnimationFrame(size); });
    raf=requestAnimationFrame(step);

    return ()=>{
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", size);
      }
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      if (raf) cancelAnimationFrame(raf);
    };
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
    return ()=>{ 
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
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

  function buildUpliftQuest(){
    if (!qStage) return ()=>{};
    
    // Message pool - rotate messages for variety
    const messagePool = [
      { id: "seen", text: "I see you. Keep going." },
      { id: "steady", text: "You're doing better than you think." },
      { id: "breath", text: "Breathe. One small step is enough." },
      { id: "light", text: "Your light matters more than you know." },
      { id: "strength", text: "You have more strength than this moment." },
      { id: "path", text: "The path appears as you walk it." },
      { id: "present", text: "You're exactly where you need to be." },
      { id: "growth", text: "Growth happens in the quiet moments." },
      { id: "connection", text: "You're not alone in this." }
    ];
    
    // Pick 3 random messages
    const shuffled = [...messagePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    
    const messagesHtml = selected.map(m => 
      `<button class="qbtn qmsg" data-msg="${m.id}" type="button" aria-pressed="false">${m.text}</button>`
    ).join('');
    
    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Choose a message that brightens a stranger, then hold Send to release it clean.</div>
      <div class="qmsgGrid" style="margin-top:10px">
        ${messagesHtml}
      </div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="send" type="button" disabled>Hold to Send</button>
        <span class="qchip">Send <span id="pct" class="mono">0</span>%</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;

    let chosen = "";
    const buttons = $$("[data-msg]", qStage);
    const send = $("#send", qStage);
    const pct = $("#pct", qStage);
    const fill = $("#fill", qStage);
    if (!send) return ()=>{};

    function select(btn){
      buttons.forEach(b => {
        b.classList.remove("primary");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("primary");
      btn.setAttribute("aria-pressed", "true");
      chosen = String(btn.dataset.msg || "");
      send.disabled = false;
      stageBurstForEl(btn);
      setStatus("Message chosen. Hold Send to release it clean.");
      setCompleteEnabled(false);
    }
    buttons.forEach(btn => btn.addEventListener("click", () => select(btn)));

    let holding = false;
    let val = 0;
    let raf = 0;
    let last = 0;
    let complete = false;

    function step(ts){
      if (!last) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;

      if (complete) {
        val = 1;
      } else if (holding) {
        val = Math.min(1, val + dt / 1.3); // Longer hold time (was 0.9s, now 1.3s)
      } else {
        val = Math.max(0, val - dt * 1.8);
      }

      const p = Math.round(val * 100);
      if (pct) pct.textContent = String(p);
      if (fill) {
        fill.style.width = p + "%";
        fill.parentElement?.setAttribute('aria-valuenow', String(p));
      }

      if (p >= 100){
        complete = true;
        holding = false;
        send.disabled = true;
        send.textContent = "Sent";
        celebrateStage();
        setStatus("Sent. The field lifts. Tap Complete to unlock.");
        setCompleteEnabled(true);
      } else {
        if (!chosen) setStatus("Pick a message.");
        else setStatus(holding ? "Sending…" : "Hold Send to release it clean.");
        setCompleteEnabled(false);
      }

      raf = requestAnimationFrame(step);
    }

    function down(e){
      if (!chosen || complete) return;
      holding = true;
      send.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function up(e){ holding = false; e.preventDefault(); }

    send.addEventListener("pointerdown", down);
    send.addEventListener("pointerup", up);
    send.addEventListener("pointercancel", up);

    raf = requestAnimationFrame(step);
    setStatus("Pick a message.");
    setCompleteEnabled(false);

    return ()=>{ 
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  }

  function buildSequenceQuest(){
    if (!qStage) return ()=>{};
    const pool=[Sigils.triad,Sigils.wave,Sigils.cord,Sigils.ring,Sigils.flame,Sigils.eye,Sigils.twin];
    const seq=[0,0,0,0].map(()=> Math.floor(Math.random()*pool.length));
    let idx=0;
    qStage.innerHTML = `
      <div class="qhelp"><b>Objective:</b> Watch the glyph, then assemble it. Tap the sigils in order.</div>
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
      setTimeout(()=>sigEls[i].classList.remove("active"), 300);
    }
    
    let replayCount = 0;
    const maxReplays = 2;
    
    function playSequence(){
      let t=0;
      // Slower timing for better visibility (was 520ms, now 650ms)
      seq.forEach((s, k)=>{ 
        setTimeout(()=>flash(s), 400 + k*650); 
        t=400 + k*650; 
      });
      setTimeout(()=>setStatus("Your turn."), t+650);
    }
    
    // Play sequence initially
    playSequence();
    
    // Add replay button
    const replayBtn = document.createElement("button");
    replayBtn.className = "qbtn";
    replayBtn.type = "button";
    replayBtn.textContent = `Watch Again (${maxReplays - replayCount} left)`;
    replayBtn.style.marginTop = "10px";
    replayBtn.disabled = replayCount >= maxReplays;
    replayBtn.addEventListener("click", () => {
      if (replayCount >= maxReplays) return;
      replayCount++;
      replayBtn.textContent = `Watch Again (${maxReplays - replayCount} left)`;
      replayBtn.disabled = replayCount >= maxReplays;
      setStatus("Watch again…");
      setTimeout(playSequence, 200);
    });
    qStage.appendChild(replayBtn);

    function onTap(e){
      const el=e.currentTarget;
      const i=Number(el.dataset.i);
      if (i === seq[idx]){
        idx++;
        if (stepEl) stepEl.textContent=String(idx);
        flash(i);
        stageBurstForEl(el);
        if (idx>=4){
          celebrateStage();
          setStatus("Pattern complete. You stay in the flow.");
          setCompleteEnabled(true);
        } else {
          setStatus("Good. Next.");
          setCompleteEnabled(false);
        }
      } else {
        idx=0;
        if (stepEl) stepEl.textContent="0";
        // Show "almost" feedback if close
        if (idx > 0) {
          setStatus(`Almost! You got ${idx} right. Breathe, then try again.`);
        } else {
          setStatus("Reset. Breathe, then try again.");
        }
        setCompleteEnabled(false);
      }
    }
    sigEls.forEach(el=>el.addEventListener("click", onTap));

    setStatus("Watch first…");
    setCompleteEnabled(false);

    return ()=>{ sigEls.forEach(el=>el.removeEventListener("click", onTap)); };
  }

  function setupQuest(insightId){
    // Prevent race conditions
    if (questSetupInProgress) {
      console.warn('Quest setup already in progress, ignoring');
      return;
    }
    
    questSetupInProgress = true;
    
    try {
      clearStage();
      const id = String(insightId || "");
      applyQuestScene(id);
      renderQuestHud();
      const unlocked = activeInsight?.classList.contains("unlocked");
      if (unlocked){
        setStatus("Already unlocked. You can reset this Signal if you want to replay it.");
        if (qComplete) qComplete.textContent = "Completed ✓";
        setCompleteEnabled(false);
        if (qReset) qReset.style.display = "inline-flex";
        updateModalNext();
        return;
      }
      try {
        // Increment attempt counter when quest starts
        if (!unlocked) {
          incrementAttempt(id);
        }
        
        switch(id){
          case "1": cleanupQuest = buildGate1AlignSparksQuest(); break;
          case "2": cleanupQuest = buildLensRotateQuest(); break;
          case "3": cleanupQuest = buildTuneQuest(); break;
          case "4": cleanupQuest = buildPatternBreakQuest(); break;
          case "5": cleanupQuest = buildHoldChargeQuest(); break;
          case "6": cleanupQuest = buildSwipeCutQuest(); break;
          case "7": cleanupQuest = buildFocusRingQuest(); break;
          case "8": cleanupQuest = buildUpliftQuest(); break;
          case "9": cleanupQuest = buildSequenceQuest(); break;
          default:
            setStatus("Tap Complete when you're ready.");
            setCompleteEnabled(true);
        }
      } catch (err) {
        handleQuestError(err, `setup_quest_${id}`);
        setStatus("Quest failed to load. Try refreshing.");
        setCompleteEnabled(false);
      }
      
      // Register cleanup if provided
      if (cleanupQuest) {
        activeCleanups.add(cleanupQuest);
      }
    } finally {
      questSetupInProgress = false;
    }
  }

  // Load quest statistics
  let questStats = (() => {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      const obj = JSON.parse(raw || "{}");
      if (!obj || typeof obj !== "object") return {};
      return obj;
    } catch {
      return {};
    }
  })();

  function saveQuestStat(questId, statType, value) {
    try {
      const id = String(questId);
      if (!questStats[id]) questStats[id] = {};
      questStats[id][statType] = value;
      questStats[id].lastUpdated = Date.now();
      localStorage.setItem(STATS_KEY, JSON.stringify(questStats));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('Storage quota exceeded for stats');
      }
    }
  }

  function getQuestStat(questId, statType) {
    try {
      return questStats[String(questId)]?.[statType];
    } catch {
      return null;
    }
  }

  function incrementAttempt(questId) {
    const current = getQuestStat(questId, 'attempts') || 0;
    saveQuestStat(questId, 'attempts', current + 1);
  }

  function saveProgress(){
    try {
      const unlocked = $$(".insight.unlocked").map(card => card.dataset.insight);
      localStorage.setItem(PROG_KEY, JSON.stringify(unlocked));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('Storage quota exceeded for progress');
        showStorageWarning('progress');
      }
    }
  }
  function emitProgressUpdate(){
    try{
      const unlocked = $$(".insight.unlocked")
        .map(card => String(card.dataset.insight || ""))
        .filter(Boolean);
      window.dispatchEvent(new CustomEvent("ev:progress", { detail: { unlocked } }));
      const pill = document.getElementById("constellationPill");
      if (pill) pill.textContent = `Constellation: ${unlocked.length}/${TOTAL_INSIGHTS}`;
      updateNextUp();
      updateModalNext();
      if (modal && modal.classList.contains("open")) renderQuestHud();
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
    try {
      const raw = localStorage.getItem(PROG_KEY);
      if (!raw) return;
      
      const unlocked = JSON.parse(raw);
      
      // Validate data structure
      if (!Array.isArray(unlocked)) {
        console.warn('Invalid progress format, resetting');
        try {
          localStorage.setItem(PROG_KEY + '_corrupted_backup_' + Date.now(), raw);
        } catch {}
        localStorage.removeItem(PROG_KEY);
        return;
      }
      
      // Validate quest IDs
      const validIds = unlocked.filter(id => {
        const num = Number(id);
        return Number.isInteger(num) && num >= 1 && num <= TOTAL_INSIGHTS;
      });
      
      // Only use valid IDs
      validIds.forEach(id => {
        const card = $(`.insight[data-insight="${id}"]`);
        if (card) card.classList.add("unlocked");
      });
      
      // If data was corrupted, save cleaned version
      if (validIds.length !== unlocked.length) {
        saveProgress(); // Save cleaned data
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
      // Backup corrupted data before clearing
      try {
        const raw = localStorage.getItem(PROG_KEY);
        if (raw) {
          localStorage.setItem(PROG_KEY + '_corrupted_backup_' + Date.now(), raw);
        }
      } catch {}
      try {
        localStorage.removeItem(PROG_KEY);
      } catch {}
    }
  }

  loadProgress();
  refreshNoteBadges();
  updateNextUp();
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
      try {
        flushNoteDebounce();
        activeInsight = card;
        const name = $(".iname", card)?.textContent?.trim() || "Quest";
        const body = $(".ibody", card)?.textContent?.trim() || "";
        const questLine = $(".quest", card)?.textContent?.trim() || "Complete the mini-quest.";
        const objective = questLine.replace(/^Mini-Quest:\\s*/i, "").trim();
        const trackId = card.getAttribute("data-track") || "";
        const qCfg = QUESTS[String(card.dataset.insight || "")] || {};
        const questId = card.dataset.insight || "";
        
        // Show attempt count if available
        const attempts = getQuestStat(questId, 'attempts') || 0;
        const completedAt = getQuestStat(questId, 'completedAt');
        const statsLine = attempts > 0 ? `\n\nAttempts: ${attempts}${completedAt ? ` • Completed: ${new Date(completedAt).toLocaleDateString()}` : ''}` : '';

        if (qTitle) qTitle.textContent = name;
        if (qDesc) {
          const lines = [];
          if (body) lines.push(body);
          if (objective) lines.push(`Objective: ${objective}`);
          if (qCfg.tip) lines.push(`Tip: ${qCfg.tip}`);
          lines.push(trackId ? "Reward: unlock this Signal + jump to the matching track." : "Reward: unlock this Signal + jump back to the player.");
          if (statsLine) lines.push(statsLine);
          qDesc.textContent = lines.filter(Boolean).join("\n\n");
        }
        renderQuestHud();

        if (qGo){
          // Still let people jump to the player, even if the gate isn't tied to a specific track
          qGo.style.display = "inline-flex";
          qGo.dataset.track = trackId;
          qGo.textContent = trackId ? "Go to Track" : "Go to Player";
        }

        // Open first so canvas-based quests can measure correctly
        loadNoteUI();
        openModal();
        requestAnimationFrame(()=> setupQuest(questId));
      } catch (e) {
        handleQuestError(e, 'open_quest');
      }
    });
  });

  continueBtn?.addEventListener("click", ()=>{
    const nextId = getNextLockedId();
    if (!nextId) return;
    const card = $(`.insight[data-insight="${nextId}"]`);
    if (!card) return;
    try { card.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
    card.click();
  });

  qNext?.addEventListener("click", ()=>{
    const nextId = getNextLockedId();
    if (!nextId) return;
    const card = $(`.insight[data-insight="${nextId}"]`);
    if (!card) return;
    card.click();
  });

  qNotes?.addEventListener("input", scheduleNoteSave);
  qNoteClear?.addEventListener("click", ()=>{
    if (!qNotes) return;
    qNotes.value = "";
    scheduleNoteSave();
    try { qNotes.focus(); } catch {}
  });

  qClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e)=>{ if (e.target === modal) closeModal(); });
  window.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeModal(); });

  qComplete?.addEventListener("click", ()=>{
    if (qComplete?.disabled) return;
    if (!activeInsight) return;

    const questId = activeInsight.dataset.insight || "";
    const wasUnlocked = activeInsight.classList.contains("unlocked");
    if (!wasUnlocked){
      activeInsight.classList.add("unlocked");
      saveProgress();
      
      // Save completion timestamp and attempts
      saveQuestStat(questId, 'completedAt', Date.now());
      const attempts = getQuestStat(questId, 'attempts') || 0;
      saveQuestStat(questId, 'finalAttempts', attempts);
      
      emitInsightUnlocked(questId);
      setStatus("Completed. Star added to your constellation.");
    } else {
      emitProgressUpdate();
      celebrateStage();
      setStatus("Already unlocked.");
    }

    if (qReset) qReset.style.display = "inline-flex";
    if (qComplete) qComplete.textContent = "Completed ✓";
    setCompleteEnabled(false);
    updateModalNext();
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
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    try {
      localStorage.removeItem(PROG_KEY);
      localStorage.removeItem(STATS_KEY);
      $$(".insight.unlocked").forEach(el=>el.classList.remove("unlocked"));
      emitProgressUpdate();
      setStatus("All progress reset.");
    } catch (e) {
      handleQuestError(e, 'reset_all');
    }
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

    let rafId = null;
    function render(now){
      // Pause when tab is hidden to save resources
      if (document.hidden) {
        rafId = null;
        return;
      }
      
      const tt = (now - t0)/1000;
      const dt = clamp((now - lastNow) / 1000, 0, 0.05);
      lastNow = now;

      drawBackground(tt);
      updateAndDrawStars(tt, dt);
      drawProgressConstellation(tt);
      updateParticles(dt);
      drawParticleConnections();
      drawParticles();
      rafId = requestAnimationFrame(render);
    }
    
    // Handle visibility changes
    function handleVisibilityChange(){
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        if (!rafId) {
          lastNow = performance.now();
          rafId = requestAnimationFrame(render);
        }
      }
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
    document.addEventListener("visibilitychange", handleVisibilityChange, { passive:true });

    resize();
    rafId = requestAnimationFrame(render);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();
