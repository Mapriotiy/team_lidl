"""Country and region resolution for ICP geography criteria.

The ICP contract stores geography in the words a person typed. Discovery search needs
ISO 3166-1 alpha-2 codes. This module is the one place that turns the former into the
latter, so the backend scorer and the frontend discovery search compare the same values.

Reference data lives in ``app/fixtures/reference_geography.json``.
"""

import json
from functools import lru_cache
from importlib.resources import files

# Phrases that mean "no restriction" rather than a set of countries.
WORLDWIDE_PHRASES = frozenset(
    {
        "all",
        "all countries",
        "any",
        "any country",
        "anywhere",
        "global",
        "globally",
        "world",
        "worldwide",
    }
)


@lru_cache(maxsize=1)
def _reference() -> tuple[dict[str, str], dict[str, str], dict[str, tuple[str, ...]]]:
    raw = json.loads(
        files("app.fixtures").joinpath("reference_geography.json").read_text(encoding="utf-8")
    )
    countries: dict[str, str] = {
        str(code).upper(): str(name) for code, name in raw["countries"].items()
    }
    aliases: dict[str, str] = {
        str(alias).casefold(): str(code).upper() for alias, code in raw["aliases"].items()
    }
    regions: dict[str, tuple[str, ...]] = {
        str(name).casefold(): tuple(str(code).upper() for code in codes)
        for name, codes in raw["regions"].items()
    }
    return countries, aliases, regions


def country_names() -> dict[str, str]:
    """ISO alpha-2 code to English country name."""
    return dict(_reference()[0])


def country_codes() -> frozenset[str]:
    return frozenset(_reference()[0])


def _lookup() -> dict[str, str]:
    """Casefolded country name or alias to ISO alpha-2 code."""
    countries, aliases, _ = _reference()
    lookup = {name.casefold(): code for code, name in countries.items()}
    lookup.update(aliases)
    return lookup


def is_worldwide(value: str) -> bool:
    return value.strip().casefold() in WORLDWIDE_PHRASES


def resolve_countries(values: list[str]) -> tuple[set[str], list[str], bool]:
    """Resolve place names to ISO alpha-2 codes.

    Returns the matched codes, the values that could not be interpreted, and whether any
    value asked for the whole world. A worldwide value short-circuits to an unrestricted
    criterion, which is why the caller must check the flag rather than the code set.
    """
    _, _, regions = _reference()
    lookup = _lookup()
    codes: set[str] = set()
    unresolved: list[str] = []
    worldwide = False
    for raw_value in values:
        value = raw_value.strip()
        if not value:
            continue
        if is_worldwide(value):
            worldwide = True
            continue
        folded = value.casefold()
        if folded in regions:
            codes.update(regions[folded])
            continue
        code = lookup.get(folded) or (value.upper() if value.upper() in country_codes() else None)
        if code is None:
            unresolved.append(value)
        else:
            codes.add(code)
    return codes, unresolved, worldwide


def resolve_country_text(value: str) -> tuple[set[str], bool]:
    """Resolve a stored company fact into the countries it could be in.

    Returns the possible codes and whether the text was understood at all. A region fact
    such as "Central and Eastern Europe" yields every code inside it, which the ICP
    evaluator treats as a partial match rather than a confirmed one.
    """
    parts = [part for part in value.replace(";", ",").replace("/", ",").split(",") if part.strip()]
    codes, unresolved, worldwide = resolve_countries(parts or [value])
    if worldwide:
        return set(country_codes()), True
    return codes, not unresolved and bool(codes)
