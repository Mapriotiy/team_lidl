from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.contracts.common import ContractModel


class Eligibility(StrEnum):
    ELIGIBLE = "eligible"
    EXCLUDED = "excluded"
    NEEDS_RESEARCH = "needs_research"


class ScoreContribution(ContractModel):
    signal_id: str
    effect: str
    raw_value: float
    weighted_value: float
    evidence_ids: list[str]


class ScoreSnapshot(ContractModel):
    id: str
    company_id: str
    profile_version_id: str
    calculation_version: str
    score: float = Field(ge=0, le=100)
    eligibility: Eligibility
    coverage: float = Field(ge=0, le=1)
    contributions: list[ScoreContribution]
    exclusion_reasons: list[str]
    created_at: datetime
