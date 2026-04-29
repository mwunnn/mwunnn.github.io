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

  function measureChar() {
    const probe = document.createElement('span');
    probe.textContent = 'M';
    const cs = getComputedStyle(fieldEl);
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:${cs.fontFamily};font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing};line-height:${cs.lineHeight};`;
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    charW = rect.width || 8;
    charH = rect.height || (parseFloat(cs.fontSize) * 1.05);
    probe.remove();
  }

  function buildField() {
    measureChar();
    // Read the height target from the stage's CSS min-height (resolved
    // pixels, stable per viewport) rather than fieldEl.clientHeight — the
    // latter reflects the explicit height we set at the end of this
    // function, which would feed back into the next call and grow the
    // plate by a row on every resize.
    const stage = fieldEl.parentElement;
    const stageStyle = stage ? getComputedStyle(stage) : null;
    const stagePadV = stageStyle
      ? parseFloat(stageStyle.paddingTop) + parseFloat(stageStyle.paddingBottom)
      : 0;
    const stageMinH = stageStyle ? parseFloat(stageStyle.minHeight) : NaN;
    const w = fieldEl.clientWidth || 400;
    const h = (stageMinH > 0 ? stageMinH - stagePadV : fieldEl.clientHeight) || 320;
    cols = Math.max(20, Math.floor(w / charW));
    // ceil + no trailing \n + explicit height below = the cell grid covers
    // the figure exactly, no blank band at the bottom of the plate.
    rows = Math.max(8, Math.ceil(h / charH));
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
    fieldEl.style.height = (rows * charH) + 'px';
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

      const intensity = fieldI > dropI ? fieldI : dropI;
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

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!fieldEl.hidden) buildField();
      fitComputer();
    }, 120);
  });

  // ---------- HERO COMPUTER ----------
  // Larger ASCII illustration that lives in hero-side and cycles through
  // screen content. Inner screen area: 58 chars wide × 22 rows tall —
  // sized to give breathing room for menu/navigation content.
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
  // Items navigate to in-page anchors. Order matches the nav bar.
  const MENU_ITEMS = [
    { label: '[01] ABOUT',    href: '#about'   },
    { label: '[02] WORK',     href: '#work'    },
    { label: '[03] WRITING',  href: '#writing' },
    { label: '[04] CONTACT',  href: '#contact' },
  ];
  // Index inside the screen's SCREEN_H rows where item 0 sits.
  const MENU_FIRST_ITEM_LINE = 4;
  let menuIdx = 0;
  let inMenu = false;

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  function buildMenuLines() {
    const lines = [];
    lines.push('');
    lines.push(' MAIN MENU');
    lines.push(' ' + '─'.repeat(SCREEN_W - 2));
    lines.push('');
    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const marker = (i === menuIdx) ? '▸' : ' ';
      lines.push(` ${marker}  ${MENU_ITEMS[i].label}`);
    }
    lines.push('');
    lines.push(' ↑↓ NAVIGATE   ↵ OPEN   ✕ CLICK');
    return lines;
  }

  // Build the full machine as HTML, wrapping menu-item lines in <a> so each
  // row is a hit target. The frame characters stay as plain (escaped) text.
  function frameMachineMenuHTML() {
    const lines = buildMenuLines();
    const screenRows = [];
    for (let i = 0; i < SCREEN_H; i++) {
      screenRows.push(padScreenLine(lines[i] || ''));
    }
    const parts = [];
    parts.push(escapeHTML(TOP_BORDER));
    parts.push(escapeHTML(BOX_EMPTY));
    parts.push(escapeHTML(SCREEN_TOP));
    for (let i = 0; i < SCREEN_H; i++) {
      const itemIdx = i - MENU_FIRST_ITEM_LINE;
      if (itemIdx >= 0 && itemIdx < MENU_ITEMS.length) {
        const item = MENU_ITEMS[itemIdx];
        const sel = (itemIdx === menuIdx) ? ' menu-item--selected' : '';
        parts.push(
          escapeHTML('║   │') +
          `<a href="${escapeHTML(item.href)}" class="menu-item${sel}" data-idx="${itemIdx}" tabindex="-1">` +
          escapeHTML(screenRows[i]) +
          '</a>' +
          escapeHTML('│ ║')
        );
      } else {
        parts.push(escapeHTML('║   │' + screenRows[i] + '│ ║'));
      }
    }
    parts.push(escapeHTML(SCREEN_BOT));
    parts.push(escapeHTML(BOX_EMPTY));
    parts.push(escapeHTML(FRONT_PANEL));
    parts.push(escapeHTML(BOT_BORDER));
    parts.push(escapeHTML(SLOPE_TOP));
    parts.push(escapeHTML(SLOPE_BOT));
    parts.push(escapeHTML(SLOPE_EDGE));
    parts.push(escapeHTML(KB_TOP));
    parts.push(escapeHTML(KB_INNER));
    parts.push(escapeHTML(KB_INNER));
    parts.push(escapeHTML(KB_BOT));
    return parts.join('\n');
  }

  const SCREENS = [
    {
      label: 'BOOTING SYSTEM 1.0',
      lines: [
        ' SYSTEM 1.0  BOOTING...',
        '',
        ' RAM CHECK ............ OK',
        ' CPU @ 8MHz ........... OK',
        ' LOADING WORKBENCH .... OK',
        '',
        ' READY.▮CURSOR▮'
      ]
    },
    {
      label: 'GREETING',
      lines: [
        '      ╭───────────╮',
        '      │           │',
        '      │   o   o   │',
        '      │           │',
        '      │    \\_/    │',
        '      ╰───────────╯',
        '       HELLO WORLD'
      ]
    },
    {
      label: 'TERMINAL SESSION',
      lines: [
        ' $ whoami',
        ' matthew_trefon',
        ' $ ls projects/',
        ' > portfolio.html',
        ' > tinker.app',
        ' > coffee.sh',
        ' $ ▮CURSOR▮'
      ]
    },
    {
      label: 'DOWNLOADING IDEAS',
      lines: [
        '',
        ' DOWNLOADING IDEAS...',
        '',
        ' [██████████░░░░░░] 64%',
        '',
        ' ETA: 2026',
        ''
      ]
    },
    {
      label: 'NOW PLAYING',
      lines: [
        '',
        '   ♪  NOW PLAYING  ♪',
        '',
        '  A QUIET LITTLE TUNE',
        '',
        '  03:42 / 04:15',
        '  [███████░░░░░░░░░]'
      ]
    }
  ];

  let screenIdx = 0;
  let blinkOn = true;
  let cycleTimer = null;
  let blinkTimer = null;

  function renderMachine() {
    if (!computerEl) return;
    if (inMenu) {
      computerEl.innerHTML = frameMachineMenuHTML();
    } else {
      computerEl.textContent = frameMachine(SCREENS[screenIdx].lines, blinkOn);
    }
  }
  function nextScreen() {
    if (inMenu) return;
    screenIdx = (screenIdx + 1) % SCREENS.length;
    renderMachine();
  }
  function startMachine() {
    if (cycleTimer) return;
    renderMachine();
    cycleTimer = setInterval(nextScreen, 4500);
    blinkTimer = setInterval(() => {
      if (inMenu) return;
      blinkOn = !blinkOn;
      renderMachine();
    }, 550);
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
  }

  function enterMenu() {
    if (inMenu) return;
    inMenu = true;
    renderMachine();
  }
  function exitMenu() {
    if (!inMenu) return;
    // Don't exit while focus is still inside the computer (e.g. mouseleave
    // after a Tab keyboard focus) or while the cursor is still hovering.
    if (computerEl && (document.activeElement === computerEl || computerEl.matches(':hover'))) return;
    inMenu = false;
    renderMachine();
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

    computerEl.addEventListener('mouseenter', enterMenu);
    computerEl.addEventListener('mouseleave', exitMenu);
    computerEl.addEventListener('focus', enterMenu);
    computerEl.addEventListener('blur', exitMenu);

    // Hover an item to move the selection cursor to it.
    computerEl.addEventListener('mousemove', (e) => {
      if (!inMenu) return;
      const link = e.target.closest('.menu-item');
      if (!link) return;
      const idx = parseInt(link.dataset.idx, 10);
      if (!Number.isNaN(idx) && idx !== menuIdx) {
        menuIdx = idx;
        renderMachine();
      }
    });

    // Click anywhere in the machine while not in menu mode → enter menu mode
    // (covers touch devices that don't fire mouseenter reliably). Clicks on
    // a menu item navigate.
    computerEl.addEventListener('click', (e) => {
      const link = e.target.closest('.menu-item');
      if (link) {
        e.preventDefault();
        const idx = parseInt(link.dataset.idx, 10);
        if (!Number.isNaN(idx)) {
          menuIdx = idx;
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
        menuIdx = (menuIdx + 1) % MENU_ITEMS.length;
        renderMachine();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        menuIdx = (menuIdx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        renderMachine();
      } else if (e.key === 'Home') {
        e.preventDefault();
        menuIdx = 0;
        renderMachine();
      } else if (e.key === 'End') {
        e.preventDefault();
        menuIdx = MENU_ITEMS.length - 1;
        renderMachine();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateMenuItem(menuIdx);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        computerEl.blur();
      }
    });
  }

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
  // Debounced so a sustained drag doesn't rebuild the cell grid 30+ times
  // per second; it just fires once after the resize quiets down.
  if (typeof ResizeObserver !== 'undefined' && fieldEl.parentElement) {
    let firstFieldObserve = true;
    let stageResizeT = null;
    new ResizeObserver(() => {
      if (firstFieldObserve) { firstFieldObserve = false; return; }
      clearTimeout(stageResizeT);
      stageResizeT = setTimeout(() => {
        if (!fieldEl.hidden) buildField();
      }, 150);
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
