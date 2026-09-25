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
        assert url == "https://query.wikidata.org/sparql"
        assert headers["Accept"] == "application/sparql-results+json"
        assert timeout == 20
        self.params = params
        return self.payload


def binding(
    *, name: str, website: str, employees: str | None, industry: str = "logistics"
) -> dict[str, dict[str, str]]:
    result = {
        "company": {"value": f"https://www.wikidata.org/entity/Q-{name}"},
        "companyLabel": {"value": name},
        "website": {"value": website},
        "countryCode": {"value": "PL"},
        "countryLabel": {"value": "Poland"},
        "industryLabel": {"value": industry},
    }
    if employees is not None:
        result["employees"] = {"value": employees}
    return result


def test_discovers_verified_and_unknown_size_companies() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [
                    binding(
                        name="Verified SA",
                        website="https://www.verified.example/",
                        employees="2500",
                    ),
                    binding(name="Unknown SA", website="https://unknown.example", employees=None),
                ]
            }
        }
    )

    candidates = WikidataDiscovery(transport).discover(DiscoveryRequest())

    assert [candidate.domain for candidate in candidates] == [
        "verified.example",
        "unknown.example",
    ]
    assert candidates[0].size_verification == SizeVerification.VERIFIED
    assert candidates[0].discovery_confidence == 0.9
    assert candidates[1].size_verification == SizeVerification.NEEDS_VERIFICATION
    assert candidates[1].discovery_confidence == 0.55
    assert 'VALUES ?countryCode { "PL" "CZ"' in transport.params["query"]


def test_filters_unknown_size_when_disabled() -> None:
    transport = FakeTransport(
        {
            "results": {
                "bindings": [binding(name="Unknown", website="https://x.example", employees=None)]
            }
        }
    )

    candidates = WikidataDiscovery(transport).discover(DiscoveryRequest(include_unknown_size=False))

    assert candidates == []


def test_rejects_invalid_country_codes() -> None:
    with pytest.raises(ValueError, match="two-letter"):
        DiscoveryRequest(country_codes=["Eastern Europe"])


def test_rejects_invalid_provider_response() -> None:
    with pytest.raises(WikidataError, match="no bindings"):
        WikidataDiscovery(FakeTransport({"results": {}})).discover(DiscoveryRequest())
