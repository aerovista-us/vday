(() => {
  const DISMISS_KEY = "ev_install_dismissed_at_v1";
  const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

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

  function recentlyDismissed() {
    try {
      const v = Number(localStorage.getItem(DISMISS_KEY) || "0");
      return v > 0 && Date.now() - v < DISMISS_MS;
    } catch {
      return false;
    }
  }

  function setDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  function clearDismissed() {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore
    }
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
    if (secondary) secondary.addEventListener("click", onSecondary || (() => { setDismissed(); hideBanner(); }));
  }

  async function tryPromptInstall() {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice?.outcome === "accepted") clearDismissed();
      hideBanner();
    } catch {
      // If prompting fails, just hide.
      hideBanner();
    }
  }

  function maybeShowInstallUX() {
    if (isStandalone()) return;
    if (recentlyDismissed()) return;

    if (deferredPrompt) {
      showBannerHTML({
        title: "Install EchoVerse",
        desc: "Get the full-screen player and faster launches from your home screen.",
        primaryLabel: "Install",
        secondaryLabel: "Not now",
        onPrimary: tryPromptInstall,
        onSecondary: () => {
          setDismissed();
          hideBanner();
        }
      });
      return;
    }

    // iOS: no beforeinstallprompt, so we show quick instructions.
    if (isIOS()) {
      showBannerHTML({
        title: "Add to Home Screen",
        desc: "iPhone/iPad: Share → Add to Home Screen for the app-like experience.",
        primaryLabel: "",
        secondaryLabel: "Got it",
        onSecondary: () => {
          setDismissed();
          hideBanner();
        }
      });
    }
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch {
      // ignore
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    maybeShowInstallUX();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    clearDismissed();
    hideBanner();
  });

  window.addEventListener("load", () => {
    registerSW();
    // Give layout a beat; show early but not instantly.
    setTimeout(maybeShowInstallUX, 1400);
  });
})();

