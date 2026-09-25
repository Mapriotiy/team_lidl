# Quality and demo guide

## Product path

The frontend now uses the persisted API for production builds. Test fixtures are selected only when Vitest runs; they are not a silent runtime fallback.

1. Open **Discover companies** or **Import companies**.
2. Search by ISO country codes, industry, minimum employee count, and result limit, or enter up to ten domains.
3. Review source attribution, size verification, confidence, geography, and industry. Select no more than ten candidates and confirm them explicitly.
4. Choose a service-profile version and start research. Collection and assessment counts are displayed independently. Polling stops at `completed`, `partial`, or `failed`; partial errors do not hide successful stages.
5. Open **Opportunities**, choose the same service profile, then filter by workflow state or search. Scores are profile-specific priorities, not purchase probabilities.
6. Open a company to review facts, assessments, exact excerpts, source metadata, score contributions, exclusions, warnings, and research history.
7. Shortlist, dismiss, restore, or save a note. Refresh to verify persistence.
8. Request Romanian for an individual excerpt. The original remains visible and translation errors are isolated from research results.
9. Export the current profile, status, and search filters as CSV.

## Local setup

The UI needs no provider credential to load existing persisted results. Set `VITE_API_URL` only when the API is not available at `http://127.0.0.1:8000`.

New live assessments and translations require backend `OPENROUTER_API_KEY` and `ASSESSMENT_MODEL`. Without both, browsing, imports, profiles, stored opportunities, actions, and exports still work; worker assessment and new translations report an explicit configuration failure.

Run frontend checks from `frontend/`:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

For a real smoke test, start the API, worker, database, and frontend with `docker compose up --build`. Use one low-cost company and verify the full path against the same persisted IDs in the browser and API.

## Truthfulness rules

- Unknown totals are shown as counts, never invented percentages.
- Unknown company facts remain unknown and lower confidence rather than being inferred.
- Full normalized source text is never displayed in the UI.
- A translation never changes assessment or scoring.
- Discovery confidence is not an opportunity score.
- Provider cost and latency are reported only after a completed measured run.

## Current limitations

- There is no global company-list endpoint; a company is opened from a known discovery/import/research/opportunity ID.
- Profile names cannot be renamed through the current API; saving configuration creates an immutable version.
- Research submission is one request per company because the backend has no batch endpoint.
- Live Wikidata, worker, OpenRouter, and browser smoke checks depend on network access and credentials and are not part of routine deterministic tests.
- The evaluation corpus is reviewed, but no provider baseline is claimed until `docs/evaluation-results.md` is populated from a measured run.
