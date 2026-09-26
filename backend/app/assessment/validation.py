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
        if proposal.evidence or proposal.evidence_strength is not None:
            raise AssessmentValidationError(
                "insufficient evidence must not include citations or evidence strength"
            )
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
        matches: list[int] = []
        offset = source.normalized_text.find(evidence.excerpt)
        while offset >= 0:
            matches.append(offset)
            offset = source.normalized_text.find(evidence.excerpt, offset + 1)
        if not matches:
            raise AssessmentValidationError("evidence excerpt does not occur in source text")
        if len(matches) == 1:
            start_offset = matches[0]
        elif evidence.start_offset in matches:
            start_offset = evidence.start_offset
        else:
            raise AssessmentValidationError("evidence excerpt is ambiguous in source text")
        end_offset = start_offset + len(evidence.excerpt)

        if evidence.event_group_key in seen_events:
            continue
        seen_events.add(evidence.event_group_key)
        validated.append(
            ValidatedEvidence(
                source_id=evidence.source_id,
                excerpt=evidence.excerpt,
                start_offset=start_offset,
                end_offset=end_offset,
                factual_claim=evidence.factual_claim,
                event_group_key=evidence.event_group_key,
            )
        )

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
