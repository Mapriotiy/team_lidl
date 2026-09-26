"""Typed criteria, resolved against stored company facts.

Every criterion answers with ``True``, ``False``, or ``None``. ``None`` means unknown: the
fact is missing, or its wording cannot be compared against what the user stated. Unknown
is not a miss — ``app.scoring.scorer`` weighs only the criteria it could decide — but it is
reported, so a profile whose criteria can never be compared is visible instead of silently
scoring zero.

Facts are read from ``Company.facts``, whose values are either the bare value or a
dictionary carrying it under ``value`` alongside its provenance.
"""

from collections.abc import Mapping
from typing import Any

from app.contracts.icp import IcpCriterionDefinition
from app.icp.employees import parse_employee_range
from app.icp.geography import resolve_countries, resolve_country_text
from app.scoring.models import IcpCriterion

FactValue = int | str | None
Match = tuple[bool | None, str | None]


def fact_value(facts: Mapping[str, Any] | None, key: str) -> FactValue:
    """Read a fact's value, unwrapping the provenance envelope the collectors store."""
    if not facts:
        return None
    raw: Any = facts.get(key)
    if isinstance(raw, dict):
        raw = raw.get("value")
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return int(raw)
    text = str(raw).strip()
    return text or None


def _normalize(text: str) -> str:
    return " ".join(text.casefold().split())


def _mentions(expected: str, actual: str) -> bool:
    """Whether two free-text labels refer to the same thing."""
    left, right = _normalize(expected), _normalize(actual)
    if not left or not right:
        return False
    return left == right or left in right or right in left


def _match_industry(definition: IcpCriterionDefinition, actual: FactValue) -> Match:
    if actual is None:
        return None, "no industry is recorded for this company"
    text = str(actual)
    if any(_mentions(value, text) for value in definition.values):
        return True, f"industry matches {text}"
    return False, f"{text} is outside the industries in this profile"


def _match_geography(definition: IcpCriterionDefinition, actual: FactValue) -> Match:
    configured, unresolved, worldwide = resolve_countries(definition.values)
    if unresolved:
        return None, "geography could not be interpreted: " + ", ".join(unresolved)
    if worldwide:
        return True, "the profile accepts every country"
    if actual is None:
        return None, "no geography is recorded for this company"
    possible, understood = resolve_country_text(str(actual))
    if not understood:
        return None, f"geography “{actual}” could not be compared against this profile"
    if possible and possible <= configured:
        return True, f"geography {actual} is inside the target markets"
    if possible & configured:
        return None, f"geography {actual} only partly overlaps the target markets"
    return False, f"geography {actual} is outside the target markets"


def _observed_employees(actual: FactValue) -> int | None:
    if isinstance(actual, int):
        return actual
    # A one-sided phrase is compared at the bound it states: "more than 5000 employees" is
    # treated as 5000, which is the most conservative reading of the stated lower bound.
    minimum, maximum, _ = parse_employee_range(str(actual))
    return minimum if minimum is not None else maximum


def _match_company_size(definition: IcpCriterionDefinition, actual: FactValue) -> Match:
    band = definition.employees
    if actual is None:
        if definition.include_unknown:
            return None, "company size is not recorded"
        return False, "company size is not recorded and this profile excludes unknown sizes"
    if band is None or band.is_open():
        stated = ", ".join(definition.values)
        return None, f"“{stated}” states no employee range that can be compared"
    observed = _observed_employees(actual)
    if observed is None:
        return None, f"reported size “{actual}” is not a number of employees"
    if band.minimum is not None and observed < band.minimum:
        return False, f"{observed} employees is below the target minimum of {band.minimum}"
    if band.maximum is not None and observed > band.maximum:
        return False, f"{observed} employees is above the target maximum of {band.maximum}"
    return True, f"{observed} employees is inside the target range"


def _match_operational_complexity(
    definition: IcpCriterionDefinition, actual: FactValue
) -> Match:
    # Operational characteristics are described in prose on both sides. Wording that
    # differs is not evidence of absence, so anything short of an exact match stays
    # unknown and is answered by research rather than by comparison.
    if actual is None:
        return None, "operational characteristics are not recorded"
    text = str(actual)
    if any(_normalize(value) == _normalize(text) for value in definition.values):
        return True, f"operational characteristics match {text}"
    return None, (
        f"operational characteristics are not confirmed by “{text}”; "
        "research answers this criterion"
    )


_MATCHERS = {
    "industry": _match_industry,
    "geography": _match_geography,
    "company_size": _match_company_size,
    "operational_complexity": _match_operational_complexity,
}


def evaluate_criteria(
    definitions: list[IcpCriterionDefinition],
    facts: Mapping[str, Any] | None,
) -> list[IcpCriterion]:
    """Resolve every criterion against the stored facts, keeping the reason for the answer."""
    results: list[IcpCriterion] = []
    for definition in definitions:
        matched, reason = _MATCHERS[definition.key](definition, fact_value(facts, definition.key))
        results.append(IcpCriterion(key=definition.key, matched=matched, reason=reason))
    return results
