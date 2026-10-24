# Tesseract T4 — interactive prototype

Desktop app prototype for **T4 by Tesseract**, with an Android companion mockup and an interactive brandbook. Plain HTML/CSS/JS, no build step, no dependencies.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server). Opening `index.html` directly from disk also works in most browsers.

## Publish on GitHub Pages

1. Push this folder to the root of a repository (keep `.nojekyll`).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. The site appears at `https://<user>.github.io/<repo>/`. All paths are relative, so it works under the repository subpath.

## What's inside

```
index.html            app window, popover, Steam handoff, Android modal, brandbook
css/tokens.css        design tokens (official / sampled / supporting) + Manrope @font-face
css/app.css           desktop app shell and components
css/motion.css        logo build, boot, teleport and stream session
css/phone.css         Android mockup
css/brandbook.css     brandbook layout
js/app.js             all interactions and simulated behaviour
assets/brand/         supplied logo SVGs; wordmark text converted to outlines (see below)
assets/fonts/         Manrope WOFF2 (SIL Open Font License)
assets/downloads/     brandbook downloads: logos, graphics, motion, colors, fonts, brand kit ZIP
assets/platforms/     drop official store logos here (see js/logos.js)
js/downloads.js       download manifest (formats, sizes)
js/logos.js           which platform logo files to use
```

## Demo flow

1. **Boot.** The symbol builds itself: a dot, then three edges growing out of it, then the ring, square and cross, then the wordmark. Click or press any key to skip.
2. **Play Steam** opens the stream settings dialog in the middle of the window. Changes are a draft until you confirm.
3. **Start streaming** teleports you. A dark veil grows out of the Play button, the symbol builds while three steps tick off, the cube turns edge-on and violet light breaks through.
4. **Stream session.** A full-screen view of the rig's screen with a live timer and a performance stats panel. Toggle the stats with Ctrl+Alt+Shift+S or the Stats button. The bottom bar hides when the mouse is idle.
5. **End stream.** Use the button or Ctrl+Alt+Shift+Q. The stream collapses into the cube, the cube unfolds, flies back into the Play button, and Home shows "Last session".

Escape cancels during the teleport. During a stream it only nudges the bar, because in a real stream Escape belongs to the game. Every run follows the same timeline, so live demos are predictable. With reduced motion turned on, the drawing, turn and light burst are replaced by simple crossfades.

The Android mockup runs the same story: Play opens a bottom sheet with the symbol building, then a live screen with End stream.

## Notes and assumptions

- **Line and outline symbols.** `Icon_Line.svg` is a single-line version of the symbol, traced along the centerlines of `Icon_on_Dark.svg`, for the build animation. `Icon_Outline.svg` is the thin neon outline of the merged shape, used for large glowing crops.
- **Logo files.** The supplied SVGs set the wordmark as live `<text>` in Manrope, so in an `<img>` it falls back to a system font. The copies in `assets/brand/` have the same artwork with the wordmark converted to Manrope Bold outlines. `Icon_on_Lgiht.svg` was renamed `Icon_on_Light.svg`.
- **Colors.** `#A700FF`, `#7B19C9`, `#111513`, `#111014` and `#DCD6E2` come from the logo files. The gradient stops were sampled from the logo book. Every other color is a supporting interface value, labelled as such in `tokens.css` and in the brandbook.
- **Store logos.** The prototype ships with neutral monogram tiles. Put each store's official logo in `assets/platforms/` and list it in `js/logos.js`; the tiles, the phone and the oversized Steam background behind the stream pick them up automatically.
- **Brandbook downloads.** Every asset has its own Download menu: logos and graphics in SVG, PNG (transparent) and PDF; the animated symbol as MP4, GIF, transparent WebM and animated SVG; colors as ASE, CSS, JSON and CSV; Manrope as TTF or WOFF2. Section 09 lists everything, and the complete kit is one ZIP. On GitHub Pages these are plain downloads. In the claude.ai preview they go through its download prompt and ZIPs are assembled in the browser; ASE and CSS can only be saved there inside the kit ZIP.
- **Simulated features.** Platform linking, the support chat, the connection test and the stream session are all local simulations. The stream view is labelled as one.
- **Saved state.** Settings and linked platforms are saved in `localStorage` for each browser. The prototype still works if storage is blocked.
