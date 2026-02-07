// analytics/umami-loader.js
(function () {
  try {
    // Avoid tracking embedded overlays (iframes) as full pageviews.
    if (window.self !== window.top) return;
  } catch {
    return;
  }

  const cfg = (window.__UMAMI__ || {});
  const enabled = cfg.enabled === true;
  const url = String(cfg.url || "").trim().replace(/\/+$/, "");
  const websiteId = String(cfg.websiteId || "").trim();
  const domains = Array.isArray(cfg.domains)
    ? cfg.domains.map((d) => String(d || "").trim()).filter(Boolean).join(",")
    : String(cfg.domains || "").trim();

  if (!enabled) return;
  if (!url || !websiteId) {
    console.warn("[analytics] Umami enabled=true, but url/websiteId missing; tracking is disabled.");
    return;
  }

  try {
    const proto = String(window.location?.protocol || "");
    if (proto !== "https:" && proto !== "http:") return;

    // Prevent silent failures: HTTPS pages can't load HTTP analytics scripts.
    if (window.location?.protocol === "https:" && url.startsWith("http://")) {
      console.warn("[analytics] Umami URL is HTTP on an HTTPS page; browsers will block mixed content. Use HTTPS.");
      return;
    }
  } catch {
    // ignore
  }

  // Stub + queue so early events (inline scripts) don't get dropped before Umami loads.
  // This is safe even if Umami isn't reachable; events remain local until the real script initializes.
  const queueKey = "__UMAMI_QUEUE__";
  const queue = Array.isArray(window[queueKey]) ? window[queueKey] : [];
  window[queueKey] = queue;

  const hadTrack = !!(window.umami && typeof window.umami.track === "function");
  if (!hadTrack) {
    window.umami = window.umami || {};
    window.umami.__stub = true;
    window.umami.track = (eventName, data) => {
      queue.push([String(eventName || ""), data || {}]);
    };
  }

  try {
    const existing = document.querySelectorAll("script[data-website-id]");
    for (const el of existing) {
      if (el.getAttribute("data-website-id") === websiteId) return;
    }
  } catch {
    // ignore
  }

  const s = document.createElement("script");
  s.defer = true;
  s.src = url + "/script.js";
  s.setAttribute("data-website-id", websiteId);
  if (domains) s.setAttribute("data-domains", domains);
  s.addEventListener("load", () => {
    try {
      // If a real Umami script didn't take over, don't re-queue into the stub.
      if (window.umami && window.umami.__stub) return;
      if (!window.umami || typeof window.umami.track !== "function") return;
      if (!Array.isArray(window[queueKey]) || window[queueKey].length === 0) return;
      const toFlush = window[queueKey].splice(0, window[queueKey].length);
      for (const item of toFlush) {
        const name = item && item[0];
        const data = item && item[1];
        if (name) window.umami.track(name, data || {});
      }
    } catch {
      // ignore
    }
  });
  document.head.appendChild(s);
})();
