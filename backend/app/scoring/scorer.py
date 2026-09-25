from datetime import UTC, datetime

from app.assessment.models import AssessmentStatus
from app.contracts.profile import SignalEffect
from app.contracts.score import Eligibility
from app.scoring.models import (
    ScoreContributionResult,
    ScoringInput,
    ScoringResult,
    SignalScoringInput,
)


class ScoringConfigurationError(ValueError):
    pass


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _freshness(
    signal: SignalScoringInput,
    *,
    calculated_at: datetime,
) -> tuple[float, str | None]:
    evidence_date = signal.event_date or signal.publication_date
    if evidence_date is None:
        return 0.25, f"{signal.definition.id}: evidence date is unknown"

    age_days = (_as_utc(calculated_at) - _as_utc(evidence_date)).total_seconds() / 86_400
    if age_days < 0:
        return 1.0, f"{signal.definition.id}: evidence date is in the future"

    factor = max(0.0, 1.0 - age_days / signal.definition.freshness_window_days)
    if signal.event_date is None:
        return factor, f"{signal.definition.id}: publication date used for freshness"
    return factor, None


def _validate_unique_signals(scoring_input: ScoringInput) -> None:
    signal_ids = [signal.definition.id for signal in scoring_input.signals]
    if len(signal_ids) != len(set(signal_ids)):
        raise ScoringConfigurationError("signal definitions must have unique IDs")


def calculate_score(scoring_input: ScoringInput) -> ScoringResult:
    _validate_unique_signals(scoring_input)

    positive_denominator = sum(
        signal.definition.weight
        for signal in scoring_input.signals
        if signal.definition.effect == SignalEffect.POSITIVE
    )
    if positive_denominator <= 0:
        raise ScoringConfigurationError("at least one positive signal must have a nonzero weight")

    assessed_count = sum(signal.assessment is not None for signal in scoring_input.signals)
    coverage = assessed_count / len(scoring_input.signals) if scoring_input.signals else 0.0

    icp_configured = bool(scoring_input.icp_criteria)
    icp_fit = (
        sum(criterion.matched is True for criterion in scoring_input.icp_criteria)
        / len(scoring_input.icp_criteria)
        if icp_configured
        else 0.0
    )

    contributions: list[ScoreContributionResult] = []
    warnings: list[str] = []
    exclusion_reasons: list[str] = []
    positive_numerator = 0.0
    penalty_points = 0.0
    has_supported_evidence = False

    for signal in scoring_input.signals:
        assessment = signal.assessment
        if assessment is None or assessment.status != AssessmentStatus.SUPPORTED:
            continue

        has_supported_evidence = True
        strength = assessment.evidence_strength
        if strength is None:
            raise ScoringConfigurationError(
                f"supported assessment {assessment.signal_id} has no evidence strength"
            )

        freshness, warning = _freshness(signal, calculated_at=scoring_input.calculated_at)
        if warning is not None:
            warnings.append(warning)

        weighted_value = signal.definition.weight * strength.factor * freshness
        source_ids = list(dict.fromkeys(item.source_id for item in assessment.evidence))
        contributions.append(
            ScoreContributionResult(
                signal_id=signal.definition.id,
                effect=signal.definition.effect,
                weight=signal.definition.weight,
                evidence_strength=strength.factor,
                freshness=freshness,
                weighted_value=weighted_value,
                evidence_source_ids=source_ids,
            )
        )

        if signal.definition.effect == SignalEffect.POSITIVE:
            positive_numerator += weighted_value
        elif signal.definition.effect == SignalEffect.PENALTY:
            penalty_points += weighted_value
        elif signal.definition.effect == SignalEffect.DISQUALIFIER:
            exclusion_reasons.append(signal.definition.question)

    positive_strength = positive_numerator / positive_denominator
    score = min(
        100.0,
        max(0.0, 100 * (0.30 * icp_fit + 0.70 * positive_strength) - penalty_points),
    )

    if exclusion_reasons:
        eligibility = Eligibility.EXCLUDED
    elif coverage < 0.5 or not has_supported_evidence:
        eligibility = Eligibility.NEEDS_RESEARCH
    else:
        eligibility = Eligibility.ELIGIBLE

    if not icp_configured:
        warnings.append("ICP criteria are not configured")

    return ScoringResult(
        company_id=scoring_input.company_id,
        profile_version_id=scoring_input.profile_version_id,
        calculation_version=scoring_input.calculation_version,
        score=score,
        eligibility=eligibility,
        coverage=coverage,
        icp_fit=icp_fit,
        icp_configured=icp_configured,
        positive_strength=positive_strength,
        penalty_points=penalty_points,
        contributions=contributions,
        exclusion_reasons=exclusion_reasons,
        warnings=warnings,
    )
