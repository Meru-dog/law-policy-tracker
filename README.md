Law & Policy Tracker (law-policy-tracker-v3)

A PWA-enabled web application that aggregates and displays regulatory updates, public comments, and news from major jurisdictions (Japan, US, EU), including sources such as the SEC.
Built with React + Vite + Tailwind CSS + Framer Motion.

⸻

Features
	•	Region tabs (🇯🇵 / 🇺🇸 / 🇪🇺) and category-based filtering
	•	Data fetching from RSS/JSON with CORS fallback via proxy
	•	Score-based classification with noise filtering (e.g., job postings, events)
	•	Partial rendering and batched fetching for improved perceived performance
	•	PWA support (installation and partial offline caching)
	•	Error boundaries and auto-refetch on network recovery

⸻

Directory Structure

.
├── public/
│   ├── icon.svg
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── .gitignore


⸻

Setup

npm ci
npm run dev

Then open the browser at http://localhost:5173 (or the URL shown in the terminal).

⸻

Build

npm run build

The production build will be generated in the dist/ directory (not included in Git).

⸻

Deployment
	•	Netlify / Vercel:
	•	Build command: npm run build
	•	Publish directory: dist/
	•	GitHub Pages:
	•	Deploy the contents of dist/ to the gh-pages branch (do not commit dist/ to the source branch)

⸻

PWA
	•	Includes public/manifest.json and public/sw.js
	•	When accessed via a production domain, users can install the app via “Add to Home Screen” or equivalent

⸻

Legal & Privacy Considerations
	•	Data sources are limited to official government sites, official RSS feeds, or public APIs
	•	All fetched data is processed client-side only; no personal information is collected or transmitted
	•	Be mindful of terms of use and robots.txt; do not access sites with restricted access controls

⸻

License

This repository is licensed under the MIT License (see LICENSE).
