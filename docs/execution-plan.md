# Execution plan

## Status and operating rules

Planning baseline: 48-hour hackathon, five contributors, three services. Documentation exists; application work has not started. Times below are elapsed from the team's agreed kickoff, not calendar deadlines.

Keep this plan current as decisions are made. Backlog rows below are local work-item IDs, not existing GitHub issues. Convert them into issues at kickoff and link the resulting issue numbers. Do not mark work complete without a merged change and its acceptance evidence.

## Ownership

| Role | Primary responsibility | Review partner |
| --- | --- | --- |
| R1 — product/frontend | App shell, opportunities, profile editor, visual consistency | R2 |
| R2 — account experience | Company workspace, evidence, activity, outreach UI | R1 and R5 for evidence |
| R3 — platform/integration | Schema, API, jobs, scoring, CI, deployment | R4; R5 for scoring |
| R4 — collection | Discovery, fetchers, identity, content extraction, deduplication | R3 and R5 |
| R5 — assessment/quality | Service presets, model extraction, validation, evaluation corpus | R4 and R3 |

Replace role labels with names at kickoff. R3 coordinates integration but does not become the sole reviewer. R1 owns presentation coherence; R5 owns the demo dataset. Each PR has one primary author and one reviewer.

Shared-file ownership: R3 coordinates migrations and backend contracts; R1 coordinates frontend package/configuration changes; R5 coordinates preset fixtures. Notify the owner before changing those files. Avoid simultaneous lockfile edits.

## Milestones

| Hours | Goal | Exit gate |
| --- | --- | --- |
| 0–2 | Scope, accounts, contracts, ownership | Providers and spending cap chosen; work claimed; response fixtures agreed. |
| 2–6 | Scaffold, deployment, source spike | Deployed skeleton; usable source documents for three real companies. |
| 6–12 | One complete research flow | One company imported, researched, scored, and displayed with evidence. |
| 12–20 | Core product | Three presets, ranked list, account detail, configuration, background progress. |
| 20–28 | Flexibility | Weight changes recalculate; custom profile and bounded discovery if P0 is stable. |
| 28–34 | Sales actions and refresh | Shortlist/export complete; refresh/history and draft if time permits. |
| 34–40 | Evaluation and polish | Reviewed dataset, honest failure states, deployed smoke checks. |
| 40–44 | Feature freeze | Release candidate recorded; complete demo rehearsed. |
| 44–48 | Buffer and presentation | Fixes only; tested deployment and cached fallback ready. |

Use staggered rest and written handoffs. Do not plan around 48 continuous working hours per contributor.

## Ordered backlog

| ID | Priority / owner | Depends on | Acceptance / proposed PR title |
| --- | --- | --- | --- |
| E01 | P0 / R3 | — | Frontend, API, PostgreSQL and worker skeleton start from documented commands; placeholder env file; health endpoint. `chore: scaffold application services` |
| E02 | P0 / R3 | E01 | Repeatable deployment; real lint/type/test/build commands in CI; no placeholder passing jobs. `ci: add application checks and deployment setup` |
| E03 | P0 / R3 + R5 | E01 | Initial migration, versioned service schema, three preset fixtures and agreed API examples. `feat(profiles): add versioned service presets` |
| E04 | P0 / R4 | E01 | Resolve domains and aliases; retrieve source text, URL, timestamps and content hashes for three companies. `feat(research): collect company source documents` |
| E05 | P0 / R5 | E03, E04 | Structured findings with validated excerpts; unsupported claims rejected; unknowns retained. `feat(signals): extract evidence-backed assessments` |
| E06 | P0 / R3 | E03, E05 | Pure deterministic scorer with contributions, penalties, eligibility and coverage; duplicate event protection. `feat(scoring): rank company service opportunities` |
| E07 | P0 / R3 | E04, E05 | Queued research jobs, bounded retries, progress, partial failures and idempotent submissions. `feat(research): run research in background jobs` |
| E08 | P0 / R1 | E01; E03/E06 for integration | App shell, service selector and ranked opportunities consume the real API. `feat(opportunities): add ranked account workspace` |
| E09 | P0 / R2 | E01; E05/E06 for integration | Company detail opens source evidence and score breakdown; unknown/empty/failure states work. `feat(companies): add evidence and service assessments` |
| E10 | P0 / R1 + R3 | E03, E06 | Edit ICP, questions, weights and exclusions; weight-only changes recalculate without collection. `feat(profiles): configure qualification and scoring rules` |
| E11 | P0 / R2 + R3 | E08, E09 | Shortlist/dismiss/note persists; filtered CSV export works. `feat(opportunities): add sales workflow and export` |
| E12 | P1 / R4 | E04, E07 | One bounded industry/geography discovery run proposes deduplicated domains for review before research. `feat(discovery): suggest companies from public search` |
| E13 | P1 / R1 | E10 | Duplicate a preset and create a new service without code changes. `feat(profiles): create custom service profiles` |
| E14 | P1 / R2 + R3 | E07, E09 | Manual refresh preserves history; one scheduled refresh path if time allows. `feat(research): refresh accounts and show changes` |
| E15 | P1 / R5 + R2 | E09, E11 | Editable draft uses verified evidence; no invented names or sending capability. `feat(outreach): draft evidence-grounded messages` |
| E16 | P0 / all; R5 coordinates | E08–E11 | Evaluation results recorded, defects triaged, deployed main flow tested, demo runbook rehearsed. `test: verify research and sales workflows` |

Frontend work can begin against agreed fixtures while dependent endpoints are implemented. Fixture usage must be explicit and replaced on the main flow before acceptance. Split any row into smaller PRs when the diff stops being easy to review.

## Immediate execution sequence

1. Read the repository state and open work before editing; preserve unrelated local changes.
2. Confirm kickoff decisions and assign R1–R5 to people.
3. Start E01 on `chore/project-scaffold` from current `main`.
4. Define the company, evidence, score and research-run fixtures with R4/R5 before building screens.
   Use [parallel workstreams](parallel-workstreams.md) for directory ownership, branch boundaries, and agent-ready assignments.
5. Merge the scaffold and deployment path, then branch dependent work from updated `main`.
6. Prioritize E03–E09 toward the hour-12 complete flow. Integrate daily work continuously, not in a final-hour batch.
7. After P0 works in the deployed environment, pull P1 items in listed order according to remaining capacity.
8. Record validation results and unresolved limitations in each PR and handoff.
9. Freeze features at hour 40. Fix, rehearse, and verify the exact release candidate.

For every work item: inspect → identify acceptance criteria → implement the smallest complete change → run relevant checks → inspect diff → open PR → review → squash merge → smoke-check integration. Do not begin optional work while the core flow is broken.

## Checkpoints and cuts

- Hour 6: replace inaccessible providers or narrow source coverage.
- Hour 12: if the complete flow fails, pause secondary UI and discovery work until it passes.
- Hour 24: narrow discovery to one market if results are weak; retain domain import.
- Hour 34: cut extra connectors, analytics, outreach variants, and scheduling controls before evidence quality.
- Hour 40: feature freeze; no new feature branches for the demo release.

Protect three editable service presets, real research, evidence inspection, deterministic scores, useful job status, and deployment. Cached research is a labeled fallback, not a substitute for implementing real collection.

## Handoff template

```text
Work item / branch / PR:
Completed behavior:
Validation and results:
Remaining work:
Blocker and next action:
Shared files or contracts changed:
Next owner:
```

Update the team at milestone gates and whenever a blocker affects another contributor. Record decisions in this document or the architecture document so the next person does not need private chat history.
