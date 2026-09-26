# Workflow recovery plan

Status: proposed execution plan, ready for implementation.

## 1. Product outcome

A sales user saves a service profile, discovers plausible target companies, selects a bounded research batch, and receives a dossier explaining whether each company deserves attention. Every material finding links to a dated source and an exact excerpt. Unknowns, inaccessible sources, contradictory evidence, and provider failures remain visible.

Keep the three current pages: Service Profile, Discover companies, Research. Put account priority, score explanations, and shortlist actions inside Research; do not restore the removed Opportunities or Companies pages.

Success means a reviewer can answer: Why this company? What happened? When? Why does it matter for our service? What weakens the opportunity? What remains unknown?

## 2. Evidence for the redesign

The September 26 audit found three company records and three partial research runs, two stored documents, zero evidence records, and zero assessments. The latest failures included GDELT rate limiting/invalid responses, failed source retrieval, no collected documents, and citation text failing exact-offset validation. The worker was configured with `google/gemini-3.1-flash-lite`; changing models alone will not repair collection or citation handling.

Code-level issues:

- Discovery uses a limited Wikidata candidate pool. Employee values lack freshness and independent verification. Sorting by these values can promote erroneous or historical claims.
- The earlier implementation silently stopped including unknown-size companies despite the agreed product behavior. Audit and restore that behavior explicitly.
- ICP fields and matching need one contract: singular/plural keys and free-text size descriptions cannot be compared using literal string equality.
- Source collection starts from the homepage and GDELT. A shared six-page budget can leave no room for useful first-party links when news fills the queue.
- First-party planning only explores links on the homepage. Reports and news index pages are not equivalent to individual reports and articles.
- Extraction supports HTML/plain text, not PDF. The documented browser fallback is not an implemented collection adapter.
- Assessment asks the model to supply exact character offsets across long documents. One invalid assessment can prevent the entire batch from being stored.
- The current research screen fetches full company detail for every list row, does not expose enough failure context, and hides collected documents when no evidence exists.
- The active profile is implicitly the first profile in some flows. Manual import still mentions the deleted Companies page and does not provide a complete research handoff.

These are implementation gaps, not reasons to weaken citation validation or call incomplete research successful.

## 3. Agreed constraints

- Default geography: the existing configurable Eastern European country set. Other regions must work through the same contracts.
- Default employee threshold: 1,000. Unknown size is allowed with `needs_verification` and lower confidence.
- English app default; Romanian display option with cached translations. Preserve original-language excerpts and link translations to their originals.
- Retain normalized public texts for 30 days. This is a retention period, not a blanket 30-day evidence window. Signal freshness follows profile configuration; older strategy/report material can remain relevant.
- OpenRouter remains the model interface. Use the currently configured model for the initial baseline; benchmark before changing it. No new paid provider or unlimited request budget is assumed.
- LinkedIn remains optional manual validation. Crunchbase is optional licensed enrichment, not a prerequisite.
- Preserve versioned profiles, deterministic scoring, job checkpoints, domain/network safeguards, and valid existing records.
- Use scoped atomic commits. Benchmark changes in isolation before integrating; no production-data resets.

## 4. Target user journey

1. **Service Profile:** user explicitly selects the active profile/version and saves geography, industries, size, and business signals. Show the normalized search interpretation before running it.
2. **Discover companies:** return candidate identity, domain, geography, industry, size claim, source/date, match explanation, and verification gaps. Filters apply to discovery, not only to an already truncated list.
3. **Confirm research:** show selected companies, profile version, source/time/request limits, and estimated cost where available. Queue each company independently and preserve any submission failures for retry.
4. **Research list:** show one company row with the selected profile's latest run, live stage, last update, priority if assessable, and an open action. Do not merge results from unrelated profile versions.
5. **Company dossier:** show collected sources immediately, then validated facts, signal interpretations, counter-evidence, unknowns, and priority explanation as they become available.
6. **Follow-up:** shortlist, add notes, retry a failed stage, refresh research, or export the reviewed results from Research.

Use Waiting, Researching, Ready, Needs attention, Failed as display labels. Distinguish “not started” from queued work. Ready can include an honest conclusion of insufficient evidence if the planned investigation completed; zero documents is not Ready. Failure labels include a useful reason and next action.

## 5. Pipeline and responsibilities

`Profile → candidates → identity checks → source plan → fetch/extract → passages → validated facts → signal assessment → score → dossier`

### A. Candidate discovery and identity

- Keep QLever/Wikidata as one candidate source with an explicit dataset provenance. Do not present it as an exhaustive or current company directory.
- Normalize countries, industry aliases, employee ranges, and free-text profile criteria into typed search fields. Preserve the original user wording.
- Resolve company/entity ID, legal or trading names, name aliases, and candidate websites. Keep name aliases separate from allowed domains.
- Separate parent groups, subsidiaries, brands, and individual employers. Do not silently merge their employees or signals. Pick a preferred official domain using evidence, retain alternatives, and expose uncertainty.
- Store employee value/range, scope, source, observation date, and verification status. Missing dates, contradictory figures, implausible jumps, or unclear group scope trigger review. Wikidata alone is “reported,” not independently verified.
- Return unknown-size candidates when enabled; confirmed under-threshold candidates are excluded. Do not silently narrow unsupported criteria.
- Implement stable server-side paging, deduplication, and deterministic ordering. “Load more” must fetch additional candidates rather than merely reveal the same bounded response.
- Evaluate a web-search adapter for candidate expansion and source discovery. Choose on measured coverage, cost, licensing, and availability; do not hard-code an unapproved paid dependency.

### B. Source planning

- Resolve official homepage, robots rules, sitemap/sitemap indexes, feeds, newsroom, investor relations, careers, and strategy/report publications.
- Follow relevant index pages to actual articles/reports/jobs, within bounded depth. Recognize multilingual paths and common official subdomains.
- Generate a small set of source-search queries from company aliases and configured signals. Search snippets locate documents; snippets are not verified evidence.
- Assign separate source budgets so news cannot consume every first-party slot. Prioritize concrete dated publications over generic homepages.
- Treat GDELT as supplemental. Use shared rate limiting, bounded retries, and explicit source errors. Collection continues independently when news search fails.
- Do not block a company solely because its homepage is inaccessible: accessible official publications or reliable third-party sources may still support research.

### C. Fetching and extraction

- Persist each source attempt and successful document immediately, with stage, URL, title, language, timestamps, hash, extraction method, and failure reason.
- Extract main HTML content with boilerplate removal. Detect consent screens, navigation-only pages, empty JavaScript shells, and unrelated redirects.
- Add bounded PDF download and text extraction; retain page references. Scanned PDFs produce an explicit unsupported/OCR-needed outcome until OCR is benchmarked.
- Use browser rendering only for identified dynamic pages. Apply equivalent network/redirect restrictions and request budgets to every browser request; respect access restrictions.
- Keep publication date, event date, retrieval date, and employee-statistic date separate. Never substitute retrieval time for publication/event time.
- Deduplicate canonical URLs/content and group syndicated events. Retrying collection must not create duplicate evidence or broken source references.

### D. Evidence and signal assessment

- Split normalized documents into stable, versioned passages with source ID, passage ID, offsets, language, and optional PDF page.
- The model selects passage IDs and proposes exact quotes and factual claims. The backend calculates offsets from the stored passage.
- Accept exact matches deterministically. If normalization mapping is used, require a reversible mapping to the original stored text; ambiguous matches are rejected. No fuzzy semantic replacement of quotes.
- Validate the claim is supported by the quote and attributed to the correct company. Database ownership alone does not establish textual attribution.
- Store validated evidence incrementally. Reject or retry only invalid items, with a bounded repair attempt. Never discard valid findings because another signal failed.
- Assess signals using validated facts, not the entire raw crawl. Keep observed fact, commercial interpretation, counter-evidence, and unknown distinct.
- Group repeated reporting of the same event before scoring. Treat internal capability as evidence of maturity and potentially reduced vendor fit, not automatically as a positive lead.
- Prioritize sources across the context budget; do not let the first long document consume it all. Record provider/model, prompt version, tokens, latency, attempts, and cost.

### E. Priority and dossier

- Repair ICP matching with explicit range, country, industry, and unknown semantics before trusting any score.
- Keep scoring deterministic and profile-version specific. Expose evidence strength, freshness, positive contributions, penalties, disqualifiers, and missing coverage.
- Separate successfully processed questions from supported-signal coverage and source coverage. “100% assessed” does not imply strong evidence.
- A low score caused by missing data must look different from an evidence-backed weak fit. Do not present scores as purchase probabilities.
- Preserve a useful dossier when the model is unavailable: identity, sources, exact extraction state, and failure reason remain inspectable.
- Show original excerpts on hover/focus and open original sources in a new tab. Highlighting applies to our stored excerpt; the app cannot guarantee highlighting arbitrary external pages.

## 6. Execution order and exit gates

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0. Reproducible baseline | Standalone research harness, saved test manifest, current pipeline report | Each failure reproduces with a company, profile, stage, reason, and timings |
| 1. Contracts and recovery | Typed ICP, source-attempt/passages contracts, incremental persistence, explicit active profile | Collection works without LLM availability; retry creates no duplicate results; invalid citation affects only its item |
| 2. One complete company | Automatic identity resolution, source discovery, HTML/PDF extraction, validated facts, assessment and dossier | From company identity only, a reviewed company produces inspectable sources and justified signal outcomes without manually injecting evidence |
| 3. Coverage and discovery | Multilingual source planning, dynamic fallback, improved candidate quality, paging | Pass the fixed cross-country benchmark and independent holdout; show unsupported/missing coverage honestly |
| 4. Product integration | Paged Research summary API, detail route, polling, retry, actionable errors, translations | Browser reload preserves selected company/run; real results progress through the three-page journey |
| 5. Release validation | Repeated live benchmark, reviewed evidence/priority report, setup and failure runbook | Quality, reliability, cost, and recovery targets met with recorded results |

First implementation order inside phases 1–2: fix citation anchoring and all-or-nothing assessment; make source attempts/documents visible; improve source planning; add PDFs; then expand discovery. A richer candidate list is not useful until at least one company can be researched correctly.

The standalone harness should use a CLI accepting company/domain, profile, budget, and run ID. Record structured results for every stage and generate a human-readable report. Freeze reusable provider-independent interfaces early so successful code moves into backend modules rather than diverging into a second implementation.

## 7. Evaluation and release targets

Build a reviewed benchmark before tuning: 12 development companies across at least four countries and three sectors, plus six unseen holdout companies. Include native-language publications, a PDF report, unknown size, parent/subsidiary ambiguity, an inaccessible site, sparse coverage, strong signals, and strong internal capability. OMV Petrom, DHL, and Lufthansa are initial diagnostic cases, not the entire benchmark and not hard-coded evidence.

Targets below are provisional engineering gates, not claims about current performance. Record failures and denominator sizes; adjust targets only with an explicit rationale, never by silently dropping difficult cases.

| Area | Proposed gate |
| --- | --- |
| Identity precision | At least 90% of sampled discovery candidates are the intended commercial company with a correctly attributed official domain; no known government/nonprofit false positives in the reviewed sample |
| ICP behavior | All deterministic country/range/unknown fixtures pass; no unverified size claim displayed as confirmed |
| Collection | On companies with reviewed accessible publications, at least 80% yield three substantive documents from two source categories; sparse/blocked cases produce explicit outcomes |
| Citation integrity | 100% of persisted excerpts resolve exactly to their stored source version and offsets |
| Claim quality | At least 90% of sampled claims are judged supported and correctly attributed; count errors separately from rejected model proposals |
| Known-signal retrieval | At least 80% of independently reviewed, accessible relevant events are recovered in the benchmark; measure positive and negative signals separately |
| Honest unknowns | Sparse-evidence cases generate no invented signals; do not require a positive or negative finding for every company |
| Reliability | At least 90% of runs on the accessible benchmark yield a usable dossier across three live runs, with provider failures counted and categorized |
| Recovery | Injected 429/timeouts, worker restarts, malformed citations, and one unavailable source preserve valid completed stages and bounded retries |
| Performance | Initial targets: first visible sources within 30 seconds, discovery p95 under 30 seconds, bounded research p95 under 3 minutes on the accessible benchmark; report actuals before promising them |
| Cost | Enforce per-run request/token/time ceilings before and during execution; record actual or explicitly unavailable costs; choose the monetary cap from measured baseline and available budget |

Do not force five sources or a negative signal on companies that have no such public evidence. Use enough sources to answer the configured questions and report what was searched. The Annex examples must be independently researched; the reference pack is not a live source citation.

## 8. Failure handling and observability

- Run stages: identity, source planning, collection, extraction, evidence, assessment, scoring. Persist timestamps and useful progress counts; avoid simulated percentages.
- Separate empty search results, provider outages, unsupported content, blocked retrieval, missing sources, invalid evidence, and failed assessment.
- Expose safe actionable errors in the UI; keep detailed transport diagnostics in logs without secrets.
- Add run/request IDs to logs and persist provider usage even when a later validation step fails.
- Stop at configured budget/deadline; show partial valid results and remaining work. Retry only failed or explicitly refreshed stages.
- Build a paged research-summary endpoint so the list does not download every company's full evidence. Poll only active runs and fetch dossier details on open.
- Test a model outage independently of collection. Model failure must not remove the user's access to collected documents.

## 9. Team execution boundaries

Agree shared contracts and migrations in phase 1 before parallel implementation. One integration owner approves contract changes and owns merges.

| Owner | Scope | Boundary |
| --- | --- | --- |
| A: discovery/identity | Candidate adapters, identity resolution, typed ICP normalization, paging | Returns candidates and provenance; does not change assessment/scoring contracts |
| B: collection | Source plan, HTML/PDF extraction, source attempts, optional browser fetch | Returns versioned documents/passages; does not infer commercial signals |
| C: evidence/assessment | Quote anchoring, attribution, incremental facts, signal analysis | Consumes passages and produces validated findings; does not fetch arbitrary URLs |
| D: research UI | Summary list, dossier, live progress, source visibility, translation controls | Uses agreed response contracts; no fabricated fallback content |
| E: integration/evaluation | Migrations, orchestration, scoring repairs, benchmark and release gates | Owns shared lifecycle/contracts and cross-workstream integration |

Suggested atomic commits: `fix(assessment): anchor quotes to source passages`, `feat(collection): record per-source outcomes`, `feat(collection): extract report PDFs`, `fix(discovery): preserve unknown size and provenance`, `feat(research): expose dossier progress and recovery`. Each commit must stand on its own and include relevant verification. Do not assign the same files/contracts to multiple active implementers without coordination.

## 10. Rollout and remaining decisions

Implement on an isolated branch, preserve existing records, and use additive migrations. Tag new research output with pipeline/schema versions; older runs remain historical rather than silently reinterpreted. Run the new pipeline against the benchmark, compare results, then expose it through Research. Make rollback possible by restoring the previous application version without deleting data.

Decisions to resolve with baseline evidence:

1. Web-search provider and account access, if free public-source coverage is inadequate. Compare actual source retrieval before purchasing access.
2. Per-company/per-batch monetary and latency budget. No assumed unlimited OpenRouter allowance.
3. Whether to include brands/subsidiaries as independent accounts by default; provisional default is to retain separate entities and flag group relationships.
4. Whether scheduled monitoring belongs in this release. Complete dependable on-demand research first; design reruns so scheduling can reuse them later.

Model choice is an evaluation result: compare citation rejection rate, supported-claim precision, latency, and cost on the same saved passages. A schema-compliant response alone is not a correct assessment.

References: `docs/annex-alignment.md`; supplied Annex 1 Participant Reference Pack; [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs); [GDELT DOC API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/); [Crunchbase Basic API](https://data.crunchbase.com/docs/crunchbase-basic-using-api).
