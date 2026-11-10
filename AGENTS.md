# Repository guidance

## Run and verify

- Dev: `docker compose -f docker-compose.dev.yml up --build`, then open `http://localhost:8082`. The dev file is standalone; do not merge it with the default Compose file. Source is bind-mounted read-only, so edits appear on refresh.
- `docker-compose.yml` is the Traefik deployment: it needs an external `traefik` network, publishes no localhost port, and bakes files into the image (no bind mount).
- The container is `nginx-unprivileged` listening on 8080 (`nginx.conf`); the Dockerfile copies only `index.html`, `css/`, `js/`, `media/`.
- Validate Compose with `docker compose -f docker-compose.dev.yml config --quiet`.
- No package manager, build pipeline, or automated tests. `.gitlab-ci.yml` only copies files into a `public/` Pages artifact. `node --check js/index.js` is a quick syntax check.
- Browser check: loader disappears, Start panel appears, Start begins audio and visuals, play/pause toggles, volume/mute work, resize updates the canvas. Serve over HTTP (audio is fetched with `fetch`).

## Runtime gotchas

- `js/index.js` is a readable, strict-mode IIFE classic script loaded after the DOM; `index.html` and `css/style.css` are plain source too.
- Autoplay policy: the AudioContext is suspended until the user presses Start; play/pause uses `AudioContext.suspend()/resume()`.
- Audio graph is `source -> analyser -> gain -> destination`; the analyser is before gain so volume does not change visuals.
- Fetch and decode errors show the `#error` panel with a Retry button.
