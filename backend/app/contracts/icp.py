"""The one ideal-customer-profile contract.

A stored Service Profile version keeps the criteria in the words the user typed
(``ProfileConfiguration.icp``) and, once written by the current editor, as typed
``IcpCriterionDefinition`` entries. This module owns three things so no other module has
to guess at them:

* the canonical criterion keys — deliberately the same singular names used for company
  facts (``industry``, ``geography``, ``company_size``, ``operational_complexity``), so a
  criterion and the fact it is compared against cannot drift apart;
* the read-time upcast from the older free-form dictionary, including its plural keys,
  which keeps already-stored immutable versions interpretable without rewriting history;
* the projection served to clients (``IcpCriterionRead``), which resolves geography to ISO
  country codes once, on the server, for both the scorer and the discovery search.
"""

from collections.abc import Iterable, Mapping
from typing import Literal

from pydantic import Field, model_validator

from app.contracts.common import ContractModel
from app.icp.employees import parse_employee_range
from app.icp.geography import is_worldwide, resolve_countries

IcpCriterionKey = Literal["industry", "geography", "company_size", "operational_complexity"]

ICP_CRITERION_KEYS: tuple[IcpCriterionKey, ...] = (
    "industry",
    "geography",
    "company_size",
    "operational_complexity",
)

# Free-form values that state no restriction. Stored versions and the editor's blank
# fields both produce these, and neither should reach the scorer as a criterion.
NO_RESTRICTION_VALUES = frozenset({"", "-", "all", "any", "n/a", "na", "none", "unknown"})

# Older stored versions used plural and near-synonym keys. Read-time aliases keep those
# immutable versions interpretable without a data migration.
LEGACY_ICP_ALIASES: dict[str, IcpCriterionKey] = {
    "companies": "company_size",
    "company_size": "company_size",
    "company_sizes": "company_size",
    "complexity": "operational_complexity",
    "countries": "geography",
    "country": "geography",
    "employee_count": "company_size",
    "employees": "company_size",
    "geographies": "geography",
    "geography": "geography",
    "industries": "industry",
    "industry": "industry",
    "markets": "geography",
    "operational_complexity": "operational_complexity",
    "region": "geography",
    "regions": "geography",
    "size": "company_size",
}

# Only the multi-value criteria may be split out of a legacy comma-separated string.
# Company size and operational characteristics are single free-text phrases that happen to
# contain commas, as in "1,000+ employees".
_SPLIT_KEYS: frozenset[IcpCriterionKey] = frozenset({"industry", "geography"})


class EmployeeRange(ContractModel):
    """An employee-count band. Either bound may be left open."""

    minimum: int | None = Field(default=None, ge=0)
    maximum: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def require_ordered_bounds(self) -> "EmployeeRange":
        if (
            self.minimum is not None
            and self.maximum is not None
            and self.minimum > self.maximum
        ):
            raise ValueError("employee range minimum cannot exceed its maximum")
        return self

    def is_open(self) -> bool:
        return self.minimum is None and self.maximum is None


class IcpCriterionDefinition(ContractModel):
    """A stored ICP criterion: what the user restricted on, in their own words.

    ``values`` always keeps the user's wording. For geography it holds places, for company
    size it holds the size phrase, and ``employees`` carries the band parsed from that
    phrase when one could be read.
    """

    key: IcpCriterionKey
    values: list[str] = Field(default_factory=list)
    employees: EmployeeRange | None = None
    note: str | None = Field(default=None, max_length=200)
    include_unknown: bool = True

    def is_restrictive(self) -> bool:
        """Whether this criterion excludes anyone at all."""
        if self.key == "company_size":
            if self.employees is not None and not self.employees.is_open():
                return True
        values = [value for value in self.values if value.strip()]
        if self.key == "geography":
            # A worldwide phrase already accepts every country, so naming markets alongside
            # it changes nothing: the criterion restricts nobody either way.
            return bool(values) and not any(is_worldwide(value) for value in values)
        return bool(values)


class IcpCriterionRead(ContractModel):
    """A criterion as served to clients, with geography already resolved to country codes."""

    key: IcpCriterionKey
    values: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    worldwide: bool = False
    employees: EmployeeRange | None = None
    include_unknown: bool = True
    unresolved: list[str] = Field(default_factory=list)
    note: str | None = None


def _as_values(raw: object, *, split: bool) -> list[str]:
    if raw is None or isinstance(raw, bool):
        return []
    if isinstance(raw, (int, float)):
        return [str(raw)]
    if isinstance(raw, str):
        parts = raw.replace(";", ",").replace("\n", ",").split(",") if split else [raw]
        return [part.strip() for part in parts if part.strip()]
    if isinstance(raw, Iterable):
        return [text for item in raw for text in _as_values(item, split=split)]
    return []


def criteria_from_legacy_icp(icp: Mapping[str, object]) -> list[IcpCriterionDefinition]:
    """Read typed criteria out of the free-form ``icp`` dictionary.

    This is how every stored version written before the typed contract stays usable: the
    keys are aliased to the canonical singular ones, empty and "unknown" values are
    dropped, and a free-text company size is parsed into an employee band.
    """
    collected: dict[IcpCriterionKey, list[str]] = {}
    for raw_key, raw_value in icp.items():
        key = LEGACY_ICP_ALIASES.get(str(raw_key).strip().casefold())
        if key is None:
            continue
        values = _as_values(raw_value, split=key in _SPLIT_KEYS)
        collected.setdefault(key, []).extend(values)

    criteria: list[IcpCriterionDefinition] = []
    for key in ICP_CRITERION_KEYS:
        values = [
            value
            for value in collected.get(key, [])
            if value.strip().casefold() not in NO_RESTRICTION_VALUES
        ]
        if key == "company_size":
            if not values:
                continue
            minimum, maximum, note = parse_employee_range(" ".join(values))
            employees = (
                EmployeeRange(minimum=minimum, maximum=maximum)
                if minimum is not None or maximum is not None
                else None
            )
            criteria.append(
                IcpCriterionDefinition(
                    key=key, values=values, employees=employees, note=note
                )
            )
        elif values:
            criteria.append(IcpCriterionDefinition(key=key, values=values))
    return criteria


def describe_criteria(
    definitions: Iterable[IcpCriterionDefinition],
) -> list[IcpCriterionRead]:
    """Project stored criteria for clients, resolving geography to ISO country codes."""
    described: list[IcpCriterionRead] = []
    for definition in definitions:
        countries: list[str] = []
        unresolved: list[str] = []
        worldwide = False
        if definition.key == "geography":
            resolved, unresolved, worldwide = resolve_countries(definition.values)
            countries = sorted(resolved)
        described.append(
            IcpCriterionRead(
                key=definition.key,
                values=list(definition.values),
                countries=countries,
                worldwide=worldwide,
                employees=definition.employees,
                include_unknown=definition.include_unknown,
                unresolved=unresolved,
                note=definition.note,
            )
        )
    return described
