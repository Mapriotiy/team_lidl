import pytest

from app.assessment import (
    AssessmentStatus,
    EvidenceStrength,
    ProposedAssessment,
    ProposedEvidence,
    SourceText,
    validate_assessment,
)
from app.assessment.validation import AssessmentValidationError

SOURCE_TEXT = "The company announced a two-year operational efficiency program."


def proposal(
    *,
    status: AssessmentStatus = AssessmentStatus.SUPPORTED,
    excerpt: str = "operational efficiency program",
    source_id: str = "source-1",
    event_group_key: str = "efficiency-2026",
) -> ProposedAssessment:
    start = SOURCE_TEXT.index("operational efficiency program")
    return ProposedAssessment(
        signal_id="efficiency-program",
        status=status,
        evidence=[
            ProposedEvidence(
                source_id=source_id,
                excerpt=excerpt,
                start_offset=start,
                end_offset=start + len(excerpt),
                factual_claim="The company announced an efficiency program.",
                event_group_key=event_group_key,
            )
        ],
        evidence_strength=EvidenceStrength.STRONG,
        rationale="The statement names a current efficiency initiative.",
        model_version="model-1",
        prompt_version="assessment-v1",
    )


def sources(company_id: str = "company-1") -> dict[str, SourceText]:
    return {
        "source-1": SourceText(
            id="source-1",
            company_id=company_id,
            normalized_text=SOURCE_TEXT,
        )
    }


def test_accepts_exact_excerpt_for_the_correct_company() -> None:
    assessment = validate_assessment(proposal(), company_id="company-1", sources=sources())

    assert assessment.status == AssessmentStatus.SUPPORTED
    assert assessment.evidence[0].excerpt == "operational efficiency program"


def test_rejects_excerpt_not_present_at_offsets() -> None:
    with pytest.raises(AssessmentValidationError, match="does not match"):
        validate_assessment(
            proposal(excerpt="automation program"),
            company_id="company-1",
            sources=sources(),
        )


def test_rejects_source_from_another_company() -> None:
    with pytest.raises(AssessmentValidationError, match="different company"):
        validate_assessment(proposal(), company_id="company-1", sources=sources("company-2"))


def test_insufficient_evidence_remains_unknown_without_citations() -> None:
    assessment = validate_assessment(
        ProposedAssessment(
            signal_id="efficiency-program",
            status=AssessmentStatus.INSUFFICIENT_EVIDENCE,
            evidence=[],
            evidence_strength=None,
            rationale="The available sources do not establish a current program.",
            model_version="model-1",
            prompt_version="assessment-v1",
        ),
        company_id="company-1",
        sources={},
    )

    assert assessment.status == AssessmentStatus.INSUFFICIENT_EVIDENCE
    assert assessment.evidence == []


def test_deduplicates_repeated_evidence_for_one_event() -> None:
    repeated = proposal()
    duplicate = repeated.evidence[0].model_copy(update={"source_id": "source-2"})
    repeated = repeated.model_copy(update={"evidence": [repeated.evidence[0], duplicate]})
    available_sources = sources()
    available_sources["source-2"] = SourceText(
        id="source-2",
        company_id="company-1",
        normalized_text=SOURCE_TEXT,
    )

    assessment = validate_assessment(repeated, company_id="company-1", sources=available_sources)

    assert len(assessment.evidence) == 1
