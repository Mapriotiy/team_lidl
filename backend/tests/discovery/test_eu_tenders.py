import json
from collections.abc import Mapping

import pytest

from app.discovery import EuTendersDiscovery, EuTendersError


def portal_item(identifier: str, *, status: str = "31094502", url: str | None = None) -> dict:
    return {
        "title": "",
        "url": url or f"https://ec.europa.eu/info/funding-tenders/opportunities/x/{identifier}#top",
        "metadata": {
            "identifier": [identifier],
            "callTitle": ["Support &amp; automation of  public services"],
            "status": [status],
            "startDate": ["2026-09-10T00:00:00.000+0000"],
            "deadlineDate": ["2026-11-13T17:00:00.000+0000"],
            "frameworkProgramme": ["DIGITAL"],
            "description": ["<p>WHO CAN&nbsp;APPLY?</p><ul><li>SMEs</li></ul>" + "x" * 900],
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
    result = EuTendersDiscovery(transport).search("cybersecurity", limit=10)

    assert transport.url.startswith("https://api.tech.ec.europa.eu/search-api/prod/rest/search?")
    assert "apiKey=SEDIA" in transport.url and "text=cybersecurity" in transport.url
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
    assert first.deadline is not None and first.deadline.isoformat().startswith("2026-11-13T17:00")
    assert first.summary.startswith("WHO CAN APPLY? SMEs")
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
    def post_multipart(self, url: str, **kwargs: object) -> object:  # type: ignore[override]
        if self.calls == 0:
            self.calls += 1
            raise EuTendersError("EU tenders portal returned HTTP 500", retryable=True)
        return super().post_multipart(url, **kwargs)  # type: ignore[arg-type]


def test_retries_once_on_retryable_error() -> None:
    transport = FlakyTransport()
    result = EuTendersDiscovery(transport).search("automation")
    assert transport.calls == 2
    assert len(result.calls) == 2


class InvalidTransport(FakeTransport):
    def post_multipart(self, url: str, **kwargs: object) -> object:  # type: ignore[override]
        return {"unexpected": True}


def test_invalid_payload_is_reported() -> None:
    with pytest.raises(EuTendersError):
        EuTendersDiscovery(InvalidTransport()).search("automation")
