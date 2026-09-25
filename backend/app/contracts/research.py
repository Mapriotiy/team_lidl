from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.contracts.common import ContractModel


class ResearchStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


class ResearchProgress(ContractModel):
    stage: str
    completed: int = Field(ge=0)
    total: int = Field(ge=0)


class PartialError(ContractModel):
    stage: str
    code: str
    message: str


class ResearchRunRead(ContractModel):
    id: str
    company_id: str
    profile_version_id: str
    status: ResearchStatus
    progress: list[ResearchProgress]
    partial_errors: list[PartialError]
    result_links: dict[str, str]
    queued_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
