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
   2. HERO ELEMENTS
   - Interference field (cursor-reactive ASCII water + ripples)
   - Hero computer (ASCII illustration cycling through screens)
   ----------------------------------------------------------- */
(function () {
  const fieldEl    = document.getElementById('asciiField');
  const computerEl = document.getElementById('asciiComputer');
  if (!fieldEl) return;

  // ---------- VIEW A: cursor-reactive field ----------
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

  // fitComputer has its own ResizeObserver on .hero-side, so we don't
  // need to call it here — that observer handles every layout shift.
  window.addEventListener('resize', scheduleFieldRebuild);

  // ---------- HERO COMPUTER ----------
  // Larger ASCII illustration in hero-side. Three states:
  //   1. entrance  — plays once on load. Types HELLO, then CZEŚĆ.
  //   2. attractor — loops "HOVER TO START" with a vertical bob until
  //                  the user hovers or focuses.
  //   3. menu      — full nav menu (see MENU MODE below).
  // Inner screen area: 58 chars wide × 22 rows tall.
  const SCREEN_W = 58;
  const SCREEN_H = 22;
  const BOX_W = SCREEN_W + 6;     // ═ count in top/bottom borders
  const KB_W  = SCREEN_W + 4;     // ─ count in keyboard borders
  const KB_INNER_W = KB_W;        // pattern width between │ │

  function padScreenLine(line) {
    const len = [...line].length;
    return line + ' '.repeat(Math.max(0, SCREEN_W - len));
  }

  function buildKbPattern(width) {
    // Roughly: clusters of 3 keys with a wide spacebar in the middle.
    let out = ' ';
    while (out.length < width - 14) out += '░░░ ';
    out += '░░░░░░░░░ ';                  // spacebar-ish block
    while (out.length < width) out += '░░ ';
    return out.slice(0, width);
  }
  const KB_PATTERN = buildKbPattern(KB_INNER_W);

  // Reusable frame strings (constant width, cheap to recompute once).
  const TOP_BORDER  = '╔' + '═'.repeat(BOX_W) + '╗';
  const BOX_EMPTY   = '║' + ' '.repeat(BOX_W) + '║';
  const SCREEN_TOP  = '║   ┌' + '─'.repeat(SCREEN_W) + '┐ ║';
  const SCREEN_BOT  = '║   └' + '─'.repeat(SCREEN_W) + '┘ ║';
  const FRONT_PANEL = (() => {
    const text = '(o)    [F] [F] [F] [F] [F] [F]';
    const left = Math.floor((BOX_W - text.length) / 2);
    const right = BOX_W - left - text.length;
    return '║' + ' '.repeat(left) + text + ' '.repeat(right) + '║';
  })();
  const BOT_BORDER  = '╚' + '═'.repeat(BOX_W) + '╝';
  const SLOPE_TOP   = ' \\' + ' '.repeat(BOX_W - 2) + '/ ';
  const SLOPE_BOT   = '  \\' + '_'.repeat(BOX_W - 4) + '/  ';
  const SLOPE_EDGE  = '   ' + '═'.repeat(BOX_W - 4) + '   ';
  const KB_TOP      = '┌' + '─'.repeat(KB_W) + '┐  ';
  const KB_INNER    = '│' + KB_PATTERN + '│  ';
  const KB_BOT      = '└' + '─'.repeat(KB_W) + '┘  ';

  function frameMachine(screenLines, cursorOn) {
    const rows = [];
    for (let i = 0; i < SCREEN_H; i++) {
      let src = screenLines[i] || '';
      if (cursorOn && src.includes('▮CURSOR▮')) {
        src = src.replace('▮CURSOR▮', '_');
      } else if (src.includes('▮CURSOR▮')) {
        src = src.replace('▮CURSOR▮', ' ');
      }
      rows.push(padScreenLine(src));
    }
    const out = [];
    out.push(TOP_BORDER);
    out.push(BOX_EMPTY);
    out.push(SCREEN_TOP);
    for (const r of rows) out.push('║   │' + r + '│ ║');
    out.push(SCREEN_BOT);
    out.push(BOX_EMPTY);
    out.push(FRONT_PANEL);
    out.push(BOT_BORDER);
    out.push(SLOPE_TOP);
    out.push(SLOPE_BOT);
    out.push(SLOPE_EDGE);
    out.push(KB_TOP);
    out.push(KB_INNER);
    out.push(KB_INNER);
    out.push(KB_BOT);
    return out.join('\n');
  }

  // ---------- MENU MODE ----------
  // Items navigate to in-page anchors. `name` is the title-case label that
  // sits under each folder icon; the order also drives keyboard navigation.
  const MENU_ITEMS = [
    { name: 'About',     href: '#about'     },
    { name: 'Resume',    href: '#resume'    },
    { name: 'Portfolio', href: '#portfolio' },
    { name: 'Blog',      href: '#blog'      },
    { name: 'Socials',   href: '#socials'   },
  ];
  // Folders are arranged in two centered rows on the desktop — three on top,
  // two on the bottom — to read like a classic Finder window.
  const MENU_TOP_ROW_COUNT = 3;
  // Base font-size of the menu overlay, expressed as a multiple of the
  // parent pre's font-size. Folder icons and labels are sized in em so
  // everything scales together when fitComputer changes the parent size.
  const MENU_FONT_SCALE = 1.05;
  // Folder SVG — outline-only so it inverts cleanly against the selection
  // highlight via `currentColor`. Step on the upper-left is the tab.
  const FOLDER_SVG =
    '<svg class="menu-folder__svg" viewBox="0 0 28 22" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linejoin="miter" ' +
    'aria-hidden="true">' +
      '<path d="M2 5 H10 L12 7 H26 V20 H2 Z"/>' +
      '<line x1="2" y1="7" x2="12" y2="7"/>' +
    '</svg>';
  // -1 means "nothing currently highlighted" — pointer is inside the
  // machine but not over any specific folder. Renderers treat -1 as a
  // no-selection state (no .menu-folder--selected class).
  let menuIdx = -1;
  let inMenu = false;
  let menuEl = null;  // <div> overlay holding the folder grid; rebuilt on entry

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  function ensureMenuEl() {
    if (menuEl) return;
    menuEl = document.createElement('div');
    menuEl.className = 'menu-folders';
    menuEl.setAttribute('role', 'navigation');
    menuEl.setAttribute('aria-label', 'Main menu');
    // Inline positioning + flex layout. Visual styling lives in style.css.
    menuEl.style.cssText =
      'position:absolute;left:0;top:0;' +
      'display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;' +
      'white-space:normal;pointer-events:none;';

    const rows = [
      document.createElement('div'),
      document.createElement('div'),
    ];
    rows.forEach((r) => {
      r.className = 'menu-folders__row';
      r.style.cssText = 'display:flex;justify-content:center;';
    });

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      const a = document.createElement('a');
      a.className = 'menu-folder';
      a.href = item.href;
      a.dataset.idx = String(i);
      a.tabIndex = -1;
      a.style.pointerEvents = 'auto';
      a.innerHTML =
        `<span class="menu-folder__icon">${FOLDER_SVG}</span>` +
        `<span class="menu-folder__label">${escapeHTML(item.name)}</span>`;
      (i < MENU_TOP_ROW_COUNT ? rows[0] : rows[1]).appendChild(a);
    }
    rows.forEach((r) => menuEl.appendChild(r));
  }

  function positionMenuEl() {
    if (!menuEl || !computerEl) return;
    const cs = getComputedStyle(computerEl);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const baseFs = parseFloat(cs.fontSize) || 12;
    const m = probeCharMetrics(cs);
    const left   = padL + SCREEN_COL_LEFT * m.charW;
    const top    = padT + SCREEN_ROW_TOP  * m.lineH;
    const width  = SCREEN_W * m.charW;
    const height = SCREEN_H * m.lineH;
    menuEl.style.left     = left.toFixed(2) + 'px';
    menuEl.style.top      = top.toFixed(2) + 'px';
    menuEl.style.width    = width.toFixed(2) + 'px';
    menuEl.style.height   = height.toFixed(2) + 'px';
    menuEl.style.fontSize = (baseFs * MENU_FONT_SCALE).toFixed(2) + 'px';
  }

  function updateMenuSelection() {
    if (!menuEl) return;
    const items = menuEl.querySelectorAll('.menu-folder');
    items.forEach((el, i) => {
      el.classList.toggle('menu-folder--selected', i === menuIdx);
    });
  }

  // Entrance: types HELLO, pauses, types CZEŚĆ (English then Polish).
  // Plays exactly once per page load — if the user hovers in mid-play
  // and later returns, elapsed time has already exceeded ENTRANCE_DURATION
  // so machineTick falls through to the attractor.
  const HELLO_TEXT = 'HELLO';
  const CZESC_TEXT = 'CZEŚĆ';
  const TYPE_MS_PER_CHAR = 160;
  const HOLD_BETWEEN_MS  = 600;
  const HOLD_AFTER_MS    = 1100;
  const ENTRANCE_DURATION =
    HELLO_TEXT.length * TYPE_MS_PER_CHAR +
    HOLD_BETWEEN_MS +
    CZESC_TEXT.length * TYPE_MS_PER_CHAR +
    HOLD_AFTER_MS;

  let mode = 'entrance';   // 'entrance' | 'attractor'
  let modeStartT = 0;      // timestamp of the current mode's first frame
  let machineRAF = null;

  // Center `text` in the screen, then append `trailing` (a 1-char cursor
  // or '') AFTER centering. Doing it this way keeps the word's column
  // fixed even as the cursor blinks on and off.
  function placeCentered(text, trailing) {
    const len = [...text].length;
    const left = Math.max(0, Math.floor((SCREEN_W - len) / 2));
    return ' '.repeat(left) + text + (trailing || '');
  }

  function renderEntrance(elapsed) {
    const helloEnd = HELLO_TEXT.length * TYPE_MS_PER_CHAR;
    const pauseEnd = helloEnd + HOLD_BETWEEN_MS;
    const czescEnd = pauseEnd + CZESC_TEXT.length * TYPE_MS_PER_CHAR;

    const helloChars = (elapsed < helloEnd)
      ? Math.floor(elapsed / TYPE_MS_PER_CHAR)
      : HELLO_TEXT.length;
    const czescChars = (elapsed < pauseEnd) ? 0
      : (elapsed < czescEnd)
        ? Math.floor((elapsed - pauseEnd) / TYPE_MS_PER_CHAR)
        : CZESC_TEXT.length;

    const blinkOn = Math.floor(elapsed / 400) % 2 === 0;
    // Cursor sits on whichever line is "active": HELLO until CZEŚĆ starts,
    // then jumps to CZEŚĆ.
    const cursorOnLine1 = elapsed < pauseEnd;
    const line1Cursor = cursorOnLine1 ? (blinkOn ? '▮' : ' ') : '';
    const line2Cursor = !cursorOnLine1 ? (blinkOn ? '▮' : ' ') : '';

    const lines = Array(SCREEN_H).fill('');
    const centerRow = Math.floor(SCREEN_H / 2);
    lines[centerRow - 1] = placeCentered(HELLO_TEXT.slice(0, helloChars), line1Cursor);
    if (elapsed >= pauseEnd) {
      lines[centerRow + 1] = placeCentered(CZESC_TEXT.slice(0, czescChars), line2Cursor);
    }
    computerEl.textContent = frameMachine(lines, false);
  }

  // ---------- ATTRACTOR: CENTERED PULSE ----------
  // The ASCII pre still draws the computer frame, but the screen interior
  // is left blank and an absolutely-positioned <span> floats over it,
  // pinned to the screen's center. The span fades smoothly via a sine
  // wave on rAF so it pulses in and out without ever fully disappearing.
  const BOUNCE_TEXT = '▸  HOVER TO START  ◂';
  // One full fade-in / fade-out cycle.
  const BLINK_PERIOD_MS  = 2400;
  // Floor opacity — the text dips to this value at the trough rather than
  // hitting zero, which keeps the motion feeling soft.
  const BLINK_MIN_OPACITY = 0.22;
  // The attractor text is rendered larger than the screen's grid font so
  // it's easier to read; positioning still uses the parent grid metrics.
  const BLINK_TEXT_SCALE = 1.6;
  // Inner-screen bounds, in character units within the pre's text grid:
  //   col 5..63 (exclusive right) → 58 cols of usable width
  //   row 3..25 (exclusive bottom) → 22 rows of usable height
  const SCREEN_COL_LEFT = 5;
  const SCREEN_COL_RIGHT = 5 + SCREEN_W;     // exclusive
  const SCREEN_ROW_TOP = 3;
  const SCREEN_ROW_BOTTOM = 3 + SCREEN_H;    // exclusive

  let bounceEl = null;
  let bounceX = 0, bounceY = 0;        // px, top-left of text relative to pre's padding box
  let bounceMetrics = null;            // { charW, lineH, textCharW, textLineH, padL, padT }
  let bounceStartT = 0;                // ms timestamp of the first tick (pulse phase anchor)
  let attractorReady = false;

  function ensureBounceEl() {
    if (bounceEl) return;
    bounceEl = document.createElement('span');
    bounceEl.className = 'computer-bounce';
    bounceEl.style.cssText =
      'position:absolute;left:0;top:0;white-space:pre;' +
      'pointer-events:none;will-change:opacity;';
    bounceEl.textContent = BOUNCE_TEXT;
  }

  // Apply the scaled font-size to bounceEl based on the current parent
  // (computerEl) font-size. Call after fitComputer changes the parent
  // size so the overlay scales with it.
  function applyBounceFontSize() {
    if (!bounceEl) return;
    const csParent = getComputedStyle(computerEl);
    const baseFs = parseFloat(csParent.fontSize) || 12;
    bounceEl.style.fontSize = (baseFs * BLINK_TEXT_SCALE).toFixed(2) + 'px';
  }

  // Probe a single char rendered with the given computed-style snapshot,
  // returning its rendered width and line-box height. Computed styles
  // are read once by the caller so we don't thrash layout.
  function probeCharMetrics(cs) {
    const fontSize = parseFloat(cs.fontSize) || 12;
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;' +
      `font-family:${cs.fontFamily};font-size:${cs.fontSize};` +
      `letter-spacing:${cs.letterSpacing};` +
      `line-height:${cs.lineHeight};` +
      `font-feature-settings:${cs.fontFeatureSettings};`;
    probe.textContent = 'M';
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const charW = rect.width  || fontSize * 0.6;
    const lineH = rect.height || fontSize * 1.2;
    probe.remove();
    return { charW, lineH };
  }

  function measureBounceMetrics() {
    // Two grids matter: the parent pre's character grid (used to locate
    // the screen interior in pixel space) and the overlay span's grid
    // (used to size and center the pulse text, since it's rendered at
    // a larger font-size than the parent).
    const csParent = getComputedStyle(computerEl);
    const padL = parseFloat(csParent.paddingLeft) || 0;
    const padT = parseFloat(csParent.paddingTop) || 0;
    const parent = probeCharMetrics(csParent);
    const overlay = probeCharMetrics(getComputedStyle(bounceEl));
    return {
      charW:     parent.charW,
      lineH:     parent.lineH,
      textCharW: overlay.charW,
      textLineH: overlay.lineH,
      padL, padT,
    };
  }

  function bounceBounds() {
    const m = bounceMetrics;
    return {
      left:   m.padL + SCREEN_COL_LEFT  * m.charW,
      right:  m.padL + SCREEN_COL_RIGHT * m.charW,
      top:    m.padT + SCREEN_ROW_TOP    * m.lineH,
      bottom: m.padT + SCREEN_ROW_BOTTOM * m.lineH,
      textW:  BOUNCE_TEXT.length * m.textCharW,
      textH:  m.textLineH,
    };
  }

  function clampBounce() {
    if (!bounceMetrics) return;
    const b = bounceBounds();
    // Pin both axes — the text is stationary now, so resizing should
    // recenter it rather than just clamp it back into bounds.
    bounceX = (b.left + b.right - b.textW) / 2;
    bounceY = (b.top + b.bottom - b.textH) / 2;
    bounceEl.style.transform = `translate(${bounceX.toFixed(2)}px, ${bounceY.toFixed(2)}px)`;
  }

  function setupAttractor() {
    // Render the computer with an empty screen, then attach the
    // overlay as a positioned child of the pre. textContent wipes any
    // prior children (including the menu overlay), so null its handle.
    computerEl.style.position = 'relative';
    const lines = Array(SCREEN_H).fill('');
    computerEl.textContent = frameMachine(lines, false);
    menuEl = null;

    ensureBounceEl();
    computerEl.appendChild(bounceEl);
    applyBounceFontSize();
    bounceMetrics = measureBounceMetrics();

    // Pin to the dead center of the screen interior.
    const b = bounceBounds();
    bounceX = (b.left + b.right - b.textW) / 2;
    bounceY = (b.top + b.bottom - b.textH) / 2;

    bounceStartT = 0;
    bounceEl.style.opacity = '1';
    bounceEl.style.transform = `translate(${bounceX.toFixed(2)}px, ${bounceY.toFixed(2)}px)`;
  }

  function tickBounce(t) {
    if (!bounceMetrics || !bounceEl) return;
    if (bounceStartT === 0) bounceStartT = t;
    // Cosine wave: starts at 1 (full visible), dips to BLINK_MIN_OPACITY
    // at half-period, returns to 1. Using rAF + sub-pixel opacity gives
    // a continuous fade without relying on a CSS transition.
    const phase = ((t - bounceStartT) % BLINK_PERIOD_MS) / BLINK_PERIOD_MS;
    const wave = 0.5 + 0.5 * Math.cos(2 * Math.PI * phase); // 1..0..1
    const opacity = BLINK_MIN_OPACITY + wave * (1 - BLINK_MIN_OPACITY);
    bounceEl.style.opacity = opacity.toFixed(3);
  }

  // Menu mode renders directly through here. The first call after entering
  // the menu wipes the screen and mounts the folder overlay; subsequent
  // calls (e.g. after arrow-key nav) just refresh the selection class on
  // the persistent DOM. Entrance + attractor are driven by the rAF loop
  // in machineTick.
  function renderMachine() {
    if (!computerEl || !inMenu) return;
    if (menuEl && menuEl.parentNode === computerEl) {
      updateMenuSelection();
      return;
    }
    computerEl.style.position = 'relative';
    const lines = Array(SCREEN_H).fill('');
    computerEl.textContent = frameMachine(lines, false);
    menuEl = null; // textContent just wiped any prior overlay
    ensureMenuEl();
    computerEl.appendChild(menuEl);
    positionMenuEl();
    updateMenuSelection();
  }

  function machineTick(t) {
    if (inMenu) { machineRAF = null; return; }
    if (modeStartT === 0) modeStartT = t;
    const elapsed = t - modeStartT;
    if (mode === 'entrance' && elapsed >= ENTRANCE_DURATION) {
      mode = 'attractor';
      modeStartT = t;
      attractorReady = false;
    } else if (mode === 'entrance') {
      renderEntrance(elapsed);
      machineRAF = requestAnimationFrame(machineTick);
      return;
    }
    // Attractor: lazy one-time frame setup, then per-frame bounce update.
    if (!attractorReady) {
      setupAttractor();
      attractorReady = true;
    }
    tickBounce(t);
    machineRAF = requestAnimationFrame(machineTick);
  }
  function startMachine() {
    if (machineRAF || inMenu) return;
    machineRAF = requestAnimationFrame(machineTick);
  }
  function stopMachine() {
    if (machineRAF) cancelAnimationFrame(machineRAF);
    machineRAF = null;
  }

  // Pick the largest font-size that keeps the (BOX_W + 2)-char-wide frame
  // inside the column it lives in. We measure the actual rendered char
  // width with a probe so we adapt to whatever monospace font the OS
  // ended up resolving from the stack — char-width-to-font-size ratio
  // varies between SF Mono, Menlo, Consolas, etc.
  const COMPUTER_FRAME_CHARS = BOX_W + 2; // outer ║ on each side
  function fitComputer() {
    if (!computerEl) return;
    const parent = computerEl.parentElement;
    if (!parent) return;
    const parentW = parent.clientWidth;
    if (!parentW) return;

    // Measure char width at a known font-size, then derive the ratio.
    const probe = document.createElement('span');
    probe.textContent = 'M';
    const cs = getComputedStyle(computerEl);
    const REF_SIZE = 16;
    probe.style.cssText = `position:absolute;visibility:hidden;font-family:${cs.fontFamily};font-size:${REF_SIZE}px;letter-spacing:${cs.letterSpacing};font-feature-settings:${cs.fontFeatureSettings};font-variant-ligatures:${cs.fontVariantLigatures};`;
    document.body.appendChild(probe);
    const charWAtRef = probe.getBoundingClientRect().width || REF_SIZE * 0.6;
    probe.remove();
    const charPerFontPx = charWAtRef / REF_SIZE;

    // Leave 2px of margin so sub-pixel rounding never pushes us over.
    const targetFrameW = parentW - 2;
    const idealFont = targetFrameW / (COMPUTER_FRAME_CHARS * charPerFontPx);
    const finalFont = Math.max(7, Math.min(16, Math.floor(idealFont)));
    computerEl.style.fontSize = finalFont + 'px';

    // Font-size shifts the bounce overlay's pixel geometry — rescale the
    // overlay's own font, re-measure, and clamp so the text stays
    // centered within the new screen rect.
    if (attractorReady && bounceEl && bounceEl.parentNode === computerEl) {
      applyBounceFontSize();
      bounceMetrics = measureBounceMetrics();
      clampBounce();
    }
    // Menu overlay sizing is also tied to the parent grid metrics.
    if (inMenu && menuEl && menuEl.parentNode === computerEl) {
      positionMenuEl();
    }
  }

  // Sync the field icon to the menu's current selection. Called after any
  // event that changes inMenu or menuIdx so hovering / arrow-keying menu
  // items drives the same overlay as hovering the nav bar.
  function syncMenuIcon() {
    if (inMenu && menuIdx >= 0 && menuIdx < MENU_ITEMS.length) {
      const href = MENU_ITEMS[menuIdx].href;
      if (NAV_ICON_KEYS.has(href)) { activeIcon = href; return; }
    }
    activeIcon = null;
  }

  function enterMenu(viaKeyboard) {
    if (inMenu) return;
    inMenu = true;
    // Keyboard entry (Tab focus) needs an initial selection so arrow
    // keys have something to start from. Pointer entry leaves selection
    // empty — items only highlight when the cursor actually lands on
    // one (handled by the mousemove listener below).
    menuIdx = viaKeyboard ? 0 : -1;
    stopMachine();
    // Menu rendering replaces the pre's innerHTML, removing the bounce
    // overlay; flag attractor for re-setup so it rebuilds on return.
    attractorReady = false;
    renderMachine();
    syncMenuIcon();
  }
  function exitMenu() {
    if (!inMenu) return;
    // Don't exit while focus is still inside the computer (e.g. mouseleave
    // after a Tab keyboard focus) or while the cursor is still hovering.
    if (computerEl && (document.activeElement === computerEl || computerEl.matches(':hover'))) return;
    inMenu = false;
    startMachine();
    syncMenuIcon();
  }
  function activateMenuItem(idx) {
    const item = MENU_ITEMS[idx];
    if (!item) return;
    const target = document.querySelector(item.href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history && typeof history.pushState === 'function') {
        history.pushState(null, '', item.href);
      }
    } else {
      window.location.href = item.href;
    }
  }

  if (computerEl) {
    computerEl.tabIndex = 0;

    computerEl.addEventListener('mouseenter', () => enterMenu(false));
    computerEl.addEventListener('mouseleave', exitMenu);
    computerEl.addEventListener('focus', () => enterMenu(true));
    computerEl.addEventListener('blur', exitMenu);

    // Selection follows the pointer: highlight the folder under the cursor,
    // clear the highlight when the cursor is over the frame or any gap
    // between folders. -1 = nothing selected.
    computerEl.addEventListener('mousemove', (e) => {
      if (!inMenu) return;
      const link = e.target.closest('.menu-folder');
      let idx = -1;
      if (link) {
        const parsed = parseInt(link.dataset.idx, 10);
        if (!Number.isNaN(parsed)) idx = parsed;
      }
      if (idx !== menuIdx) {
        menuIdx = idx;
        updateMenuSelection();
        syncMenuIcon();
      }
    });

    // Click anywhere in the machine while not in menu mode → enter menu mode
    // (covers touch devices that don't fire mouseenter reliably). Clicks on
    // a folder navigate.
    computerEl.addEventListener('click', (e) => {
      const link = e.target.closest('.menu-folder');
      if (link) {
        e.preventDefault();
        const idx = parseInt(link.dataset.idx, 10);
        if (!Number.isNaN(idx)) {
          menuIdx = idx;
          syncMenuIcon();
          activateMenuItem(idx);
        }
        return;
      }
      if (!inMenu) {
        enterMenu();
        computerEl.focus();
      }
    });

    // Listen at document level so hover-keyboard works: when the cursor is
    // over the computer (inMenu is true via mouseenter, even without focus),
    // arrow keys / Enter drive the menu instead of scrolling the page.
    document.addEventListener('keydown', (e) => {
      if (!inMenu) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        // From "nothing selected" go to the first item; otherwise wrap.
        menuIdx = menuIdx < 0 ? 0 : (menuIdx + 1) % MENU_ITEMS.length;
        renderMachine();
        syncMenuIcon();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        // From "nothing selected" go to the last item; otherwise wrap.
        menuIdx = menuIdx < 0
          ? MENU_ITEMS.length - 1
          : (menuIdx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        renderMachine();
        syncMenuIcon();
      } else if (e.key === 'Home') {
        e.preventDefault();
        menuIdx = 0;
        renderMachine();
        syncMenuIcon();
      } else if (e.key === 'End') {
        e.preventDefault();
        menuIdx = MENU_ITEMS.length - 1;
        renderMachine();
        syncMenuIcon();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (menuIdx >= 0) activateMenuItem(menuIdx);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        computerEl.blur();
      }
    });
  }

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
  if (computerEl) {
    startMachine();
    fitComputer();
    // Observe the column itself so font-size updates the moment its width
    // changes — works for window resizes, dev-tools toggles, parent layout
    // shifts, anything. Browsers throttle this to once per animation frame.
    if (typeof ResizeObserver !== 'undefined' && computerEl.parentElement) {
      new ResizeObserver(fitComputer).observe(computerEl.parentElement);
    }
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
