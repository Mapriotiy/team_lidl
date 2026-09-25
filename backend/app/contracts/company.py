from datetime import datetime

from app.contracts.common import ContractModel


class ProvenancedFact(ContractModel):
    value: str | int | float | bool | None
    source_ids: list[str]
    is_unknown: bool = False


class CompanySummary(ContractModel):
    id: str
    canonical_domain: str
    display_name: str
    aliases: list[str]
    industry: ProvenancedFact | None = None
    geography: ProvenancedFact | None = None
    company_size: ProvenancedFact | None = None
    operational_complexity: ProvenancedFact | None = None


class CompanyDetail(CompanySummary):
    profile_assessment_ids: list[str]
    research_run_ids: list[str]
    created_at: datetime
    updated_at: datetime
