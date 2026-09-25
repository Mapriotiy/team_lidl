from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.assessment.models import SignalAssessment
from app.contracts.profile import SignalDefinition
from app.contracts.score import Eligibility


class ScoringModel(BaseModel):
    model_config = ConfigDict(frozen=True)


class IcpCriterion(ScoringModel):
    key: str
    matched: bool | None


class SignalScoringInput(ScoringModel):
    definition: SignalDefinition
    assessment: SignalAssessment | None = None
    event_date: datetime | None = None
    publication_date: datetime | None = None


class ScoringInput(ScoringModel):
    company_id: str
    profile_version_id: str
    calculation_version: str = "v1"
    icp_criteria: list[IcpCriterion] = Field(default_factory=list)
    signals: list[SignalScoringInput]
    calculated_at: datetime


class ScoreContributionResult(ScoringModel):
    signal_id: str
    effect: str
    weight: float
    evidence_strength: float
    freshness: float
    weighted_value: float
    evidence_source_ids: list[str]


class ScoringResult(ScoringModel):
    company_id: str
    profile_version_id: str
    calculation_version: str
    score: float
    eligibility: Eligibility
    coverage: float
    icp_fit: float
    icp_configured: bool
    positive_strength: float
    penalty_points: float
    contributions: list[ScoreContributionResult]
    exclusion_reasons: list[str]
    warnings: list[str]
