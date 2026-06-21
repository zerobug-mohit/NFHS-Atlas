# NFHS Atlas

An offline-capable dashboard for exploring India's National Family Health Survey
data (NFHS-4, NFHS-5 and NFHS-6) across 640 districts and 37 states/UTs and 131
indicators. Built with [Vite](https://vitejs.dev/) and [D3](https://d3js.org/),
with PowerPoint and Excel export of any view.

## What's inside

```
.
├── index.html              # app shell / markup
├── src/
│   ├── main.js             # entry: loads libraries + data, then the app
│   ├── app.js              # all dashboard logic (map, compare, change, profile, exports)
│   └── styles.css          # design system + component styles
├── public/data/            # survey + geometry data, served as static files
│   ├── nfhs_data.json      # indicators, districts, states, national values
│   ├── districts.json      # district GeoJSON (640 features)
│   └── states.json         # state/UT GeoJSON
├── vite.config.js
└── .github/workflows/deploy.yml   # CI: build + deploy to GitHub Pages
```

The data is loaded at runtime with `fetch`, so the JavaScript bundle stays small
and the JSON files are cached separately by the browser.

## Run locally

Requires Node.js 18+ (20 recommended).

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build locally
```

## Deploy to GitHub Pages (automatic)

This repo ships with a GitHub Actions workflow that builds the site and publishes
it to GitHub Pages on every push to `main`.

1. Create a new repository on GitHub and push this project:

   ```bash
   git init
   git add .
   git commit -m "NFHS Atlas dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. In the repository on GitHub, open **Settings → Pages** and set
   **Source** to **GitHub Actions**.

3. The `Deploy to GitHub Pages` workflow runs automatically. When it finishes,
   your dashboard is live at `https://<your-username>.github.io/<your-repo>/`.
   (You can also trigger it manually from the **Actions** tab.)

`vite.config.js` uses `base: './'`, so the build works under any repository path
without hard-coding the repo name. If you instead serve from a custom domain or
the repo root, the relative base still works.

## Updating the data

Replace the files in `public/data/` (keeping the same filenames and shapes) and
push — the workflow rebuilds and redeploys automatically. `nfhs_data.json` holds
`indicators`, `categories`, `districts`, `states`, `national` and `meta`;
`districts.json` / `states.json` are GeoJSON `FeatureCollection`s whose feature
properties carry the keys the app joins on (`k`/`s` for districts, `s` for states).

## Notes on the data

NFHS-4/5 state and national figures are unweighted means of district values;
NFHS-6 figures are the official IIPS factsheet estimates (population-weighted,
state/UT and national only — no district series; Manipur was not surveyed in
2023–24). Δ 5→6 compares official figures on both ends; Δ 4→6 mixes bases and is
labelled accordingly. Ladakh shares 2011-census geometry with Jammu & Kashmir.

## License

Data © IIPS / MoHFW, Government of India (NFHS). Dashboard code: add your own
license here.
