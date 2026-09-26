# Settings data-source diagnostics handoff

R3 backend handoff for the settings feature. This is additive instrumentation of main;
no backend code was copied from v2 and provider selection, budgets, SSRF, redirects,
collection limits, assessment and scoring remain unchanged.

## API contract

`GET /data-sources?limit=100` accepts 1–250 events (default 100). Read-only: opening
Settings never makes provider requests or changes configuration.

```json
{
  "sources": [
    {
      "id": "gdelt",
      "name": "GDELT",
      "description": "Public news discovery; article URLs are collected separately.",
      "configured": true,
      "attempts": 1,
      "succeeded": 0,
      "failed": 1,
      "last_attempt_at": "2026-09-26T10:00:00Z"
    }
  ],
  "crawl_log": [
    {
      "id": "event-uuid",
      "run_id": "run-uuid",
      "company_id": "company-uuid",
      "company_name": "Example",
      "provider": "gdelt",
      "target": "GDELT search batch",
      "status": "error",
      "detail": "GDELT search failed; continuing with other sources",
      "at": "2026-09-26T10:00:00Z",
      "documents": null,
      "provenance": "crawl_log"
    }
  ],
  "runtime": {
    "assessment_model": "configured/model",
    "assessment_configured": true,
    "newsapi_configured": false,
    "browser_rendering_enabled": false,
    "source_text_retention_days": 30,
    "worker_concurrency": 2
  }
}
```

- Sources always include `gdelt`, `newsapi`, `websites`. These same IDs appear in
  `crawl_log.provider`. Status is `ok`, `error`, or `skipped`.
- Events are newest first. Times reflect actual collection outcomes or stored-source
  retrieval timestamps, not the API read. `provenance` is `crawl_log` for recorded collector
  events and `stored_source` for historical activity derived from a saved source row.
- Counts summarize the returned log window, not all historical runs. `attempts` counts
  non-skipped events, including followed redirects. `succeeded`/`failed` count ok/error.
  Last attempt excludes skipped events and is null when no attempt appears in the window.
- News providers report one **search batch** result, not an event for each HTTP request,
  internal retry, or query. A batch may contain successful URLs and partial query failures
  hidden by the existing adapters. `documents` is null for discovery: returned links are
  described in `detail`, and do not imply their contents have been retrieved.
- NewsAPI remains supplementary and runs when configured, even when GDELT succeeds.
  If GDELT fails and NewsAPI succeeds, both real outcomes appear chronologically.
  Unconfigured NewsAPI produces a skipped event, not a failure or a claimed request.
- Website events describe collector outcomes, including redirects, success, failure,
  duplicate URL/content skips and page limits. `documents` is 1 for an extracted page,
  0 for duplicate content, null for a redirect/failure/not-fetched page. Concurrent pages
  may subsequently deduplicate by content; event counts are not persisted source totals.
  Browser subresource traffic is not included.
- Target URLs exclude query strings, fragments and credentials. Redirect destinations use
  the same sanitizer. Details use internal controlled messages, not upstream exception
  text, headers, provider keys, response bodies or normalized document text.
- Runtime configuration is the API process's environment snapshot. Deploy API and worker
  with the same environment. A run's NewsAPI skipped event reflects the worker at run time.

## Persistence and visibility

Events live at `ResearchRun.stage_results.collection.crawl_log`, next to the existing
collection checkpoint documents. The existing lease-fenced checkpoint persists them
atomically and assessment checkpoints preserve them. No new table or migration is needed.
The company research deletion endpoint removes these logs with the owning run.

Logs become visible **after collection completes and its checkpoint commits**, not while
individual requests are running. Collection interrupted before that checkpoint creates no
persisted log. Retries that reuse the checkpoint do not invent repeated collection events.
Older research runs have no full crawl trace. When a terminal run has persisted source
rows but no `crawl_log` key, the endpoint derives clearly labeled `stored_source` events
from their IDs, URLs and `retrieved_at` timestamps. These prove that a source was collected;
they do not reconstruct provider calls, failed attempts, redirects, or prior retrievals
overwritten by deduplication. The stable ID is `stored-source:<source_id>`. A saved empty
`crawl_log` suppresses derivation, as does an in-flight run. This is a read-only projection:
repeated GETs never write synthetic telemetry, and deletion removes the source activity
alongside the original research. Expired normalized text does not erase source provenance.
The endpoint reads only the JSON log projection and source metadata, never normalized
source documents, and
bounds work to the latest 250 runs (ordered by queue time) that contain telemetry. It then
also reads at most `limit` historical source rows ordered by retrieval time. It merges
these with telemetry and returns the newest requested events within those windows.
Summary counts include the displayed historical source successes, whose explicit
provenance distinguishes them from instrumented attempts. No migration/backfill.

## Validation

Fixture-only tests cover GDELT error followed by NewsAPI success, unconfigured NewsAPI,
per-page success and timeout, redirects, page-limit skips, safe URLs/errors, API bounds,
no fabricated historical logs, and removal with company research. No live provider calls.

Run from `backend` with the project Python environment:

```sh
python -m ruff check .
python -m mypy app tests
python -m pytest
```

Validated: full backend suite 170 passed, 9 skipped (optional browser/PostgreSQL tests);
`mypy app tests` passed; ruff passed for changed files. Existing unused imports in
`app/worker.py` are outside this change. Focused telemetry tests also verify assessment
checkpoint preservation and rejection of stale lease tokens.

## Historical activity follow-up validation

Tests cover stable IDs across repeated reads, no database mutation, sanitized URLs,
correct recorded retrieval times, no invented news-provider attribution, expired-text
metadata, historical window bounds, removal with research, and suppression when a real
(including empty) crawl log exists. In-flight collection remains hidden until its existing
checkpoint is committed.
