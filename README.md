# EchoVerse VDAY (v5)

Static, vanilla-HTML/JS “experience drop”:
- Album player (`index.html`) with lyrics + optional chat wall
- “Nine Signals” adventure (`adventure.html` + `adventure.js`) as a standalone page or an overlay iframe
- Installable PWA (`manifest.webmanifest`, `pwa.js`, `sw.js`, `offline.html`)

Live: `https://aerovista-us.github.io/vday/`

## Local run
Use a local server (don’t open via `file://` — `fetch()` + SW/PWA behaviors won’t match production):
```bash
python -m http.server 8080
```
Open `http://localhost:8080/v5/` (if you’re serving from the repo root) or `http://localhost:8080/` (if `v5/` is your web root).

## Documentation
Start here: `v5/docs/README.md`

