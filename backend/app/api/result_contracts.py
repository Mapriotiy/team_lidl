from datetime import datetime
from typing import Literal

from pydantic import Field

from app.contracts.common import ContractModel
from app.contracts.opportunity import OpportunityStatus
from app.contracts.score import Eligibility


class PageMeta(ContractModel):
    page: int
    page_size: int
    total: int


class OpportunityRead(ContractModel):
    id: str
    company_id: str
    company_name: str
    canonical_domain: str
    profile_id: str
    profile_name: str
    profile_version_id: str
    status: OpportunityStatus
    note: str | None
    score: float
    eligibility: Eligibility
    coverage: float
    collection_completion: float
    strongest_signal: str | None
    last_researched_at: datetime


class OpportunityPage(ContractModel):
    items: list[OpportunityRead]
    meta: PageMeta


class OpportunityPatch(ContractModel):
    status: OpportunityStatus | None = None
    note: str | None = Field(default=None, max_length=5000)


class TranslationRead(ContractModel):
    id: str
    target_language: Literal["en", "ro"]
    translated_excerpt: str
    provider_model: str
    source_text_hash: str
    created_at: datetime


class SourceRead(ContractModel):
    id: str
    canonical_url: str
    source_type: str
    title: str
    retrieved_at: datetime
    publication_date: datetime | None
    event_date: datetime | None
    content_hash: str


class EvidenceRead(ContractModel):
    id: str
    source_id: str
    excerpt: str
    start_offset: int
    end_offset: int
    factual_claim: str
    event_group_key: str
    source: SourceRead
    translations: list[TranslationRead]


class AssessmentRead(ContractModel):
    id: str
    profile_version_id: str
    signal_id: str
    status: str
    evidence_strength: str | None
    rationale: str
    evidence: list[EvidenceRead]
    model_version: str
    prompt_version: str


class ScoreRead(ContractModel):
    id: str
    profile_version_id: str
    calculation_version: str
    score: float
    eligibility: Eligibility
    coverage: float
    icp_fit: float
    positive_strength: float
    penalty_points: float
    contributions: list[dict[str, object]]
    exclusion_reasons: list[str]
    warnings: list[str]
    created_at: datetime


class ResearchHistoryRead(ContractModel):
    id: str
    profile_version_id: str
    status: str
    progress: list[dict[str, object]]
    partial_errors: list[dict[str, object]]
    usage: dict[str, object]
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class CompanyResultRead(ContractModel):
    id: str
    canonical_domain: str
    display_name: str
    aliases: list[str]
    facts: dict[str, object]
    assessments: list[AssessmentRead]
    scores: list[ScoreRead]
    research_history: list[ResearchHistoryRead]
    created_at: datetime
    updated_at: datetime


class TranslationRequest(ContractModel):
    target_language: Literal["en", "ro"]
