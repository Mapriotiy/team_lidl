from datetime import UTC, datetime, timedelta

import pytest

from app.assessment import (
    AssessmentStatus,
    EvidenceStrength,
    SignalAssessment,
    ValidatedEvidence,
)
from app.contracts.profile import SignalDefinition, SignalEffect
from app.contracts.score import Eligibility
from app.scoring import (
    IcpCriterion,
    ScoringConfigurationError,
    ScoringInput,
    SignalScoringInput,
    calculate_score,
)

NOW = datetime(2026, 9, 25, 12, tzinfo=UTC)


def definition(
    signal_id: str,
    *,
    effect: SignalEffect = SignalEffect.POSITIVE,
    weight: float = 20,
    freshness_window_days: int = 100,
) -> SignalDefinition:
    return SignalDefinition(
        id=signal_id,
        question=f"Does {signal_id} apply?",
        positive_criteria=["Verified public evidence"],
        exclusions=[],
        weight=weight,
        effect=effect,
        freshness_window_days=freshness_window_days,
    )


def assessment(
    signal_id: str,
    *,
    status: AssessmentStatus = AssessmentStatus.SUPPORTED,
    strength: EvidenceStrength | None = EvidenceStrength.STRONG,
    event_group_key: str | None = None,
) -> SignalAssessment:
    evidence = (
        [
            ValidatedEvidence(
                source_id=f"source-{signal_id}",
                excerpt="Verified evidence",
                start_offset=0,
                end_offset=17,
                factual_claim="A verified event occurred.",
                event_group_key=event_group_key or signal_id,
            )
        ]
        if status != AssessmentStatus.INSUFFICIENT_EVIDENCE
        else []
    )
    return SignalAssessment(
        signal_id=signal_id,
        status=status,
        evidence=evidence,
        evidence_strength=strength,
        rationale="Reviewed against the signal criteria.",
        model_version="model-1",
        prompt_version="assessment-v1",
    )


def scoring_input(signals: list[SignalScoringInput]) -> ScoringInput:
    return ScoringInput(
        company_id="company-1",
        profile_version_id="profile-v1",
        icp_criteria=[
            IcpCriterion(key="geography", matched=True),
            IcpCriterion(key="industry", matched=False),
        ],
        signals=signals,
        calculated_at=NOW,
    )


def test_calculates_fixed_denominator_score_without_rounding() -> None:
    result = calculate_score(
        scoring_input(
            [
                SignalScoringInput(
                    definition=definition("supported", weight=30),
                    assessment=assessment("supported"),
                    event_date=NOW,
                ),
                SignalScoringInput(
                    definition=definition("unknown", weight=30),
                    assessment=assessment(
                        "unknown",
                        status=AssessmentStatus.INSUFFICIENT_EVIDENCE,
                        strength=None,
                    ),
                ),
            ]
        )
    )

    assert result.icp_fit == 0.5
    assert result.positive_strength == 0.5
    assert result.score == 50.0
    assert result.coverage == 0.5
    assert result.eligibility == Eligibility.ELIGIBLE


def test_insufficient_evidence_does_not_inflate_coverage() -> None:
    result = calculate_score(
        scoring_input(
            [
                SignalScoringInput(
                    definition=definition("unknown"),
                    assessment=assessment(
                        "unknown",
                        status=AssessmentStatus.INSUFFICIENT_EVIDENCE,
                        strength=None,
                    ),
                )
            ]
        )
    )

    assert result.coverage == 0
    assert result.eligibility == Eligibility.NEEDS_RESEARCH


def test_applies_strength_freshness_and_penalty_once_per_question() -> None:
    result = calculate_score(
        scoring_input(
            [
                SignalScoringInput(
                    definition=definition("positive", weight=40),
                    assessment=assessment("positive", strength=EvidenceStrength.MODERATE),
                    event_date=NOW - timedelta(days=50),
                ),
                SignalScoringInput(
                    definition=definition(
                        "internal-capability",
                        effect=SignalEffect.PENALTY,
                        weight=10,
                    ),
                    assessment=assessment("internal-capability"),
                    event_date=NOW,
                ),
            ]
        )
    )

    assert result.positive_strength == pytest.approx(0.35)
    assert result.penalty_points == 10
    assert result.score == pytest.approx(29.5)


def test_supported_disqualifier_excludes_account() -> None:
    result = calculate_score(
        scoring_input(
            [
                SignalScoringInput(
                    definition=definition("positive"),
                    assessment=assessment("positive"),
                    event_date=NOW,
                ),
                SignalScoringInput(
                    definition=definition(
                        "excluded-sector", effect=SignalEffect.DISQUALIFIER, weight=0
                    ),
                    assessment=assessment("excluded-sector"),
                    event_date=NOW,
                ),
            ]
        )
    )

    assert result.eligibility == Eligibility.EXCLUDED
    assert result.exclusion_reasons == ["Does excluded-sector apply?"]


def test_unknown_date_uses_visible_provisional_factor() -> None:
    result = calculate_score(
        scoring_input(
            [
                SignalScoringInput(
                    definition=definition("positive"),
                    assessment=assessment("positive"),
                )
            ]
        )
    )

    assert result.contributions[0].freshness == 0.5
    assert result.warnings == ["positive: evidence date is unknown"]


def test_low_coverage_is_separated_as_needs_research() -> None:
    result = calculate_score(
        scoring_input(
            [
                SignalScoringInput(
                    definition=definition("supported"),
                    assessment=assessment("supported"),
                    event_date=NOW,
                ),
                SignalScoringInput(definition=definition("missing-1")),
                SignalScoringInput(definition=definition("missing-2")),
            ]
        )
    )

    assert result.coverage == pytest.approx(1 / 3)
    assert result.eligibility == Eligibility.NEEDS_RESEARCH


def test_rejects_profiles_without_positive_weight() -> None:
    with pytest.raises(ScoringConfigurationError, match="positive signal"):
        calculate_score(
            scoring_input(
                [
                    SignalScoringInput(
                        definition=definition("penalty", effect=SignalEffect.PENALTY, weight=10)
                    )
                ]
            )
        )


def test_rejects_duplicate_signal_definitions() -> None:
    duplicate = SignalScoringInput(definition=definition("duplicate"))

    with pytest.raises(ScoringConfigurationError, match="unique IDs"):
        calculate_score(scoring_input([duplicate, duplicate]))


def test_rejects_assessment_attached_to_another_signal() -> None:
    with pytest.raises(ScoringConfigurationError, match="does not match"):
        calculate_score(
            scoring_input(
                [
                    SignalScoringInput(
                        definition=definition("expected"),
                        assessment=assessment("different"),
                    )
                ]
            )
        )
