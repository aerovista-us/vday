// analytics/umami-loader.js
(function () {
  try {
    // Avoid tracking embedded overlays (iframes) as full pageviews.
    if (window.self !== window.top) return;
  } catch {
    return;
  }

  const cfg = (window.__UMAMI__ || {});
  const url = String(cfg.url || "").trim().replace(/\/+$/, "");
  const websiteId = String(cfg.websiteId || "").trim();
  const domains = String(cfg.domains || "").trim();

  if (!url || !websiteId) return;

  try {
    // Prevent silent failures: HTTPS pages can't load HTTP analytics scripts.
    if (window.location?.protocol === "https:" && url.startsWith("http://")) {
      console.warn("[analytics] Umami URL is HTTP on an HTTPS page; browsers will block mixed content. Use HTTPS.");
      return;
    }
  } catch {
    // ignore
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
  document.head.appendChild(s);
})();
