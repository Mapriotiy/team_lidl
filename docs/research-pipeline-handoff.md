# Research pipeline handoff

## Branch and objective

Continue from `feat/research-pipeline`. The objective is a real, evidence-backed flow from configurable company discovery through collection, assessment, scoring, persistence, API responses, and the existing frontend.

Do not recreate completed modules. Read `docs/architecture.md`, `docs/annex-alignment.md`, and this handoff before editing.

## Decisions already confirmed

- Company discovery is global and configurable.
- Default discovery market: Poland, Czechia, Slovakia, Hungary, Romania, Bulgaria, Moldova, Ukraine, Estonia, Latvia, and Lithuania.
- Default company-size threshold: 1,000 employees.
- Missing employee counts remain candidates with `needs_verification` and reduced discovery confidence.
- Wikidata is the credential-free company-discovery source.
- Users must explicitly confirm up to 10 discovered candidates before research begins.
- GDELT supplies recent external-news targets without an API key.
- Crunchbase and NewsAPI remain optional adapters when keys are available.
- LinkedIn is manual validation only; never scrape it.
- Native-language sources are collected without filtering.
- Default interface language is English, with Romanian as an alternative.
- Translations are cached and generated through OpenRouter. Recommended remaining decision: translate cited evidence excerpts only, not whole pages.
- OpenRouter is the assessment provider. The exact model remains environment-configured so a structured-output-capable free model can be selected later.
- Full normalized source text is stored privately for 30 days. Evidence excerpts and provenance remain for audit.
- Default per-run model budget is USD 5 and must remain configurable.

## Completed atomic commits

```text
7bebf9c feat(discovery): add configurable Wikidata company discovery
746865f feat(assessment): add configurable OpenRouter provider
295c893 feat(research): persist evidence and score history
c446f02 feat(discovery): require candidate confirmation before research
266a7ef feat(discovery): find recent multilingual news with GDELT
128d739 feat(research): connect collection assessment and scoring
```

## Implemented behavior

- Configurable Wikidata discovery with the Eastern Europe default preset.
- Verified and `needs_verification` employee-count states.
- Discovery confidence reduction for unknown company size.
- Persisted discovery runs and explicit candidate confirmation endpoint.
- GDELT recent-news URL discovery in native languages.
- OpenRouter Chat Completions adapter using strict JSON Schema output.
- No hard-coded model or API key.
- Source, evidence, assessment, score snapshot, opportunity, and discovery persistence.
- Thirty-day normalized-text expiry timestamps.
- Integrated worker pipeline:
  - company homepage and recent-news targeting;
  - safe bounded collection;
  - normalized-text persistence;
  - OpenRouter structured assessment;
  - exact excerpt and company validation;
  - deterministic scoring;
  - score and opportunity persistence;
  - token/cost usage recording.
- The worker remains explicitly unconfigured until both `OPENROUTER_API_KEY` and `ASSESSMENT_MODEL` are set.

## Environment variables

```text
OPENROUTER_API_KEY=
ASSESSMENT_MODEL=
ASSESSMENT_TIMEOUT_SECONDS=60
RESEARCH_BUDGET_USD=5
SOURCE_TEXT_RETENTION_DAYS=30
```

Choose an OpenRouter model that supports `response_format=json_schema`. Do not silently fall back to unstructured output.

## Remaining work in priority order

### 1. Cached evidence translations

Add a translation cache keyed by evidence ID, target language, provider model, and source-text hash. Support `en` and `ro` initially. Preserve and expose the original excerpt alongside the translation. Use the same OpenRouter endpoint through a separate translation adapter and never overwrite original evidence.

Suggested commits:

```text
feat(evidence): persist cached excerpt translations
feat(assessment): translate evidence through OpenRouter
```

### 2. Read APIs

Implement real endpoints backed by persisted results:

```text
GET /opportunities
GET /companies/{id}
PATCH /opportunities/{id}
GET /exports/opportunities.csv
POST /evidence/{id}/translations
```

Support service, status, eligibility, pagination, and sorting filters. Return collection completion separately from assessment coverage. CSV output must neutralize cells beginning with `=`, `+`, `-`, or `@`.

Suggested commits:

```text
feat(opportunities): expose ranked persisted opportunities
feat(companies): expose evidence and research history
feat(opportunities): persist sales workflow actions
feat(exports): export filtered opportunities safely
```

### 3. Frontend API integration

Replace fixture repository internals with real API calls while retaining fixtures for tests and an explicitly labeled cached demo fallback. Connect:

- discovery filters and candidate confirmation;
- domain import and research submission;
- real research progress;
- opportunities and company evidence;
- profile save;
- shortlist, dismiss, notes, and CSV export;
- English/Romanian evidence translation toggle.

Do not remove fixture disclosure until the primary path uses real API results.

### 4. Source coverage

Current integrated collection uses the company homepage plus GDELT news URLs. Add bounded first-party link planning for newsrooms, careers, investor/strategy pages, and annual reports. PDF parsing is not yet implemented. Preserve all existing SSRF, redirect, deadline, content-size, and retention controls.

Optional adapters after credentials arrive:

- Crunchbase for company profiles, key people, and corporate events;
- NewsAPI for recent news;
- no LinkedIn automation.

### 5. Operations and quality

- Add a scheduled cleanup job that nulls expired `normalized_text` without deleting evidence excerpts.
- Run the four PostgreSQL-only lease tests using `TEST_DATABASE_URL`.
- Add live tests for Wikidata and GDELT with strict small limits; keep routine CI fixture-only.
- Add a real OpenRouter smoke test only after credentials and a spending cap are supplied.
- Build the reviewed 15-25 company evaluation corpus and report precision, missed signals, wrong-company attribution, coverage, latency, and cost.
- Add application checks to CI.
- Verify Docker Compose from a clean database and deploy behind access control.

## Known limitations and cautions

- Wikidata employee counts may be stale; treat them as sourced facts, not guaranteed current truth.
- GDELT discovers articles, not verified company attribution. Assessment validation must continue checking company identity.
- The model budget is checked after the single assessment call because actual cost is only known from the response. Record an over-budget result and stop further paid work.
- OpenRouter free models may not support strict structured outputs. The configured model must support the required parameter.
- Full normalized text must not be exported or shown wholesale; expose citations and source links.
- No live provider call has been performed because credentials are not available.

## Validation baseline

The latest complete validation before this handoff:

```text
ruff check .                              passed
mypy app tests                            passed
pytest                                    76 passed, 4 skipped before pipeline additions
focused discovery/assessment/pipeline     passed
```

Run the full suite again after pulling the branch:

```bash
cd backend
ruff check .
mypy app tests
pytest
alembic upgrade head --sql
```

The four skipped tests require a migrated disposable PostgreSQL database through `TEST_DATABASE_URL`.

## Handoff completion criterion

The next major milestone is complete only when a user can:

1. configure a global discovery search;
2. confirm up to 10 candidates;
3. start research;
4. observe real collection and assessment progress;
5. open a persisted ranked opportunity;
6. inspect original and optionally translated evidence;
7. reproduce its score;
8. shortlist, note, dismiss, or export it.

