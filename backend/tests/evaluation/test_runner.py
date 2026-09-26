from app.assessment import AssessmentStatus, EvidenceStrength, ProposedAssessment, ProposedEvidence
from app.assessment.providers import AssessmentBatch
from app.contracts.profile import ProfileConfiguration
from app.evaluation import ReviewedCorpus
from app.evaluation.runner import FIXTURE_DIR, _profiles, run_benchmark


class FakeProvider:
    model = "fake-model"

    def assess(self, **kwargs: object) -> AssessmentBatch:
        return AssessmentBatch(
            assessments=(
                ProposedAssessment(
                    signal_id="transformation-initiative",
                    status=AssessmentStatus.SUPPORTED,
                    evidence=[
                        ProposedEvidence(
                            source_id="source-1",
                            excerpt="may consider a major automation overhaul",
                            start_offset=24,
                            end_offset=65,
                            factual_claim="The company may consider automation.",
                            event_group_key="event-1",
                        )
                    ],
                    evidence_strength=EvidenceStrength.WEAK,
                    rationale="The headline mentions a possible initiative.",
                    model_version="fake-model",
                    prompt_version="assessment-v2",
                ),
            ),
            model="fake-model",
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15,
            cost_usd=0.001,
        )


def test_product_rpa_profile_resolves_corpus_business_name() -> None:
    profiles = _profiles(FIXTURE_DIR / "service_profiles.json")

    assert profiles["Process automation"] == profiles["RPA"]


def test_runner_records_headline_only_false_positive() -> None:
    corpus = ReviewedCorpus.model_validate(
        {
            "schema_version": 1,
            "review_status": "reviewed-v1",
            "reviewed_at": "2026-09-27",
            "guidance": "Adversarial fixture",
            "companies": [
                {
                    "id": "company-1",
                    "name": "Northstar Manufacturing",
                    "country": "Synthetic",
                    "domains": ["northstar.example.test"],
                    "case_tags": ["headline-only"],
                    "sources": [
                        {
                            "id": "source-1",
                            "url": "https://news.example.test/northstar",
                            "source_type": "news",
                            "published_at": "2026-09-01",
                            "language": "en",
                            "company_attribution": "confirmed",
                            "event_key": "event-1",
                            "content_scope": "headline_only",
                            "normalized_text": (
                                "Northstar Manufacturing may consider a major automation overhaul"
                            ),
                        }
                    ],
                    "labels": [
                        {
                            "profile": "Process automation",
                            "signal_id": "transformation-initiative",
                            "expected_status": "insufficient_evidence",
                            "evidence": [],
                        }
                    ],
                }
            ],
        }
    )
    profile = ProfileConfiguration.model_validate(
        {
            "service_description": "Automation consulting",
            "icp": {},
            "signals": [
                {
                    "id": "transformation-initiative",
                    "question": "Is there a current automation initiative?",
                    "positive_criteria": ["Named implementation"],
                    "exclusions": ["Speculative headlines"],
                    "weight": 20,
                    "effect": "positive",
                    "freshness_window_days": 365,
                }
            ],
        }
    )

    report, predictions = run_benchmark(
        corpus=corpus,
        profiles={"Process automation": profile},
        provider=FakeProvider(),
        revision="abc123",
        budget_usd=1,
        max_calls=2,
    )

    assert len(predictions) == 1
    assert report.passed_quality_gate is False
    assert report.counts.false_positive_supported == 1
    assert report.counts.headline_only_supported == 1
    assert report.run.provider_cost_usd == 0.001
