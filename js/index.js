/*
 * Audio Visualization
 * Canvas + Web Audio API, no dependencies.
 *
 * Audio graph:  source -> analyser -> gain -> destination
 * The analyser sits before the gain node so the visuals do not change with volume.
 */
(function () {
  "use strict";

  var DEFAULT_TRACK = "media/1.ogg";

  var CONFIG = {
    fftSize: 1024,
    minDecibels: -100,
    maxDecibels: -30,
    smoothing: 0.8,
    totalStars: 1200,
    starsBreakPoint: 140,
    starsBrightPoint: 110,
    waveformPoints: 512,
    waveformTick: 0.02,
    avgPoints: 64,
    avgTick: 0.001,
    avgBreakPoint: 100,
    maxPixelRatio: 2,
  };

  var COLORS = {
    bg: ["#000011", "#060d1f", "#02243f"],
    star: "#465677",
    starBright: "#b5bfd4",
    starSpecial: "#f451ba",
    waveFill: "rgba(29, 36, 57, 0.05)",
    waveFillBeat: "rgba(0, 0, 0, 0)",
    waveLine: "rgba(157, 242, 157, 0.18)",
    waveLineBeat: "rgba(157, 242, 157, 0.85)",
    avgFill: "rgba(29, 36, 57, 0.1)",
    avgFillBeat: "rgba(29, 36, 57, 0.05)",
    avgLine: "rgba(77, 218, 248, 1)",
  };

  var TWO_PI = Math.PI * 2;
  var DEG = Math.PI / 180;

  var AudioContextClass = window.AudioContext || window.webkitAudioContext;

  var $ = function (id) {
    return document.getElementById(id);
  };

  var els = {
    loading: $("loading"),
    msg: $("loading-msg"),
    noAudio: $("no-audio"),
    error: $("error"),
    errorText: $("error-text"),
    start: $("start"),
    startBtn: $("start-btn"),
    controls: $("controls"),
    playBtn: $("play-btn"),
    muteBtn: $("mute-btn"),
    volume: $("volume"),
    fileInput: $("file-input"),
    trackName: $("track-name"),
    fullscreenBtn: $("fullscreen-btn"),
    drop: $("drop"),
  };

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");

  var actx, analyser, gainNode, source, audioBuffer;
  var frequencyData, timeData;
  var w = 0,
    h = 0,
    cx = 0,
    cy = 0,
    dpr = 1,
    scale = 1;
  var bgGradient = null;
  var stars = [];
  var wavePoints = [];
  var avgPoints = [];
  var avg = 0;
  var rotation = 0;
  var rafId = 0;
  var lastVolume = 0.8;
  var userPaused = false;
  var started = false;

  /* ---------- helpers ---------- */

  function setMessage(text) {
    els.msg.textContent = text;
  }

  function hideLoader() {
    els.loading.classList.add("hide");
  }

  function showError(text) {
    hideLoader();
    els.errorText.textContent = text;
    els.error.hidden = false;
  }

  function isPlaying() {
    return !!actx && actx.state === "running" && !userPaused;
  }

  /* ---------- scene objects ---------- */

  function Star() {
    this.reset();
  }

  Star.prototype.reset = function () {
    this.x = Math.random() * w - cx;
    this.y = Math.random() * h - cy;
    this.maxDepth = Math.max(w / h, 1);
    this.z = this.maxDepth;
    this.radius = 0.2;

    var sx = this.x > 0 ? 1 : -1;
    var sy = this.y > 0 ? 1 : -1;
    var ax = Math.abs(this.x);
    var ay = Math.abs(this.y);
    if (ax > ay) {
      this.dx = 1;
      this.dy = ay / (ax || 1);
    } else {
      this.dx = ax / (ay || 1);
      this.dy = 1;
    }
    this.dx *= sx;
    this.dy *= sy;
    this.dz = -0.1;
    this.ddx = 0.001 * this.dx;
    this.ddy = 0.001 * this.dy;

    // 0 = dim, 1 = bright, 2 = special (only spawned during loud passages)
    if (this.y > cy / 2) this.tone = 1;
    else if (avg > CONFIG.starsBreakPoint) this.tone = 2;
    else if (avg > CONFIG.starsBrightPoint) this.tone = 1;
    else this.tone = 0;
  };

  function RingPoint(index, total) {
    this.angle = (360 * index) / total;
    this.sin = Math.sin(DEG * this.angle);
    this.cos = Math.cos(DEG * this.angle);
    this.x = 0;
    this.y = 0;
    this.dx = 0;
    this.dy = 0;
  }

  RingPoint.prototype.layout = function () {
    var radius = Math.min(w, h) / 6;
    this.x = cx + radius * this.sin;
    this.y = cy + radius * this.cos;
    this.dx = this.x;
    this.dy = this.y;
  };

  function createScene() {
    stars = [];
    for (var i = 0; i < CONFIG.totalStars; i++) stars.push(new Star());
    wavePoints = [];
    for (i = 0; i < CONFIG.waveformPoints; i++) {
      wavePoints.push(new RingPoint(i + 1, CONFIG.waveformPoints));
    }
    avgPoints = [];
    for (i = 0; i < CONFIG.avgPoints; i++) {
      avgPoints.push(new RingPoint(i + 1, CONFIG.avgPoints));
    }
    layoutScene();
  }

  function layoutScene() {
    for (var i = 0; i < wavePoints.length; i++) wavePoints[i].layout();
    for (i = 0; i < avgPoints.length; i++) avgPoints[i].layout();
  }

  /* ---------- drawing ---------- */

  function drawBackground() {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars() {
    var speed = avg > CONFIG.avgBreakPoint ? avg / 20 : avg / 50;
    var buckets = [[], [], []];
    var i, s;

    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      s.x += s.dx * speed;
      s.y += s.dy * speed;
      s.z += s.dz;
      s.dx += s.ddx;
      s.dy += s.ddy;
      s.radius = Math.max(0.2, 0.2 + 0.1 * (s.maxDepth - s.z));

      if (s.x < -cx || s.x > cx || s.y < -cy || s.y > cy) {
        s.reset();
        continue;
      }
      buckets[s.tone].push(s);
    }

    ctx.globalCompositeOperation = "lighter";
    var fills = [COLORS.star, COLORS.starBright, COLORS.starSpecial];
    for (var t = 0; t < 3; t++) {
      var list = buckets[t];
      if (!list.length) continue;
      ctx.fillStyle = fills[t];
      ctx.beginPath();
      for (i = 0; i < list.length; i++) {
        s = list[i];
        ctx.moveTo(s.x + cx + s.radius, s.y + cy);
        ctx.arc(s.x + cx, s.y + cy, s.radius, 0, TWO_PI, false);
      }
      ctx.fill();
    }
  }

  // Draws a closed, smoothed ring whose radius is displaced by `valueAt(i)`.
  function drawRing(points, valueAt, stroke, fill) {
    var n = points.length;
    var i, p, next, mx, my;

    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.translate(-cx, -cy);

    for (i = 0; i < n; i++) {
      p = points[i];
      var d = valueAt(i);
      p.dx = p.x + d * p.sin;
      p.dy = p.y + d * p.cos;
    }

    ctx.beginPath();
    // Start at the midpoint of the last and first points so the closed curve has no seam.
    var last = points[n - 1];
    ctx.moveTo((last.dx + points[0].dx) / 2, (last.dy + points[0].dy) / 2);
    for (i = 0; i < n; i++) {
      p = points[i];
      next = points[(i + 1) % n];
      mx = (p.dx + next.dx) / 2;
      my = (p.dy + next.dy) / 2;
      ctx.quadraticCurveTo(p.dx, p.dy, mx, my);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  function drawAverage() {
    var beat = avg > CONFIG.avgBreakPoint;
    rotation += beat ? -CONFIG.avgTick : CONFIG.avgTick;
    var base = (beat ? avg + 10 * Math.random() : avg) * scale;
    drawRing(
      avgPoints,
      function () {
        return base;
      },
      COLORS.avgLine,
      beat ? COLORS.avgFillBeat : COLORS.avgFill,
    );
  }

  function drawWaveform() {
    var beat = avg > CONFIG.avgBreakPoint;
    rotation += beat ? CONFIG.waveformTick : -CONFIG.waveformTick;
    var len = timeData.length;
    drawRing(
      wavePoints,
      function (i) {
        return timeData[Math.floor((i * len) / wavePoints.length)] * scale;
      },
      beat ? COLORS.waveLineBeat : COLORS.waveLine,
      beat ? COLORS.waveFillBeat : COLORS.waveFill,
    );
  }

  function frame() {
    rafId = 0;
    if (!isPlaying()) return;
    rafId = window.requestAnimationFrame(frame);

    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);

    var sum = 0;
    for (var i = 0; i < frequencyData.length; i++) sum += frequencyData[i];
    avg = sum / frequencyData.length;

    drawBackground();
    drawStars();
    drawAverage();
    drawWaveform();
  }

  function startLoop() {
    if (!rafId) rafId = window.requestAnimationFrame(frame);
  }

  function renderIdle() {
    // One static frame so the canvas is never blank while paused or waiting.
    if (!bgGradient) return;
    drawBackground();
    if (stars.length) drawStars();
  }

  /* ---------- audio ---------- */

  function buildGraph() {
    analyser = actx.createAnalyser();
    analyser.fftSize = CONFIG.fftSize;
    analyser.minDecibels = CONFIG.minDecibels;
    analyser.maxDecibels = CONFIG.maxDecibels;
    analyser.smoothingTimeConstant = CONFIG.smoothing;

    gainNode = actx.createGain();
    gainNode.gain.value = lastVolume;

    analyser.connect(gainNode);
    gainNode.connect(actx.destination);

    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.frequencyBinCount);
  }

  function playBuffer(buffer) {
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch (e) {
        /* already stopped */
      }
      source.disconnect();
    }
    audioBuffer = buffer;
    source = actx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(analyser);
    source.start(0);
  }

  function decode(arrayBuffer) {
    return new Promise(function (resolve, reject) {
      // Callback form for older Safari, which lacks the promise form.
      actx.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }

  function fetchTrack(url) {
    return fetch(url).then(function (res) {
      if (!res.ok)
        throw new Error("HTTP " + res.status + " while loading " + url);
      return res.arrayBuffer();
    });
  }

  function updatePlayButton() {
    var playing = isPlaying();
    els.playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    els.playBtn.setAttribute("aria-pressed", String(playing));
    els.playBtn.classList.toggle("is-playing", playing);
  }

  function play() {
    userPaused = false;
    return actx.resume().then(function () {
      updatePlayButton();
      startLoop();
    });
  }

  function pause() {
    userPaused = true;
    return actx.suspend().then(updatePlayButton);
  }

  function toggle() {
    if (!started || !audioBuffer) return;
    if (isPlaying()) pause();
    else play();
  }

  function setVolume(value) {
    value = Math.min(1, Math.max(0, value));
    if (value > 0) lastVolume = value;
    if (gainNode) gainNode.gain.setTargetAtTime(value, actx.currentTime, 0.015);
    els.volume.value = String(value);
    els.volume.style.setProperty("--fill", value * 100 + "%");
    els.muteBtn.classList.toggle("is-muted", value === 0);
    els.muteBtn.setAttribute("aria-label", value === 0 ? "Unmute" : "Mute");
  }

  function loadFile(file) {
    if (!file) return;
    if (
      file.type &&
      file.type.indexOf("audio") !== 0 &&
      file.type.indexOf("video") !== 0
    ) {
      showToast("That file is not an audio file.");
      return;
    }
    showToast("Decoding " + file.name + "…");
    file
      .arrayBuffer()
      .then(decode)
      .then(function (buffer) {
        playBuffer(buffer);
        els.trackName.textContent = file.name;
        if (started) play();
        showToast("Now playing: " + file.name);
      })
      .catch(function () {
        showToast("Could not decode that file.");
      });
  }

  /* ---------- UI ---------- */

  var toastTimer = 0;
  function showToast(text) {
    var t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      t.classList.remove("show");
    }, 2600);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }

  function bindUI() {
    els.startBtn.addEventListener("click", function () {
      started = true;
      els.start.classList.add("hide");
      els.controls.classList.remove("hide");
      play();
    });

    els.playBtn.addEventListener("click", toggle);

    els.muteBtn.addEventListener("click", function () {
      setVolume(gainNode && gainNode.gain.value > 0 ? 0 : lastVolume);
    });

    els.volume.addEventListener("input", function () {
      setVolume(parseFloat(els.volume.value));
    });

    els.fileInput.addEventListener("change", function () {
      loadFile(els.fileInput.files[0]);
      els.fileInput.value = "";
    });

    els.fullscreenBtn.addEventListener("click", toggleFullscreen);
    if (!document.documentElement.requestFullscreen)
      els.fullscreenBtn.hidden = true;

    window.addEventListener("keydown", function (e) {
      if (
        e.target &&
        /^(INPUT|TEXTAREA)$/.test(e.target.tagName) &&
        e.code !== "Space"
      )
        return;
      if (e.code === "Space" && !(e.target && e.target.tagName === "BUTTON")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "m" || e.key === "M") {
        els.muteBtn.click();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    });

    // Drag & drop a local file
    var depth = 0;
    window.addEventListener("dragenter", function (e) {
      e.preventDefault();
      depth++;
      els.drop.classList.add("show");
    });
    window.addEventListener("dragleave", function () {
      depth = Math.max(0, depth - 1);
      if (!depth) els.drop.classList.remove("show");
    });
    window.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    window.addEventListener("drop", function (e) {
      e.preventDefault();
      depth = 0;
      els.drop.classList.remove("show");
      if (e.dataTransfer && e.dataTransfer.files.length)
        loadFile(e.dataTransfer.files[0]);
    });

    // Fade controls out when the pointer is idle
    var idleTimer = 0;
    function wake() {
      document.body.classList.remove("idle");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(function () {
        if (isPlaying()) document.body.classList.add("idle");
      }, 3000);
    }
    ["mousemove", "touchstart", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, wake, { passive: true });
    });
    wake();

    // Don't burn CPU in a background tab; resume when visible again.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && isPlaying()) startLoop();
    });
  }

  /* ---------- sizing ---------- */

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
    w = window.innerWidth;
    h = window.innerHeight;
    cx = w / 2;
    cy = h / 2;
    scale = Math.max(0.5, Math.min(w, h) / 800);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bgGradient = ctx.createLinearGradient(0, 0, 0, h);
    bgGradient.addColorStop(0, COLORS.bg[0]);
    bgGradient.addColorStop(0.96, COLORS.bg[1]);
    bgGradient.addColorStop(1, COLORS.bg[2]);

    layoutScene();
    // Re-seed stars so they cover the new viewport.
    for (var i = 0; i < stars.length; i++) stars[i].reset();

    if (!isPlaying()) renderIdle();
  }

  var resizeQueued = false;
  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    window.requestAnimationFrame(function () {
      resizeQueued = false;
      resize();
    });
  }

  /* ---------- startup ---------- */

  function init() {
    if (!AudioContextClass) {
      hideLoader();
      els.noAudio.hidden = false;
      return;
    }

    document.body.insertBefore(canvas, document.body.firstChild);
    window.addEventListener("resize", onResize, false);
    resize();

    actx = new AudioContextClass();
    buildGraph();
    setVolume(lastVolume);
    bindUI();

    // Keep the context idle until the user presses Start (browser autoplay policy).
    actx.suspend();

    setMessage("Loading audio");
    fetchTrack(DEFAULT_TRACK)
      .then(function (data) {
        setMessage("Decoding audio");
        return decode(data);
      })
      .then(function (buffer) {
        playBuffer(buffer);
        els.trackName.textContent = "Demo track";
        createScene();
        renderIdle();
        hideLoader();
        els.start.classList.remove("hide");
        els.startBtn.focus();
      })
      .catch(function (err) {
        showError(
          "Could not load the audio: " +
            (err && err.message ? err.message : "decode error"),
        );
      });
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init, false);
})();
