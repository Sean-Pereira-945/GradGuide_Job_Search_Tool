# GradGuide Job Discovery — Scraper Architecture & Feature Rationale

##Demo Video Link : https://drive.google.com/file/d/1mjudfRJC_jzoQXjm8-InWvXTl4SY-iZ8/view?usp=sharing

## 1. How the Live Scraper Engine Works

Per the assignment specification, this tool uses **zero paid or free job-board APIs** (no Indeed, LinkedIn, or Adzuna APIs) and **zero AI/LLM scraping SaaS wrappers**. Every job listing displayed in the application is dynamically scraped in real time over HTTP and parsed via Cheerio in `server.ts`. Every single listing links directly to its live, verifiable external job posting URL.

### Live Data Sources & Parsing Pipeline
1. **Live University, Campus, Hospitality, Retail & Tutoring Scraping (`jobs.ac.uk`)**:
   - The scraper executes parallel HTTP `GET` requests against live search queries on `https://www.jobs.ac.uk/search/` covering:
     - **Cafe, Catering & Hospitality**: `?keywords=catering+assistant`
     - **Retail & Customer Service**: `?keywords=customer+service+assistant` and `?keywords=retail+shop`
     - **Campus & Academic Tutoring**: `?keywords=tutor+part+time` and `?keywords=library+assistant`
     - **Internships & Graduate Roles**: `?keywords=internship` and `?keywords=graduate+assistant`
   - Raw HTML is loaded into `cheerio.load(html)` to traverse `.j-search-result__result` nodes, extracting:
     - Exact job title and live URL (`https://www.jobs.ac.uk/job/...`)
     - University or employer name (`.j-search-result__employer`)
     - Department, location city, and campus coordinates
     - Raw salary string (`.j-search-result__info`), automatically parsed and normalized into an hourly equivalent rate (converting annual pro-rata £ salaries or hourly rates into comparable hourly figures)
     - Posted date and closing date
2. **Live STEM & Software Job Board Scraping (`python.org/jobs/`)**:
   - Fetches and parses `ol.list-recent-jobs > li` DOM elements for real-time technical, data, and software engineering roles with direct links to `https://www.python.org/jobs/<id>/`.
3. **Live Global Remote Support & Operations Feed (`weworkremotely.com`)**:
   - Fetches `https://weworkremotely.com/remote-jobs.rss` and parses `<item>` nodes via Cheerio XML mode for live customer support, operations, and junior tech roles that students can work flexibly from campus accommodation, linking directly to the live posting on `weworkremotely.com`.
4. **On-Demand Live Keyword & URL Scraper**:
   - Users can type any keyword (e.g., `"barista"`, `"student ambassador"`, `"research assistant"`, `"delivery"`) or paste any public job board URL to trigger an immediate live scrape and populate matching real-world listings.

---

## 2. Rationale for the 3 Original International Student Features

Generic job boards treat international students the same as domestic full-time workers. In reality, international students face three immediate, high-stakes constraints once they arrive abroad:

### Feature 1: Visa Work-Hour Compliance & Multi-Job Shift Simulator
- **What Problem It Solves**: International students on a UK Student Visa (strictly capped at 20 hrs/week during term-time), Australian Subclass 500 Visa (48 hrs/fortnight / 24 hrs/week average), Canadian Study Permit (24 hrs/week off-campus), or US F-1 Visa (20 hrs/week on-campus only in Year 1) frequently combine multiple casual jobs—such as 12 hours in campus catering plus 6 hours as a peer tutor. Standard job boards only display static labels like "Part-time", leaving students to manually guess whether combining two rosters will breach their visa conditions.
- **Why It Matters**: Breaching student visa work-hour limits can lead to visa cancellation or refusal of post-study graduate visas. Our interactive **Visa & Shift Planner** lets students select their visa regime, save real job listings, and adjust weekly shift sliders to verify their combined weekly hours and gross pay remain 100% compliant.

### Feature 2: Campus Hub Proximity & "Between-Lectures" Commute Matcher
- **What Problem It Solves**: Newly arrived international students rarely own cars and are unfamiliar with local university towns and transit geography. Furthermore, casual shifts (library desk, catering, retail, tutoring) must fit inside 2-to-3 hour gaps between lectures or evening blocks.
- **Why It Matters**: By anchoring the search interface to major university hubs (e.g., UCL / London, University of Warwick / Coventry, University of Leeds, University of Bristol, University of Glasgow, Melbourne, Toronto, Boston), the tool calculates real Haversine distance and estimated walking/transit times from the campus center, complete with a one-click **"Near Selected Campus Hub"** filter.

### Feature 3: Employer Trust, Wage Shield & Language Comfort Filter
- **What Problem It Solves**: International students face two major barriers when applying for everyday jobs: (1) uncertainty over whether an employer pays verified statutory/university-scale wages with formal payslips versus informal below-minimum arrangements, and (2) anxiety over whether a role requires native-level client-facing fluency versus conversational English (such as catering, stockroom, or library shelving).
- **Why It Matters**: Every scraped job is automatically analyzed to display **Employer Trust Signals** (Verified University/Enterprise Payroll, Skilled Worker Sponsor Track Record, or Verify Pay Rate) alongside an **English Language Comfort Filter** (`Conversational`, `Intermediate`, or `Fluent / Academic`), empowering students to apply with confidence.
