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
