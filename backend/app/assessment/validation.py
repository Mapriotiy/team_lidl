from dataclasses import dataclass

from app.assessment.models import (
    AssessmentStatus,
    ProposedAssessment,
    SignalAssessment,
    ValidatedEvidence,
)


class AssessmentValidationError(ValueError):
    pass


@dataclass(frozen=True)
class SourceText:
    id: str
    company_id: str
    normalized_text: str


def validate_assessment(
    proposal: ProposedAssessment,
    *,
    company_id: str,
    sources: dict[str, SourceText],
) -> SignalAssessment:
    if proposal.status == AssessmentStatus.INSUFFICIENT_EVIDENCE:
        return SignalAssessment(
            signal_id=proposal.signal_id,
            status=proposal.status,
            evidence=[],
            evidence_strength=None,
            rationale=proposal.rationale,
            model_version=proposal.model_version,
            prompt_version=proposal.prompt_version,
        )

    if not proposal.evidence:
        raise AssessmentValidationError("supported and contradicted assessments require evidence")
    if proposal.evidence_strength is None:
        raise AssessmentValidationError(
            "supported and contradicted assessments require evidence strength"
        )

    validated: list[ValidatedEvidence] = []
    seen_events: set[str] = set()

    for evidence in proposal.evidence:
        source = sources.get(evidence.source_id)
        if source is None:
            raise AssessmentValidationError(f"unknown source: {evidence.source_id}")
        if source.company_id != company_id:
            raise AssessmentValidationError("source belongs to a different company")
        if evidence.end_offset > len(source.normalized_text):
            raise AssessmentValidationError("evidence offsets exceed source text")

        source_excerpt = source.normalized_text[evidence.start_offset : evidence.end_offset]
        if source_excerpt != evidence.excerpt:
            raise AssessmentValidationError("evidence excerpt does not match source text")

        if evidence.event_group_key in seen_events:
            continue
        seen_events.add(evidence.event_group_key)
        validated.append(ValidatedEvidence.model_validate(evidence.model_dump()))

    if not validated:
        raise AssessmentValidationError("assessment has no unique validated evidence")

    return SignalAssessment(
        signal_id=proposal.signal_id,
        status=proposal.status,
        evidence=validated,
        evidence_strength=proposal.evidence_strength,
        rationale=proposal.rationale,
        model_version=proposal.model_version,
        prompt_version=proposal.prompt_version,
    )
