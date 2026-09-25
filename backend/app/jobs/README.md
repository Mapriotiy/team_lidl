# Import and research jobs

Import up to ten identities per request:

```http
POST /companies/import
{"domains": ["https://www.example.com/about", "example.com", "localhost"]}
```

The response has `accepted` entries containing `input`, `company` and `created`, and
`rejected` entries containing `input`, `code` and `message`. Repeated identities
return the persisted company with `created: false`. Import validates syntax only;
the collection adapter must resolve DNS and enforce destination safety at fetch time.

```http
POST /research-runs
{"company_id": "<imported ID>", "profile_version_id": "<immutable version ID>", "idempotency_key": "batch-1-company-1"}
GET /research-runs/<returned ID>
```

Submission returns HTTP 202 and the existing `ResearchRunRead` contract. Reusing a
key with the same company/version returns the same run; different inputs return
409. Use a new key for an intentional refresh. Missing IDs return structured 404
errors. Progress is actual stage counts, never a synthetic percentage.

The PostgreSQL worker claims rows with `FOR UPDATE SKIP LOCKED`, uses a unique
lease token per attempt, heartbeats every 15 seconds, and fences all writes against
an unexpired token. Three total attempts permit two retries with exponential
backoff. Expired final attempts become terminal. Completed stage data and partial
errors survive crashes, and retries skip persisted stages. Adapter results must
be JSON serializable; external side effects inside adapters must be idempotent.
Transient attempt errors remain visible after recovery, yielding `partial`.

Implement `app.jobs.runner.ResearchPipeline` and call `app.worker.run(pipeline)`
from an application entrypoint. Its `collect(company)` and
`assess(company, immutable_configuration, sources)` methods return `StageResult`.
A stage can preserve successful data and report source errors together. Raise
`RetryableResearchError` only for transient failures. Other exceptions are terminal.
The default worker explicitly fails unconfigured jobs; it does not fabricate
collection or assessment results. R4 and R5 adapters still require integration.

Run PostgreSQL tests against a disposable, migrated, otherwise idle database:

```sh
DATABASE_URL="$TEST_DATABASE_URL" alembic upgrade head
pytest
```

Set `TEST_DATABASE_URL` before pytest to enable concurrency/lease and retry tests;
without it those four tests are skipped. Test rows use unique identities and remain
in the disposable database. No paid provider or live web calls are made.
