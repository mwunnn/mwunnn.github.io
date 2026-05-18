/* =========================================================
   SCRIPT.JS — Personal Site
   One small feature:
     1. Uptime counter in the About card
   Plain JS, no libraries. Run when the page is ready.
   ========================================================= */

/* -----------------------------------------------------------
   1. UPTIME COUNTER
   Tracks how long the visitor has had the page open.
   document.getElementById finds an element by its id="..."
   We update the text once per second using setInterval.
   ----------------------------------------------------------- */
const sessionStart = Date.now();
function updateUptime() {
  const seconds = Math.floor((Date.now() - sessionStart) / 1000);
  // padStart pads single digits with a leading zero (5 -> "05")
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const el = document.getElementById('uptime');
  if (el) el.textContent = `${m}:${s}`;
}
updateUptime();              // run once immediately
setInterval(updateUptime, 1000); // then every second

/* -----------------------------------------------------------
   2. HERO INTERFERENCE FIELD
   A cursor-reactive ASCII water surface — ambient shimmer and
   ripples, with 3D nav-link icons that fade in on hover.
   ----------------------------------------------------------- */
(function () {
  const fieldEl = document.getElementById('asciiField');
  if (!fieldEl) return;

  // ---------- cursor-reactive field ----------
  const RAMP = ' .:-=+*#%@';
  let cells = [];
  let cols = 0, rows = 0;
  let charW = 8, charH = 14;
  let mx = -9999, my = -9999;
  let fieldRAF = null;

  // idle-animation state
  let cursorPresence = 0; // 0 = idle, 1 = hover. eased.

  // Nav-link overlay state. Hovering a nav link fades the water out,
  // then fades a rotating 3D icon in. The transition is driven by
  // `iconPresence` (eased 0..1): water_alpha rides the first half,
  // icon_alpha rides the second half — sequenced, not crossfaded.
  let activeIcon = null;     // href key (e.g. '#about') or null
  let iconPresence = 0;      // 0 = water visible, 1 = icon visible. eased.
  let iconBuffer = null;     // Float32Array(rows*cols) — per-cell icon brightness (z-buffer)

  // Nav-link icons — each is a 2D bitmap extruded into a slab of point
  // layers along z, then rotated about the y-axis at render time.
  // Layer count + thickness control how "solid" the slab looks when
  // tilted; the bitmap itself is the silhouette you see face-on.
  // ICONS maps a nav href to its compiled point cloud + dimensions.
  const ICON_THICKNESS = 1.4;    // half-thickness in cell-width units
  const ICON_DEPTH_LAYERS = 5;   // # of point layers stacked along z
  const ICON_DENSITY_XY = 4;     // sub-samples per bitmap cell along x & y
  const ICON_ASPECT = 1.9;       // chars are ~1.9× taller than wide
  function buildIconPoints(bitmap) {
    const w = bitmap[0].length;
    const h = bitmap.length;
    const pts = [];
    const step = 1 / ICON_DENSITY_XY;
    const half = (ICON_DENSITY_XY - 1) / 2;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (bitmap[r].charAt(c) !== '@') continue;
        const xBase = c - (w - 1) / 2;
        const yBase = r - (h - 1) / 2;
        for (let dy = 0; dy < ICON_DENSITY_XY; dy++) {
          for (let dx = 0; dx < ICON_DENSITY_XY; dx++) {
            const x = xBase + (dx - half) * step;
            const y = yBase + (dy - half) * step;
            for (let l = 0; l < ICON_DEPTH_LAYERS; l++) {
              const z = -ICON_THICKNESS + (2 * ICON_THICKNESS) * l / (ICON_DEPTH_LAYERS - 1);
              pts.push({ x, y, z });
            }
          }
        }
      }
    }
    return { points: pts, w, h };
  }
  // Each icon also declares a `motion` — how it animates while visible:
  //   'spin' = rotates about y-axis (3D slab feel)
  //   'bob'  = face-on, translates up/down on a sine wave (gentle hover)
  const ICONS = {
    '#about': { ...buildIconPoints([
      '   @@@@@   ',
      '  @@   @@  ',
      '       @@  ',
      '      @@   ',
      '     @@    ',
      '     @@    ',
      '           ',
      '     @@    ',
      '     @@    ',
    ]), motion: 'spin' },
    '#resume': { ...buildIconPoints([
      ' @@@ ',
      ' @@@ ',
      ' @@@ ',
      '  @  ',
      '  @  ',
      '  @  ',
      '  @  ',
      ' @@@ ',
      '@@@@@',
      '@@@@@',
      '@@@@@',
      '@@@@@',
      '@@@@@',
      '@@@@@',
      ' @@@ ',
      ' @@@ ',
      '  @  ',
    ]), motion: 'bob' },
  };

  // Smoothstep — used to split the iconPresence transition cleanly into
  // a "water leaves" half and an "icon arrives" half.
  function smoothstep(a, b, x) {
    if (x <= a) return 0;
    if (x >= b) return 1;
    const u = (x - a) / (b - a);
    return u * u * (3 - 2 * u);
  }

  // Render the active icon as a point cloud into iconBuffer. For each
  // point, transform per the icon's motion, project to a cell, write
  // its depth-derived brightness (greater = closer = brighter). Cells
  // the icon doesn't touch stay at 0 so water shows through them.
  function renderIcon(t) {
    if (!iconBuffer) return;
    iconBuffer.fill(0);
    const icon = ICONS[activeIcon];
    if (!icon) return;

    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;

    // Fit the slab to ~75% of the field, respecting char aspect (chars
    // are ~1.9× taller than wide, so y maps to fewer rows than x to
    // columns for the same visual length).
    const scaleX = 0.75 * cols / icon.w;
    const scaleY = 0.75 * rows * ICON_ASPECT / icon.h;
    const SCALE = Math.min(scaleX, scaleY);

    if (icon.motion === 'bob') {
      // Face-on, no rotation. y is offset by a sine wave so the icon
      // hovers gently. Brightness comes straight from each point's z
      // (z = -ICON_THICKNESS is the front face → brightest).
      const BOB_OMEGA = 0.00314;   // rad/ms → ~2.0s period
      const BOB_AMP_ROWS = 1.5;    // ± rows of vertical travel
      const yOffset = Math.sin(t * BOB_OMEGA) * BOB_AMP_ROWS;
      const invMaxZ = 0.5 / ICON_THICKNESS;
      for (let i = 0; i < icon.points.length; i++) {
        const p = icon.points[i];
        const cc = Math.round(cx + p.x * SCALE);
        const cr = Math.round(cy + p.y * SCALE / ICON_ASPECT + yOffset);
        if (cc < 0 || cc >= cols || cr < 0 || cr >= rows) continue;
        const idx = cr * cols + cc;
        const depth01 = 0.5 - p.z * invMaxZ;     // [0, 1], 1 = closest
        const brightness = 0.6 + depth01 * 0.4;  // [0.6, 1.0]
        if (brightness > iconBuffer[idx]) iconBuffer[idx] = brightness;
      }
      return;
    }

    // Default: spin about Y. Dynamic max-z so brightness uses the full
    // [0, 1] range at every rotation — at face-on, only the thickness
    // contributes; at edge-on, x reaches its max.
    const angle = -t * 0.0012; // negative = spin the other way
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const maxZ = ICON_THICKNESS * Math.abs(ca) + (icon.w / 2) * Math.abs(sa);
    const invMaxZ = maxZ > 1e-6 ? 0.5 / maxZ : 0;
    for (let i = 0; i < icon.points.length; i++) {
      const p = icon.points[i];
      const xr = p.x * ca + p.z * sa;
      const zr = -p.x * sa + p.z * ca;
      const cc = Math.round(cx + xr * SCALE);
      const cr = Math.round(cy + p.y * SCALE / ICON_ASPECT);
      if (cc < 0 || cc >= cols || cr < 0 || cr >= rows) continue;
      const idx = cr * cols + cc;
      // Keep the slab in the dense half of the ramp so even the back
      // face reads as "filled" — depth still cues which side is closer.
      const depth01 = 0.5 - zr * invMaxZ;       // [0, 1], 1 = closest
      const brightness = 0.6 + depth01 * 0.4;   // [0.6, 1.0]
      if (brightness > iconBuffer[idx]) iconBuffer[idx] = brightness;
    }
  }

  function measureChar() {
    // Probe lives INSIDE the field so it inherits font-family, font-size,
    // letter-spacing, and line-height through normal CSS — exactly like
    // the cells will. The previous version copied those props through
    // getComputedStyle into an inline string, which could drift
    // (sub-pixel font-size strings, quoted font names, line-height as
    // multiplier vs px) and produce slightly different metrics
    // fresh-vs-resize. Position absolute + offscreen keeps it out of
    // layout flow without disturbing the field.
    const probe = document.createElement('span');
    probe.textContent = 'M';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:-9999px;';
    fieldEl.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    charW = rect.width || 8;
    charH = rect.height || 14;
    fieldEl.removeChild(probe);
  }

  function buildField() {
    measureChar();
    // Stripped-down sizing: just read the field's own dimensions and
    // fill it with cells. No aspect-ratio detection, no min-height
    // parsing, no explicit field height — the stage has a fixed CSS
    // min-height now, so the field's stretched size is stable per
    // viewport. floor() leaves a small gap below the cells; that's
    // intentional for now and we'll address it as part of the
    // responsive pass later.
    const w = fieldEl.clientWidth || 400;
    const h = fieldEl.clientHeight || 320;
    const newCols = Math.max(20, Math.floor(w / charW));
    const newRows = Math.max(8, Math.floor(h / charH));
    if (cells.length > 0 && cols === newCols && rows === newRows) return;
    cols = newCols;
    rows = newRows;
    iconBuffer = new Float32Array(rows * cols);
    fieldEl.textContent = '';
    cells = [];
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = document.createElement('span');
        s.textContent = ' ';
        cells.push({ el: s, c, r, last: ' ' });
        frag.appendChild(s);
      }
      if (r < rows - 1) frag.appendChild(document.createTextNode('\n'));
    }
    fieldEl.appendChild(frag);
    drops.length = 0;
    nextDropAt = 0;
  }

  function onMove(e) {
    const rect = fieldEl.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    mx = cx / charW;
    my = cy / charH;
  }
  function onLeave() { mx = my = -9999; }

  fieldEl.addEventListener('mousemove', onMove);
  fieldEl.addEventListener('mouseleave', onLeave);
  fieldEl.addEventListener('touchmove', onMove, { passive: true });
  fieldEl.addEventListener('touchend', onLeave);

  // Idle animation 1: water surface — ambient shimmer + occasional drop.
  // A single ripple spawns at a random (center-biased) point, fully fades,
  // then the surface calms for DROP_CALM ms before the next drop.
  const DROP_LIFETIME = 3800;   // ms — ripple amplitude effectively zero by here
  const DROP_CALM     = 2400;   // ms of just-shimmer between ripples
  const DROP_SPREAD   = 0.55;   // 0 = always center, 1 = anywhere on the plate
  const DROP_SPEED    = 0.013;  // chars (aspect-corrected) per ms
  const DROP_FREQ     = 1.05;   // ripple wavelength factor (higher = denser rings)
  const DROP_FADE     = 0.0008; // amplitude decay per ms of age
  const DROP_FLASH    = 220;    // ms of bright central-impact flash

  let drops = [];      // active ripples: { x, y, start }
  let nextDropAt = 0;  // earliest ms at which a new drop may spawn

  function spawnDrop(t) {
    const x = cols / 2 + (Math.random() - 0.5) * cols * DROP_SPREAD;
    const y = rows / 2 + (Math.random() - 0.5) * rows * DROP_SPREAD;
    drops.push({ x, y, start: t });
  }
  function updateDrops(t) {
    for (let i = drops.length - 1; i >= 0; i--) {
      if (t - drops[i].start >= DROP_LIFETIME) drops.splice(i, 1);
    }
    if (drops.length === 0 && t >= nextDropAt) {
      spawnDrop(t);
      nextDropAt = t + DROP_LIFETIME + DROP_CALM;
    }
  }

  function tickField(t) {
    const ASPECT = 1.9; // chars are taller than wide
    const RAMP_LAST = RAMP.length - 1;

    const target = (mx > -9000) ? 1 : 0;
    cursorPresence += (target - cursorPresence) * 0.08;

    updateDrops(t);
    const cxP = cols / 2, cyP = rows / 2;

    // Sequenced transition: water out (presence 0..0.5), icon in (0.5..1).
    // Smoothstep on each half so the wipe doesn't feel mechanical.
    const iconTarget = activeIcon ? 1 : 0;
    iconPresence += (iconTarget - iconPresence) * 0.10;
    const waterAlpha = 1 - smoothstep(0, 0.5, iconPresence);
    const iconAlpha  = smoothstep(0.5, 1, iconPresence);
    if (iconAlpha > 0) renderIcon(t);

    for (const cell of cells) {
      // Hover field — appears on top when cursor is over the plate.
      let fieldI = 0;
      if (cursorPresence > 0.01) {
        const dx = cell.c - mx;
        const dy = (cell.r - my) * ASPECT;
        const d2 = dx * dx + dy * dy;
        const cursor = Math.exp(-d2 / 28);
        const wave = Math.max(0, Math.sin(cell.c * 0.22 + cell.r * 0.34 + t * 0.0009)) * 0.13;
        fieldI = (cursor + wave) * cursorPresence;
      }

      // Water shimmer + ripples — always running underneath.
      const dxC = cell.c - cxP;
      const dyC = (cell.r - cyP) * ASPECT;
      const dC = Math.sqrt(dxC * dxC + dyC * dyC);
      const amb1 = Math.sin(dC * 0.55 - t * 0.0014) * 0.18;
      const amb2 = Math.sin(dC * 0.95 + t * 0.0009) * 0.12;
      const amb3 = Math.sin(cell.c * 0.22 + cell.r * 0.27 + t * 0.0007) * 0.06;
      let s = 0.16 + amb1 + amb2 + amb3;

      for (const drop of drops) {
        const dx = cell.c - drop.x;
        const dy = (cell.r - drop.y) * ASPECT;
        const d = Math.sqrt(dx * dx + dy * dy);
        const age = t - drop.start;
        const r = age * DROP_SPEED;
        const delta = d - r;
        const env = (delta > 0)
          ? Math.exp(-delta * delta * 0.35)
          : Math.exp(delta * 0.05);
        const ring = Math.cos(delta * DROP_FREQ) * 0.5 + 0.5;
        const fade = Math.exp(-age * DROP_FADE);
        s += env * ring * fade * 0.85;

        if (age < DROP_FLASH && d < 3) {
          const flash = (1 - age / DROP_FLASH) * Math.exp(-d * d * 0.6);
          if (flash > s) s = flash;
        }
      }

      if (s < 0) s = 0; else if (s > 1) s = 1;
      const dropI = s;

      let intensity = (fieldI > dropI ? fieldI : dropI) * waterAlpha;
      if (iconAlpha > 0) {
        const ib = iconBuffer[cell.r * cols + cell.c] * iconAlpha;
        if (ib > intensity) intensity = ib;
      }

      const idx = intensity >= 1 ? RAMP_LAST : Math.floor(intensity * RAMP.length);
      const ch = RAMP[idx > RAMP_LAST ? RAMP_LAST : idx];

      if (ch !== cell.last) {
        cell.el.textContent = ch;
        cell.last = ch;
      }
    }
    fieldRAF = requestAnimationFrame(tickField);
  }
  function startField() {
    if (fieldRAF) return;
    if (cells.length === 0) buildField();
    fieldRAF = requestAnimationFrame(tickField);
  }
  function stopField() {
    if (fieldRAF) cancelAnimationFrame(fieldRAF);
    fieldRAF = null;
  }

  // Schedule a field rebuild on the next animation frame, coalescing
  // multiple triggers in the same frame. rAF aligns with the browser's
  // paint cycle so dimensions read inside buildField are always settled,
  // and the rebuild lands within ~16ms of the resize event instead of
  // waiting for a debounce timer.
  let rebuildScheduled = false;
  function scheduleFieldRebuild() {
    if (rebuildScheduled) return;
    rebuildScheduled = true;
    requestAnimationFrame(() => {
      rebuildScheduled = false;
      if (!fieldEl.hidden) buildField();
    });
  }

  window.addEventListener('resize', scheduleFieldRebuild);

  // ---------- NAV-LINK ICONS ----------
  // Hovering/focusing a nav link sets activeIcon to the link's href.
  // The render loop fades water out and a 3D icon in (see renderIcon).
  // Add hrefs here as new icons are implemented.
  const NAV_ICON_KEYS = new Set(['#about', '#resume']);

  document.querySelectorAll('.nav-bar a[href^="#"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!NAV_ICON_KEYS.has(href)) return;
    const show = () => { activeIcon = href; };
    const hide = () => { if (activeIcon === href) activeIcon = null; };
    a.addEventListener('mouseenter', show);
    a.addEventListener('mouseleave', hide);
    a.addEventListener('focus', show);
    a.addEventListener('blur', hide);
  });

  // ---------- INIT ----------
  if (cells.length === 0) buildField();
  startField();
  // Re-measure after web fonts settle — char metrics from the fallback may
  // not match the loaded font, which would leave the cell grid mis-sized.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (!fieldEl.hidden) buildField(); });
  }
  // Observe the stage so the field rebuilds whenever its container's size
  // changes — covers layout shifts that don't trigger window resize.
  // rAF-throttled (via scheduleFieldRebuild) so a sustained drag coalesces
  // into one rebuild per paint frame.
  if (typeof ResizeObserver !== 'undefined' && fieldEl.parentElement) {
    let firstFieldObserve = true;
    new ResizeObserver(() => {
      if (firstFieldObserve) { firstFieldObserve = false; return; }
      scheduleFieldRebuild();
    }).observe(fieldEl.parentElement);
  }
})();

/* -----------------------------------------------------------
   3. BACKGROUND GLYPHS
   Scatter little ASCII / Unicode symbols across the page
   margins — the gutters to the left and right of the centered
   .page column. Glyphs never land behind the main content.
   Random position, size, rotation, and opacity; redrawn on
   resize so the pattern always fills the current gutters.
   ----------------------------------------------------------- */
(function () {
  const host = document.getElementById('bgGlyphs');
  const pageEl = document.querySelector('.page');
  if (!host || !pageEl) return;

  // Vocabulary chosen to echo glyphs already used elsewhere on the site
  // (◆ ▪ ▸ ▾ ░ ▒ ▓ § ¶ etc.) so the pattern feels native, not pasted on.
  const GLYPHS = [
    '◆', '◇', '◈', '◉', '◦',
    '▪', '▫', '▸', '▾', '▴', '◂',
    '✦', '✧', '✺', '✱', '✣', '✚', '✕',
    '⌘', '⌬', '⌖', '⌗', '⌑',
    '§', '¶', '†', '‡', '※', '⁂',
    '⊹', '⊛', '⨀', '❋', '☼'
  ];

  // Density: roughly one glyph per AREA_PER_GLYPH px² of *gutter* area.
  // Lower number = denser pattern. Capped to keep DOM count sane on tall pages.
  const AREA_PER_GLYPH = 9000;
  const MIN_COUNT = 12;
  const MAX_COUNT = 240;

  // Visual range — kept subtle so glyphs texture rather than compete.
  const SIZE_MIN = 11;       // px
  const SIZE_MAX = 26;       // px
  const OPACITY_MIN = 0.08;
  const OPACITY_MAX = 0.20;
  const ROTATE_RANGE = 18;   // ± degrees

  // Inset from the very edge of the viewport / inner edge of the gutter, so
  // glyphs don't clip at the screen edge or kiss the .page border.
  const OUTER_INSET = 8;     // px from the window edge
  const INNER_INSET = 6;     // px from the .page column edge

  // Below this gutter width there's no room for the pattern — bail out.
  const MIN_GUTTER = 28;     // px

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function place() {
    const docH = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.documentElement.clientHeight
    );

    // Live page-column edges in viewport coordinates. Reading the bounding
    // rect (instead of hardcoding 1200) means this stays correct if the
    // .page max-width or padding ever changes.
    const pageRect = pageEl.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const leftGutter  = Math.max(0, pageRect.left - OUTER_INSET - INNER_INSET);
    const rightGutter = Math.max(0, vw - pageRect.right - OUTER_INSET - INNER_INSET);

    host.textContent = '';

    // No room on either side (narrow viewport) — render nothing.
    if (leftGutter < MIN_GUTTER && rightGutter < MIN_GUTTER) return;

    const usableLeft  = leftGutter  >= MIN_GUTTER ? leftGutter  : 0;
    const usableRight = rightGutter >= MIN_GUTTER ? rightGutter : 0;
    const totalGutterArea = (usableLeft + usableRight) * docH;
    const count = Math.min(
      MAX_COUNT,
      Math.max(MIN_COUNT, Math.round(totalGutterArea / AREA_PER_GLYPH))
    );

    // Probability of picking the right side, weighted by relative width so
    // both gutters end up at the same visual density.
    const rightBias = (usableLeft + usableRight) > 0
      ? usableRight / (usableLeft + usableRight)
      : 0;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.textContent = pick(GLYPHS);

      const onRight = Math.random() < rightBias;
      let xPx;
      if (onRight) {
        // Right gutter: from .page right edge (+ inner inset) out to vw - OUTER_INSET
        xPx = rand(pageRect.right + INNER_INSET, vw - OUTER_INSET);
      } else {
        // Left gutter: from OUTER_INSET in to .page left edge - INNER_INSET
        xPx = rand(OUTER_INSET, pageRect.left - INNER_INSET);
      }

      s.style.left = xPx.toFixed(1) + 'px';
      s.style.top = ((rand(0, docH)) | 0) + 'px';
      s.style.fontSize = rand(SIZE_MIN, SIZE_MAX).toFixed(1) + 'px';
      s.style.opacity = rand(OPACITY_MIN, OPACITY_MAX).toFixed(3);
      // translate(-50%, -50%) centers each glyph on its left/top coord so it
      // can't drift past the gutter edges as its font-size varies.
      s.style.transform = 'translate(-50%, -50%) rotate(' + rand(-ROTATE_RANGE, ROTATE_RANGE).toFixed(1) + 'deg)';
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  place();

  // Re-scatter on resize (debounced) and once more after full load in case
  // late-loading fonts/images shift the document height.
  let resizeT = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(place, 200);
  });
  window.addEventListener('load', place);
})();

/* -----------------------------------------------------------
   BONUS: a tiny easter egg.
   Type "hello" anywhere on the page to see it briefly invert.
   Try removing the // to enable it!
   ----------------------------------------------------------- */
// let typed = '';
// document.addEventListener('keydown', (e) => {
//   typed = (typed + e.key).slice(-5).toLowerCase();
//   if (typed === 'hello') {
//     document.body.style.filter = 'invert(1)';
//     setTimeout(() => { document.body.style.filter = ''; }, 600);
//   }
// });
