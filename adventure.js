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
  const qStage = $("#questStage");
  const qStatus = $("#questStatus");
  const qClose = $("#questClose");
  const qReset = $("#questReset");
  const qComplete = $("#questComplete");
  const qGo = $("#questGo");

  let activeInsight = null;
  let cleanupQuest = null;

  function openModal(){
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    clearStage();
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
        <p class="g1-hint">Drag the three sparks into the glowing triangle.</p>
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
      setStatus("Triangle aligned. Gate opened.");
      setCompleteEnabled(true);

      // auto-complete after a short delay
      setTimeout(() => {
        if (!activeInsight) return;
        activeInsight.classList.add("unlocked");
        saveProgress();
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
        setStatus("Triangle aligned. Gate opened.");
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
      <div class="qhelp">Tune the dial until the signal locks. Hold it steady for 1 second.</div>
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
      <div class="qhelp">Swipe across the cord three times to sever it.</div>
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
      <div class="qhelp">Press and hold to charge the battery to 100%. Releasing early resets.</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="holdBtn" type="button">Hold to Charge</button>
        <span class="qchip">Charge: <span id="pct" class="mono">0</span>%</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;
    const btn=$("#holdBtn", qStage);
    const pct=$("#pct", qStage);
    const fill=$("#fill", qStage);
    let holding=false, val=0, raf=0, last=0;

    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (holding) val = Math.min(1, val + dt/1.4);
      else val = 0;
      const p=Math.round(val*100);
      if (pct) pct.textContent=String(p);
      if (fill) fill.style.width = p+"%";
      if (p>=100){
        setStatus("Fully charged. You generate clean energy.");
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
    setStatus("Press and hold to charge.");
    setCompleteEnabled(false);

    return ()=>{ if (raf) cancelAnimationFrame(raf); };
  }

  function buildFocusRingQuest(){
    if (!qStage) return ()=>{};
    qStage.innerHTML = `
      <div class="qhelp">Ignite the match, then keep your pointer inside the ring for 3 seconds.</div>
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

    let armed=false, inside=false, hold=0, raf=0, last=0;
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
      if (armed && inside) hold = Math.min(3, hold+dt);
      else hold = Math.max(0, hold-dt*1.2);
      if (secEl) secEl.textContent = hold.toFixed(1);

      if (hold>=3){
        setStatus("Focus achieved. Fire becomes direction.");
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
      <div class="qhelp">Press and hold the eye for 2 seconds. Stay still (no big movement).</div>
      <div class="qrow" style="margin-top:10px">
        <button class="qbtn primary" id="eyeHold" type="button" aria-label="Hold the eye">${Sigils.eye}</button>
        <span class="qchip">Stillness: <span id="still" class="mono">0.0</span>s / 2.0s</span>
      </div>
      <div class="qprogress" style="margin-top:10px"><div id="fill"></div></div>
    `;
    const btn=$("#eyeHold", qStage);
    const still=$("#still", qStage);
    const fill=$("#fill", qStage);

    let holding=false, t=0, raf=0, last=0;
    let startX=0,startY=0;
    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (holding) t = Math.min(2, t+dt);
      else t = Math.max(0, t-dt*1.3);
      if (still) still.textContent=t.toFixed(1);
      if (fill) fill.style.width = Math.round((t/2)*100)+"%";
      if (t>=2){
        setStatus("Observer mode unlocked. You notice the pattern.");
        setCompleteEnabled(true);
      } else {
        setStatus(holding ? "Hold still…" : "Press and hold.");
        setCompleteEnabled(false);
      }
      raf=requestAnimationFrame(step);
    }
    function down(e){
      holding=true; t=0;
      startX=e.clientX; startY=e.clientY;
      btn.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function move(e){
      if (!holding) return;
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
      <div class="qhelp">Bring both sliders to the same value, then tap Merge.</div>
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
      <div class="qhelp">Choose an intention. Hold to seal it.</div>
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

    let holding=false, val=0, raf=0, last=0;
    function step(ts){
      if (!last) last=ts;
      const dt=(ts-last)/1000; last=ts;
      if (holding) val = Math.min(1, val + dt/1.0);
      else val = Math.max(0, val - dt*1.8);
      const p=Math.round(val*100);
      if (pct) pct.textContent=String(p);
      if (fill) fill.style.width=p+"%";
      if (p>=100){
        setStatus("Intention sealed. Walk in alignment.");
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
      <div class="qhelp">Watch the sequence, then tap the sigils in order.</div>
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
    const unlocked = activeInsight?.classList.contains("unlocked");
    if (unlocked){
      setStatus("Already completed. You can reset this gate if you want to replay it.");
      setCompleteEnabled(true);
      if (qReset) qReset.style.display = "inline-flex";
      return;
    }
    switch(String(insightId)){
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
  function loadProgress(){
    const unlocked = JSON.parse(localStorage.getItem(PROG_KEY) || "[]");
    unlocked.forEach(id=>{
      const card = $(`.insight[data-insight="${id}"]`);
      if (card) card.classList.add("unlocked");
    });
  }

  loadProgress();

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
      activeInsight.classList.add("unlocked");
      saveProgress();
      setStatus("Completed.");
      setCompleteEnabled(true);
    }
    closeModal();
  });

  // Reset a single gate
  qReset?.addEventListener("click", ()=>{
    if (!activeInsight) return;
    activeInsight.classList.remove("unlocked");
    saveProgress();
    // Rebuild the quest interaction immediately
    requestAnimationFrame(()=> setupQuest(activeInsight.dataset.insight));
  });

  qGo?.addEventListener("click", ()=>{
    const trackId = qGo.dataset.track || "";
    if (trackId) localStorage.setItem("ev_track", trackId);
    window.location.href = "./index.html";
  });

  // Reset all progress
  $("#resetAll")?.addEventListener("click", ()=>{
    if (!confirm("Reset all gate progress?")) return;
    localStorage.removeItem(PROG_KEY);
    $$(".insight.unlocked").forEach(el=>el.classList.remove("unlocked"));
  });
})();



/* =========================================================
   EV_SKYFIELD — Canvas Starfield + Constellation Sketch
   - Lightweight: no deps, pointer-events none on canvas
   - Click near stars to "link" them; double-click clears
   - Subtle twinkle + parallax on mouse move
========================================================= */
(function(){
  const SKY_TAG = "EV_SKYFIELD";
  // guard (in case bundled twice)
  if (window[SKY_TAG]) return;
  window[SKY_TAG] = true;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function init(){
    const canvas = document.getElementById("sky");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha:true });

    let w=0,h=0,dpr=1;
    let stars=[];
    let links=[]; // indices of selected stars
    let mouse = {x:0,y:0, tx:0, ty:0, has:false};
    let t0 = performance.now();

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

    function rand(min,max){ return min + Math.random()*(max-min); }

    function buildStars(){
      const area = w*h;
      const count = clamp(Math.round(area/18000), 60, 160);
      stars = [];
      for(let i=0;i<count;i++){
        const r = rand(0.8, 1.9);
        const b = rand(0.55, 1.0); // brightness
        const hue = rand(190, 320); // cyan->magenta range
        stars.push({
          x: rand(0,w),
          y: rand(0,h),
          r,
          b,
          tw: rand(0.6, 1.4),
          ph: rand(0, Math.PI*2),
          hue
        });
      }
      // reset links if they point out of range
      links = links.filter(idx => idx>=0 && idx<stars.length);
    }

    function drawBackground(){
      // very soft vignette
      ctx.clearRect(0,0,w,h);
      const g = ctx.createRadialGradient(w*0.5,h*0.35, 0, w*0.5,h*0.55, Math.max(w,h)*0.75);
      g.addColorStop(0, "rgba(255,255,255,0.03)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
    }

    function drawStars(now){
      const tt = (now - t0)/1000;
      const px = mouse.has ? (mouse.x - w/2)*0.015 : 0;
      const py = mouse.has ? (mouse.y - h/2)*0.015 : 0;

      for(let i=0;i<stars.length;i++){
        const s = stars[i];
        const tw = 0.75 + 0.25*Math.sin(tt*s.tw + s.ph);
        const alpha = clamp(s.b*tw, 0.15, 1);
        const x = s.x + px*(0.6 + s.r*0.25);
        const y = s.y + py*(0.6 + s.r*0.25);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 95%, 70%, ${alpha*0.65})`;
        ctx.arc(x, y, s.r*1.3, 0, Math.PI*2);
        ctx.fill();

        // tiny glow
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 95%, 75%, ${alpha*0.12})`;
        ctx.arc(x, y, s.r*4.2, 0, Math.PI*2);
        ctx.fill();
      }
    }

    function drawConstellation(now){
      if (!links.length) return;
      const tt = (now - t0)/1000;
      const pulse = 0.65 + 0.35*Math.sin(tt*2.2);
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(255,255,255,${0.18*pulse})`;
      ctx.beginPath();
      for(let i=0;i<links.length;i++){
        const a = stars[links[i]];
        if (!a) continue;
        const x = a.x, y = a.y;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();

      // highlight nodes
      for(const idx of links){
        const s = stars[idx];
        if(!s) continue;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${0.35*pulse})`;
        ctx.arc(s.x, s.y, Math.max(2.2, s.r*1.6), 0, Math.PI*2);
        ctx.fill();
      }
    }

    function render(now){
      drawBackground();
      drawStars(now);
      drawConstellation(now);
      requestAnimationFrame(render);
    }

    function nearestStar(x,y, maxDist=28){
      let best=-1, bestD=maxDist*maxDist;
      for(let i=0;i<stars.length;i++){
        const s=stars[i];
        const dx=s.x-x, dy=s.y-y;
        const d=dx*dx+dy*dy;
        if(d<bestD){ best=i; bestD=d; }
      }
      return best;
    }

    // Interactions: click near star to add to links; double click clears
    function onClick(e){
      // ignore clicks when modal/drawer open if you want; but safe to allow
      const x = e.clientX, y = e.clientY;
      const idx = nearestStar(x,y, 30);
      if (idx<0) return;
      if (!links.includes(idx)){
        links.push(idx);
        if (links.length>7) links.shift();
      } else {
        // clicking an already-linked star removes it
        links = links.filter(i=>i!==idx);
      }
    }
    function onDbl(e){ links=[]; }

    function onMove(e){
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.has = true;
    }

    window.addEventListener("resize", resize, {passive:true});
    window.addEventListener("mousemove", onMove, {passive:true});
    window.addEventListener("touchmove", (e)=>{
      if (!e.touches || !e.touches[0]) return;
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.has = true;
    }, {passive:true});
    document.addEventListener("click", onClick, {passive:true});
    document.addEventListener("dblclick", onDbl, {passive:true});

    resize();
    requestAnimationFrame(render);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();
