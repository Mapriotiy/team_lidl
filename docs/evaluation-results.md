# Evaluation results

## Current status

The reviewed fixture contains 16 companies and 64 company/question labels across Process automation, Cybersecurity, and Software development. It is intentionally independent of generated prose: review decisions concern factual support, company and source attribution, exact excerpts, assessment status, freshness, and event identity.

No model evaluation has been run against this corpus yet. The result fields therefore remain `null`; zeroes in the run template are counters awaiting a run, not reported performance. Do not quote a precision, latency, or cost figure until a completed run is attached to a Git revision, model, and prompt version.

## Coverage

The corpus includes:

- strong and weak matches;
- sparse-source accounts;
- penalty/disqualifier cases based on strong internal capability;
- ambiguous company names and aliases;
- stale evidence that must not be treated as current;
- syndicated copies sharing one event key;
- accounts evaluated against more than one service profile;
- English, Romanian, Polish, Czech, and Hungarian source text;
- two companies outside Eastern Europe to preserve the product's wider-region behavior.

The source bodies are bounded fixture text, not retained web-page dumps. Before a release evaluation, a reviewer must verify that each URL is still public and permitted, confirm the excerpt against the captured source, and record any correction as a corpus change. Synthetic `example.test` syndicated URLs deliberately model duplicate wire coverage and must not be presented as live sources.

## Run procedure

1. Copy `backend/app/fixtures/evaluation/evaluation_run_template.json` to a dated result artifact outside routine fixtures.
2. Record the exact application revision, provider model, prompt version, and UTC start time.
3. Run every label without tuning the prompt against individual failures. Keep a reserved subset when prompt changes are being compared.
4. Review outputs by company/question. Ignore stylistic differences in rationale.
5. Populate raw counts first, then calculate metrics with the definitions below.
6. Record terminal partial failures, latency, token usage, and provider cost. Never infer missing cost as zero.

## Metric definitions

| Metric | Calculation |
| --- | --- |
| Supported-finding precision | `true_positive_supported / (true_positive_supported + false_positive_supported)` |
| Missed-signal rate | `false_negative_supported / (true_positive_supported + false_negative_supported)` |
| Research coverage | `labels_with_usable_sources / reviewed_labels` |
| Wrong-company attribution rate | `wrong_company_attributions / reviewed_labels` |
| Excerpt accuracy | `1 - (inaccurate_excerpts / reviewed_labels)` |
| Mean latency per completed account | `latency_ms_total / accounts_completed` |
| Mean provider cost per completed account | `provider_cost_usd / accounts_completed` |

If a denominator is zero, report the metric as `null`, not `0`. The supported-finding precision target is at least 90%, with the numerator and denominator disclosed. A supported assessment is correct only when its fact, company attribution, source attribution, excerpt, freshness treatment, and event deduplication are all correct.

## Pending baseline

| Item | Result |
| --- | --- |
| Revision | Not run |
| Provider model / prompt | Not run |
| Accounts completed | 0 of 16 |
| Reviewed labels | 64 available; 0 evaluated |
| Supported-finding precision | Not available |
| Missed signals | Not available |
| Research coverage | Not available |
| Wrong-company attributions | Not available |
| Excerpt accuracy | Not available |
| Duplicate events counted | Not available |
| Mean latency per account | Not available |
| Mean cost per account | Not available |

## Known limitations

- This commit provides the evaluation set and reproducible report structure, not a provider benchmark.
- Fixture excerpts are short and deliberately bounded; they do not test long-document retrieval by themselves.
- Most labels are insufficient-evidence negatives, reflecting the rule that absence of a cited fact is not a positive finding.
- Live URL availability, robots directives, and content drift require a fresh pre-release audit.
- The corpus tests assessment correctness but does not replace the end-to-end browser smoke test or worker persistence checks.
