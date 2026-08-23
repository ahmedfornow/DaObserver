# DaObserver — asset pipeline

Produces the images the landing page (`index.html`) expects.

```
assets/
  hero-bg.jpg        2400x1400   AI
  about-visual.jpg   1200x900    AI
  section-1.jpg      800x600     AI
  section-2.jpg      800x600     AI
  section-3.jpg      800x600     AI
  og-image.jpg       1200x630    AI
  device-bezel.png   1600x1200   drawn by code
  hero-device.png    1600x1200   bezel + your screenshot
  screens/today.png  390x844     captured by hand, not committed
```

Icons are not generated. The landing page falls back to Material Symbols,
which are already loaded, always sharp, and cost nothing.

---

## 0. Install

```bash
npm install
```

## 1. Capture the screenshot (5 minutes, do this first)

The screenshot has to be of the real app, signed in as you. Automating this
is not worth it: Firebase stores its session in IndexedDB, which Playwright's
`storageState` does not save, so an automated run would ask you to log in
every single time anyway.

1. Open your live app in Chrome and sign in
2. `F12` to open DevTools
3. `Ctrl+Shift+M` (`Cmd+Shift+M` on Mac) to toggle device mode
4. In the device dropdown choose **Responsive**, then type **390 x 844**
5. Set the zoom dropdown to **100%**
6. Make sure the Today tab is showing
7. `Ctrl+Shift+P` -> type `screenshot` -> pick **Capture screenshot**
8. Save it as `assets/screens/today.png`

Verify: the file must be exactly 390x844 or 1170x2532. `npm run verify`
will flag it if the aspect ratio is off.

## 2. Generate the AI images

```bash
export GEMINI_API_KEY="your_key"     # PowerShell: $env:GEMINI_API_KEY="..."
npm run gen
```

If the model name has changed since this was written:

```bash
IMAGEN_MODEL=some-newer-model npm run gen
```

## 3. Build the device mockup

```bash
npm run bezel     # draws the frame
npm run hero      # drops your screenshot into it
```

## 4. Verify

```bash
npm run verify
```

Every row must read `ok`. Exit code is 0 when clean, 1 when anything is
flagged, so this is safe to wire into CI later.

## 5. Publish

```bash
git add assets index.html app.html
git commit -m "add landing page assets"
git push
```

Hard-refresh the live site with `Ctrl+Shift+R`. Every dashed placeholder box
should now be a real image.

---

## Run everything at once

Only after step 1 is done:

```bash
npm run assets
```

## Notes

- `.gitignore` keeps `assets/screens/` and any credential file out of the
  repo. GitHub Pages serves every committed file publicly, so never put a
  token or session file under `assets/`.
- `scripts/geometry.mjs` is the single source of truth for the mockup.
  Change a number there and both the bezel and the composite follow.
- `compose-hero.mjs` runs two sharp passes on purpose: sharp applies
  `rotate()` before `composite()` inside one pipeline, which would tilt the
  frame and leave the screenshot upright.
