from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator

EASTERN_EUROPE_DEFAULT = [
    "PL",
    "CZ",
    "SK",
    "HU",
    "RO",
    "BG",
    "MD",
    "UA",
    "EE",
    "LV",
    "LT",
]


class DiscoveryModel(BaseModel):
    model_config = ConfigDict(frozen=True)


class SizeVerification(StrEnum):
    VERIFIED = "verified"
    NEEDS_VERIFICATION = "needs_verification"


class DiscoveryRequest(DiscoveryModel):
    country_codes: list[str] = Field(
        default_factory=lambda: list(EASTERN_EUROPE_DEFAULT), max_length=50
    )
    minimum_employees: int = Field(default=1000, ge=1, le=10_000_000)
    include_unknown_size: bool = True
    industry: str | None = Field(default=None, max_length=120)
    industries: list[str] = Field(default_factory=list, max_length=50)
    limit: int = Field(default=25, ge=1, le=100)

    @field_validator("country_codes")
    @classmethod
    def normalize_country_codes(cls, values: list[str]) -> list[str]:
        normalized = [value.strip().upper() for value in values]
        if any(len(value) != 2 or not value.isalpha() for value in normalized):
            raise ValueError("country codes must use two-letter ISO 3166-1 codes")
        return list(dict.fromkeys(normalized))


class DiscoveryCandidate(DiscoveryModel):
    entity_id: str
    name: str
    domain: str
    country_code: str
    country_name: str
    industry: str | None
    employee_count: int | None
    size_verification: SizeVerification
    discovery_confidence: float = Field(ge=0, le=1)
    source_url: str
