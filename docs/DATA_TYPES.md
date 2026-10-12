# GradGuide — Data Types

This doc explains all the TypeScript types used across the GradGuide project. These are defined in [`src/types.ts`](../src/types.ts).

Understanding these types makes it easier to read the code — they describe exactly what shape data takes as it flows from the scraper, through the server, and into the frontend.

---

## JobListing

The most important type. Represents one job card shown to the student.

```typescript
interface JobListing {
  id: string;                    // Unique ID for this listing
  title: string;                 // Job title, e.g. "Library Assistant"
  employer: string;              // Company or university name
  department?: string;           // Optional department name
  location: string;              // Human-readable location text
  city: string;                  // Resolved city name
  country: string;               // Country
  lat: number;                   // GPS latitude (for distance calc)
  lng: number;                   // GPS longitude
  payDisplay: string;            // Text shown to student, e.g. "£12.50/hr"
  hourlyRateEquivalent: number;  // Parsed hourly rate for comparison (0 = unknown)
  currencySymbol: string;        // e.g. "£", "$", "A$", "CA$"
  jobType: JobType;              // "Part-time / Casual" | "Internship" | "Full-time" | "Type unverified"
  category: JobCategory;         // e.g. "Cafe & Hospitality"
  postedDate: string;            // ISO date string
  closesDate?: string;           // Optional closing date
  weeklyHoursMin: number;        // Minimum weekly hours
  weeklyHoursMax: number;        // Maximum weekly hours
  isOnCampus: boolean;           // True if job is at a university/on-campus employer
  shiftFlexibility: ...;         // "Between Lectures" | "Evenings & Weekends" | "Flexible Roster" | "Fixed Business Hours"
  sourceName: string;            // e.g. "jobs.ac.uk"
  sourceUrl: string;             // URL that was scraped
  applyUrl: string;              // Direct link to the job posting
  description: string;           // Job description (may be AI-enriched)
  requirements: string[];        // List of requirements
  trustInfo: EmployerTrustInfo;  // Trust/verification information
}
```

---

## JobType

What kind of employment contract the job is:

```typescript
type JobType =
  | 'Part-time / Casual'   // Regular part-time or casual/flexible hours
  | 'Internship'           // Internship or work placement
  | 'Full-time'            // Full-time permanent role
  | 'Type unverified';     // Source didn't clearly state — not guessed
```

> GradGuide uses "Type unverified" rather than guessing from ambiguous listings. Students should check the original posting.

---

## JobCategory

The broad category the job falls into, used for filtering:

```typescript
type JobCategory =
  | 'Cafe & Hospitality'        // Coffee shops, food service, events catering
  | 'Retail & Customer Service' // Shops, sales, front desk
  | 'Campus & Tutoring'         // University-based, tutoring, library, lab support
  | 'Delivery & Logistics'      // Courier, warehouse, delivery
  | 'Internship & Grad'         // Internships and graduate programmes
  | 'Full-time';                // Full-time roles
```

---

## VisaRegimeId

The identifier string for each supported visa type:

```typescript
type VisaRegimeId =
  | 'UK_TIER4'   // UK Student Visa
  | 'AU_500'     // Australia Subclass 500
  | 'CA_STUDY'   // Canada Study Permit
  | 'US_F1'      // USA F-1 Visa
  | 'VACATION';  // Vacation / Graduate Route (no restriction)
```

---

## VisaRegime

The full details of a visa type (see [VISA_PLANNER.md](./VISA_PLANNER.md) for context):

```typescript
interface VisaRegime {
  id: VisaRegimeId;
  name: string;                    // Full readable name
  country: string;                 // "United Kingdom", "Australia", etc.
  maxWeeklyHours: number;          // Work-hour cap during term
  maxFortnightlyHours?: number;    // Australia uses fortnightly cap
  onCampusOnly: boolean;           // US F-1 restriction
  ruleSummary: string;             // Plain English rule description
}
```

---

## CampusHub

A university hub — a geographic anchor point used to calculate job proximity:

```typescript
interface CampusHub {
  id: string;        // e.g. "london-ucl"
  name: string;      // Full name: "London Universities (UCL, LSE, KCL, Imperial, Brunel)"
  shortName: string; // Short label: "London Campus Hub"
  city: string;      // City name: "London"
  country: string;   // Country: "United Kingdom"
  lat: number;       // Latitude
  lng: number;       // Longitude
}
```

There are 13 campus hubs defined: 5 UK, 3 US, 2 Canada, 3 Australia.

---

## EmployerTrustInfo

Signals about the employer's trustworthiness and suitability for international students:

```typescript
interface EmployerTrustInfo {
  status:
    | 'Verified University / Enterprise Payroll'
    | 'Licensed Visa Sponsor'
    | 'Standard Verified Listing';
  awardComplianceNote: string;        // Note about award/minimum wage compliance
  sponsorshipTrackRecord: boolean;    // Has the employer sponsored visas before?
  payslipVerified: boolean;           // Is payroll/payslip verified?
  languageComfort:
    | 'Conversational'
    | 'Intermediate'
    | 'Fluent / Academic';            // English level required for the role
}
```

---

## ScraperTargetRun

The result of running one scraper. One record is created per source, per scrape:

```typescript
interface ScraperTargetRun {
  targetId: string;         // Unique ID for this scraper target
  name: string;             // Display name, e.g. "jobs.ac.uk — London"
  url: string;              // The URL that was fetched
  categoryFocus: string;    // What categories this source covers
  status: 'success' | 'error';
  jobsExtracted: number;    // How many jobs were found
  durationMs: number;       // How long the scrape took (milliseconds)
  timestamp: string;        // ISO timestamp of when it ran
  errorMessage?: string;    // Error detail if status === "error"
}
```

---

## ScrapeResponse

The full response from the `POST /api/scrape` endpoint:

```typescript
interface ScrapeResponse {
  jobs: JobListing[];            // All jobs from all successful scrapers
  runs: ScraperTargetRun[];      // One entry per scraper (success or error)
  lastScrapedAt: string;         // ISO timestamp
  totalExtracted: number;        // Total jobs across all runs
}
```

---

## TrackedApplication

A job the student has saved and is tracking through their application process:

```typescript
interface TrackedApplication {
  jobId: string;                  // References JobListing.id
  stage: ApplicationStage;        // Current pipeline stage
  committedWeeklyHours: number;   // Hours/week the student plans to work
  notes: string;                  // Free-text notes
  updatedAt: string;              // ISO timestamp of last update
}
```

---

## ApplicationStage

The four stages of a job application:

```typescript
type ApplicationStage =
  | 'Saved'                      // Bookmarked — haven't applied yet
  | 'Applied'                    // Application submitted
  | 'Trial Shift / Interview'    // Invited for an interview or trial
  | 'Offer';                     // Job offered
```
