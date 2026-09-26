"""Fixture-only crawl diagnostics, including failed providers and safe persisted logs."""

import json
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from test_profiles_api import (  # noqa: F401
    TestingSession,
    profile_payload,
    setup_function,
    teardown_function,
)

from app.collection import CanonicalCompany, PublicSourceCollector, SourceTarget
from app.collection.models import CollectionFailure
from app.collection.observability import safe_target
from app.collection.transport import FetchResponse
from app.config import Settings, get_settings
from app.contracts.research import ResearchProgress
from app.discovery import GdeltError, GdeltNewsDiscovery, NewsApiDiscovery, NewsCandidate
from app.jobs import service
from app.main import app
from app.models.profile import utc_now
from app.models.research import Company, ResearchRun
from app.research.pipeline import IntegratedResearchPipeline


class BrokenGdelt(GdeltNewsDiscovery):
    def discover_queries(
        self, queries: list[str], *, limit_per_query: int = 5, max_results: int = 18
    ) -> list[NewsCandidate]:
        raise GdeltError("secret-provider-token in an arbitrary upstream error")


class WorkingNewsApi(NewsApiDiscovery):
    def __init__(self) -> None:
        super().__init__("secret-provider-token")

    def discover_queries(
        self, queries: list[str], *, limit_per_query: int = 5, max_results: int = 18
    ) -> list[NewsCandidate]:
        return []


class PageTransport:
    def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse:
        if "www." in url:
            raise TimeoutError("secret-provider-token")
        return FetchResponse(
            200,
            {"content-type": "text/html"},
            b"<html><body><p>Public company strategy announcement.</p></body></html>",
        )


def make_run(client: TestClient) -> tuple[str, str]:
    company_id = client.post("/companies/import", json={"domains": ["example.com"]}).json()[
        "accepted"
    ][0]["company"]["id"]
    profile = client.post("/service-profiles", json=profile_payload()).json()
    run = client.post(
        "/research-runs",
        json={
            "company_id": company_id,
            "profile_version_id": profile["current_version"]["id"],
            "idempotency_key": "test-diagnostics",
        },
    ).json()
    return company_id, run["id"]


@pytest.mark.parametrize("newsapi_enabled", [False, True])
def test_pipeline_logs_actual_outcomes_through_fenced_checkpoint(newsapi_enabled: bool) -> None:
    client = TestClient(app)
    company_id, run_id = make_run(client)
    with TestingSession.begin() as session:
        run = session.get_one(ResearchRun, run_id)
        run.status = "running"
        run.lease_token = "test-lease"
        run.lease_expires_at = utc_now() + timedelta(minutes=5)
        company = session.get_one(Company, company_id)
        session.expunge(company)
    pipeline = IntegratedResearchPipeline(
        TestingSession,
        None,  # type: ignore[arg-type]  # Assessment must never be called in this test.
        news=BrokenGdelt(),
        newsapi=WorkingNewsApi() if newsapi_enabled else None,
        collector=PublicSourceCollector(PageTransport(), concurrency=2),
    )
    result = pipeline.collect(run_id, company)
    assert result.completed == 1
    # Collection telemetry only becomes visible after the existing fenced checkpoint.
    assert client.get("/data-sources").json()["crawl_log"] == []
    with TestingSession.begin() as session:
        service.checkpoint(
            session,
            run_id,
            "test-lease",
            ResearchProgress(stage="collection", completed=result.completed, total=result.total),
            result.data,
            result.errors,
        )
    with TestingSession.begin() as session:
        service.checkpoint(
            session,
            run_id,
            "test-lease",
            ResearchProgress(stage="assessment", completed=1, total=1),
            {"score": 25},
            [],
        )
    with TestingSession.begin() as session:
        with pytest.raises(service.LeaseLost):
            service.checkpoint(
                session,
                run_id,
                "stale-lease",
                ResearchProgress(stage="collection", completed=0, total=0),
                {"documents": [], "crawl_log": []},
                [],
            )
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        openrouter_api_key="secret-provider-token",
        assessment_model="test/model",
        newsapi_key="secret-provider-token" if newsapi_enabled else None,
    )
    response = client.get("/data-sources")
    assert response.status_code == 200
    body = response.json()
    assert "secret-provider-token" not in response.text
    logs = list(reversed(body["crawl_log"]))
    assert [(row["provider"], row["status"]) for row in logs[:2]] == [
        ("gdelt", "error"),
        ("newsapi", "ok" if newsapi_enabled else "skipped"),
    ]
    assert logs[0]["at"] <= logs[1]["at"]
    assert logs[1]["documents"] is None
    assert {row["status"] for row in logs if row["provider"] == "websites"} == {"ok", "error"}
    assert {row["company_id"] for row in logs} == {company_id}
    assert body["runtime"]["assessment_configured"] is True
    assert body["runtime"]["newsapi_configured"] == newsapi_enabled
    assert body["runtime"]["assessment_model"] == "test/model"
    assert body["sources"][0]["failed"] == 1
    assert body["sources"][1]["attempts"] == int(newsapi_enabled)
    assert len(client.get("/data-sources?limit=1").json()["crawl_log"]) == 1
    assert client.get("/data-sources?limit=0").status_code == 422
    assert client.get("/data-sources?limit=251").status_code == 422
    assert client.delete(f"/companies/{company_id}/research").status_code == 200
    assert client.get("/data-sources").json()["crawl_log"] == []


@pytest.mark.parametrize("concurrency", [1, 2])
def test_redirects_failure_and_limit_are_real_safe_events(concurrency: int) -> None:
    requested: list[str] = []

    class RedirectTransport:
        def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse:
            requested.append(url)
            if "/start" in url:
                return FetchResponse(302, {"location": "/end?token=hidden-key#private"}, b"")
            if "/end" in url:
                return FetchResponse(
                    200, {"content-type": "text/html"}, b"<p>Useful public text</p>"
                )
            raise CollectionFailure("fetch_error", "secret-provider-token")

    result = PublicSourceCollector(
        RedirectTransport(),
        max_pages=2,
        concurrency=concurrency,
    ).collect(
        CanonicalCompany("company", "example.com"),
        [
            SourceTarget("https://example.com/start?api_key=hidden-key"),
            SourceTarget("https://example.com/fail?password=hidden-key"),
            SourceTarget("https://example.com/limit?token=hidden-key"),
        ],
    )
    assert len(requested) == 3  # Redirect + destination + failed page, never the limited page.
    assert len(result.documents) == 1
    assert [a.status for a in result.attempts].count("ok") == 2
    assert [a.status for a in result.attempts].count("error") == 1
    assert [a.status for a in result.attempts].count("skipped") == 1
    assert any("redirected to https://example.com/end" in a.detail for a in result.attempts)
    serialized = json.dumps([{"url": a.target, "detail": a.detail} for a in result.attempts])
    assert "hidden-key" not in serialized
    assert "secret-provider-token" not in serialized
    assert safe_target("https://username:password@example.com/a?key=secret#token") == (
        "https://example.com/a"
    )


def test_existing_research_without_telemetry_has_no_fabricated_logs() -> None:
    client = TestClient(app)
    _, run_id = make_run(client)
    with TestingSession.begin() as session:
        run = session.get_one(ResearchRun, run_id)
        run.stage_results = {"collection": {"documents": [{"normalized_text": "PRIVATE_TEXT"}]}}
    response = client.get("/data-sources")
    assert response.status_code == 200
    assert response.json()["crawl_log"] == []
    assert "PRIVATE_TEXT" not in response.text
    assert all(source["attempts"] == 0 for source in response.json()["sources"])
