// analytics/umami-loader.js
(function () {
  const cfg = (window.__UMAMI__ || {});
  const url = (cfg.url || "").replace(/\/+$/, "");
  const websiteId = cfg.websiteId || "";

  if (!url || !websiteId) return;

  const s = document.createElement("script");
  s.defer = true;
  s.src = url + "/script.js";
  s.setAttribute("data-website-id", websiteId);
  document.head.appendChild(s);
})();
