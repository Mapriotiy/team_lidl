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
        return 0.5, f"{signal.definition.id}: evidence date is unknown"

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

    supported_count = sum(
        signal.assessment is not None
        and signal.assessment.status == AssessmentStatus.SUPPORTED
        for signal in scoring_input.signals
    )
    coverage = supported_count / len(scoring_input.signals) if scoring_input.signals else 0.0

    # A criterion that could not be compared (matched is None) is unknown, not a miss, so
    # it is reported but kept out of the ICP fit denominator. Otherwise a profile whose
    # facts are thin would be scored as if it fitted badly.
    decided = [item for item in scoring_input.icp_criteria if item.matched is not None]
    icp_configured = bool(scoring_input.icp_criteria)
    icp_fit = (
        sum(criterion.matched is True for criterion in decided) / len(decided)
        if decided
        else 0.0
    )

    contributions: list[ScoreContributionResult] = []
    warnings: list[str] = []
    exclusion_reasons: list[str] = []
    positive_numerator = 0.0
    penalty_points = 0.0
    has_credible_positive = False
    claimed_positive_events: set[str] = set()
    independent_positive_sources: set[str] = set()
    positive_strength_factors: list[float] = []

    for signal in scoring_input.signals:
        assessment = signal.assessment
        if assessment is None:
            continue
        if assessment.signal_id != signal.definition.id:
            raise ScoringConfigurationError(
                f"assessment {assessment.signal_id} does not match signal {signal.definition.id}"
            )
        if assessment.status != AssessmentStatus.SUPPORTED:
            continue

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
        source_independence_keys = {
            signal.source_independence_keys.get(source_id, source_id)
            for source_id in source_ids
        }
        event_keys = set(item.event_group_key for item in assessment.evidence)

        # One public event may answer more than one broad profile question. It is still
        # one piece of commercial evidence and must not multiply the opportunity score.
        if signal.definition.effect == SignalEffect.POSITIVE and event_keys:
            novel_events = event_keys - claimed_positive_events
            novelty_factor = len(novel_events) / len(event_keys)
            if novelty_factor < 1:
                warnings.append(
                    f"{signal.definition.id}: repeated evidence event was not scored twice"
                )
            weighted_value *= novelty_factor
            claimed_positive_events.update(novel_events)
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
            if weighted_value > 0:
                independent_positive_sources.update(source_independence_keys)
                positive_strength_factors.append(strength.factor)
            if strength.factor >= 0.7 and weighted_value > 0:
                has_credible_positive = True
        elif signal.definition.effect == SignalEffect.PENALTY:
            penalty_points += weighted_value
        elif signal.definition.effect == SignalEffect.DISQUALIFIER:
            exclusion_reasons.append(signal.definition.question)

    positive_strength = positive_numerator / positive_denominator
    source_confidence = min(1.0, len(independent_positive_sources) / 2)
    mean_positive_strength = (
        sum(positive_strength_factors) / len(positive_strength_factors)
        if positive_strength_factors
        else 0.0
    )
    evidence_confidence = source_confidence * mean_positive_strength

    # ICP facts decide whether an account belongs in the research queue. They do not
    # prove current demand. The public opportunity score is therefore evidence-gated.
    score = min(
        100.0,
        max(0.0, 100 * positive_strength * evidence_confidence - penalty_points),
    )
    if len(independent_positive_sources) < 2:
        score = min(score, 49.0)
    if not has_credible_positive:
        score = min(score, 39.0)

    target_mismatch = bool(decided) and not any(item.matched is True for item in decided)

    if exclusion_reasons:
        eligibility = Eligibility.EXCLUDED
    elif (
        coverage < 0.5
        or not has_credible_positive
        or len(independent_positive_sources) < 2
        or evidence_confidence < 0.65
        or positive_strength < 0.5
        or target_mismatch
    ):
        eligibility = Eligibility.NEEDS_RESEARCH
    else:
        eligibility = Eligibility.ELIGIBLE

    if not icp_configured:
        warnings.append("ICP criteria are not configured")
    elif not decided:
        warnings.append(
            "No ICP criterion could be compared against the stored company facts: "
            + "; ".join(
                item.reason or item.key for item in scoring_input.icp_criteria
            )
        )
    for criterion in scoring_input.icp_criteria:
        if criterion.matched is False and criterion.reason is not None:
            warnings.append(f"{criterion.key}: {criterion.reason}")
    if target_mismatch:
        warnings.append("No verified company fact matches the configured target criteria")
    if positive_numerator > 0 and not has_credible_positive:
        warnings.append("Only weak positive evidence was found; buying intent is not established")
    if positive_numerator > 0 and len(independent_positive_sources) < 2:
        warnings.append(
            "Fewer than two independent sources support the opportunity; score is capped at 49"
        )

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
        evidence_confidence=evidence_confidence,
        independent_positive_sources=len(independent_positive_sources),
        penalty_points=penalty_points,
        contributions=contributions,
        exclusion_reasons=exclusion_reasons,
        warnings=warnings,
    )
