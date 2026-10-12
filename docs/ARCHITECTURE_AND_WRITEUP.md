# GradGuide Job Discovery — Scraper Architecture & Feature Rationale

## How the scraper works
GradGuide uses its own server-side fetch-and-parse code in `server.ts`, with Cheerio to inspect public HTML. It does not call paid/free job-board APIs or use an AI scraping service. Each result keeps a direct link to the original job posting; a source can return zero results or a visible error when its public page changes or blocks a request.

The selected anchor campus scopes the source set and search terms:

- **United Kingdom:** `jobs.ac.uk` HTML searches for campus catering, retail/customer service, tutoring/library, logistics, and internships, with the selected city included; plus a location-specific `Reed.co.uk` search page.
- **United States:** a location-specific student/internship search on the public `USAJOBS.gov` results page. Its current search template loads results dynamically, so the HTML scraper reports zero rather than calling a job-board API when no postings are present in the returned HTML.
- **Canada:** a student/part-time search on the public `Job Bank Canada` results page.
- **Australia:** city-specific `Jora` part-time and internship HTML result pages, keyed to Melbourne, Sydney, or Brisbane.
- **All campuses:** the existing Python.org jobs page and We Work Remotely feed provide additional technical and remote roles.

Regional HTML results are parsed from job links and nearby result-card text; the source hostname and posting-path patterns are checked before a link is accepted. Source markup is not stable and some boards may block automated requests, so the Sources tab reports each run's status and extraction count. Job Bank Canada can return listings from outside the requested metro area; only recognized locations are assigned coordinates, so unrelated or unmapped listings do not pass the anchor-region filter. Work type is taken from explicit title, pay, or source-label evidence; if the source is ambiguous, the listing is labeled **Type unverified** rather than guessed. Boston University's public Student Job Board information page links to a student-only portal; GradGuide does not scrape or bypass its eligibility gate. Exact pay is shown only when the source exposes it; otherwise GradGuide points applicants to the original listing rather than inventing a wage. Unlocated listings do not count as anchor-region matches, and campus status is labeled only when the location text explicitly supports it. Hours shown for broad source-board results are screening ranges, not employer-confirmed schedules; confirm the actual shift details with the employer.

## Three international-student features

### 1. Visa-aware campus choices and work-hour planner
Selecting a UK, US F-1, Canadian study-permit, or Australian student-visa regime limits the anchor-campus choices to that country. Vacation/graduate-work mode exposes all supported campus regions. The shift planner tracks saved roles and compares planned weekly hours with the configured reference cap. **Visa rules change and individual authorization varies; the planner is informational, not legal advice. Verify work eligibility with the relevant immigration authority or your institution before accepting a role.**

### 2. Anchor-region and work-location matching
The interface separates **on-campus**, **off-campus**, and **remote** roles. On/off-campus matches must be within 55 km of the selected anchor campus; remote jobs are shown separately and remain available from any region. Results favor internships, part-time/casual jobs, remote work, and roles near the selected campus so common student-friendly options surface first.

### 3. Employer trust and language context
Listing cards retain source links and show the available employer/payroll signals and language-comfort labels. Regional results use a standard source-listing trust label unless the source supports a stronger claim. Applicants can use the language filter and check the source posting for final details.

The intended audience is international students looking for internships, remote work, and practical part-time roles near their campus—not just graduate schemes. The goal is to make location and work eligibility visible early, while keeping the original employer posting as the authority for current terms.
