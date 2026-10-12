# GradGuide — Google Gemini AI Integration

This doc explains how and why Google Gemini AI is used in GradGuide.

---

## What Does Gemini Do Here?

When a job listing is scraped from a website, the raw description is often short, vague, or formatted oddly. Gemini is used to **enrich and analyse** these descriptions to make them more useful to international students.

In plain English: Gemini reads the raw job description and rewrites/summarizes it in a more student-friendly way.

---

## The SDK

GradGuide uses the official **`@google/genai`** SDK (version `^2.4.0`):

```typescript
import { GoogleGenerativeAI } from '@google/genai';
```

The client is initialized on the server side using the API key from the `.env` file:

```typescript
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
```

If no API key is set, the enrichment step is skipped — all other functionality still works.

---

## Where Enrichment Happens

Enrichment happens on the **backend** (`server.ts`) — not in the browser. This is important because:

- The API key stays secret (never sent to the browser)
- The browser doesn't need to make direct calls to Google's servers

The flow is:

```
Backend scrapes raw job HTML
        │
        ▼
Raw JobListing created (description may be short or messy)
        │
        ▼
Gemini API called with the raw description
        │
        ▼
Gemini returns enriched description
        │
        ▼
JobListing.description updated with enriched text
        │
        ▼
JobListing returned to frontend
```

---

## What the Prompt Asks Gemini to Do

The prompt instructs Gemini to analyze a job description and return information useful to an international student, such as:

- A clear, plain-English summary of the role
- What skills or experience the employer is looking for
- Whether the role seems student-friendly (flexible hours, no experience required, etc.)
- Any language requirements implied by the role

GradGuide keeps the enriched text inline in the `description` field of the `JobListing` — it's shown in the job detail panel when the student clicks a listing.

---

## What Gemini Does NOT Do

- ❌ Does not create or invent job listings
- ❌ Does not change pay, hours, or employer information (these are taken directly from the source)
- ❌ Does not decide whether a job is "safe" for a student's visa — that logic is entirely rule-based in the app's own code
- ❌ Does not store any student data or query history

---

## Setting Up Your API Key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and generate an API key
2. Copy `.env.example` to `.env` in the project root
3. Set `GEMINI_API_KEY=your_key_here`

```env
# .env
GEMINI_API_KEY=AIza...your_key_here
```

The server reads this at startup via `dotenv`.

---

## Cost & Rate Limits

Google Gemini has a **free tier** that is sufficient for personal/development use. For production use with many concurrent users, check [Google AI Studio pricing](https://ai.google.dev/pricing).

GradGuide enriches descriptions **lazily** (only when a scrape is run) rather than in a continuous polling loop, so API calls are naturally rate-limited by user actions.

---

## Fallback Behaviour

If the Gemini call fails for any reason (network error, rate limit, invalid key, etc.):

- The error is logged on the server
- The original scraped description is used unchanged
- The `JobListing` is still returned to the frontend
- The student sees the raw description instead of the enriched one

The app never crashes or returns an error to the user because of a Gemini failure.
