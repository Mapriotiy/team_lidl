# Evaluation results

## Current status

The reviewed fixture contains 16 real-company cases plus one explicitly synthetic headline-only adversarial case, with 65 company/question labels across Process automation, Cybersecurity, and Software development. It is intentionally independent of generated prose: review decisions concern factual support, company and source attribution, exact excerpts, assessment status, freshness, and event identity.

A baseline was run against revision `4a2591d` with `google/gemini-3.1-flash-lite` and
`assessment-v2`. It passed the precision and evidence-integrity checks but failed the complete
quality gate because it missed 10 of 24 reviewed supported signals. The full machine-readable
artifact is [baseline-4a2591d.json](evaluation-runs/baseline-4a2591d.json).

## Coverage

The corpus includes:

- strong and weak matches;
- sparse-source accounts;
- penalty/disqualifier cases based on strong internal capability;
- ambiguous company names and aliases;
- stale evidence that must not be treated as current;
- syndicated copies sharing one event key;
- a clearly labeled synthetic headline-only case that must remain insufficient evidence;
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

Run the product assessment path with a bounded budget:

```bash
cd backend
python -m app.evaluation.runner --output ../artifacts/evaluation-$(date +%F).json \
  --revision "$(git rev-parse HEAD)" --budget-usd 1
```

The command exits non-zero when the quality gate fails. The output includes every reviewed
prediction and validation error, so a failed run is still a useful artifact. It never writes
credentials or source text beyond the reviewed fixture into the report.

## Metric definitions

| Metric | Calculation |
| --- | --- |
| Supported-finding precision | `true_positive_supported / (true_positive_supported + false_positive_supported)` |
| Missed-signal rate | `false_negative_supported / (true_positive_supported + false_negative_supported)` |
| Research coverage | `labels_with_usable_sources / reviewed_labels` |
| Wrong-company attribution rate | `wrong_company_attributions / reviewed_labels` |
| Excerpt accuracy | `1 - (inaccurate_excerpts / reviewed_labels)` |
| Headline-only supported rate | `headline_only_supported / supported_predictions` |
| Mean latency per completed account | `latency_ms_total / accounts_completed` |
| Mean provider cost per completed account | `provider_cost_usd / accounts_completed` |

If a denominator is zero, report the metric as `null`, not `0`. The supported-finding precision target is at least 90%, with the numerator and denominator disclosed. A supported assessment is correct only when its fact, company attribution, source attribution, excerpt, freshness treatment, and event deduplication are all correct.

The automated gate requires complete predictions, at least 90% supported-finding precision,
no more than 20% missed known signals, and zero wrong-company citations, inaccurate excerpts,
duplicate events, or supported findings whose reviewed source is marked `headline_only`. This is
an evidence-quality gate, not a second lead score and not a calibrated probability of purchase.
The monetary cap is enforced only when the provider reports cost; `--max-calls` remains the hard
bound when it does not.

## Baseline at `4a2591d`

| Item | Result |
| --- | --- |
| Quality gate | **Failed:** missed-signal rate above 20% |
| Revision | `4a2591d` |
| Provider model / prompt | `google/gemini-3.1-flash-lite` / `assessment-v2` |
| Accounts completed | 17 of 17 |
| Reviewed labels | 65 of 65 evaluated |
| Supported-finding precision | 93.3% (14/15 supported predictions correct) |
| Missed signals | 41.7% (10/24 reviewed supported signals missed) |
| Research coverage | 100% of labels had a usable fixture source; not a live-web coverage claim |
| Wrong-company attributions | 0 |
| Excerpt accuracy | 100% under the fixture metric |
| Duplicate events counted | 0 |
| Headline-only supported findings | 0 of 15 supported predictions |
| Mean latency per account | 6.36 seconds |
| Mean cost per account | Unavailable from provider response; do not infer zero |

## Known limitations

- The baseline is a provider benchmark over bounded reviewed passages, not the full live collection pipeline.
- The saved `4a2591d` predictions predate rationale persistence; later runs retain rationale and evidence strength for failure review.
- Fixture excerpts are short and deliberately bounded; they do not test long-document retrieval by themselves.
- Most labels are insufficient-evidence negatives, reflecting the rule that absence of a cited fact is not a positive finding.
- Live URL availability, robots directives, and content drift require a fresh pre-release audit.
- The corpus tests assessment correctness but does not replace the end-to-end browser smoke test or worker persistence checks.
