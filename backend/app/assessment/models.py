from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AssessmentModel(BaseModel):
    model_config = ConfigDict(frozen=True)


class AssessmentStatus(StrEnum):
    SUPPORTED = "supported"
    CONTRADICTED = "contradicted"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class EvidenceStrength(StrEnum):
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"

    @property
    def factor(self) -> float:
        return {
            EvidenceStrength.STRONG: 1.0,
            EvidenceStrength.MODERATE: 0.6,
            EvidenceStrength.WEAK: 0.3,
        }[self]


class ProposedEvidence(AssessmentModel):
    source_id: str
    excerpt: str = Field(min_length=1)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    factual_claim: str = Field(min_length=1)
    event_group_key: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_offsets(self) -> "ProposedEvidence":
        if self.end_offset <= self.start_offset:
            raise ValueError("end_offset must be greater than start_offset")
        return self


class ProposedAssessment(AssessmentModel):
    signal_id: str
    status: AssessmentStatus
    evidence: list[ProposedEvidence] = Field(default_factory=list)
    evidence_strength: EvidenceStrength | None = None
    rationale: str = Field(min_length=1)
    model_version: str = Field(min_length=1)
    prompt_version: str = Field(min_length=1)


class ValidatedEvidence(AssessmentModel):
    source_id: str
    excerpt: str
    start_offset: int
    end_offset: int
    factual_claim: str
    event_group_key: str


class SignalAssessment(AssessmentModel):
    signal_id: str
    status: AssessmentStatus
    evidence: list[ValidatedEvidence]
    evidence_strength: EvidenceStrength | None
    rationale: str
    model_version: str
    prompt_version: str
