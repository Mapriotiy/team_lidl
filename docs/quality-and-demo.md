# Quality and demo runbook

## Release acceptance

- [ ] Three presets run through the same configuration and assessment engine.
- [ ] A real domain can be imported, researched, scored and opened in the deployed interface.
- [ ] Every scored finding has a working source reference and an excerpt present in stored source text.
- [ ] Company identity is correct in the reviewed dataset.
- [ ] Score contributions reproduce the total; penalties and exclusions are visible.
- [ ] Weight changes recalculate without recollecting source documents.
- [ ] Duplicate events do not increase the score.
- [ ] Insufficient evidence, unknown dates, blocked sources and partial failures are visible.
- [ ] Shortlist/dismiss state persists and CSV export reflects the selected filters.
- [ ] Loading, empty and failed states are usable on the four core screens.
- [ ] The exact deployed revision and its smoke-check results are recorded.

For included P1 features, also verify discovery candidate review, custom profile creation, refresh history, scheduled execution, and outreach factuality. Record omitted P1 features explicitly.

## Meaningful checks

Unit-test the pure scorer, denominator/zero-weight cases, freshness boundaries, hard exclusions, penalties, deduplication, and URL validation. Test contracts and schema migrations at integration boundaries. Exercise worker retries/idempotency and partial failure behavior. Use one browser smoke flow for import → research → evidence → shortlist, plus profile editing and recalculation.

Model evaluation uses saved, permitted source fixtures with human-reviewed labels. Do not assert exact wording of generated prose. Test supported facts and source attribution instead. Keep routine CI independent of paid live providers; run a small live-source check before the demo and record its time and outcome.

Documentation-only changes need link/diff review, not application tests that do not exist yet. Never report a placeholder job as application verification.

## Evaluation set

R5 curates 15–25 companies across all three service profiles and roughly 60–100 reviewed company/question assessments, scaled to available time. Include strong matches, weak matches, multi-service accounts, sparse sources, an exclusion, an ambiguous company name, stale material, and syndicated coverage.

Label findings independently from model outputs where possible. Reserve a subset for the final evaluation instead of tuning every prompt against every example.

Report supported-finding precision, missed labeled signals, research coverage, wrong-company attributions, latency and cost per account. Precision target: at least 90% on the reviewed set; always disclose the denominator and actual result. All scored findings must remain traceable even if the precision target is missed.

## Five-minute presentation

| Time | Action | Point to demonstrate |
| --- | --- | --- |
| 0:00–0:30 | Describe the salesperson's research problem | Clear user and business value |
| 0:30–1:15 | Open ranked accounts and switch services | Company–service prioritization |
| 1:15–2:15 | Inspect one account, source and score breakdown | Verifiable evidence |
| 2:15–3:00 | Change a weight and show recalculation | Configurable business logic |
| 3:00–3:40 | Duplicate a profile, if included | Flexible service coverage |
| 3:40–4:20 | Shortlist/export; show draft if included | Useful sales action |
| 4:20–5:00 | Show bounded research progress and honest unknowns | Working pipeline and trust |

Choose examples based on reviewed evidence. Do not invent outcomes, customer usage, purchasing intent, or time savings. Measure any efficiency claim before presenting it.

## Pre-demo checklist

- [ ] Feature freeze is in effect; release candidate commit recorded.
- [ ] Deployment is healthy and frontend/API versions agree.
- [ ] Demo credentials and provider budgets are valid; secrets are not on screen.
- [ ] All three presets and the selected accounts are available.
- [ ] Live run uses a small bounded company set.
- [ ] Cached fallback is labeled with its collection time.
- [ ] Presenter has rehearsed the actual deployed build twice.
- [ ] A second teammate knows the recovery steps.

If live collection fails, show the visible error/partial status and switch to labeled cached research. Do not present cached results as freshly collected. If deployment fails, use the tested local setup described by the scaffold; rehearse that fallback too.

## Release record

Fill this in at freeze:

```text
Release candidate commit:
Deployment URL / revision:
Smoke check time and result:
Evaluation sample size and results:
Features omitted:
Known limitations:
Fallback dataset timestamp:
Presenter / recovery owner:
```
