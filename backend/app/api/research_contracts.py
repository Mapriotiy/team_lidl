from typing import Annotated

from pydantic import Field, StringConstraints

from app.contracts.common import ContractModel
from app.contracts.company import CompanySummary


class CompanyImport(ContractModel):
    domains: list[Annotated[str, StringConstraints(max_length=2048)]] = Field(
        min_length=1, max_length=10
    )


class AcceptedCompany(ContractModel):
    input: str
    company: CompanySummary
    created: bool


class RejectedCompany(ContractModel):
    input: str
    code: str
    message: str


class CompanyImportResult(ContractModel):
    accepted: list[AcceptedCompany]
    rejected: list[RejectedCompany]


class ResearchSubmission(ContractModel):
    company_id: str = Field(min_length=1, max_length=36)
    profile_version_id: str = Field(min_length=1, max_length=36)
    idempotency_key: str = Field(min_length=1, max_length=200, pattern=r"^\S+$")
