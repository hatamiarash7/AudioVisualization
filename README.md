# Audio Visualization

Real-time audio visualization built with plain JavaScript, Canvas and the Web Audio API. No dependencies, no build step.

![audio](https://user-images.githubusercontent.com/16325641/136423841-e0ad2183-8b37-478f-bd7d-0ce01a2faf21.jpg)

## Features

- Starfield, frequency "bubble" and waveform ring that react to the music
- Modern glass UI: play/pause, volume, mute, fullscreen, auto-hiding controls
- Play your own audio: pick a file or drag & drop it onto the page
- Keyboard shortcuts: `Space` play/pause, `M` mute, `F` fullscreen
- HiDPI-aware canvas, resize handling, and paused rendering when idle
- Hardened nginx container (non-root, read-only filesystem, healthcheck)

## Run

### Development (localhost)

```sh
docker compose -f docker-compose.dev.yml up --build
```

Open [http://localhost:8082](http://localhost:8082). Source files are bind-mounted read-only, so edits show up on browser refresh.

### Production (Traefik)

`docker-compose.yml` expects an existing external Docker network called `traefik` and routes `audio-visualization.arash-hatami.ir`. Adjust the host rule to your domain, then:

```sh
docker network create traefik   # once, if it does not exist
docker compose up -d --build
```

The image is self-contained (files are copied in, not mounted). The container listens on port `8080`.

### Without Docker

Any static server works; the audio is fetched over HTTP, so opening `index.html` via `file://` will not work.

```sh
python3 -m http.server 8082
```

## Project layout

```text
index.html      page markup
css/style.css   styles
js/index.js     visualizer + player logic
media/1.ogg     demo track
nginx.conf      container web server config
```

## Notes

- Browsers block audio until a user gesture, so playback begins when you press **Start**.
- Tweak look and feel via the `CONFIG` and `COLORS` objects at the top of `js/index.js`.

---

## Support

[Donate with Bitcoin](https://donatebadges.ir/donate/Bitcoin/bc1qmmh6vt366yzjt3grjxjjqynrrxs3frun8gnxrz) · [Donate with Ethereum](https://donatebadges.ir/donate/Ethereum/0x0831bD72Ea8904B38Be9D6185Da2f930d6078094) · [PayPing](https://payping.ir/@hatamiarash7)

## Contributing

1. Fork it
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'feat: add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Open a pull request

## Issues

Found a bug? Please [open an issue](https://github.com/hatamiarash7/AudioVisualization/issues).
