from datetime import datetime
from enum import StrEnum

from pydantic import Field, model_validator

from app.contracts.common import ContractModel
from app.contracts.icp import (
    IcpCriterionDefinition,
    IcpCriterionRead,
    criteria_from_legacy_icp,
    describe_criteria,
)


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
    icp_criteria: list[IcpCriterionDefinition] | None = None
    signals: list[SignalDefinition] = Field(min_length=1)

    @model_validator(mode="after")
    def require_positive_weight(self) -> "ProfileConfiguration":
        positive_weight = sum(
            signal.weight for signal in self.signals if signal.effect == SignalEffect.POSITIVE
        )
        if positive_weight <= 0:
            raise ValueError("at least one positive signal must have a nonzero weight")
        return self

    def stored_icp_criteria(self) -> list[IcpCriterionDefinition]:
        """Every criterion this version states, whichever shape it was stored in.

        Versions written by the current editor carry ``icp_criteria``. Older immutable
        versions carry only the free-form ``icp`` dictionary and are upcast here, so no
        stored history has to be rewritten to benefit from the typed contract. This includes
        criteria that restrict nobody, which the editor still has to show back to the user.
        """
        if self.icp_criteria is not None:
            return list(self.icp_criteria)
        return criteria_from_legacy_icp(self.icp)

    def effective_icp_criteria(self) -> list[IcpCriterionDefinition]:
        """The criteria that actually decide anything, for scoring and discovery."""
        return [criterion for criterion in self.stored_icp_criteria() if criterion.is_restrictive()]


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
    icp_criteria: list[IcpCriterionRead] = Field(default_factory=list)
    created_at: datetime

    @model_validator(mode="after")
    def derive_icp_criteria(self) -> "ProfileVersionRead":
        """Serve every stated criterion, so clients never re-derive them from the raw dict."""
        self.icp_criteria = describe_criteria(self.configuration.stored_icp_criteria())
        return self


class ProfileRead(ContractModel):
    id: str
    name: str
    current_version: ProfileVersionRead
    created_at: datetime
    updated_at: datetime
