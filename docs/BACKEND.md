# GradGuide — Backend

This doc explains what the server does, how it's structured, and how the frontend talks to it.

---

## What is the Backend?

The backend is a **Node.js server** that runs alongside the React app. It does the heavy lifting that can't happen in the browser:

- **Fetching HTML** from external job websites (browsers can't do cross-origin requests to arbitrary sites)
- **Parsing** that HTML to extract job listings
- **Calling Google Gemini AI** to enrich job descriptions
- **Serving the React app** itself in development mode

Everything lives in one file: [`server.ts`](../server.ts).

---

## Technology Stack

| Tool | Why it's used |
|------|--------------|
| **Node.js** | JavaScript runtime for the server |
| **Express** | Lightweight web framework — handles routing and middleware |
| **TypeScript** | Type safety on the server side |
| **tsx** | Runs TypeScript directly without pre-compiling (used in development) |
| **Cheerio** | jQuery-like HTML parser — used to extract job data from web pages |
| **dotenv** | Loads secrets (like the Gemini API key) from the `.env` file |

---

## How to Start

```bash
npm run dev
# This runs: tsx server.ts
```

The server starts on **port 3000**. In development, it also serves the Vite-compiled frontend through a middleware proxy — so you only need one browser tab at `http://localhost:3000`.

---

## API Endpoints

### `POST /api/scrape`

The main endpoint. Triggers a live scrape of all job boards for the selected campus.

**Request body:**
```json
{
  "campusId": "london-ucl",
  "visaId": "UK_TIER4",
  "keyword": "barista"   // optional — for keyword-specific scrapes
}
```

**Response:**
```json
{
  "jobs": [ /* array of JobListing objects */ ],
  "runs": [ /* array of ScraperTargetRun objects */ ],
  "lastScrapedAt": "2026-10-12T10:00:00.000Z",
  "totalExtracted": 47
}
```

Each scraper runs independently and its result (including errors) is captured in a `ScraperTargetRun` so the frontend can show which sources succeeded.

---

## Vite Dev Server Middleware

In development mode, Express acts as a **reverse proxy** for Vite:

```
Browser → localhost:3000/anything
         └── If it's an /api/* route → handled by Express
         └── Everything else → proxied to Vite's dev server (e.g. port 5173)
```

This means the student only needs to visit one URL and there are no CORS errors when the frontend calls `/api/scrape`.

In production (`npm run build`), the built static files are served directly by Express using `express.static`.

---

## Scraper Engine

The scraper engine is the biggest part of `server.ts`. It selects which scraping targets to use based on the campus region, fetches their HTML, and parses the results.

See [SCRAPER.md](./SCRAPER.md) for a detailed breakdown of how individual scrapers work.

At a high level:

```
POST /api/scrape received
      │
      ▼
server.ts selects scrapers for the campusId's country
      │
      ├── jobs.ac.uk scraper  (UK only)
      ├── targetjobs.co.uk scraper  (UK)
      ├── USAJOBS scraper  (US)
      ├── Job Bank Canada scraper  (Canada)
      ├── Jora scraper  (Australia)
      ├── Python.org jobs  (all regions)
      └── We Work Remotely  (all regions)
      │
      ▼
All scrapers run (even if some fail — errors are captured per-run)
      │
      ▼
Jobs optionally sent to Gemini for description enrichment
      │
      ▼
All jobs + all run statuses returned as JSON
```

---

## Helper Utilities (inside server.ts)

### Location → Coordinates resolver
When a job listing includes a city name (e.g. "Manchester") but no GPS coordinates, the server looks up approximate coordinates from a built-in city map. This is needed to calculate whether a job is within 55 km of the selected campus hub.

### Salary text parser
Job listings sometimes show pay as text like `"£12.50 per hour"` or `"£22,000–£24,000 per annum"`. The server parses these strings into a numeric `hourlyRateEquivalent` so the frontend can display and compare wages.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
GEMINI_API_KEY=your_key_here
```

If no key is set, the server still works — Gemini enrichment is just skipped silently.

---

## Error Handling

The backend is designed to be **resilient**:

- If one scraper fails (e.g. a job board changed its HTML structure), the error is caught and stored in the `ScraperTargetRun` for that source — all other scrapers still run.
- If Gemini AI is unavailable or returns an error, jobs are still returned without enrichment.
- The frontend always gets a valid JSON response even if every scraper failed (it just gets zero jobs and a list of errors).
