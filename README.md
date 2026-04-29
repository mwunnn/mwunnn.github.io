# Your Name — Personal Site

A handmade personal website inspired by Tamara Shopsin's cover for *LaserWriter II* — printer test pages, classic Mac windows, and a heavy dose of ASCII art.

```
██╗   ██╗ ██████╗ ██╗   ██╗██████╗     ███╗   ██╗ █████╗ ███╗   ███╗███████╗
╚██╗ ██╔╝██╔═══██╗██║   ██║██╔══██╗    ████╗  ██║██╔══██╗████╗ ████║██╔════╝
 ╚████╔╝ ██║   ██║██║   ██║██████╔╝    ██╔██╗ ██║███████║██╔████╔██║█████╗
  ╚██╔╝  ██║   ██║██║   ██║██╔══██╗    ██║╚██╗██║██╔══██║██║╚██╔╝██║██╔══╝
   ██║   ╚██████╔╝╚██████╔╝██║  ██║    ██║ ╚████║██║  ██║██║ ╚═╝ ██║███████╗
   ╚═╝    ╚═════╝  ╚═════╝ ╚═╝  ╚═╝    ╚═╝  ╚═══╝╚═╝  ╚═══╝╚═╝     ╚═╝╚══════╝
```

## File structure

```
your-website/
├── index.html      ← the page itself (structure + content)
├── style.css       ← all the visual styling
├── script.js       ← live clock, uptime, boot animation
├── README.md       ← this file
└── .gitignore      ← files git should ignore
```

Three things to know:
- **HTML** is structure — what's on the page.
- **CSS** is style — how it looks.
- **JS** is behavior — what it does.

Keeping them in separate files is the standard convention and makes everything easier to find as the project grows.

## Running it locally

Just open `index.html` in any browser. Double-click the file, or right-click → Open With → your browser. No build step, no install, nothing fancy.

## Customizing

### Your name
Open `index.html` and search for `Your Name`. Replace every match with your actual name. The big serif name lives inside the `<h1 class="name">` tag.

### The ASCII banner
The big block-letter banner is also in `index.html`, inside the `<pre class="ascii-banner">` tag. To make your own:
1. Visit a tool like https://patorjk.com/software/taag/
2. Pick a font (the demo uses "ANSI Shadow")
3. Paste your name and copy the result
4. Replace the existing banner — keep it inside the `<pre>` tag

### Content
Search `index.html` for placeholder text like "Project Title One", "Notes on Making Small Things", or "you@example.com" and swap in your real stuff. The structure of each section will hold up with very little or quite a lot of content.

### Colors
Open `style.css` and look at the top, in the `:root` block:

```css
:root {
  --ink: #0a0a0a;
  --paper: #f4f1ea;
  ...
}
```

Change those two color codes and the entire site retones. That's the power of CSS variables — you change one line, every element updates.

### Fonts
Fonts come from Google Fonts. To swap them out, edit two places:
1. The `<link href="https://fonts.googleapis.com/...">` tag at the top of `index.html`
2. The `--serif-display`, `--serif-body`, and `--mono` variables in `style.css`

## Deploying to GitHub Pages

GitHub Pages is free static-site hosting. Here's the path of least resistance.

### Option A: Drag-and-drop (no command line)

1. Sign in to GitHub at https://github.com.
2. Create a new repository. **Important:** if you want your URL to be `yourusername.github.io`, name the repo exactly that. Otherwise pick any name — the URL will be `yourusername.github.io/repo-name`.
3. On the empty repo page, click **uploading an existing file**.
4. Drag your `index.html`, `style.css`, `script.js`, and `README.md` into the upload area. Click **Commit changes**.
5. Go to the repo's **Settings** → **Pages** (in the left sidebar).
6. Under "Build and deployment," set **Source** to *Deploy from a branch*, **Branch** to `main`, and folder to `/ (root)`. Click **Save**.
7. Wait a minute, refresh the Pages settings page, and your site URL will appear at the top.

### Option B: With Git (recommended once you're comfortable)

```bash
# 1. In the project folder, initialize a git repo
git init
git add .
git commit -m "First commit"

# 2. Connect it to your new (empty) GitHub repo
git remote add origin https://github.com/YOURUSERNAME/REPONAME.git
git branch -M main
git push -u origin main

# 3. Enable GitHub Pages in the repo's Settings → Pages
```

After that, every time you make a change:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

Your site updates automatically within a minute or so.

## Things to try next

A few small upgrades to learn from:
- **Add a favicon** — the tiny icon in the browser tab. Save a 32x32 PNG as `favicon.png` and add `<link rel="icon" href="favicon.png">` in the `<head>`.
- **Real project images** — replace the CSS swatch pattern in a `.work-card` with `<img src="myproject.png" alt="...">` inside a div with class `swatch`.
- **A second page** — for a full blog post, create `posts/my-first-post.html` and link to it from `index.html`. GitHub Pages will serve it at `/posts/my-first-post.html`.
- **Enable the easter egg** in `script.js` — uncomment the last block and try typing `hello` on the live page.

## Credits

- Inspired by *LaserWriter II* by Tamara Shopsin — cover designed by [Na Kim](https://www.na-kim.com/).
- Type: [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display), [EB Garamond](https://fonts.google.com/specimen/EB+Garamond), [JetBrains Mono](https://www.jetbrains.com/lp/mono/).

```
       ╔══════════════════════════════════════════════════════════╗
       ║   THANKS FOR VISITING ▪ MADE BY HAND ▪ NO ROBOTS HARMED  ║
       ╚══════════════════════════════════════════════════════════╝
```
