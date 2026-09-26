from datetime import datetime
from enum import StrEnum

from pydantic import Field, model_validator

from app.contracts.common import ContractModel


class SignalEffect(StrEnum):
    POSITIVE = "positive"
    PENALTY = "penalty"
    DISQUALIFIER = "disqualifier"


class SignalDefinition(ContractModel):
    id: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=500)
    positive_criteria: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    weight: float = Field(ge=0)
    effect: SignalEffect
    freshness_window_days: int = Field(gt=0)


class ProfileConfiguration(ContractModel):
    service_role: str | None = Field(default=None, max_length=160)
    service_description: str = Field(min_length=1, max_length=2000)
    icp: dict[str, list[str] | str | int | float | bool | None] = Field(default_factory=dict)
    signals: list[SignalDefinition] = Field(min_length=1)

    @model_validator(mode="after")
    def require_positive_weight(self) -> "ProfileConfiguration":
        positive_weight = sum(
            signal.weight for signal in self.signals if signal.effect == SignalEffect.POSITIVE
        )
        if positive_weight <= 0:
            raise ValueError("at least one positive signal must have a nonzero weight")
        return self


class ProfileCreate(ContractModel):
    name: str = Field(min_length=1, max_length=160)
    configuration: ProfileConfiguration


class ProfileUpdate(ContractModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    configuration: ProfileConfiguration


class ProfileVersionRead(ContractModel):
    id: str
    version: int
    configuration: ProfileConfiguration
    created_at: datetime


class ProfileRead(ContractModel):
    id: str
    name: str
    current_version: ProfileVersionRead
    created_at: datetime
    updated_at: datetime
