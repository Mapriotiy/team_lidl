from datetime import UTC, datetime
from typing import Any

from app.contracts.icp import IcpCriterionDefinition, criteria_from_legacy_icp
from app.contracts.profile import (
    ProfileConfiguration,
    ProfileVersionRead,
    SignalDefinition,
    SignalEffect,
)
from app.icp.employees import parse_employee_range
from app.icp.evaluation import evaluate_criteria
from app.scoring import (
    IcpCriterion,
    ScoringInput,
    ScoringResult,
    SignalScoringInput,
    calculate_score,
)

SIGNAL = SignalDefinition(
    id="efficiency-program",
    question="Is there a current efficiency programme?",
    weight=20,
    effect=SignalEffect.POSITIVE,
    freshness_window_days=365,
)


def configuration(icp: dict[str, Any]) -> ProfileConfiguration:
    return ProfileConfiguration(
        service_description="Intelligent automation services.", icp=icp, signals=[SIGNAL]
    )


def keys(icp: dict[str, Any]) -> list[str]:
    return [criterion.key for criterion in criteria_from_legacy_icp(icp)]


def test_plural_and_legacy_keys_resolve_to_the_canonical_singular_names() -> None:
    # The keys stored with company facts are singular. Older profile versions and the
    # presets used plurals, which is why the two could never be compared.
    assert keys(
        {
            "industries": ["Logistics"],
            "geographies": ["Poland"],
            "company_sizes": ["1,000+ employees"],
            "operational_complexity": "high",
        }
    ) == ["industry", "geography", "company_size", "operational_complexity"]


def test_blank_and_unknown_values_state_no_restriction() -> None:
    assert keys(
        {
            "industry": [],
            "geography": "",
            "company_size": "",
            "operational_complexity": "unknown",
        }
    ) == []


def test_free_text_company_size_becomes_an_employee_range() -> None:
    (criterion,) = criteria_from_legacy_icp({"company_size": "1,000+ employees"})
    assert criterion.employees is not None
    assert (criterion.employees.minimum, criterion.employees.maximum) == (1000, None)

    (spelled,) = criteria_from_legacy_icp(
        {"company_size": "Large organisations with more than one thousand employees"}
    )
    assert spelled.employees is not None
    assert spelled.employees.minimum == 1000

    (band,) = criteria_from_legacy_icp({"company_size": "250-500 employees"})
    assert band.employees is not None
    assert (band.employees.minimum, band.employees.maximum) == (250, 500)


def test_a_size_phrase_without_a_number_stays_unparsed_rather_than_guessed() -> None:
    (criterion,) = criteria_from_legacy_icp({"company_size": "Large enterprise"})
    assert criterion.employees is None
    assert criterion.values == ["Large enterprise"]
    assert criterion.is_restrictive()


def test_negated_comparisons_are_read_in_the_right_direction() -> None:
    assert parse_employee_range("no more than 500 employees")[:2] == (None, 500)
    assert parse_employee_range("no fewer than 500 employees")[:2] == (500, None)
    assert parse_employee_range("turnover of 800 million")[:2] == (None, None)


def test_a_lone_number_is_read_as_a_floor_and_the_reading_is_disclosed() -> None:
    minimum, maximum, note = parse_employee_range("1,000")

    assert (minimum, maximum) == (1000, None)
    assert note is not None and "1,000" in note


def test_a_profile_version_reports_geography_as_country_codes() -> None:
    version = ProfileVersionRead(
        id="version",
        version=1,
        configuration=configuration({"geographies": ["Romania", "Central and Eastern Europe"]}),
        created_at=datetime.now(UTC),
    )

    (geography,) = version.icp_criteria
    assert geography.key == "geography"
    assert geography.values == ["Romania", "Central and Eastern Europe"]
    assert "RO" in geography.countries
    assert "PL" in geography.countries
    assert geography.unresolved == []


def test_an_uninterpretable_place_is_reported_rather_than_dropped() -> None:
    version = ProfileVersionRead(
        id="version",
        version=1,
        configuration=configuration({"geography": ["Atlantis"]}),
        created_at=datetime.now(UTC),
    )

    (geography,) = version.icp_criteria
    assert geography.countries == []
    assert geography.unresolved == ["Atlantis"]


def test_a_worldwide_geography_is_shown_to_the_editor_but_restricts_nobody() -> None:
    version = ProfileVersionRead(
        id="version",
        version=1,
        configuration=configuration({"geography": ["Global"]}),
        created_at=datetime.now(UTC),
    )

    # The editor has to show the user what they typed...
    (geography,) = version.icp_criteria
    assert geography.values == ["Global"]
    assert geography.worldwide is True
    # ...but a criterion that accepts every country must not inflate the ICP fit.
    assert version.configuration.effective_icp_criteria() == []
    (result,) = evaluate_criteria([IcpCriterionDefinition(key="geography", values=["Global"])], {})
    assert result.matched is True


def test_criteria_are_resolved_against_stored_company_facts() -> None:
    company_facts = {
        "industry": {"value": "Logistics", "source_ids": ["source"]},
        "geography": {"value": "Poland"},
        "company_size": {"value": 2500},
        "operational_complexity": {"value": "Multiple sites and shared services"},
    }

    results = evaluate_criteria(
        criteria_from_legacy_icp(
            {
                "industries": ["Transport and logistics"],
                "geographies": ["Central and Eastern Europe"],
                "company_sizes": ["1,000+ employees"],
                "operational_complexity": "Multiple sites and shared services",
            }
        ),
        company_facts,
    )
    matched = {result.key: result.matched for result in results}

    assert matched == {
        "industry": True,
        "geography": True,
        "company_size": True,
        "operational_complexity": True,
    }


def test_a_country_outside_the_target_markets_is_a_decision_not_an_unknown() -> None:
    (result,) = evaluate_criteria(
        criteria_from_legacy_icp({"geography": ["Germany"]}), {"geography": "Poland"}
    )
    assert result.matched is False
    assert result.reason is not None and "Poland" in result.reason


def test_a_region_fact_only_partly_overlapping_the_target_is_unknown() -> None:
    facts = {"geography": "Central and Eastern Europe"}
    (result,) = evaluate_criteria(criteria_from_legacy_icp({"geography": ["Poland"]}), facts)
    assert result.matched is None


def test_operational_characteristics_are_never_decided_by_wording_alone() -> None:
    (result,) = evaluate_criteria(
        criteria_from_legacy_icp({"operational_complexity": "Multiple sites"}),
        {"operational_complexity": "Distributed branch network"},
    )
    assert result.matched is None


def test_missing_facts_are_unknown_unless_unknown_sizes_are_excluded() -> None:
    unknown = evaluate_criteria(criteria_from_legacy_icp({"company_size": "1,000+ employees"}), {})
    assert unknown[0].matched is None

    definitions = criteria_from_legacy_icp({"company_size": "1,000+ employees"})
    definitions[0] = definitions[0].model_copy(update={"include_unknown": False})
    excluded = evaluate_criteria(definitions, {})
    assert excluded[0].matched is False


def _score(criteria: list[IcpCriterion]) -> ScoringResult:
    return calculate_score(
        ScoringInput(
            company_id="company",
            profile_version_id="version",
            icp_criteria=criteria,
            signals=[SignalScoringInput(definition=SIGNAL)],
            calculated_at=datetime.now(UTC),
        )
    )


def test_unknown_criteria_are_reported_but_not_scored_as_a_miss() -> None:
    result = _score(
        [
            IcpCriterion(key="industry", matched=True),
            IcpCriterion(key="operational_complexity", matched=None, reason="not recorded"),
        ]
    )

    assert result.icp_fit == 1.0
    assert result.icp_configured is True


def test_a_profile_whose_criteria_can_never_be_compared_says_so() -> None:
    uncomparable = IcpCriterion(key="geography", matched=None, reason="no geography is recorded")
    result = _score([uncomparable])

    assert result.icp_fit == 0.0
    assert any("No ICP criterion could be compared" in warning for warning in result.warnings)


def test_a_plural_keyed_profile_now_reaches_icp_fit() -> None:
    # The regression this contract exists to prevent: the stored facts are keyed
    # "industry"/"geography", the older profile said "industries"/"geographies", and the
    # literal-equality comparison silently scored every company as zero ICP fit.
    profile_version = ProfileVersionRead(
        id="version",
        version=1,
        configuration=configuration({"industries": ["Logistics"], "geographies": ["Poland"]}),
        created_at=datetime.now(UTC),
    )

    criteria = evaluate_criteria(
        profile_version.configuration.effective_icp_criteria(),
        {"industry": {"value": "Logistics"}, "geography": {"value": "Poland"}},
    )

    assert _score(criteria).icp_fit == 1.0
