from datetime import UTC, datetime

from app.assessment import AssessmentStatus
from app.evaluation import (
    BenchmarkPrediction,
    PredictionEvidence,
    ReviewedCorpus,
    evaluate_predictions,
)
from app.evaluation.benchmark import BenchmarkRun


def corpus(*, content_scope: str = "full_text") -> ReviewedCorpus:
    return ReviewedCorpus.model_validate(
        {
            "schema_version": 1,
            "review_status": "reviewed-v1",
            "reviewed_at": "2026-09-27",
            "guidance": "Reviewed evidence",
            "companies": [
                {
                    "id": "company-1",
                    "name": "Example SA",
                    "country": "Poland",
                    "domains": ["example.com"],
                    "case_tags": ["strong-match"],
                    "sources": [
                        {
                            "id": "source-1",
                            "url": "https://example.com/news",
                            "source_type": "company_newsroom",
                            "published_at": "2026-09-01",
                            "language": "en",
                            "company_attribution": "confirmed",
                            "event_key": "event-1",
                            "normalized_text": "Example SA announced a named automation programme.",
                            "content_scope": content_scope,
                        }
                    ],
                    "labels": [
                        {
                            "profile": "Process automation",
                            "signal_id": "transformation-initiative",
                            "expected_status": "supported",
                            "evidence": [
                                {
                                    "source_id": "source-1",
                                    "excerpt": "announced a named automation programme",
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    )


def run() -> BenchmarkRun:
    now = datetime.now(UTC)
    return BenchmarkRun(
        revision="abc123",
        started_at=now,
        finished_at=now,
        provider_model="test-model",
        prompt_version="assessment-v2",
        accounts_attempted=1,
        accounts_completed=1,
        latency_ms_total=100,
        provider_cost_usd=0.01,
    )


def supported_prediction() -> BenchmarkPrediction:
    return BenchmarkPrediction(
        company_id="company-1",
        profile="Process automation",
        signal_id="transformation-initiative",
        status=AssessmentStatus.SUPPORTED,
        evidence=[
            PredictionEvidence(
                source_id="source-1",
                excerpt="announced a named automation programme",
                event_group_key="event-1",
            )
        ],
    )


def test_passes_complete_precise_evidence() -> None:
    report = evaluate_predictions(corpus(), [supported_prediction()], run())

    assert report.passed_quality_gate is True
    assert report.metrics.supported_finding_precision == 1
    assert report.metrics.headline_only_supported_rate == 0
    assert report.counts.true_positive_supported == 1


def test_fails_supported_finding_that_only_has_a_headline() -> None:
    report = evaluate_predictions(
        corpus(content_scope="headline_only"), [supported_prediction()], run()
    )

    assert report.passed_quality_gate is False
    assert report.counts.headline_only_supported == 1
    assert report.metrics.headline_only_supported_rate == 1
    assert any("headline" in failure for failure in report.gate_failures)


def test_missing_or_unreviewed_evidence_cannot_pass_as_precise() -> None:
    prediction = supported_prediction().model_copy(
        update={
            "evidence": [
                PredictionEvidence(
                    source_id="unknown-source",
                    excerpt="unsupported",
                    event_group_key="event-2",
                )
            ]
        }
    )

    report = evaluate_predictions(corpus(), [prediction], run())

    assert report.passed_quality_gate is False
    assert report.counts.false_positive_supported == 1
    assert report.counts.false_negative_supported == 1
    assert report.counts.wrong_company_attributions == 1
