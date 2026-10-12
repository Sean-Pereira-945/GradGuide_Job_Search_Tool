# GradGuide — Frontend

This doc explains what the student-facing side of GradGuide does and how it's built.

---

## What is the Frontend?

The frontend is the part that opens in your web browser. It's built with **React** — a popular library for building interactive UIs. The student uses it to:

- Search and filter live job listings
- Save jobs they're interested in
- Plan their work schedule while staying within their visa's hour limits

---

## Technology Stack

| Tool | Why it's used |
|------|--------------|
| **React 19** | Build the UI from reusable components |
| **TypeScript** | Catch type errors before the app runs |
| **Vite** | Fast development server & build tool |
| **TailwindCSS** | Utility-first CSS — style elements without writing separate CSS files |
| **Framer Motion (`motion`)** | Smooth animations (slide-ins, transitions) |
| **Lucide React** | Clean, consistent icon set (search, refresh, check, warning icons etc.) |

---

## Entry Point

```
index.html  →  src/main.tsx  →  src/App.tsx
```

- **`index.html`** is the bare HTML shell Vite serves
- **`main.tsx`** mounts the React app into the `#root` div
- **`App.tsx`** is where everything lives

---

## App.tsx — The Brain

[`App.tsx`](../src/App.tsx) is the top-level component. It:

1. **Holds all the state** — jobs list, filters, active campus, tracked applications, loading status
2. **Makes API calls** to the backend (`/api/scrape`)
3. **Passes data down** to the two main view components

### State Variables (what the app remembers)

| State | What it stores |
|-------|---------------|
| `jobs` | All job listings returned from the latest scrape |
| `runs` | Status of each scraper run (success/error, count, time) |
| `isLoading` | Whether jobs are being loaded on first open |
| `isScraping` | Whether a manual "Refresh" scrape is in progress |
| `selectedVisaId` | Which visa regime the student is on (UK, US, AU, CA) |
| `selectedCampusId` | Which university hub the student is near |
| `trackedApps` | Jobs the student has saved/applied to (persisted in localStorage) |
| `searchQuery` | Current text in the search bar |
| `selectedJobType` | Filter: Part-time, Internship, Full-time, etc. |
| `selectedCategory` | Filter: Cafe & Hospitality, Campus & Tutoring, etc. |
| `campusWorkFilter` | Filter: On-campus / Off-campus / Remote |
| `onlyVisaCompliant` | Toggle: hide jobs that violate visa restrictions |
| `onlyNearCampus` | Toggle: only show jobs within 55 km of the campus hub |
| `languageFilter` | Filter by English proficiency requirement |

---

## Three Tabs

The app has three tabs the student can switch between:

### 1. Discover (Main job board)
- Shows all filtered job listings as cards
- Each card has: title, employer, pay, hours, location, shift flexibility, trust badge
- Clicking a card opens a detail panel on the right
- Filters and search bar sit at the top

### 2. Visa & Shift Planner
- Shows jobs the student has saved/tracked
- Student can set their stage: `Saved → Applied → Trial Shift → Offer`
- Student can enter how many hours/week they plan to work each role
- The planner totals up the hours and shows whether they're over their visa cap
- See [VISA_PLANNER.md](./VISA_PLANNER.md) for more detail

### 3. Sources
- Shows which job boards were scraped in the last run
- Displays: source name, URL, jobs extracted, response time, success/error status
- Student can trigger a new scrape with a custom keyword from this tab

---

## Components

### [`ScraperEngineView.tsx`](../src/components/ScraperEngineView.tsx)
Renders the **Sources tab**. Shows the table of scraper runs. Has the keyword scrape form.

### [`VisaShiftPlannerView.tsx`](../src/components/VisaShiftPlannerView.tsx)
Renders the **Planner tab**. Reads `trackedApps` and the full `jobs` list to display enriched tracked-application cards with hour inputs and stage dropdowns.

---

## Constants

[`constants.ts`](../src/constants.ts) defines:

- **`VISA_REGIMES`** — all supported visa types with their rules (max hours, on-campus restriction)
- **`CAMPUS_HUBS`** — 13 university hubs across UK, US, Canada, and Australia with GPS coordinates
- **`calculateDistanceKm()`** — Haversine formula to calculate distance between two GPS points
- **`getCommuteEstimate()`** — estimates walk/transit time from campus to a job's location

---

## localStorage (Persistent Data)

Tracked applications survive a page refresh because they are stored in the browser's **localStorage** under the key `gradguide_live_tracked_apps_v2`.

```
localStorage["gradguide_live_tracked_apps_v2"] = [
  {
    jobId: "abc123",
    stage: "Applied",
    committedWeeklyHours: 10,
    notes: "Evening shift only",
    updatedAt: "2026-10-12T10:00:00Z"
  },
  ...
]
```

This means closing and reopening the browser tab does **not** lose your tracked jobs.

---

## Filtering Logic

When the student changes any filter, `App.tsx` re-runs a `useMemo` filter function that:

1. Applies the text `searchQuery` against job title, employer, and location
2. Filters by `selectedJobType`, `selectedCategory`, `campusWorkFilter`
3. If `onlyVisaCompliant` is on — hides jobs that exceed visa hours or violate on-campus rules
4. If `onlyNearCampus` is on — hides jobs more than 55 km from the selected campus hub
5. Filters by `languageFilter` comfort level
6. Sorts results so on-campus and internship roles surface first
