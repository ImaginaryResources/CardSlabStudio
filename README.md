# OpenGrading

Local slab-label maker for card grading slabs. Prints labels at exactly **2.72 × 0.84 in** on A4 (or Letter / custom) with photos, custom text, and grades. Static files, no dependencies, no build, works offline.

## Run

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

Any static file server works. Use a server rather than opening the file directly: ES modules and localStorage are more reliable over `http://`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Form, sheet stage |
| `style.css` | Screen UI, label themes, print rules |
| `lib.js` | Defaults, grid math, pagination, import validation |
| `app.js` | State, rendering, storage, image downscaling, print |
| `check.mjs` | Assertions for grid math and import validation |

## Check

```sh
node check.mjs   # or: npm run check
```

## Label size

Defaults to 2.72 × 0.84 in. Adjust **Label width/height** for other inserts; internal text and photos scale with the label.
