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

## Custom events (player)
`v5/index.html` emits custom Umami events so you can break down engagement beyond pageviews:
- `track_start`: counts a **new track start** (excludes resumes) with `track_id`, `track_title`, `album`, `drop`, `theme`, `page_path`
- `play` / `pause` / `ended`: playback state events (note: `play` includes resumes)
- `progress`: milestone events with `milestone` (25/50/75/95) + track context
- `track_select`, `restart`, `theme_toggle`, `drawer_open`, `drawer_close`, `view_switch`, `page_view_player`

## Custom events (adventure)
`v5/adventure.js` emits quest events:
- Standalone `adventure.html`: events go directly to Umami
- Embedded Adventure overlay inside `index.html`: events are posted to the parent (so Umami only tracks once)

Events:
- `quest_open`: `{ quest_id, quest_title, track_id, unlocked, attempts, theme, page_path, embed }`
- `quest_complete`: `{ quest_id, track_id, attempts?, completed_new, ... }`
- `quest_reset`: `{ quest_id, ... }`
- `quest_go`: `{ quest_id, track_id, ... }`

In Umami, use **Pages** for per-page stats, and **Events** to filter/group by `track_title` (or other event properties).
