/* NFHS Atlas — Vite entry.
   Loads the design system + vendor libraries, fetches the survey data, then
   hands off to the application logic in app.js. The app reads d3 / PptxGenJS /
   XLSX / DATA / GEO_D / GEO_S from the global scope, so we attach them to
   window before importing it. */
import './styles.css';
import * as d3 from 'd3';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';

window.d3 = d3;
window.PptxGenJS = PptxGenJS;
window.XLSX = XLSX;

const base = import.meta.env.BASE_URL; // respects vite `base` on GitHub Pages

async function boot() {
  try {
    const [DATA, GEO_D, GEO_S] = await Promise.all([
      fetch(base + 'data/nfhs_data.json').then((r) => r.json()),
      fetch(base + 'data/districts.json').then((r) => r.json()),
      fetch(base + 'data/states.json').then((r) => r.json()),
    ]);
    window.DATA = DATA;
    window.GEO_D = GEO_D;
    window.GEO_S = GEO_S;
    await import('./app.js'); // self-running IIFE; reads the globals above
  } catch (err) {
    console.error('Failed to load NFHS Atlas data', err);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<p style="padding:24px;font-family:sans-serif;color:#9C3F1B">' +
        'Could not load dashboard data. If you are running locally, start the dev ' +
        'server with <code>npm run dev</code>.</p>'
    );
  }
}

boot();
