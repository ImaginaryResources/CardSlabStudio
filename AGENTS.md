# AGENTS.md

Static, dependency-free browser app. No build, bundler, framework, or backend. Keep it that way.

## Run / verify

```sh
npm start          # python3 -m http.server 8080
node check.mjs     # only automated check; must pass
```

Serve over HTTP; opening `index.html` via `file://` breaks ES modules.

## Architecture

- `lib.js` — pure helpers (defaults, grid math, pagination, `cleanImport`). Must stay DOM-free: `check.mjs` imports it directly in Node.
- `app.js` — all DOM/state/localStorage/image/print logic.
- `index.html`, `style.css` — markup, screen UI, themes, print rules.
- Data lives only in `localStorage` key `cardslabstudio.v1` (theme: `cardslabstudio.theme`); images are embedded data URLs.

## Gotchas

- Cache busting: `index.html` and `app.js` import `?v=26.11.6`. Version is `YY.MM[.patch]` (e.g. `26.11` = Nov 2026, `.1` = second release that month); on any change to `app.js`, `lib.js`, or `style.css`, bump all three occurrences and keep `package.json` in sync, or users may get stale code. Bump the patch when the month has not changed.
- Add a label field in `lib.js` (`newLabel`, `LABEL_TEXT`, `cleanImport` sanitizing), then wire `#f-<name>` in `index.html` / `app.js`.
- Numeric limits are duplicated in `lib.js` (`NUMBER_LIMITS`), `index.html` (`min`/`max`), and `bindNumber` calls. Change all three.
- `cleanImport` is the trust boundary for both storage load and JSON import. New data must be validated/clamped there; never insert user content with `innerHTML`.
- Label/internal text sizes use `calc()` off `--label-w` / `--label-h` (set in px at 96/in). Do not use container-query units: they break Firefox printing.
- Print sizing relies on `.no-print`, one `.page-wrap` per page, dynamic `#page-size` `@page` rule, and sheets 0.4 mm smaller than the page to avoid blank pages in Firefox/Safari.
- Photos are downscaled to 900 px longest side, white-filled, JPEG 0.82 before storage.

## Baseline behavior

A4 default = 2 × 11 = 22 labels/page; Letter = 2 × 10 = 20. `check.mjs` is authoritative; `PLAN.md` has a stale Letter count.
