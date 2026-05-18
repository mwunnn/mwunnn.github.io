/* ============================================================
   computer3d.js — a true-3D ASCII computer.

   A vintage all-in-one computer, modelled as a handful of boxes
   (housing, base, dark glass screen, drive slot). Every face is
   point-sampled in model space; each frame those points are
   rotated about the vertical axis, tilted toward the camera,
   projected with perspective and resolved through a depth buffer.
   Flat Lambert shading off a fixed light picks one glyph per face.

   No dependencies — pure character math, in the spirit of
   orrery.html. Tune here, then fold into the landing page.
   ============================================================ */
(function () {
  'use strict';

  var pre = document.getElementById('screen');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- glyph ramp — dark face → bright face (light-on-dark) ---- */
  var RAMP = '.,-~:;=!*#$@';

  /* ---- scene constants ---------------------------------------- */
  var CAM_Z        = 5.0;     // camera sits this far out along +Z
  var DEFAULT_TILT = 0.34;    // starting downward view tilt (radians)
  var AMBIENT      = 0.18;    // floor light, so shadow faces aren't black

  // Light direction (world space, normalised) — upper front-left.
  var LX, LY, LZ;
  (function () {
    var lx = -0.45, ly = 0.62, lz = 0.80;
    var L = Math.sqrt(lx*lx + ly*ly + lz*lz);
    LX = lx/L; LY = ly/L; LZ = lz/L;
  })();

  // Spin presets — seconds per full revolution.
  var SPEEDS = [18, 12, 7];
  var speedIdx = 1;
  function spinRate() { return Math.PI * 2 / SPEEDS[speedIdx]; }

  /* ---- model — axis-aligned boxes, centred on the origin ------
     The whole computer spans y ∈ [-0.85, 0.85] and turns about
     the Y axis. albedo is the surface's base reflectance (0..1).  */
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function normalize(v) {
    var L = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]) || 1;
    return [v[0]/L, v[1]/L, v[2]/L];
  }
  // A flat quad: corner `o`, edge vectors `u` and `v`.
  function quad(o, u, v, albedo) {
    return { o:o, u:u, v:v, albedo:albedo, n:normalize(cross(u, v)), pts:null };
  }
  // The six outward-facing quads of an axis-aligned box.
  function boxFaces(x0,y0,z0, x1,y1,z1, albedo) {
    var dx = x1-x0, dy = y1-y0, dz = z1-z0;
    return [
      quad([x0,y0,z1], [dx,0,0],  [0,dy,0],  albedo),  // front  +Z
      quad([x1,y0,z0], [-dx,0,0], [0,dy,0],  albedo),  // back   -Z
      quad([x1,y0,z1], [0,0,-dz], [0,dy,0],  albedo),  // right  +X
      quad([x0,y0,z0], [0,0,dz],  [0,dy,0],  albedo),  // left   -X
      quad([x0,y1,z1], [dx,0,0],  [0,0,-dz], albedo),  // top    +Y
      quad([x0,y0,z0], [dx,0,0],  [0,0,dz],  albedo)   // bottom -Y
    ];
  }

  var FACES = []
    .concat(boxFaces(-0.80,-0.55,-0.55,  0.80, 0.85, 0.55, 0.95))  // housing
    .concat(boxFaces(-0.92,-0.85,-0.62,  0.92,-0.55, 0.62, 0.78)); // base
  // Dark glass screen + drive slot, sitting just proud of the front.
  FACES.push(quad([-0.55,-0.25,0.57], [1.10,0,0], [0,0.85,0], 0.20));
  FACES.push(quad([-0.30,-0.47,0.58], [0.60,0,0], [0,0.07,0], 0.08));

  // The widest horizontal sweep the model reaches as it spins,
  // and its height — both used to scale it to the viewport.
  var MODEL_H    = 1.70;
  var MODEL_SPAN = 2.70;

  /* ---- viewport grid ------------------------------------------ */
  var COLS, ROWS, CX, CY, S, ASPECT, charW, charH;
  var buf, zbuf;

  function measure() {
    var fs = Math.max(7, Math.min(15, window.innerWidth / 135));
    pre.style.fontSize = fs + 'px';

    var probe = document.createElement('span');
    probe.textContent = new Array(81).join('0');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    pre.appendChild(probe);
    charW = probe.getBoundingClientRect().width / 80;
    pre.removeChild(probe);
    charH = fs;                            // line-height is 1

    COLS = Math.max(31, Math.floor(window.innerWidth  / charW));
    ROWS = Math.max(21, Math.floor(window.innerHeight / charH));
    if (COLS % 2 === 0) COLS--;            // odd → a true centre cell
    if (ROWS % 2 === 0) ROWS--;
    CX = (COLS - 1) / 2;
    CY = (ROWS - 1) / 2;
    ASPECT = charW / charH;                // a cell is this wide per tall

    // Scale so the model fills a comfortable share of the frame,
    // bounded by BOTH height and width so it never overruns.
    var sH = 0.64 * ROWS * CAM_Z / (ASPECT * MODEL_H);
    var sW = 0.84 * COLS * CAM_Z / MODEL_SPAN;
    S = Math.min(sH, sW);

    buf  = new Array(COLS * ROWS);
    zbuf = new Float64Array(COLS * ROWS);

    buildSamples();
  }

  // Point-sample every face. The pitch is derived from S so the
  // projected points land under one cell apart — dense enough to
  // fill each face solidly, with no surface holes.
  function buildSamples() {
    var step = 0.7 * CAM_Z / S;            // model units between samples
    if (step < 0.014) step = 0.014;        // cap the point count
    if (step > 0.05)  step = 0.05;
    for (var f = 0; f < FACES.length; f++) {
      var face = FACES[f];
      var u = face.u, v = face.v, o = face.o;
      var lu = Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]);
      var lv = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      var ns = Math.max(2, Math.ceil(lu / step));
      var nt = Math.max(2, Math.ceil(lv / step));
      var pts = [];
      for (var i = 0; i < ns; i++) {
        var s = i / (ns - 1);
        for (var j = 0; j < nt; j++) {
          var t = j / (nt - 1);
          pts.push(
            o[0] + s*u[0] + t*v[0],
            o[1] + s*u[1] + t*v[1],
            o[2] + s*u[2] + t*v[2]
          );
        }
      }
      face.pts = pts;                      // flat [x,y,z, x,y,z, …]
    }
  }

  /* ---- render one frame: `yaw` about Y, `pitch` about X ------- */
  function renderAt(yaw, pitch) {
    var n = COLS * ROWS, i;
    for (i = 0; i < n; i++) { buf[i] = ' '; zbuf[i] = 0; }

    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var ct = Math.cos(pitch), st = Math.sin(pitch);

    for (var f = 0; f < FACES.length; f++) {
      var face = FACES[f], nrm = face.n;

      // Rotate the normal the same way as the points: spin about
      // the Y axis, then tilt about X.
      var nx = nrm[0], ny = nrm[1], nz = nrm[2];
      var rx  =  nx*cy + nz*sy;
      var rz  = -nx*sy + nz*cy;
      var rny =  ny*ct - rz*st;
      var rnz =  ny*st + rz*ct;
      // Back-face cull — drop faces turned away from the camera.
      if (rnz <= 0) continue;

      // Flat Lambert shade → one glyph for the whole face.
      var ndl = rx*LX + rny*LY + rnz*LZ;
      if (ndl < 0) ndl = 0;
      var lum = (AMBIENT + (1 - AMBIENT) * ndl) * face.albedo;
      var gi = Math.round(lum * (RAMP.length - 1));
      if (gi < 0) gi = 0; else if (gi >= RAMP.length) gi = RAMP.length - 1;
      var glyph = RAMP.charAt(gi);

      // Splat the face's sample points through the depth buffer.
      var p = face.pts, m = p.length;
      for (i = 0; i < m; i += 3) {
        var x = p[i], y = p[i+1], z = p[i+2];
        var x1 =  x*cy + z*sy;             // spin about Y
        var z1 = -x*sy + z*cy;
        var y1 =  y*ct - z1*st;            // tilt about X
        var z2 =  y*st + z1*ct;
        var depth = CAM_Z - z2;
        if (depth <= 0.1) continue;
        var inv = 1 / depth;               // bigger = nearer the camera
        var col = Math.round(CX + S * x1 * inv);
        var row = Math.round(CY - S * ASPECT * y1 * inv);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
        var idx = row * COLS + col;
        if (inv > zbuf[idx]) { zbuf[idx] = inv; buf[idx] = glyph; }
      }
    }

    var lines = [];
    for (var r = 0; r < ROWS; r++) {
      lines.push(buf.slice(r * COLS, (r + 1) * COLS).join(''));
    }
    pre.textContent = lines.join('\n');
  }

  /* ---- view state + animation loop ---------------------------- */
  var yaw       = 0;                  // rotation about the vertical axis
  var pitch     = DEFAULT_TILT;       // up/down view tilt
  var spinning  = !reduceMotion;      // is the auto-spin advancing yaw?
  var prevT     = null;
  var lastPaint = 0;
  var rafId     = null;

  function draw() { renderAt(yaw, pitch); }

  function frame(now) {
    if (!spinning) { rafId = null; return; }
    if (now - lastPaint >= 32) {            // throttle to ~31fps
      if (prevT === null) prevT = now;
      yaw += (now - prevT) / 1000 * spinRate();
      prevT = now;
      draw();
      lastPaint = now;
    }
    rafId = requestAnimationFrame(frame);
  }

  function syncSpinBtn() {
    spinBtn.textContent = spinning ? 'Pause' : 'Spin';
  }
  function startSpin() {
    if (reduceMotion || spinning) return;
    spinning = true;
    prevT = null;
    lastPaint = 0;
    if (rafId === null) rafId = requestAnimationFrame(frame);
    syncSpinBtn();
  }
  function stopSpin() {
    spinning = false;                       // frame() bails on its next tick
    syncSpinBtn();
  }

  /* ---- drag to orbit ------------------------------------------
     Dragging takes over the angle: it stops the auto-spin and
     steers yaw (horizontal) and pitch (vertical) directly. Release
     leaves the computer parked — hit Spin to set it turning again. */
  var dragging = false, lastX = 0, lastY = 0;
  var ORBIT_SENS  = 0.012;                  // radians turned per pixel dragged
  var PITCH_LIMIT = 1.45;                   // ~83° — stop short of the poles

  pre.addEventListener('pointerdown', function (e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    stopSpin();
    pre.style.cursor = 'grabbing';
    if (pre.setPointerCapture) pre.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    yaw   += (e.clientX - lastX) * ORBIT_SENS;
    pitch += (e.clientY - lastY) * ORBIT_SENS;
    if (pitch >  PITCH_LIMIT) pitch =  PITCH_LIMIT;
    if (pitch < -PITCH_LIMIT) pitch = -PITCH_LIMIT;
    lastX = e.clientX;
    lastY = e.clientY;
    draw();
  });
  window.addEventListener('pointerup', function () {
    if (!dragging) return;
    dragging = false;
    pre.style.cursor = 'grab';
  });

  /* ---- HUD wiring --------------------------------------------- */
  var spinBtn = document.getElementById('pause');

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      if (!spinning) draw();                // the spin loop redraws itself
    }, 140);
  });

  document.getElementById('speed').addEventListener('click', function (e) {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    e.target.textContent = 'Speed: ' + ['Slow', 'Normal', 'Fast'][speedIdx];
  });

  document.getElementById('invert').addEventListener('click', function () {
    document.body.classList.toggle('invert');
  });

  spinBtn.addEventListener('click', function () {
    if (reduceMotion) return;
    if (spinning) stopSpin(); else startSpin();
  });

  /* ---- go ----------------------------------------------------- */
  measure();
  if (reduceMotion) {
    yaw = 0.6;                              // a settled 3/4 view
    draw();
  } else {
    rafId = requestAnimationFrame(frame);
  }
  syncSpinBtn();
})();
