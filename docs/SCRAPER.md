# GradGuide — Scraper Engine

This doc explains how GradGuide fetches real job listings from the internet without using paid APIs.

---

## The Big Idea

Most job sites don't give you free access to their listings via an official API. GradGuide gets around this by doing what a browser does — **fetching the public HTML page** and then **reading the job data out of it**.

This technique is called **web scraping**. GradGuide uses a library called **Cheerio** to do the HTML parsing (it works like jQuery, but on the server side).

> ⚠️ Because scraping depends on a site's HTML structure, a job board that changes its page layout can break the scraper for that source. The Sources tab in GradGuide shows you which scrapers are currently working.

---

## How One Scraper Works

```
1. Build the URL  (e.g. jobs.ac.uk/search?keywords=tutor&location=London)
        │
        ▼
2. Fetch the HTML  (Node.js fetch() with a browser-like User-Agent header)
        │
        ▼
3. Load HTML into Cheerio  (like opening the page's DOM in memory)
        │
        ▼
4. Use CSS selectors to find job cards  (e.g. $(".j-search-result__listing"))
        │
        ▼
5. Extract fields from each card  (title, employer, location, pay, link)
        │
        ▼
6. Validate & clean the data  (check domain, resolve location to lat/lng)
        │
        ▼
7. Return array of JobListing objects
```

---

## Job Sources by Region

The active scraper set depends on which **campus hub** the student selects.

### 🇬🇧 United Kingdom

| Source | What it finds |
|--------|--------------|
| **jobs.ac.uk** | Academic/university jobs — catering, library, tutoring, lab work, admin |
| **targetjobs.co.uk** | Graduate schemes and internships |

Searches include the city name (e.g. "London", "Leeds") plus student-friendly keywords like "part-time", "internship", "catering".

### 🇺🇸 United States

| Source | What it finds |
|--------|--------------|
| **USAJOBS.gov** | Government and federal student internships |

> Note: USAJOBS loads results via JavaScript on the real page, so the HTML scraper may return zero results if no static HTML jobs are present in the initial page load.

### 🇨🇦 Canada

| Source | What it finds |
|--------|--------------|
| **Job Bank Canada** | Federal job bank — student and part-time roles |

Job Bank can return listings from outside the target city. GradGuide filters these by checking whether the listed location can be mapped to coordinates within 55 km of the campus hub.

### 🇦🇺 Australia

| Source | What it finds |
|--------|--------------|
| **Jora** | Part-time and internship jobs near Melbourne, Sydney, or Brisbane |

### 🌐 All Regions

| Source | What it finds |
|--------|--------------|
| **Python.org jobs** | Technical / software development roles |
| **We Work Remotely** | Remote-friendly tech and design roles |

---

## Cheerio — The HTML Parser

Cheerio loads the raw HTML and lets you query it with CSS selectors, exactly like you would in a browser's dev tools.

**Example** (simplified):

```typescript
import * as cheerio from 'cheerio';

const html = await fetch('https://jobs.ac.uk/search?keywords=tutor').then(r => r.text());
const $ = cheerio.load(html);

$('.j-search-result__listing').each((i, el) => {
  const title = $(el).find('h2.j-search-result__title').text().trim();
  const employer = $(el).find('.j-search-result__employer').text().trim();
  // ...
});
```

---

## Keyword Scraping (On-Demand)

Beyond the automatic source set, students can type any keyword (e.g. "barista", "student ambassador") into the Sources tab and trigger a **live keyword scrape** right now.

This sends the keyword to the server, which constructs a targeted search URL for each applicable source and scrapes it immediately.

---

## ScraperTargetRun — The Result Record

Every time a scraper runs — whether it succeeds or fails — it produces a `ScraperTargetRun` record:

```typescript
{
  targetId: "jobs-ac-uk-london",
  name: "jobs.ac.uk — London",
  url: "https://www.jobs.ac.uk/search/?keywords=...",
  categoryFocus: "Campus & Tutoring, Internship & Grad",
  status: "success",        // or "error"
  jobsExtracted: 12,
  durationMs: 843,
  timestamp: "2026-10-12T10:00:00.000Z",
  errorMessage: undefined   // populated if status === "error"
}
```

The Sources tab in GradGuide displays these records so students can see exactly which boards are live and how many jobs came from each one.

---

## Location & Distance Filtering

Every scraped job needs **GPS coordinates** so the app can check whether it's within 55 km of the student's campus hub.

If a job listing has explicit coordinates — great. If it only has a city name (which is common), the server resolves that city name to approximate coordinates from a built-in lookup map.

Jobs that can't be located (no recognized city name) are:
- Shown with `"Location unverified"` if they're explicitly remote
- **Excluded** from the "near campus" count if they can't be placed on a map

---

## Pay Parsing

Job boards display pay in many formats. The server normalises all of them to an **hourly rate equivalent**:

| Source text | Parsed as |
|-------------|----------|
| `£12.50 per hour` | £12.50 / hr |
| `£22,000 per annum` | £22,000 ÷ 52 ÷ 37.5 ≈ £11.28 / hr |
| `$18–$22/hr` | midpoint $20 / hr |
| `"Competitive"` | 0 (shown as "See listing") |

If pay is unknown, GradGuide shows the original text and links to the original posting rather than making up a number.

---

## What GradGuide Does NOT Do

- ❌ Does not use paid job-board APIs (no API keys needed for scraping)
- ❌ Does not bypass login gates or student-only portals (e.g. university career portals)
- ❌ Does not store job listings in a database — everything is fetched fresh on demand
- ❌ Does not invent or guess pay, hours, or work type — if it's not on the page, it's marked as unverified
