# Orange Signal

AI B2B sales intelligence for Orange Systems. It scrapes public sources, answers
sales-defined signal questions with quoted evidence, scores and ranks companies, and drafts
outreach grounded in what it actually found.

Built on custom scrapers. No LinkedIn dependency, as the brief requires.

- Architecture and design rationale: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Dashboard: [frontend/](frontend/)

## What it does

1. **Ingest** — for each target company, scrape job postings, news, its own newsroom and
   strategy pages, and firmographics.
2. **Evaluate** — Claude answers each configured signal question `yes`/`no`/`unknown` with a
   verbatim quote from a real document. Quotes are verified in code against the source text.
3. **Score** — deterministic weighted scoring with recency decay, negative signals and
   disqualification rules. The model never produces the score.
4. **Act** — ranked leads with a full evidence trail, plus an outreach draft per lead.

## Requirements

- Node.js 20+
- A Postgres 14+ instance - a [Supabase](https://supabase.com) free-plan project works
  out of the box, or Docker for a local one
- A key for any OpenAI-compatible model gateway, for the evaluation and outreach steps
  only. [AgentRouter](https://agentrouter.org) is the default - one key reaches Anthropic,
  OpenAI, DeepSeek and others. Add it in the dashboard under **Settings -> Model**, or set
  `LLM_API_KEY` in `.env`.

## Setup

```bash
npm install
cp .env.example .env          # put DATABASE_URL in it (the model key can go in the UI)
npm run db:init                # creates the schema
npm run seed                   # loads services, signal questions and ICP from config/seed.json
```

`DATABASE_URL` points at Postgres directly (`src/db.ts` runs plain SQL over `pg`, not
the Supabase JS client), so any Postgres 14+ works. For Supabase, use the **pooler**
connection string (Project Settings -> Database -> Connection string -> Transaction
pooler, port 6543) - the free plan's direct connection is IPv6-only and won't reach
most networks. See `.env.example` for the exact format.

Running a local Postgres instead:

```bash
npm run db:up                  # starts PostgreSQL on port 5433 (needs Docker running)
```

## Run the pipeline

```bash
# Check the scrapers against a live site. No database or API key needed.
npx tsx src/cli/smoke.ts celonis.com Celonis

# Scrape the target list
npm run ingest -- --file config/targets.json

# Answer the signal questions, then score
npm run evaluate -- --service apa
npm run score -- --service apa

# Or all of it in one go
npm run pipeline -- --file config/targets.json

# Print the ranked leads
npx tsx src/cli/run.ts report --service apa
```

Then start the API and the dashboard:

```bash
npm run api                   # http://localhost:8080
cd frontend && npm install    # first run only
cd frontend && npm run dev    # http://localhost:5173
```

## The dashboard

Nine screens, all reading live data. Nothing is mocked: an empty database gives
empty charts rather than plausible-looking placeholders.

| Screen | What it does |
|---|---|
| **Overview** | Qualified accounts, average score, confirmed signals and evidence volume, with a weekly trend and the problems worth fixing first |
| **Leads** | Every scored account: search, band filters, sortable columns, multi-select CSV export |
| **Lead detail** | The audit trail — score ring, the arithmetic that produced the number, every question asked with its verbatim quote and source link, and evidence-grounded outreach |
| **Signals** | Live feed of confirmed signals, how often each question fires, and in-place editing of questions, weights, half-lives and sources |
| **ICP & Scoring** | The firmographic profile, with a browser-side preview of what a draft profile would do to existing scores before you commit to a re-score |
| **Data sources** | Per-adapter health, volume and freshness, a 24-hour success histogram, the crawl log, and switches that genuinely stop the crawler |
| **Outreach** | Sequences: a saved audience rule plus planned steps, live enrolment, and every draft written so far |
| **Reports** | Score distribution, which questions earn their weight, segment breakdown, CSV export and saved report schedules |
| **Settings** | Workspace details, the connected model, team, notification preferences, and a read-only view of how the backend is configured |

### Connecting a model

**Settings -> Model** is the whole configuration: a base URL, a model name and a key.
Anything that speaks the OpenAI `chat/completions` schema works, so the sales team can
switch provider or model without a redeploy.

| Gateway | Base URL | Example model |
|---|---|---|
| AgentRouter (default) | `https://agentrouter.org/v1` | `claude-opus-5` |
| OpenAI | `https://api.openai.com/v1` | `gpt-5` |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-opus-5` |
| Groq | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1` |

Some gateways want more than a key. **Extra request headers** in the same screen sends
whatever they ask for with every call - OpenRouter's `HTTP-Referer` and `X-Title`, a
corporate proxy's own token - one `Name: value` per line. `Authorization` and
`Content-Type` belong to the client and cannot be overridden there.

### Fitting a rate-limited tier

An evidence pack is sized for a large context window by default: `EVIDENCE_CHAR_BUDGET`
is 240000 characters, roughly 60k tokens. A free tier is usually far smaller - Groq's
allows 8k tokens per minute - and the run fails with "request too large" on every company
that has any real volume of evidence. Lower the budget to match, per run or in `.env`:

```bash
npm run evaluate -- --service apa --budget 20000
```

Rate limits themselves are waited out rather than failed: a 429 or 503 is retried,
honouring `Retry-After` when the gateway sends one.

**List available** asks the gateway for its model list; **Test connection** makes a real
one-token round trip so a bad key is caught before it replaces a working one.

The key is **write-only**: it is AES-256-GCM encrypted before it is stored, and the API
returns only whether a key is set plus a four-character hint (`sk-…4f2a`) - never the
value. Saved settings take precedence over `LLM_API_KEY` / `LLM_BASE_URL` / `SIGNAL_MODEL`
in the environment, which remain as a fallback.

> **Set `APP_SECRET`.** It is the secret that encrypts the stored key. If it is unset the
> server generates one and keeps it in the same database as the ciphertext - still better
> than plaintext, but the two are not separated. The Settings screen says so when this is
> the case.

Structured output is the one place providers genuinely differ, so `src/llm/client.ts`
degrades in three steps - strict `json_schema`, then `json_object`, then plain prose - and
validates the result with zod either way. A weaker model behind the gateway still produces
verified answers or a clear error, never silent nonsense.

Press `⌘K` / `Ctrl-K` anywhere to search companies or jump between screens. The
light and dark palettes both come from the same design tokens in
`frontend/src/theme.css`.

**Switching a source off in Data sources is real** — `src/pipeline/ingest.ts`
reads `source_settings` before each block, so the crawler stops touching that
source on the next run rather than merely hiding it.

Where the design called for something this platform does not do, the screen
reports what it actually knows instead of inventing it: there are no email open
rates, because nothing here sends email, and no revenue figures, because the
platform never sees money.

## Configuring signals

Everything sales cares about is data, not code. Edit it in the dashboard, through the API,
or in `config/seed.json` before seeding.

A signal question has:

| Field | Meaning |
|---|---|
| `text` | The business question, in sales' own words |
| `weight` | `high` / `medium` / `low` |
| `polarity` | `positive`, `negative`, or `disqualifier` |
| `source_kinds` | Which evidence to read: `website`, `jobs`, `news`, `firmographics` |
| `half_life_days` | How fast this signal goes stale. 120 for hiring, 365 for a strategy programme |

Changing weights costs nothing: `POST /api/rescore` recomputes every score from stored
answers without calling the model again.

## Scraping conduct

`src/net/fetcher.ts` is the only thing that makes HTTP requests. It obeys robots.txt
including `Crawl-delay`, serialises requests per host, caps global concurrency, backs off on
429 and 5xx, and sends an identifying User-Agent.

**Set a real contact address in `CRAWLER_USER_AGENT` before running this at any scale**, and
check the terms of any site you add to the target list. Job data comes from each applicant
tracking system's own public JSON API rather than from scraping careers pages.

### How job data is found

Detection runs three passes: read the careers pages for a board URL, then probe the ATS APIs
with slugs guessed from the domain, then render the page with Playwright and look again.

Pass two does most of the work. Across ten European companies only one exposed its ATS in
static HTML, because modern careers pages are client-rendered. Probing found a board for
nine of eleven, with no browser.

Playwright is an **optional** dependency for the third pass. Without it that pass is skipped
and the crawl continues:

```bash
npm i -D playwright && npx playwright install chromium
```

## Cost

One model call per company per service, not one per document. Unchanged pages are
deduplicated on content hash at ingest and never re-evaluated, so a nightly re-run only
pays for genuinely new material. The evidence pack is capped by `charBudget` in
`src/signals/evaluate.ts` - lower it to send less context per call.

Note that moving to the OpenAI-compatible schema gave up Anthropic's prompt caching, which
previously made a *second* service for the same company mostly cache reads. Evaluating two
services against one company now costs roughly twice what it did, because the evidence pack
is sent in full each time. The portability was the trade: set `LLM_BASE_URL` to
`https://api.anthropic.com/v1` only if you want to go back to a single-provider setup.

The cheapest lever is the model itself - **Settings -> Model** switches it without a
redeploy, so a cheaper model can be measured against a stronger one on the same target list.

## Layout

```
db/schema.sql               tables
config/seed.json            services, signal questions, ICP
config/targets.json         companies to scrape
src/net/                    polite fetcher, HTML extraction
src/sources/                ats.ts, news.ts, website.ts, firmographics.ts
src/pipeline/ingest.ts      run every adapter, dedupe, store
src/llm/client.ts           OpenAI-compatible chat, portable structured output
src/llm/config.ts           model settings: database first, environment fallback
src/llm/crypto.ts           AES-256-GCM for the stored API key
src/signals/evaluate.ts     question answering with verified citations
src/scoring/score.ts        the scoring formula
src/outreach/draft.ts       evidence-grounded outreach
src/api/server.ts           REST API: leads, questions, ICP, scoring
src/api/routes/analytics.ts signal feed, source health, report aggregates
src/api/routes/workspace.ts sequences, schedules, members, settings
src/cli/run.ts              pipeline CLI
src/cli/smoke.ts            scraper check, no DB or API key needed

frontend/src/theme.css      design tokens (light + dark)
frontend/src/api.ts         typed API client
frontend/src/components/ui/ the primitives — button, card, select, dialog…
frontend/src/components/     app chrome: AppShell, states, domain chips
frontend/src/routes/        one file per screen
```

`lead_scores.fit_score` and `intent_score` are stored on a 0–100 scale while
`breakdown.icp.score` is 0–1; the formula is
`total = fit_weight × fit_score + (1 − fit_weight) × intent_score − penalty`.

## Known limits

- **Crunchbase needs a paid key.** Without one the platform uses Wikidata, an optional
  manual export at `config/crunchbase_seed.json`, and the company homepage. The adapter
  interface does not change when a key is added.
- **Google News links are consent redirects**, so those items are stored as headline-level
  evidence and labelled as such. GDELT supplies direct publisher URLs and full article text.
- **GDELT throttles hard, and signals it with HTTP 200 plus a plain-text body** rather than
  an error status. The adapter spaces calls 6.5 seconds apart and detects that body
  explicitly, logging `GDELT: throttled or rejected`. If you see that line, the run is not
  broken; Google News still supplies headlines and GDELT recovers after a cooldown. The
  working window parameter is `timespan=3m`. Ingesting many companies is news-bound, so run
  it as a nightly batch.
- **No accuracy benchmark yet.** The highest-value next step is a labelled set of around
  twenty companies scored by a rep, so prompt and weight changes can be measured.
