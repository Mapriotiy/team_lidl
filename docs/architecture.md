# Architecture and contracts

## Stack baseline

| Layer | Choice |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind, shared components |
| API | Python, FastAPI, Pydantic |
| Persistence | PostgreSQL, SQLAlchemy, Alembic migrations; JSONB for flexible configuration |
| Background work | Separate worker, PostgreSQL-backed job table |
| Collection | HTTP/HTML extraction first; Playwright for dynamic pages |
| Assessment | One model provider with structured output; small LangGraph workflow if useful to the team |
| Delivery | Docker-based setup and a deployment host selected at kickoff |

Use a monorepo with `frontend/`, `backend/`, `docs/`, and `.github/`. Keep backend modules for collection, assessment, scoring, jobs and API separate. Scoring is a pure function of versioned inputs. A vector database is outside the initial scope.

Provider selection, exact dependency versions, commands, and hosting configuration must be recorded with the scaffold. Do not add dependencies based solely on the challenge's list of examples.

## Research flow

```text
Import/discover domains
  -> resolve company identity
  -> collect bounded public sources
  -> normalize and deduplicate
  -> assess service questions
  -> validate supporting evidence
  -> calculate score
  -> persist snapshot and display opportunity
```

Collect shared documents once and reuse them across service assessments. Add targeted collection when a service needs different sources. Weight-only edits reuse assessments; semantic question edits require reassessment, and may require fresh collection.

Use a job key tied to company, profile version, and requested research operation. Workers atomically claim jobs, maintain a lease/heartbeat, and use bounded retries with backoff. A stale lease can be reclaimed without duplicating final records. Persist results by stage so one source failure does not discard successful research.

Suggested initial limits, to tune after the source spike: 10 companies per interactive batch, 10 pages per company, bounded page size, request timeouts, and at most two retries for transient failures. Record run cost and usage; enforce the team's chosen budget cap.

## Data model

| Entity | Minimum fields / rule |
| --- | --- |
| Company | ID, canonical domain, display name, aliases, industry/geography/size facts with provenance and unknown values |
| ServiceProfile / ProfileVersion | Stable profile ID; immutable version containing service description, ICP and signal definitions |
| SignalDefinition | Stable question ID, criteria, exclusions, weight, effect, freshness window |
| ResearchRun | Company, profile version, stage/status, progress, timestamps, errors, usage, idempotency key |
| SourceDocument | Company, canonical URL, source type, title, retrieval/publication/event dates, content hash, permitted stored text |
| Evidence | Source ID, exact excerpt/offsets, factual claim, company attribution, event grouping key |
| SignalAssessment | Profile version, question, status, evidence IDs, evidence strength, rationale, model/prompt version |
| ScoreSnapshot | Company/profile version, calculation version, score, contributions, penalties, eligibility, coverage, input references |
| Opportunity | Company/profile, shortlist/dismiss state, notes, latest snapshot |

Keep extracted facts separate from sales interpretations. Store event date separately from publication and retrieval dates. Do not silently use retrieval time as evidence recency.

## Assessment contract

Question status: `supported`, `contradicted`, or `insufficient_evidence`. Collection status is separate. A failed fetch cannot establish a negative answer.

Every supported finding references source documents and exact excerpts. Validate the excerpt occurs in normalized source text and the source refers to the correct company. Use defined evidence-strength categories, provisionally strong = 1.0, moderate = 0.6, weak = 0.3, rather than treating a model's confidence as calibrated probability.

Search snippets locate sources; snippets alone do not establish strong verified findings. Group syndicated coverage and repeated job postings into events. Multiple citations can support a finding without multiplying its score.

## Scoring v1

Provisional defaults, to validate with the reviewed dataset:

```text
positive_strength = sum(weight * evidence_strength * freshness)
                    / sum(configured_positive_weights)

priority = clamp(100 * (0.30 * icp_fit + 0.70 * positive_strength)
                 - penalty_points, 0, 100)
```

- Each positive question contributes at most once; repeated sources do not accumulate points.
- Use a fixed denominator per profile version. Unknown signals contribute zero support and are not explicit negatives.
- If no positive weights are configured, block scoring and show a configuration error.
- ICP fit uses equal weights for configured criteria in v1; match = 1, mismatch/unknown = 0. Display unknown facts separately. No configured ICP criteria means ICP fit = 0 with an explicit unconfigured indicator.
- Explicit hard disqualifiers set eligibility to `excluded`, display the reason, and remove the account from the default ranked list.
- Penalty definitions use nonnegative score points multiplied by evidence strength and freshness; cap each penalty once per question.
- Proposed freshness: `max(0, 1 - age_days / window_days)`, using event date, or publication date with that fallback labeled. Missing both dates receives a provisional factor of 0.25 and a visible unknown-date warning. Validate positive windows; flag future dates for review.
- Round only the final displayed score; keep full precision in stored contributions.
- Configuration and calculation versions are part of every snapshot. Do not compare scores from different versions as though the criteria were unchanged.

Coverage is assessed questions / configured questions, where a valid completed assessment counts even when it finds insufficient evidence. Show fetch completion separately. Provisionally label an account `needs_research` if coverage is under 50% or it has no supported evidence; display it separately from the default ranked list. This is a product threshold to validate, not proof of low potential.

## API baseline

| Endpoint | Behavior |
| --- | --- |
| `GET/POST /service-profiles` | List or create profiles |
| `PATCH /service-profiles/{id}` | Create a new immutable configuration version |
| `POST /companies/import` | Validate and deduplicate domains; return accepted and rejected entries |
| `POST /discovery-runs` | Start bounded discovery; return run ID |
| `POST /research-runs` | Enqueue work; return HTTP 202 and run ID |
| `GET /research-runs/{id}` | Return stage, counts, partial errors and result links |
| `GET /opportunities` | Filter/paginate by service, status and eligibility |
| `GET /companies/{id}` | Company facts, service assessments, evidence and history |
| `PATCH /opportunities/{id}` | Update shortlist/dismiss state and notes |
| `POST /opportunities/{id}/draft` | Produce editable text from selected verified evidence |
| `GET /exports/opportunities.csv` | Export the selected/filter-matching opportunity set |

Use UTC ISO 8601 timestamps and stable string IDs. Return structured errors with code, message and request ID. Document pagination and filters in generated OpenAPI and shared fixtures. Discovery produces candidate domains; confirm the bounded research batch before incurring collection costs.

## Source and application boundaries

- Crunchbase enrichment is optional until licensed access is confirmed. NewsAPI's developer tier is not a production plan. Keep provider adapters replaceable.
- LinkedIn is manual validation only. Do not depend on scraping it.
- Treat retrieved text as untrusted data; embedded instructions cannot change extraction rules or trigger tools.
- For user-supplied URLs, allow HTTP(S) only, reject private/loopback/link-local destinations, revalidate redirects, cap content size and duration, and do not forward credentials. Browser collection needs equivalent network restrictions.
- Respect access restrictions and source retention requirements. Store the excerpts and provenance needed for review; do not publish bulk scraped content.
- Keep provider keys on the backend. Escape rendered source text; neutralize spreadsheet formula prefixes in exported text cells.
- Put a public demo behind access control before enabling paid research endpoints. Add per-user/run limits. No multi-tenant security claims without implemented isolation tests.
- Outreach remains a draft. No invented contacts, email lookup, or message sending.

## External references

- [Crunchbase API access](https://data.crunchbase.com/docs/using-the-api)
- [NewsAPI plans](https://newsapi.org/pricing)
- [LinkedIn prohibited automation](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions)
