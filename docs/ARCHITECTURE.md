# GradGuide — System Architecture

This page explains how the whole GradGuide system fits together. Think of it as a map of all the moving parts.

---

## Architecture Diagram

![GradGuide Architecture](./architecture.png)

---

## The Three Layers

GradGuide is split into three distinct layers. Each layer has its own job and talks to the layer below it.

```
┌─────────────────────────────────────┐
│         FRONTEND (Browser)          │  ← What the student sees & clicks
├─────────────────────────────────────┤
│         BACKEND (Server)            │  ← Does the scraping & data work
├─────────────────────────────────────┤
│       EXTERNAL SERVICES             │  ← Real job boards + Google AI
└─────────────────────────────────────┘
```

---

## Layer 1 — Frontend (What you see)

**Technology:** React, Vite, TypeScript, TailwindCSS, Framer Motion

The frontend is what opens in your browser. It's a single-page app with two main views:

| View | What it does |
|------|-------------|
| **Scraper Engine View** | Lets you trigger a live scrape and browse the results |
| **Visa & Shift Planner View** | Tracks your saved jobs, your planned hours, and checks them against your visa cap |

The main file is [`App.tsx`](../src/App.tsx) — it holds all the state (saved applications, filter settings, current campus) and passes data down to the two views.

State that survives a page refresh (like your saved applications) is stored in **localStorage** in the browser.

---

## Layer 2 — Backend (The engine)

**Technology:** Node.js, Express, TypeScript (`server.ts`)

The backend runs on your computer (or a server) and listens on **port 3000**. It has four main responsibilities:

| Responsibility | Details |
|---------------|---------|
| **REST API** | Provides `/api/scrape` and related endpoints the frontend calls |
| **Vite Middleware** | In development, serves the React frontend through the same Express server so there's no CORS issue |
| **Scraper Engine** | Fetches HTML from real job boards and extracts job listings using Cheerio |
| **Gemini AI** | Calls the Google Gemini API to enrich job descriptions with helpful summaries |

---

## Layer 3 — External Services (The data sources)

These are the real-world services GradGuide connects to. GradGuide does **not** store job data in a database — it fetches live each time.

| Service | What it provides |
|---------|-----------------|
| **jobs.ac.uk** | UK academic and university jobs (campus-adjacent, tutoring, lab work) |
| **targetjobs.co.uk** | UK graduate and internship schemes |
| **Google Gemini API** | AI-powered job description enrichment and analysis |

> **Note:** Other regional sources (USAJOBS, Job Bank Canada, Jora Australia) are also scraped depending on the campus region selected.

---

## How a Job Search Works (Step by Step)

```
Student clicks "Refresh All Live Sources"
        │
        ▼
Frontend calls POST /api/scrape
        │
        ▼
Backend picks scrapers for the selected campus region
        │
        ├── Scraper A: jobs.ac.uk → fetch HTML → Cheerio parse → job objects
        ├── Scraper B: targetjobs.co.uk → fetch HTML → Cheerio parse → job objects
        └── (more scrapers depending on region...)
        │
        ▼
Each job optionally enriched by Gemini AI
        │
        ▼
Backend returns JSON array of JobListing objects
        │
        ▼
Frontend displays cards, applies filters, checks visa compliance
```

---

## Key TypeScript Types (Data Shapes)

The following types flow between the layers. See [DATA_TYPES.md](./DATA_TYPES.md) for full details.

| Type | Purpose |
|------|---------|
| `JobListing` | A single job card with title, pay, hours, location, trust info |
| `ScraperTargetRun` | The result of one scraper run — how many jobs, how long it took, success/error |
| `TrackedApplication` | A job the student has saved, with their stage and committed hours |
| `VisaRegime` | The rules for a specific visa type (max weekly hours, on-campus restriction) |
| `CampusHub` | A university hub with coordinates, used to check proximity of jobs |

---

## File Map

```
GradGuide_Job_Search_Tool_updated/
├── src/
│   ├── App.tsx                        # Main React component (state + layout)
│   ├── types.ts                       # All TypeScript type definitions
│   ├── constants.ts                   # Campus hubs, visa regimes, distance calc
│   └── components/
│       ├── ScraperEngineView.tsx      # Sources tab UI
│       └── VisaShiftPlannerView.tsx   # Planner tab UI
├── server.ts                          # Backend: Express server + scraper engine
├── docs/
│   ├── architecture.png               # This architecture diagram
│   ├── README.md                      # Docs index
│   ├── ARCHITECTURE.md                # This file
│   ├── FRONTEND.md
│   ├── BACKEND.md
│   ├── SCRAPER.md
│   ├── VISA_PLANNER.md
│   ├── DATA_TYPES.md
│   └── GEMINI_AI.md
├── index.html                         # HTML entry point for Vite
├── vite.config.ts                     # Vite build config
└── package.json                       # Dependencies and scripts
```
