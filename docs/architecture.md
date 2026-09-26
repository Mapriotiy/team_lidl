# Orange Signal — architecture

An AI B2B sales intelligence platform. It converts public information into scored,
evidence-backed sales signals so a sales development rep knows who to contact, why now,
and what to say.

## The one decision everything else follows from

**The language model never produces a score.**

It answers configured business questions with `yes` / `no` / `unknown`, a confidence, and a
verbatim quote from a real document. Scoring is arithmetic performed in TypeScript over
those answers.

That split buys four things:

| Benefit | Why it follows |
|---|---|
| Explainability | Every point in a score traces to a sentence on a page with a URL and a date |
| Cheap re-tuning | Changing a weight from medium to high re-scores instantly with no model calls |
| Auditability | The scoring formula is readable code, not a prompt |
| Resistance to hallucination | Quotes are checked against the source text in code before they can count |

## Pipeline

```
 targets ──▶ INGEST ──▶ documents ──▶ EVALUATE ──▶ signal_answers ──▶ SCORE ──▶ lead_scores ──▶ API ──▶ React
             scrapers    (Postgres)     (Claude)     (evidence)      (pure TS)   (+breakdown)
```

Each stage is independently runnable and communicates only through the database. Ingest runs
nightly, evaluation runs only on companies with new documents, scoring runs on every config
change. Nothing is recomputed at dashboard load time.

## 1. Ingest — the custom scrapers

All traffic goes through `src/net/fetcher.ts`, which enforces robots.txt (including
`Crawl-delay`), one request per host at a time with a configurable gap, a global concurrency
cap, exponential backoff, and an honest identifying User-Agent. No adapter calls `fetch`
directly.

### Hiring signals — `src/sources/ats.ts`

The highest-value source, and the place where most implementations waste effort. Almost no
company hand-builds a careers page any more; they embed an applicant tracking system, and
every major ATS publishes a documented JSON endpoint for its own board.

So the scraper does not parse careers pages. It **detects which ATS the company uses**, then
reads structured JSON.

Detection runs three passes, cheapest and most authoritative first:

1. **Read the homepage and careers pages** for a board URL. Authoritative, no false
   positives, but low yield: measured across ten European companies, only one exposed its
   ATS in static HTML. Modern careers pages are client-rendered, so the board URL simply is
   not in the markup.
2. **Probe the ATS APIs** with slugs derived from the domain and company name. Keyless and
   fast. On the same eleven companies this found a board for nine. A 200 is not accepted as
   proof, because Workable answers 200 with an empty list for accounts that do not exist —
   only a board returning at least one real posting counts. The domain-derived slug is tried
   first, since it is least likely to collide with a similarly named company.
3. **Render a careers page with Playwright** and scan again. Playwright is an optional
   dependency; without it this pass is skipped rather than failing the crawl.

Verified end to end: `celonis.com` exposes no ATS in static HTML, but probing resolves it to
Greenhouse with 250 live postings, each around 7,000 characters of full job description.

The endpoints behind each provider:

| Provider | Endpoint | Status |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | verified live |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` | verified live |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` | verified live |
| Workable | `apply.workable.com/api/v1/widget/accounts/{slug}?details=true` | verified live |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings` | endpoint valid |
| Recruitee | `{slug}.recruitee.com/api/offers/` | endpoint valid |
| Personio | `{slug}.jobs.personio.de/xml` | endpoint valid |
| Workday | `{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{board}/jobs` (POST) | endpoint valid |

HTML scraping of the careers page is the fallback for the tail, not the default path.

### News — `src/sources/news.ts`

- **GDELT** — keyless, global, 65+ languages, which matters for the brief's international
  markets. Returns direct publisher URLs, so the article body is then fetched and extracted.
  Two things learned by testing it: the working window parameter is `timespan=3m`, and when
  throttled it replies **HTTP 200 with a plain-text warning**, not an error status. The
  adapter serialises its calls at least 6.5 seconds apart and explicitly detects that
  plain-text body. Without that check a throttled run is indistinguishable from "no news
  about this company", which silently under-scores leads.
- **Google News RSS** — keyless, strong headline recall. Item links are consent redirects, so
  these are stored as headline-level evidence and labelled as such.
- **NewsAPI** — used only when a key is present.

Results are deduplicated across providers on normalised title, and no single outlet may
supply more than two articles, so a syndicated wire story cannot dominate the evidence.

### Company-owned pages — `src/sources/website.ts`

Sitemap-first, never a blind crawl. `robots.txt` advertises the sitemap, the sitemap lists
every URL with a `lastmod`, so relevant recent pages (newsroom, press, strategy, investor,
about, technology) are selected directly. Blind link-walking is the fallback.

### Firmographics — `src/sources/firmographics.ts`

Crunchbase is the brief's preferred source but its API needs a paid licence, so it sits
behind an adapter with keyless fallbacks that let the system run today:

1. `config/crunchbase_seed.json` — a manual export keyed by domain
2. Wikidata — open, no key; matched to the company by official-website URL so the wrong
   entity is never merged in
3. The company homepage

Supplying `CRUNCHBASE_API_KEY` changes nothing downstream.

### LinkedIn

Deliberately absent, per the brief. Nothing depends on it. Decision-maker research stays a
manual step in the rep's workflow.

## 2. Evaluate — `src/signals/evaluate.ts`

One model call per company per service answers every configured question at once.

- **Evidence pack**: recent documents, with a guaranteed share of the budget per source kind
  so job postings are not crowded out by news. Each is tagged `[D1]`, `[D2]` with source,
  date and URL.
- **Prompt caching**: the system prompt and the evidence pack are cached blocks and the
  questions come last, so evaluating a second service for the same company reads the cache
  rather than resending the corpus.
- **Citation verification**: every returned quote is checked as a verbatim substring of a
  real stored document. Unverified quotes are flagged, and a `yes` whose evidence does not
  survive verification is capped at low confidence or demoted to `unknown`. A hallucinated
  citation cannot inflate a lead.
- **Prompt injection**: scraped pages are hostile input. Documents are delimited and the
  system prompt states they are untrusted data whose instructions must be ignored.

## 3. Score — `src/scoring/score.ts`

```
total = fit_weight · fit · 100  +  (1 − fit_weight) · intent  −  penalty
```

- `intent` — weighted share of positive signals confirmed, each multiplied by a recency
  decay of `0.5 ^ (age / half_life)`. A hiring push from two years ago is not a live buying
  signal, and half-life is configured per question: 120 days for hiring, 365 for a
  transformation programme.
- `penalty` — weighted negative signals, **not** decayed. A structural mismatch does not fade.
- `fit` — firmographic match to the ICP. Missing data scores neutral rather than zero, so an
  unknown headcount does not silently kill a good lead.
- Any disqualifier answered `yes` with confidence ≥ 0.5 zeroes the lead.

Bands: hot ≥ 70, warm ≥ 45, nurture ≥ 25, cold below.

The full per-question audit trail is written to `lead_scores.breakdown`, and that JSON is
what the dashboard renders as "why this lead".

## 4. Configuration is data, not code

`services`, `signal_questions` and `icp_profiles` are database tables edited through the API
and dashboard. Sales writes its own questions in its own words, sets weight and polarity,
marks disqualifiers, and re-scores without a deploy. `config/seed.json` only provides the
starting set.

## Cost control

| Lever | Effect |
|---|---|
| Content-hash dedupe on ingest | Unchanged pages are never re-evaluated |
| One call per company per service | Not one per document |
| Cached evidence pack | Second service for the same company is mostly cache reads |
| Re-score without re-evaluating | Weight changes cost nothing |
| `output_config.effort` in `evaluate.ts` | First dial to turn before changing model |

## What to build next

- **pgvector retrieval** when a company exceeds a few hundred documents; today the evidence
  pack is recency-ranked, which is sufficient at this corpus size.
- **A labelled evaluation set.** Twenty companies a rep has judged by hand, so changes to
  prompts or weights can be measured rather than argued about. This is the highest-value
  next step for accuracy.
- **Scheduled re-ingestion** and change detection alerts, so a newly appointed CIO surfaces
  the morning it is announced.
- **HubSpot write-back** from `lead_scores.breakdown`.
