/* =========================================================
   SCRIPT.JS — MATTHEW_OS (Desktop OS concept)

   Standalone build. Drives four stages, tracked as <body>
   classes (see index.html):

     1. powered off — computer on the desk, power button pulses
     2. os-on       — CRT lit, boot log types out
     3. os-zooming  — the screen rushes forward to fill the view
     4. os-desktop  — the desktop: icons, windows, the Sidekick

   Nothing here touches the original site files.
   ========================================================= */
(function () {
  'use strict';

  const reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 700px)').matches;

  /* ---- element handles ---------------------------------- */
  const body       = document.body;
  const screenSlot = document.getElementById('screenSlot');
  const powerBtn   = document.getElementById('powerBtn');
  const crt        = document.getElementById('crt');
  const bootLog    = document.getElementById('bootLog');
  const desktop    = document.getElementById('desktop');
  const desk       = document.getElementById('desk');
  const deskIcons  = document.getElementById('deskIcons');
  const menubarNav = document.getElementById('menubarNav');
  const clockEl    = document.getElementById('clock');
  const sidekick   = document.getElementById('sidekick');
  const dock       = document.getElementById('dock');

  /* =========================================================
     CONTENT — windows and the icons that open them.
     One place to edit copy. `content` is the window's inner
     HTML; classes are styled in style.css section 10.
     ========================================================= */
  const WINDOWS = {
    read_me: {
      title: 'read_me.txt',
      content:
        '<p class="lead">Hi — I’m Matthew Trefon.</p>' +
        '<p>You’ve just switched on a small machine. It isn’t really a ' +
        'computer; it’s me. Every folder on this desktop opens a part of ' +
        'who I am — what I think about, what I’ve built, and what ' +
        'I’m chasing next.</p>' +
        '<p>Take your time. Open things. Drag them around the desk.</p>' +
        '<h4>Where to start</h4>' +
        '<ul class="os-dir">' +
        '<li><a class="os-dir__title" data-open="about" href="#">▸ About — if we’ve never met</a><span class="os-dir__meta">open</span></li>' +
        '<li><a class="os-dir__title" data-open="portfolio" href="#">▸ Portfolio — if you want the work</a><span class="os-dir__meta">open</span></li>' +
        '<li><a class="os-dir__title" data-open="socials" href="#">▸ Socials — if you’d like to keep in touch</a><span class="os-dir__meta">open</span></li>' +
        '</ul>' +
        '<p class="win__signature">— M.</p>',
    },
    about: {
      title: 'about_me.txt',
      content:
        '<h3>About</h3>' +
        '<p>One paragraph that introduces you. Where you live, what you do, ' +
        'and the thread running through it all. Keep it short — first ' +
        'paragraphs do the heavy lifting.</p>' +
        '<p>A second paragraph for texture. The hobbies, the obsessions, the ' +
        'slightly embarrassing detail you’re proud of. Specifics beat ' +
        'generics every time.</p>' +
        '<dl class="os-stats">' +
        '<dt>Status</dt><dd>● Online</dd>' +
        '<dt>Location</dt><dd>Your City</dd>' +
        '<dt>Currently</dt><dd>Building things</dd>' +
        '<dt>Reading</dt><dd>LaserWriter II</dd>' +
        '<dt>Uptime</dt><dd id="osUptime">--</dd>' +
        '</dl>',
    },
    resume: {
      title: 'resume.doc',
      content:
        '<h3>Resume</h3>' +
        '<p>A line on what you’re looking for, or the shape of work you do best.</p>' +
        '<h4>Experience</h4>' +
        '<div class="os-job">' +
        '<div class="os-job__head"><span class="os-job__role">Job Title</span>' +
        '<span class="os-job__date">2024 — Now</span></div>' +
        '<div class="os-job__where">Company Name</div>' +
        '<p>One or two lines on what you did and what changed because of it.</p></div>' +
        '<div class="os-job">' +
        '<div class="os-job__head"><span class="os-job__role">Earlier Title</span>' +
        '<span class="os-job__date">2022 — 2024</span></div>' +
        '<div class="os-job__where">Previous Company</div>' +
        '<p>Another short, concrete line. Numbers help if you have them.</p></div>' +
        '<h4>Toolkit</h4>' +
        '<p>The tools, languages, and skills you’d list on a card.</p>',
    },
    portfolio: {
      title: 'portfolio',
      content:
        '<h3>Portfolio</h3>' +
        '<p>Selected work, 2022–2026. Click through to a project.</p>' +
        '<div class="os-grid">' +
        card('lines', '2026 · Project', 'Project Title One') +
        card('grad',  '2025 · Site',    'A Quiet Little Website') +
        card('cross', '2025 · Tool',    'Small Useful Tool') +
        card('solid', '2024 · Essay',   'An Essay With A Title') +
        '</div>',
    },
    blog: {
      title: 'blog',
      content:
        '<h3>Blog</h3>' +
        '<p>Notes, most recent first.</p>' +
        '<ul class="os-dir">' +
        post('Notes on Making Small Things', '04·12·2026 · 5 min') +
        post('Why I Keep a Plain-Text Journal', '02·28·2026 · 8 min') +
        post('An Argument for Boring Tools', '01·09·2026 · 3 min') +
        post('The First Thing I Built That Worked', '11·22·2025 · 6 min') +
        '</ul>',
    },
    socials: {
      title: 'socials',
      content:
        '<h3>Socials</h3>' +
        '<p>Find me around, or say hello directly.</p>' +
        '<ul class="os-links">' +
        link('Email',    'you@example.com',        'mailto:you@example.com') +
        link('GitHub',   '@yourhandle',            '#') +
        link('Are.na',   '@yourhandle',            '#') +
        link('Mastodon', '@you@instance.social',   '#') +
        link('RSS',      '/feed.xml',              '#') +
        '</ul>',
    },
    // The original static site, embedded in its own window.
    static_site: {
      title: 'static_site',
      cls: 'win--site',
      content:
        '<iframe class="win__site" src="../site/index.html" ' +
        'title="Matthew Trefon — the static site" loading="lazy"></iframe>',
    },
  };

  /* small content helpers ---------------------------------- */
  function card(sw, label, title) {
    return (
      '<a class="os-card" href="#">' +
      '<div class="os-card__swatch sw-' + sw + '"></div>' +
      '<div class="os-card__body">' +
      '<div class="os-card__label">' + label + '</div>' +
      '<div class="os-card__title">' + title + '</div>' +
      '</div></a>'
    );
  }
  function post(title, meta) {
    return (
      '<li><a class="os-dir__title" href="#">▸ ' + title + '</a>' +
      '<span class="os-dir__meta">' + meta + '</span></li>'
    );
  }
  function link(label, text, href) {
    return (
      '<li><span class="os-links__label">' + label + '</span>' +
      '<a href="' + href + '">' + text + '</a></li>'
    );
  }

  /* Icons on the desk, in display order. `type` picks the SVG. */
  const ICONS = [
    { id: 'read_me',     label: 'read_me',     type: 'doc'    },
    { id: 'about',       label: 'About',       type: 'folder' },
    { id: 'resume',      label: 'Resume',      type: 'folder' },
    { id: 'portfolio',   label: 'Work',        type: 'folder' },
    { id: 'blog',        label: 'Blog',        type: 'folder' },
    { id: 'socials',     label: 'Socials',     type: 'folder' },
    { id: 'static_site', label: 'Static Site', type: 'doc'    },
  ];

  const FOLDER_SVG =
    '<svg viewBox="0 0 24 20" aria-hidden="true">' +
    '<path d="M1.6 4.5 H8 l2 2 H22.4 V17.4 H1.6 Z"/></svg>';
  const DOC_SVG =
    '<svg viewBox="0 0 24 20" aria-hidden="true">' +
    '<path d="M5 1.6 H14.5 L19 6 V18.4 H5 Z"/>' +
    '<path d="M14.5 1.6 V6 H19"/></svg>';

  /* Apps in the bottom dock — placeholders for now; clicking one
     just bounces it. Outline icons, in the same line-art style. */
  function appSvg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + inner + '</svg>';
  }
  const DOCK_APPS = [
    { id: 'notes', label: 'Notes', svg: appSvg(
      '<rect x="5" y="3" width="14" height="18" rx="1.5"/>' +
      '<line x1="8.5" y1="8"  x2="15.5" y2="8"/>' +
      '<line x1="8.5" y1="12" x2="15.5" y2="12"/>' +
      '<line x1="8.5" y1="16" x2="13"   y2="16"/>') },
    { id: 'music', label: 'Music', svg: appSvg(
      '<path d="M9 18 V7 L19 4.5 V15"/>' +
      '<circle cx="6.4"  cy="18" r="2.6"/>' +
      '<circle cx="16.4" cy="15" r="2.6"/>') },
    { id: 'photos', label: 'Photos', svg: appSvg(
      '<rect x="3" y="7" width="18" height="13" rx="2"/>' +
      '<path d="M9 7 L10.5 4.5 H13.5 L15 7"/>' +
      '<circle cx="12" cy="13.5" r="3.6"/>') },
    { id: 'terminal', label: 'Terminal', svg: appSvg(
      '<rect x="3" y="5" width="18" height="14" rx="1.5"/>' +
      '<path d="M7 10 L10 12.5 L7 15"/>' +
      '<line x1="12" y1="15" x2="16" y2="15"/>') },
    { id: 'mail', label: 'Mail', svg: appSvg(
      '<rect x="3" y="6" width="18" height="12" rx="1.5"/>' +
      '<path d="M3.5 7 L12 13 L20.5 7"/>') },
  ];

  /* =========================================================
     STAGE 1 → 2 → 3 → 4 : power on, boot, zoom, desktop
     ========================================================= */

  // Dock the CRT exactly over the computer's screen recess. Done
  // with the transition suppressed so it doesn't visibly slide.
  function dockCRT() {
    if (body.classList.contains('os-zooming') ||
        body.classList.contains('os-desktop')) return;
    const r = screenSlot.getBoundingClientRect();
    crt.style.transition = 'none';
    crt.style.top    = r.top + 'px';
    crt.style.left   = r.left + 'px';
    crt.style.width  = r.width + 'px';
    crt.style.height = r.height + 'px';
    // Force a reflow, then hand the transition back for the zoom.
    void crt.offsetWidth;
    crt.style.transition = '';
  }

  // Title card — the animated entrance (banner wipe, tagline ripple,
  // computer rise). Plays once per browser tab; reduced motion skips
  // it. CSS does the animating; this just toggles the .cover-intro
  // class and re-docks the CRT once the computer has settled.
  function playCover() {
    if (reduceMotion || sessionStorage.getItem('mos_cover_seen')) return;
    sessionStorage.setItem('mos_cover_seen', '1');
    body.classList.add('cover-intro');
    window.setTimeout(function () {
      body.classList.remove('cover-intro');
      dockCRT();
    }, 2700);
  }

  let booted = false;
  function powerOn() {
    if (booted) return;
    booted = true;
    body.classList.add('os-on');
    typeBootLog(function () {
      window.setTimeout(beginZoom, reduceMotion ? 80 : 620);
    });
  }

  // The boot log. Lines tagged `dim` render faded; `hi` render bold.
  const BOOT_LINES = [
    { t: 'MATTHEW_OS   v3.0', cls: 'boot-hi' },
    { t: '─'.repeat(26), cls: 'boot-ok' },
    { t: '> power ............... OK' },
    { t: '> loading kernel ...... OK' },
    { t: '> mounting /self ...... OK' },
    { t: '> waking sidekick ..... OK' },
    { t: '' },
    { t: '  welcome.', cls: 'boot-hi' },
    { t: '  this machine is a portrait of me.' },
    { t: '  open a folder to look inside.' },
    { t: '' },
    { t: '> launching desktop' },
  ];

  function typeBootLog(done) {
    const caret = document.createElement('span');
    caret.className = 'caret';

    // Reduced motion: drop the whole log in at once.
    if (reduceMotion) {
      BOOT_LINES.forEach(function (ln) {
        const span = document.createElement('span');
        if (ln.cls) span.className = ln.cls;
        span.textContent = ln.t + '\n';
        bootLog.appendChild(span);
      });
      bootLog.appendChild(caret);
      window.setTimeout(done, 60);
      return;
    }

    let li = 0, ci = 0, line = null;
    bootLog.appendChild(caret);

    function step() {
      if (li >= BOOT_LINES.length) { done(); return; }
      const ln = BOOT_LINES[li];
      if (line === null) {
        line = document.createElement('span');
        if (ln.cls) line.className = ln.cls;
        bootLog.insertBefore(line, caret);
      }
      if (ci < ln.t.length) {
        line.textContent += ln.t.charAt(ci);
        ci++;
        // Dotted leader lines fly by; prose types at reading pace.
        const fast = ln.t.indexOf('....') !== -1;
        window.setTimeout(step, fast ? 7 : 17);
      } else {
        line.textContent += '\n';
        line = null; ci = 0; li++;
        window.setTimeout(step, 150);
      }
    }
    step();
  }

  // Animate the docked CRT out to fill the whole viewport.
  function beginZoom() {
    body.classList.add('os-zooming');
    crt.classList.add('crt--full');
    crt.style.top    = '0px';
    crt.style.left   = '0px';
    crt.style.width  = window.innerWidth + 'px';
    crt.style.height = window.innerHeight + 'px';

    let entered = false;
    function enter() {
      if (entered) return;
      entered = true;
      enterDesktop();
    }
    crt.addEventListener('transitionend', function onEnd(e) {
      if (e.propertyName === 'width') {
        crt.removeEventListener('transitionend', onEnd);
        enter();
      }
    });
    // Fallback in case transitionend is missed.
    window.setTimeout(enter, reduceMotion ? 60 : 1100);
  }

  function enterDesktop() {
    body.classList.add('os-desktop');
    desktop.hidden = false;
    buildMenubar();
    buildIcons();
    buildDock();
    startClock();
    placeSidekick();
    if (!isMobile() && !reduceMotion) startWander();
    // The Static Site opens itself — kept front-and-centre so the
    // original site is the first thing to hand.
    window.setTimeout(function () { openWindow('static_site'); }, 420);
  }

  // Skip the whole power-on sequence and land straight on the
  // desktop — used when arriving already-booted (from the orrery
  // intro, which has effectively done the booting already).
  function bootInstant() {
    if (booted) return;
    booted = true;
    body.classList.add('os-on', 'os-zooming', 'os-desktop');
    crt.classList.add('crt--full');
    crt.style.transition = 'none';
    crt.style.top    = '0px';
    crt.style.left   = '0px';
    crt.style.width  = window.innerWidth + 'px';
    crt.style.height = window.innerHeight + 'px';
    enterDesktop();
  }

  /* =========================================================
     DESKTOP : menu bar + clock + uptime
     ========================================================= */
  function buildMenubar() {
    ICONS.filter(function (i) { return i.id !== 'read_me'; })
      .forEach(function (icon) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = icon.label;
        b.addEventListener('click', function () { openWindow(icon.id); });
        menubarNav.appendChild(b);
      });
  }

  const bootTime = Date.now();
  function startClock() {
    function tick() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      clockEl.textContent = hh + ':' + mm;
      // Uptime, if the About window is open.
      const up = document.getElementById('osUptime');
      if (up) {
        const s = Math.floor((Date.now() - bootTime) / 1000);
        const m = Math.floor(s / 60);
        up.textContent = m + 'M ' + String(s % 60).padStart(2, '0') + 'S';
      }
    }
    tick();
    window.setInterval(tick, 1000);
  }

  /* =========================================================
     DESKTOP : icons
     ========================================================= */
  function buildIcons() {
    ICONS.forEach(function (icon, i) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'desk-icon';
      el.dataset.win = icon.id;
      el.innerHTML =
        '<span class="desk-icon__art">' +
        (icon.type === 'doc' ? DOC_SVG : FOLDER_SVG) +
        '</span>' +
        '<span class="desk-icon__label">' + icon.label + '</span>';

      // Free placement on desktop (two columns, right side); the
      // mobile grid in CSS overrides this with position:static.
      const col = Math.floor(i / 3);
      const row = i % 3;
      el.style.right = (24 + col * 112) + 'px';
      el.style.top   = (24 + row * 116) + 'px';

      el.addEventListener('click', function () { openWindow(icon.id); });
      deskIcons.appendChild(el);
    });
  }

  // Build the bottom dock — placeholder apps that bounce on click.
  function buildDock() {
    DOCK_APPS.forEach(function (app) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock__app';
      b.setAttribute('aria-label', app.label);
      b.innerHTML = app.svg +
        '<span class="dock__tip">' + app.label + '</span>';
      b.addEventListener('click', function () {
        b.classList.remove('is-bouncing');
        void b.offsetWidth;            // restart the bounce
        b.classList.add('is-bouncing');
      });
      dock.appendChild(b);
    });
  }

  function syncIconStates() {
    deskIcons.querySelectorAll('.desk-icon').forEach(function (el) {
      el.classList.toggle('is-open', openWins.has(el.dataset.win));
    });
  }

  /* =========================================================
     DESKTOP : wallpaper glyphs
     Scatter faint ASCII marginalia across the desk surface — the
     same decorative back-layer the static site uses in its margins.
     ========================================================= */
  // Vocabulary matches the static site so the pattern feels native.
  const GLYPHS = [
    '◆', '◇', '◈', '◉', '◦',
    '▪', '▫', '▸', '▾', '▴', '◂',
    '✦', '✧', '✺', '✱', '✣', '✚', '✕',
    '⌘', '⌬', '⌖', '⌗', '⌑',
    '§', '¶', '†', '‡', '※', '⁂',
    '⊹', '⊛', '⨀', '❋', '☼'
  ];
  const GLYPH_AREA   = 13000;   // px² of viewport per glyph (higher = sparser)
  const GLYPH_MIN    = 24;      // never fewer than this
  const GLYPH_MAX    = 150;     // cap so the DOM stays light
  const GLYPH_SZ_MIN = 11;      // px
  const GLYPH_SZ_MAX = 26;      // px
  const GLYPH_OP_MIN = 0.05;    // faint — texture, not noise
  const GLYPH_OP_MAX = 0.16;
  const GLYPH_ROT    = 18;      // ± degrees
  const GLYPH_EDGE   = 2;       // % kept clear at the desk edges

  function gRand(a, b) { return a + Math.random() * (b - a); }
  function gPick(arr)  { return arr[(Math.random() * arr.length) | 0]; }

  function scatterGlyphs() {
    const host = document.getElementById('deskGlyphs');
    if (!host) return;

    // Positions are PERCENTAGES — the browser re-resolves them against the
    // desk on every reflow, so the pattern fills the surface no matter what
    // size the desk happened to be when this ran. Count scales with the
    // viewport, which is always measurable.
    const vw = window.innerWidth  || 1280;
    const vh = window.innerHeight || 800;
    const count = Math.min(GLYPH_MAX, Math.max(GLYPH_MIN,
      Math.round((vw * vh) / GLYPH_AREA)));

    host.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.textContent = gPick(GLYPHS);
      s.style.left = gRand(GLYPH_EDGE, 100 - GLYPH_EDGE).toFixed(2) + '%';
      s.style.top  = gRand(GLYPH_EDGE, 100 - GLYPH_EDGE).toFixed(2) + '%';
      s.style.fontSize = gRand(GLYPH_SZ_MIN, GLYPH_SZ_MAX).toFixed(1) + 'px';
      s.style.opacity  = gRand(GLYPH_OP_MIN, GLYPH_OP_MAX).toFixed(3);
      // translate(-50%,-50%) centers each glyph on its coord so it can't
      // drift past the desk edges as its font-size varies.
      s.style.transform = 'translate(-50%, -50%) rotate(' +
        gRand(-GLYPH_ROT, GLYPH_ROT).toFixed(1) + 'deg)';
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  // Re-scatter whenever the desk changes size. A ResizeObserver fires
  // once when observing starts and again as the desk settles into its
  // real dimensions (after the CRT zoom) — so the pattern always fills
  // the full surface rather than whatever size it had on first paint.
  (function observeDesk() {
    if (!desk) return;
    if (window.ResizeObserver) {
      let t = null;
      new ResizeObserver(function () {
        clearTimeout(t);
        t = setTimeout(scatterGlyphs, 120);
      }).observe(desk);
    } else {
      window.addEventListener('load', scatterGlyphs);
    }
  })();

  /* =========================================================
     WINDOWS : open, close, focus, drag
     ========================================================= */
  const openWins = new Map();   // id -> window element
  let zTop = 10;

  function bringToFront(win) {
    zTop++;
    win.style.zIndex = zTop;
    desk.querySelectorAll('.win').forEach(function (w) {
      w.classList.toggle('is-front', w === win);
    });
  }

  function openWindow(id) {
    const data = WINDOWS[id];
    if (!data) return;

    // Already open — just surface it.
    if (openWins.has(id)) { bringToFront(openWins.get(id)); return; }

    const win = document.createElement('div');
    win.className = 'win';
    if (data.cls) win.classList.add(data.cls);
    win.dataset.win = id;
    win.innerHTML =
      '<div class="win__bar">' +
      '<button class="win__close" type="button" aria-label="Close ' +
      data.title + '">×</button>' +
      '<span class="win__title">' + data.title + '</span>' +
      '</div>' +
      '<div class="win__body">' + data.content + '</div>' +
      '<div class="win__resize" aria-hidden="true"></div>';

    if (isMobile()) {
      win.classList.add('win--mobile');
    } else {
      // Cascade each new window down-and-right from the last.
      const n = openWins.size;
      win.style.left = (54 + n * 30) + 'px';
      win.style.top  = (30 + n * 30) + 'px';
      makeDraggable(win);
      makeResizable(win);
    }

    desk.appendChild(win);
    openWins.set(id, win);
    bringToFront(win);
    syncIconStates();

    // Close box.
    win.querySelector('.win__close')
       .addEventListener('click', function () { closeWindow(id); });

    // Focus on any pointer-down inside the window.
    win.addEventListener('pointerdown', function () { bringToFront(win); });

    // Cross-links inside content (e.g. read_me's "open About").
    win.querySelectorAll('[data-open]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openWindow(a.dataset.open);
      });
    });
  }

  function closeWindow(id) {
    const win = openWins.get(id);
    if (!win) return;
    openWins.delete(id);
    syncIconStates();
    win.classList.add('is-closing');
    window.setTimeout(function () { win.remove(); }, reduceMotion ? 0 : 140);
  }

  // Drag a window by its titlebar, clamped to the desk.
  function makeDraggable(win) {
    const bar = win.querySelector('.win__bar');
    let startX, startY, originX, originY, dragging = false;

    bar.addEventListener('pointerdown', function (e) {
      // Don't start a drag from the close box.
      if (e.target.closest('.win__close')) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originX = win.offsetLeft;
      originY = win.offsetTop;
      bar.setPointerCapture(e.pointerId);
      body.classList.add('win-dragging');
    });

    bar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const maxX = desk.clientWidth - 60;
      const maxY = desk.clientHeight - 28;
      const x = clamp(originX + (e.clientX - startX), 0, maxX);
      const y = clamp(originY + (e.clientY - startY), 0, maxY);
      win.style.left = x + 'px';
      win.style.top  = y + 'px';
    });

    function end(e) {
      if (!dragging) return;
      dragging = false;
      body.classList.remove('win-dragging');
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    }
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  // Drag the bottom-right corner grip to resize a window.
  function makeResizable(win) {
    const handle = win.querySelector('.win__resize');
    if (!handle) return;
    let startX, startY, startW, startH, resizing = false;

    handle.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = win.offsetWidth;
      startH = win.offsetHeight;
      handle.setPointerCapture(e.pointerId);
      body.classList.add('win-dragging');
    });

    handle.addEventListener('pointermove', function (e) {
      if (!resizing) return;
      const maxW = desk.clientWidth  - win.offsetLeft - 8;
      const maxH = desk.clientHeight - win.offsetTop  - 8;
      win.style.width  = clamp(startW + (e.clientX - startX), 220, maxW) + 'px';
      win.style.height = clamp(startH + (e.clientY - startY), 140, maxH) + 'px';
    });

    function end(e) {
      if (!resizing) return;
      resizing = false;
      body.classList.remove('win-dragging');
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* =========================================================
     SIDEKICK : the pixel bunny wanders the desk
     ========================================================= */
  function placeSidekick() {
    const w = desk.clientWidth, h = desk.clientHeight;
    moveSidekick(w * 0.42, h * 0.55, true);
  }

  function moveSidekick(x, y, instant) {
    if (instant) sidekick.style.transition = 'none';
    sidekick.style.setProperty('--sk-x', x + 'px');
    sidekick.style.setProperty('--sk-y', y + 'px');
    if (instant) { void sidekick.offsetWidth; sidekick.style.transition = ''; }
  }

  function startWander() {
    window.setInterval(function () {
      // Skip a turn now and then so the bunny pauses to think.
      if (Math.random() < 0.25) return;
      const m = 70;                                  // edge margin
      const x = m + Math.random() * (desk.clientWidth  - m * 2 - 90);
      const y = m + Math.random() * (desk.clientHeight - m * 2 - 80);
      const curX = parseFloat(sidekick.style.getPropertyValue('--sk-x')) || 0;
      sidekick.style.setProperty('--sk-face', x < curX ? -1 : 1);
      moveSidekick(x, y, false);
    }, 4200);
  }

  /* =========================================================
     WIRING
     ========================================================= */
  powerBtn.addEventListener('click', powerOn);

  window.addEventListener('resize', function () {
    if (!body.classList.contains('os-desktop')) {
      dockCRT();
    } else {
      // Keep the (now full-screen) CRT matched to the viewport.
      crt.style.width  = window.innerWidth + 'px';
      crt.style.height = window.innerHeight + 'px';
    }
  });

  /* ---- Brand menu — power off → back to the galaxy ---------- */
  (function brandMenu() {
    const brandBtn = document.getElementById('brandBtn');
    const menu     = document.getElementById('brandMenu');
    const powerOff = document.getElementById('powerOff');
    if (!brandBtn) return;

    function setOpen(open) {
      menu.hidden = !open;
      brandBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    brandBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    // Any click elsewhere, or Escape, closes the menu.
    document.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    powerOff.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(false);
      powerDown();
    });
  })();

  // Boot-off sequence — collapse the CRT, then return to the galaxy.
  function powerDown() {
    if (body.classList.contains('shutting-down')) return;
    body.classList.add('shutting-down');
    window.setTimeout(function () {
      window.location.href = '../index.html';
    }, 700);
  }

  // The boot sequence (power-on, boot log, CRT zoom, title card) is
  // retired — MATTHEW_OS lands straight on the desktop.
  bootInstant();
})();
