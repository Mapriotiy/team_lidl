# Parallel workstreams

## Purpose

Five contributors should be able to work at the same time without duplicating features or repeatedly editing the same files. The shared scaffold is merged first. Product work then proceeds against versioned API examples, with integration occurring continuously rather than in a final batch.

Replace R1-R5 with contributor names when work is assigned. One person owns each branch and another reviews it.

## Workstream map

| Stream | Owner | Branch | Deliverable | Primary file ownership |
| --- | --- | --- | --- | --- |
| A - product shell | R1 | `feat/opportunities-workspace` | App navigation, opportunities list, filters, profile editor | `frontend/src/app/`, `frontend/src/features/opportunities/`, `frontend/src/features/profiles/` |
| B - account experience | R2 | `feat/company-workspace` | Company evidence, score breakdown, research activity, notes and actions | `frontend/src/features/companies/`, `frontend/src/features/activity/`, `frontend/src/features/actions/` |
| C - platform | R3 | `feat/platform-contracts` | Database base, migrations, profile/company/job/opportunity APIs, worker claiming | `backend/app/api/`, `backend/app/models/`, `backend/app/jobs/`, `backend/migrations/` |
| D - collection | R4 | `feat/public-source-collection` | Domain identity, safe HTTP collection, normalization, source deduplication | `backend/app/collection/`, `backend/tests/collection/` |
| E - assessment and quality | R5 | `feat/evidence-assessment` | Presets, structured assessment, evidence validation, scoring tests and evaluation fixtures | `backend/app/assessment/`, `backend/app/scoring/`, `backend/app/fixtures/`, `backend/tests/assessment/`, `backend/tests/scoring/` |

Shared configuration files remain owned by the scaffold integrator. Contributors should avoid changing `compose.yaml`, lockfiles, root configuration, or package configuration unless the change is coordinated first.

## Contract-first starting point

Before feature branches diverge, R3 and R5 publish reviewed JSON examples for these boundaries:

1. service profile and immutable profile version;
2. company summary and company detail;
3. source document and evidence excerpt;
4. signal assessment and score contribution;
5. research-run progress and partial error;
6. opportunity list item and update request.

Frontend streams use those examples through a clearly named fixture adapter. Backend streams validate real responses against the same shapes. Fixture adapters must be replaceable through one API client boundary and removed from the primary demo path before E16.

## Parallel sequence

### Wave 0 - shared scaffold

R3 merges E01: frontend, API, database, worker, environment template, and real local checks. No product data model is included in this wave.

### Wave 1 - five simultaneous branches

- R1 builds the opportunities and profile surfaces using agreed examples.
- R2 builds company, evidence, activity, and action surfaces using agreed examples.
- R3 implements versioned persistence, migrations, API routing, job leases, and imports.
- R4 implements collection behind a narrow `collect(company) -> SourceDocument[]` boundary.
- R5 implements presets, assessment, excerpt validation, and a pure scorer behind fixture-driven tests.

### Wave 2 - thin vertical integration

Merge the smallest path that imports one domain, collects one source, assesses one automation question, calculates one score, and displays its evidence. Integrate in this order: contracts and migration, collection, assessment/scoring, API/job orchestration, then the two frontend consumers.

### Wave 3 - independent completion

After the thin path works, each stream completes its remaining acceptance criteria. Optional discovery, refresh, and outreach work starts only after P0 is stable.

## Merge rules

- Rebase a sole-owner branch on current `main` before review; do not rewrite a shared branch.
- Keep changes inside the owned directories wherever possible.
- Contract changes require a short handoff to every consumer before merge.
- Each pull request contains one working boundary, its validation output, and remaining limitations.
- Use Conventional Commit titles such as `feat: add company evidence workspace`, `fix: prevent duplicate event scoring`, or `test: cover worker retry behavior`.
- Do not add generated-by footers, assistant names, or hidden authorship metadata.
- Squash merge only after one teammate reviews the change.

## Agent-ready work packets

These packets can be assigned independently after the scaffold and response examples are on `main`:

```text
R1: Implement E08 and the UI half of E10. Stay within the opportunities/profile feature folders. Use the shared API examples and expose loading, empty and error states. Do not implement company detail.

R2: Implement E09 and the UI half of E11. Stay within the companies/activity/actions feature folders. Preserve fact, interpretation and unknown as distinct concepts. Do not change scoring.

R3: Implement E03 and E07 platform contracts, migrations and endpoints. Own shared response schemas and publish examples before changing them. Do not implement collection or model assessment.

R4: Implement E04 behind the collection interface. Enforce URL safety, bounded retrieval, identity checks, normalized text and deduplication. Do not assign sales meaning to sources.

R5: Implement E05 and E06 with the three configurable presets. Validate excerpts, retain insufficient evidence, implement deterministic scoring, and cover Annex positive/negative automation signals. Do not build HTTP collectors or UI.
```

Each packet ends with a handoff containing branch, completed behavior, exact validation, remaining work, changed contracts, and next owner.

