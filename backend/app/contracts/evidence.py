from datetime import datetime
from enum import StrEnum

from app.contracts.common import ContractModel


class SourceType(StrEnum):
    COMPANY = "company"
    NEWS = "news"
    CAREERS = "careers"
    REPORT = "report"
    INDUSTRY = "industry"
    OTHER = "other"


class SourceDocument(ContractModel):
    id: str
    company_id: str
    canonical_url: str
    source_type: SourceType
    title: str
    retrieved_at: datetime
    publication_date: datetime | None = None
    event_date: datetime | None = None
    content_hash: str


class EvidenceExcerpt(ContractModel):
    id: str
    source_id: str
    excerpt: str
    start_offset: int
    end_offset: int
    factual_claim: str
    event_group_key: str
