# NFHS Atlas

[![View live dashboard](https://img.shields.io/badge/View%20live%20dashboard-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://zerobug-mohit.github.io/NFHS-Atlas/)

An offline-capable dashboard for exploring India's National Family Health Survey
data (NFHS-4, NFHS-5 and NFHS-6) across 640 districts and 37 states/UTs and 131
indicators. Built with [Vite](https://vitejs.dev/) and [D3](https://d3js.org/),
with PowerPoint and Excel export of any view.

## Repository structure

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

## Notes on the data

Issues - Known and Resolved:
All the States and Districts have been matched with 2011 Census Codes. However, 65 new districts have been since formed that lack district codes:
State	State Code	District
Arunachal Pradesh	12	Kra Daadi
Arunachal Pradesh	12	Longding
Arunachal Pradesh	12	Namsai
Arunachal Pradesh	12	Siang
Assam	18	Biswanath
Assam	18	Charaideo
Assam	18	Hojai
Assam	18	Majuli
Assam	18	South Salmara Mancachar
Assam	18	West Karbi Anglong
Chhattisgarh	22	Balod
Chhattisgarh	22	Baloda Bazar
Chhattisgarh	22	Balrampur
Chhattisgarh	22	Bemetara
Chhattisgarh	22	Gariyaband
Chhattisgarh	22	Kodagaon
Chhattisgarh	22	Mungeli
Chhattisgarh	22	Sukma
Chhattisgarh	22	Surajpur
Gujarat	24	Aravali
Gujarat	24	Botad
Gujarat	24	Chhota Udaipur
Gujarat	24	Devbhumi Dwarka
Gujarat	24	Gir Somnath
Gujarat	24	Mahisagar
Gujarat	24	Morbi
Haryana	6	Dadri
Madhya Pradesh	23	Agar Malwa
Maharashtra	27	Palghar
Meghalaya	17	East Jaintia Hills
Meghalaya	17	North Garo Hills
Meghalaya	17	South West Garo Hills
Meghalaya	17	South West Khasi Hills
Meghalaya	17	West Jaintia Hills
NCT of Delhi	7	Shahdara
NCT of Delhi	7	South East
Punjab	3	Fazilka
Punjab	3	Pathankot
Telangana	28	Bhadradri Kothagudem
Telangana	28	Jagitial
Telangana	28	Jangoan
Telangana	28	Jayashankar Bhupalapally
Telangana	28	Jogulamba Gadwal
Telangana	28	Kamareddy
Telangana	28	Komaram Bheem Asifabad
Telangana	28	Mancherial
Telangana	28	MedchalMalkajgiri
Telangana	28	Nagarkurnool
Telangana	28	Nirmal
Telangana	28	Peddapalli
Telangana	28	Rajanna Sircilla
Telangana	28	Sangareddy
Telangana	28	Siddipet
Telangana	28	Suryapet
Telangana	28	Vikarabad
Telangana	28	Wanaparthy
Telangana	28	Yadadri Bhuvanagiri
Tripura	16	Gomati
Tripura	16	Khowai
Tripura	16	Sepahijala
Tripura	16	Unakoti
Uttar Pradesh	9	Amethi
Uttar Pradesh	9	Hapur
Uttar Pradesh	9	Sambhal
Uttar Pradesh	9	Shamli

NFHS-4/5 state and national figures are unweighted means of district values;
NFHS-6 figures are the official IIPS factsheet estimates (population-weighted,
state/UT and national only — no district series; Manipur was not surveyed in
2023–24). Δ 5→6 compares official figures on both ends; Δ 4→6 mixes bases and is
labelled accordingly. Ladakh shares 2011-census geometry with Jammu & Kashmir.

## License

Data © NFHS Factsheets, published by IIPS.
