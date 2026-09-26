"""EU tenders is an opt-in market signal; disabled by default and never calls the portal."""

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from test_profiles_api import (  # noqa: F401
    profile_payload,
    setup_function,
    teardown_function,
)

from app.api import eu_tenders
from app.config import Settings, get_settings
from app.discovery import EuTendersError, TenderCall, TenderSearchResult
from app.main import app
from app.seed import load_presets

client = TestClient(app)


def enable(enabled: bool) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(eu_tenders_enabled=enabled)


class RecordingTenders:
    def __init__(self, error: EuTendersError | None = None) -> None:
        self.error = error
        self.queries: list[str] = []

    def search(self, query: str, *, limit: int = 10, include_forthcoming: bool = True):  # type: ignore[no-untyped-def]
        self.queries.append(query)
        if self.error is not None:
            raise self.error
        return TenderSearchResult(
            query=query,
            total=1,
            calls=[
                TenderCall(
                    identifier="DIGITAL-2026-A",
                    title="Automation of public services",
                    url="https://ec.europa.eu/info/funding-tenders/opportunities/x/1",
                    status="open",
                    summary="Call summary",
                )
            ],
            retrieved_at=datetime(2026, 9, 26, tzinfo=UTC),
        )


def test_status_reports_disabled_by_default() -> None:
    enable(False)
    response = client.get("/eu-tenders/status")
    assert response.status_code == 200
    assert response.json()["id"] == "eu_tenders"
    assert response.json()["enabled"] is False


def test_search_is_hidden_when_disabled() -> None:
    enable(False)
    tenders = RecordingTenders()
    app.dependency_overrides[eu_tenders.get_tenders] = lambda: tenders
    response = client.get("/eu-tenders/search", params={"profile_id": "missing"})
    assert response.status_code == 404
    assert tenders.queries == []


def test_search_uses_profile_terms_when_enabled() -> None:
    enable(True)
    profile = client.post("/service-profiles", json=profile_payload()).json()
    tenders = RecordingTenders()
    app.dependency_overrides[eu_tenders.get_tenders] = lambda: tenders

    response = client.get("/eu-tenders/search", params={"profile_id": profile["id"], "limit": 5})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["profile_name"] == "Process automation"
    assert body["total"] == 1
    assert body["calls"][0]["identifier"] == "DIGITAL-2026-A"
    assert body["warnings"]
    assert tenders.queries == [body["query"]]
    assert body["query"] == "automation"
    assert "services" not in body["query"]


def test_builtin_services_use_recall_safe_tender_queries() -> None:
    queries = {
        preset.name: eu_tenders.profile_query(preset.configuration)
        for preset in load_presets()
    }

    assert queries == {
        "RPA": "automation",
        "Cybersecurity": "cybersecurity",
        "Software development": "software",
    }


def test_search_reports_unknown_profile_and_upstream_failure_safely() -> None:
    enable(True)
    app.dependency_overrides[eu_tenders.get_tenders] = lambda: RecordingTenders()
    assert client.get("/eu-tenders/search", params={"profile_id": "nope"}).status_code == 404

    profile = client.post("/service-profiles", json=profile_payload()).json()
    failing = RecordingTenders(EuTendersError("HTTP 503 with upstream-token", retryable=True))
    app.dependency_overrides[eu_tenders.get_tenders] = lambda: failing
    response = client.get("/eu-tenders/search", params={"profile_id": profile["id"]})
    assert response.status_code == 502
    assert "upstream-token" not in response.text
