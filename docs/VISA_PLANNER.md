# GradGuide — Visa & Shift Planner

This doc explains how GradGuide understands visa work-hour rules and helps students plan their shifts.

---

## Why This Feature Exists

International students often have **strict limits** on how many hours per week they can work. Breaking these limits — even accidentally — can have serious immigration consequences.

GradGuide makes these limits visible so students can plan their work schedule safely. It does this by:

1. Knowing the rules for each visa type
2. Letting students track which jobs they're pursuing and how many hours they plan to work
3. Comparing their planned total against their visa cap and showing a clear warning if they're over

> ⚠️ **Legal disclaimer:** The planner is informational only. Visa rules change and individual authorizations vary. Always verify your work eligibility with the relevant immigration authority or your institution.

---

## Supported Visa Regimes

GradGuide supports four visa types plus a vacation mode:

| Visa | Country | Max Hours/Week | Notes |
|------|---------|---------------|-------|
| **UK Student Visa (Tier 4 / Graduate Route)** | 🇬🇧 UK | 20 hrs | Full-time during official vacations |
| **Australia Subclass 500** | 🇦🇺 Australia | 24 hrs (48 per fortnight) | Unlimited during course breaks |
| **Canada Study Permit** | 🇨🇦 Canada | 24 hrs (off-campus) | No cap for on-campus roles |
| **USA F-1 Visa** | 🇺🇸 USA | 20 hrs | **On-campus only** during term; CPT/OPT needed for off-campus |
| **Vacation / Graduate Visa** | All | 40 hrs | Full-time work rights |

These are defined in [`constants.ts`](../src/constants.ts) as `VISA_REGIMES`.

---

## The VisaRegime Type

Each visa regime is represented by this shape:

```typescript
interface VisaRegime {
  id: VisaRegimeId;           // e.g. "UK_TIER4"
  name: string;               // Human-readable name
  country: string;            // Country the visa applies in
  maxWeeklyHours: number;     // Cap during term time
  maxFortnightlyHours?: number; // Alternative cap (Australia uses fortnightly)
  onCampusOnly: boolean;      // If true, off-campus work is restricted
  ruleSummary: string;        // Plain English explanation of the rule
}
```

---

## Campus Hubs and Region Locking

When a student selects their visa type, the **campus hub selector is filtered** to only show universities in that country:

- UK Tier 4 → only UK campuses (London, Midlands, North, South West, Scotland)
- US F-1 → only US campuses (Boston, New York, Los Angeles)
- Canada Study Permit → only Canadian campuses (Toronto, Vancouver)
- Australia 500 → only Australian campuses (Melbourne, Sydney, Brisbane)
- Vacation / Graduate → all campuses available

This prevents students from accidentally selecting, say, a US visa while browsing UK jobs.

---

## The Shift Planner View

The **Visa & Shift Planner** tab ([`VisaShiftPlannerView.tsx`](../src/components/VisaShiftPlannerView.tsx)) shows a list of all jobs the student has saved. For each job, they can:

- **Set their stage:** Saved → Applied → Trial Shift / Interview → Offer
- **Set committed hours:** How many hours/week they realistically plan to work this role
- **Add notes:** Any personal notes about the role
- **Remove the job** from their tracker

---

## Hours Calculation

The planner adds up `committedWeeklyHours` across all tracked jobs:

```
Total Hours = sum of committedWeeklyHours for each tracked job
```

This total is compared against the selected visa's `maxWeeklyHours`:

| Status | Condition | Shown as |
|--------|-----------|---------|
| ✅ Within limit | Total ≤ maxWeeklyHours | Green bar |
| ⚠️ Over limit | Total > maxWeeklyHours | Red warning banner |

---

## On-Campus Restriction (US F-1)

The US F-1 visa is special — students can only work **on-campus** during term time (unless they have CPT or OPT authorization).

If the active visa has `onCampusOnly: true` and the student has saved any off-campus job, the planner shows a specific warning:

> "Your visa restricts you to on-campus work only during term. One or more tracked roles appear to be off-campus — confirm authorization before accepting."

GradGuide identifies on-campus jobs using the `isOnCampus` field on each `JobListing`, which is set by the scraper based on whether the employer is listed as a university or on-campus facility.

---

## Estimated Weekly Earnings

If any tracked jobs have disclosed pay (i.e. `hourlyRateEquivalent > 0`), the planner estimates weekly gross earnings:

```
Estimated Weekly Gross = sum of (committedWeeklyHours × hourlyRateEquivalent) for each job with disclosed pay
```

If jobs use different currencies (e.g. one GBP role and one USD role), the planner displays "Multiple currencies" rather than adding them together incorrectly.

---

## Application Stages

Students track their progress through a simple pipeline:

```
Saved  →  Applied  →  Trial Shift / Interview  →  Offer
```

These stages are purely for the student's own tracking — GradGuide doesn't communicate with the employer in any way.

---

## Data Persistence

All tracked applications are saved to **browser localStorage** under the key `gradguide_live_tracked_apps_v2`. This means:

- ✅ Data survives page refreshes
- ✅ Data survives closing and reopening the browser tab
- ❌ Data does NOT sync across devices
- ❌ Data is lost if the browser's localStorage is cleared
