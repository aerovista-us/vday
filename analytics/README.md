# Analytics (Umami)

This site loads Umami via:
- `analytics/umami-config.js` (project/environment values)
- `analytics/umami-loader.js` (injects the remote `script.js`)

## Enable tracking
Edit `analytics/umami-config.js`:
- `enabled`: set `true` to turn tracking on
- `url`: base URL of your Umami instance (no trailing slash)
- `websiteId`: your Umami website UUID
- `domains` (optional): comma-separated allowlist string or array

## Notes
- The loader skips tracking when embedded in an iframe (prevents overlay embeds from counting as full pageviews).
- If the site is served over HTTPS, `url` must also be HTTPS (browsers block HTTP analytics scripts as mixed content).
