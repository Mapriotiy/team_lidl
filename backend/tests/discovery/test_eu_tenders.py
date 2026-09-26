import json
from collections.abc import Mapping

import pytest

from app.discovery import EuTendersDiscovery, EuTendersError


def portal_item(
    identifier: str,
    *,
    status: str = "31094502",
    url: str | None = None,
    deadline: str = "2027-11-13T17:00:00.000+0000",
    description: str | None = None,
    programme: str = "DIGITAL",
) -> dict[str, object]:
    return {
        "title": "",
        "url": url or f"https://ec.europa.eu/info/funding-tenders/opportunities/x/{identifier}#top",
        "metadata": {
            "identifier": [identifier],
            "callTitle": ["Support &amp; automation of  public services"],
            "status": [status],
            "startDate": ["2026-09-10T00:00:00.000+0000"],
            "deadlineDate": [deadline],
            "frameworkProgramme": [programme],
            "description": [
                description
                or "<p>WHO CAN&nbsp;APPLY?</p><ul><li>Automation SMEs</li></ul>" + "x" * 900
            ],
        },
    }


class FakeTransport:
    def __init__(self) -> None:
        self.url = ""
        self.fields: Mapping[str, tuple[str, bool]] = {}
        self.calls = 0

    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        self.calls += 1
        self.url = url
        self.fields = fields
        return {
            "totalResults": 3,
            "results": [
                portal_item("DIGITAL-2026-A"),
                portal_item("DIGITAL-2026-A"),
                portal_item("DIGITAL-2026-B", status="31094501"),
                portal_item("EVIL", url="https://attacker.example/phish"),
            ],
        }


def test_search_builds_portal_filters_and_sanitizes_results() -> None:
    transport = FakeTransport()
    result = EuTendersDiscovery(transport).search("automation", limit=10)

    assert transport.url.startswith("https://api.tech.ec.europa.eu/search-api/prod/rest/search?")
    assert "apiKey=SEDIA" in transport.url and "text=automation" in transport.url
    assert "sortBy=startDate" in transport.url and "order=DESC" in transport.url
    body, as_file = transport.fields["query"]
    assert as_file
    must = json.loads(body)["bool"]["must"]
    assert {"terms": {"type": ["8"]}} in must
    assert {"terms": {"status": ["31094502", "31094501"]}} in must

    assert result.total == 3
    assert [call.identifier for call in result.calls] == ["DIGITAL-2026-A", "DIGITAL-2026-B"]
    first, second = result.calls
    assert first.title == "Support & automation of public services"
    assert first.url == "https://ec.europa.eu/info/funding-tenders/opportunities/x/DIGITAL-2026-A"
    assert first.status == "open" and second.status == "forthcoming"
    assert first.opportunity_type == "funding_call"
    assert first.deadline is not None and first.deadline.isoformat().startswith("2027-11-13T17:00")
    assert first.summary.startswith("WHO CAN APPLY? Automation SMEs")
    assert "<" not in first.summary and len(first.summary) <= 600


def test_open_only_filter_and_validation() -> None:
    transport = FakeTransport()
    EuTendersDiscovery(transport).search("automation", include_forthcoming=False)
    must = json.loads(transport.fields["query"][0])["bool"]["must"]
    assert {"terms": {"status": ["31094502"]}} in must

    with pytest.raises(ValueError):
        EuTendersDiscovery(transport).search("   ")
    with pytest.raises(ValueError):
        EuTendersDiscovery(transport).search("automation", limit=51)


class FlakyTransport(FakeTransport):
    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        if self.calls == 0:
            self.calls += 1
            raise EuTendersError("EU tenders portal returned HTTP 500", retryable=True)
        return super().post_multipart(url, fields=fields, headers=headers, timeout=timeout)


def test_retries_once_on_retryable_error() -> None:
    transport = FlakyTransport()
    result = EuTendersDiscovery(transport).search("automation")
    assert transport.calls == 2
    assert len(result.calls) == 2


class InvalidTransport(FakeTransport):
    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        return {"unexpected": True}


def test_invalid_payload_is_reported() -> None:
    with pytest.raises(EuTendersError):
        EuTendersDiscovery(InvalidTransport()).search("automation")


class NoisyTransport(FakeTransport):
    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        return {
            "totalResults": 4,
            "results": [
                portal_item("RELEVANT", description="Robotic process automation services"),
                portal_item("IRRELEVANT", description="Marine biology research"),
                portal_item(
                    "EXPIRED",
                    deadline="2020-01-01T00:00:00.000+0000",
                    description="Robotic process automation services",
                ),
                portal_item(
                    "NUMERIC-PROGRAMME",
                    description="Robotic process automation platform",
                    programme="43108390",
                ),
            ],
        }


def test_filters_irrelevant_and_expired_results_and_hides_programme_ids() -> None:
    result = EuTendersDiscovery(NoisyTransport()).search('"robotic process automation"')

    assert [call.identifier for call in result.calls] == ["RELEVANT", "NUMERIC-PROGRAMME"]
    assert result.calls[1].programme is None


class CompetitiveCallTransport(FakeTransport):
    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        item = portal_item(
            "CASCADE",
            url=(
                "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/"
                "opportunities/competitive-calls-cs/48401785"
            ),
            description="Software automation and security",
        )
        metadata = item["metadata"]
        assert isinstance(metadata, dict)
        metadata["furtherInformation"] = [
            '<p>Read the call at <a href="https://nlnet.nl/codesupply#apply">CodeSupply</a></p>'
        ]
        return {"totalResults": 1, "results": [item]}


def test_competitive_call_uses_official_external_page_instead_of_broken_spa_route() -> None:
    result = EuTendersDiscovery(CompetitiveCallTransport()).search("automation")

    assert result.calls[0].url == "https://nlnet.nl/codesupply"
    assert result.calls[0].opportunity_type == "cascade_funding"


class PerQueryTransport(FakeTransport):
    """Each query sees its own result set; cascade calls share one parent topic id."""

    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        self.calls += 1
        shared = "HORIZON-CASCADE"
        if "text=cyber&" in url:
            items = [
                portal_item(shared, url="https://ec.europa.eu/x/cascade-1"),
                portal_item("OTHER", url="https://ec.europa.eu/x/unrelated"),
            ]
        else:
            items = [
                portal_item(shared, url="https://ec.europa.eu/x/cascade-1"),
                portal_item(shared, url="https://ec.europa.eu/x/cascade-2"),
            ]
        for item in items:
            metadata = item["metadata"]
            assert isinstance(metadata, dict)
            if str(item["url"]).endswith("unrelated"):
                metadata["callTitle"] = ["Forest restoration grants"]
                metadata["description"] = ["Trees"]
            else:
                metadata["callTitle"] = ["Cyber resilience open call"]
        return {"totalResults": len(items), "results": items}


def test_search_many_merges_queries_and_keeps_cascade_calls() -> None:
    transport = PerQueryTransport()
    result = EuTendersDiscovery(transport).search_many(
        ["cyber", "security"], relevance_terms=["cyber", "resilien"], limit=10
    )

    assert transport.calls == 2
    assert result.query == "cyber | security"
    assert result.total == 4
    assert [call.url for call in result.calls] == [
        "https://ec.europa.eu/x/cascade-1",
        "https://ec.europa.eu/x/cascade-2",
    ]


def test_search_many_rejects_blank_queries() -> None:
    with pytest.raises(ValueError):
        EuTendersDiscovery(FakeTransport()).search_many(["  ", ""])
