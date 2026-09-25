from datetime import datetime
from enum import StrEnum

from app.contracts.common import ContractModel
from app.contracts.score import Eligibility


class OpportunityStatus(StrEnum):
    NEW = "new"
    SHORTLISTED = "shortlisted"
    DISMISSED = "dismissed"


class OpportunityListItem(ContractModel):
    id: str
    company_id: str
    company_name: str
    profile_id: str
    profile_name: str
    status: OpportunityStatus
    eligibility: Eligibility
    score: float
    coverage: float
    strongest_signal: str | None
    last_researched_at: datetime | None


class OpportunityUpdate(ContractModel):
    status: OpportunityStatus | None = None
    note: str | None = None
