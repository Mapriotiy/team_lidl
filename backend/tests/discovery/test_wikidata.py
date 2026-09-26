from collections.abc import Mapping

import pytest

from app.discovery import DiscoveryRequest, SizeVerification, WikidataDiscovery, WikidataError


class FakeTransport:
    def __init__(self, payload: object) -> None:
        self.payload = payload
        self.params: Mapping[str, str] = {}

    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        assert url == "https://qlever.dev/api/wikidata"
        assert headers["Accept"] == "application/sparql-results+json"
        assert 0 < timeout <= 30
        self.params = params
        return self.payload


class FakeLabels:
    def resolve(self, entity_ids: set[str], *, timeout: float) -> dict[str, str]:
        assert 0 < timeout <= 30
        return {
            "Q1": "Verified SA",
            "Q2": "Second SA",
            "Q36": "Poland",
            "Q177": "logistics",
        }


def binding(
    *, entity_id: str, website: str, employees: str, statements: str = "12"
) -> dict[str, dict[str, str]]:
    return {
        "company": {"value": f"https://www.wikidata.org/entity/{entity_id}"},
        "website": {"value": website},
        "country": {"value": "https://www.wikidata.org/entity/Q36"},
        "countryCode": {"value": "PL"},
        "industry": {"value": "https://www.wikidata.org/entity/Q177"},
        "employees": {"value": employees},
        "statements": {"value": statements},
    }


def test_discovers_sourced_companies_with_size_left_unverified() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [
                    binding(entity_id="Q1", website="https://verified.example", employees="2500"),
                    binding(entity_id="Q2", website="https://second.example", employees="1500"),
                ]
            }
        }
    )

    candidates = WikidataDiscovery(transport, FakeLabels()).discover(DiscoveryRequest())

    assert [candidate.name for candidate in candidates] == ["Verified SA", "Second SA"]
    assert candidates[0].country_name == "Poland"
    assert candidates[0].industry == "logistics"
    assert candidates[0].employee_count == 2500
    assert candidates[0].size_verification == SizeVerification.NEEDS_VERIFICATION
    assert candidates[0].discovery_confidence == 0.55
    query = transport.params["query"]
    assert 'VALUES ?countryCode { "PL" "CZ"' in query
    assert "wdt:P31/wdt:P279* wd:Q783794" in query
    assert "FILTER NOT EXISTS" in query
    assert "FILTER(?statements >= 8)" in query


def test_filters_companies_with_too_little_public_footprint() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [
                    binding(
                        entity_id="Q1",
                        website="https://obscure.example",
                        employees="2500",
                        statements="7",
                    ),
                    binding(
                        entity_id="Q2",
                        website="https://researchable.example",
                        employees="2500",
                        statements="8",
                    ),
                ]
            }
        }
    )

    candidates = WikidataDiscovery(transport, FakeLabels()).discover(DiscoveryRequest())

    assert [candidate.domain for candidate in candidates] == ["researchable.example"]


def test_treats_implausible_employee_totals_as_unknown_size() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [
                    binding(entity_id="Q1", website="https://inflated.example", employees="665637"),
                    binding(entity_id="Q2", website="https://real.example", employees="2500"),
                ]
            }
        }
    )

    candidates = WikidataDiscovery(transport, FakeLabels()).discover(DiscoveryRequest())

    assert [candidate.domain for candidate in candidates] == ["inflated.example", "real.example"]
    inflated, real = candidates
    assert inflated.employee_count is None
    assert inflated.size_verification == SizeVerification.NEEDS_VERIFICATION
    assert inflated.discovery_confidence == 0.55
    assert real.employee_count == 2500


def test_drops_unknown_size_candidates_when_not_requested() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [
                    binding(entity_id="Q1", website="https://inflated.example", employees="665637"),
                ]
            }
        }
    )

    candidates = WikidataDiscovery(transport, FakeLabels()).discover(
        DiscoveryRequest(include_unknown_size=False)
    )

    assert candidates == []


def test_deduplicates_multiple_domains_for_one_company() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [
                    binding(entity_id="Q1", website="https://first.example", employees="2500"),
                    binding(entity_id="Q1", website="https://second.example", employees="2500"),
                ]
            }
        }
    )

    candidates = WikidataDiscovery(transport, FakeLabels()).discover(DiscoveryRequest())

    assert [candidate.domain for candidate in candidates] == ["first.example"]


def test_rejects_invalid_country_codes() -> None:
    with pytest.raises(ValueError, match="two-letter"):
        DiscoveryRequest(country_codes=["Eastern Europe"])


def test_unrestricted_geography_keeps_missing_employee_counts() -> None:
    company = binding(entity_id="Q1", website="https://unknown.example", employees="0")
    del company["employees"]
    transport = FakeTransport({"results": {"bindings": [company]}})
    candidates = WikidataDiscovery(transport, FakeLabels()).discover(
        DiscoveryRequest(country_codes=[], include_unknown_size=True)
    )
    assert len(candidates) == 1
    assert candidates[0].employee_count is None
    assert "VALUES ?countryCode" not in transport.params["query"]
    assert "OPTIONAL { ?company wdt:P1128 ?employees. }" in transport.params["query"]
    assert "!BOUND(?employees)" in transport.params["query"]


def test_rejects_invalid_provider_response() -> None:
    with pytest.raises(WikidataError, match="no bindings"):
        WikidataDiscovery(FakeTransport({"results": {}}), FakeLabels()).discover(DiscoveryRequest())


def test_profile_industries_rank_matches_without_hiding_other_candidates() -> None:
    known = binding(entity_id="Q1", website="https://known.example", employees="2500")
    unknown = binding(entity_id="Q2", website="https://unknown.example", employees="2500")
    del unknown["industry"]
    transport = FakeTransport({"results": {"bindings": [known, unknown]}})
    provider = WikidataDiscovery(transport, FakeLabels())
    candidates = provider.discover(DiscoveryRequest(industries=["Logistics", "Manufacturing"]))
    assert [item.domain for item in candidates] == ["known.example", "unknown.example"]

    candidates = provider.discover(DiscoveryRequest(industries=["Software"]))
    assert [item.domain for item in candidates] == ["known.example", "unknown.example"]
