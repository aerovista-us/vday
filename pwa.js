(() => {
  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }

  const hadControllerAtStart = (() => {
    try { return ("serviceWorker" in navigator) && !!navigator.serviceWorker.controller; }
    catch { return false; }
  })();
  let userInteracted = false;
  window.addEventListener("pointerdown", () => { userInteracted = true; }, { passive: true, once: true });
  window.addEventListener("keydown", () => { userInteracted = true; }, { once: true });

  const ASSET_VERSION = (() => {
    try {
      const src = document.currentScript?.src || "";
      const u = new URL(src, window.location.href);
      return (u.searchParams.get("v") || "").trim();
    } catch {
      return "";
    }
  })();

  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.matchMedia?.("(display-mode: minimal-ui)")?.matches ||
      // iOS Safari
      window.navigator?.standalone === true
    );
  }

  function isIOS() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const iOSLike = /iPad|iPhone|iPod/.test(ua) || /iPad|iPhone|iPod/.test(platform);
    const iPadOS13Plus = platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iOSLike || iPadOS13Plus;
  }

  function ensureBannerEl() {
    let el = document.getElementById("installBanner");
    if (!el) {
      el = document.createElement("div");
      el.id = "installBanner";
      document.body.appendChild(el);
    }
    el.className = "install-banner";
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function hideBanner() {
    const el = document.getElementById("installBanner");
    if (!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = "";
  }

  function showBannerHTML({ title, desc, primaryLabel, secondaryLabel, onPrimary, onSecondary }) {
    const el = ensureBannerEl();
    el.innerHTML = `
      <div class="install-card" role="region" aria-label="Install app">
        <div class="install-text">
          <div class="install-title">${title}</div>
          <div class="install-desc">${desc}</div>
        </div>
        <div class="install-actions">
          ${primaryLabel ? `<button class="btn primary" id="evInstallPrimary" type="button">${primaryLabel}</button>` : ""}
          <button class="btn" id="evInstallSecondary" type="button">${secondaryLabel || "Not now"}</button>
        </div>
      </div>
    `;
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");

    const primary = document.getElementById("evInstallPrimary");
    const secondary = document.getElementById("evInstallSecondary");
    if (primary && onPrimary) primary.addEventListener("click", onPrimary);
    if (secondary) secondary.addEventListener("click", onSecondary || (() => { hideBanner(); }));
  }

  async function tryPromptInstall() {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideBanner();
    } catch {
      // If prompting fails, just hide.
      hideBanner();
    }
  }

  function maybeShowInstallUX() {
    if (isStandalone()) return;

    if (deferredPrompt) {
      showBannerHTML({
        title: "Install EchoVerse",
        desc: "Tip: Open your browser menu (⋮) → “Install app” / “Add to Home screen” for the PWA experience.",
        primaryLabel: "Install",
        secondaryLabel: "Not now",
        onPrimary: tryPromptInstall,
        onSecondary: () => {
          hideBanner();
        }
      });
      return;
    }

    // iOS: no beforeinstallprompt, so we show quick instructions.
    if (isIOS()) {
      showBannerHTML({
        title: "Install EchoVerse",
        desc: "Tip: iPhone/iPad: Share → Add to Home Screen for the PWA experience.",
        primaryLabel: "",
        secondaryLabel: "Got it",
        onSecondary: () => {
          hideBanner();
        }
      });
      return;
    }

    // Other browsers: show instructions until beforeinstallprompt is available.
    showBannerHTML({
      title: "Install EchoVerse",
      desc: "Tip: Open your browser menu (⋮) → “Install app” / “Add to Home screen” for the PWA experience.",
      primaryLabel: "",
      secondaryLabel: "Close",
      onSecondary: hideBanner
    });
  }

  // Allow pages to trigger install UX from a header button.
  window.addEventListener("ev:install_request", () => {
    if (isStandalone()) return;
    if (deferredPrompt) {
      // User gesture → we can prompt directly.
      tryPromptInstall();
    } else {
      maybeShowInstallUX();
    }
  });

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const swUrl = "./sw.js" + (ASSET_VERSION ? `?v=${encodeURIComponent(ASSET_VERSION)}` : "");
      const reg = await navigator.serviceWorker.register(swUrl);
      try { await reg.update(); } catch {}
    } catch {
      // ignore
    }
  }

  // If an older SW was already controlling this page, reload once when the new
  // controller takes over. This prevents “half-updated” loads (e.g., broken images)
  // without forcing refreshes on first-time visitors.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadControllerAtStart) return;
      if (userInteracted) return;
      try { if (performance.now() > 12000) return; } catch {}
      try {
        const key = "ev_sw_reload_once";
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore storage failures
      }
      window.location.reload();
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    maybeShowInstallUX();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideBanner();
  });

  window.addEventListener("load", () => {
    registerSW();
    // Show the install promo on every top-level load (browsers still require a tap to trigger the native prompt).
    setTimeout(maybeShowInstallUX, 700);
  });
})();
