// analytics/umami-config.js
// Set values to enable Umami.
// - enabled: explicit on/off gate (prevents accidental partial enablement)
// - url: base URL of your Umami instance (no trailing slash), e.g. https://stats.yourdomain.com
// - websiteId: your Umami website UUID
// - domains (optional): allowlist (string "a.com,b.com" or array ["a.com","b.com"])
window.__UMAMI__ = {
  enabled: false,
  url: "",
  websiteId: "",
  domains: ["aerovista-us.github.io"]
};
