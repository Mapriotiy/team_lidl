from collections.abc import Generator
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.discovery import get_discovery_provider
from app.db import Base, get_session
from app.discovery import DiscoveryCandidate, DiscoveryRequest, SizeVerification
from app.discovery.catalog import store_candidates
from app.main import app
from app.models.research import Company
from app.models.results import DiscoveryRun

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, expire_on_commit=False)


class FakeDiscovery:
    def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
        assert request.minimum_employees == 1000
        return [
            DiscoveryCandidate(
                entity_id="Q1",
                name="Example Logistics",
                domain="example.com",
                country_code="PL",
                country_name="Poland",
                industry="logistics",
                employee_count=None,
                size_verification=SizeVerification.NEEDS_VERIFICATION,
                discovery_confidence=0.55,
                source_url="https://www.wikidata.org/entity/Q1",
            )
        ]


def override_session() -> Generator[Session, None, None]:
    with TestingSession() as session:
        yield session


def setup_function() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_discovery_provider] = FakeDiscovery


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_discovery_requires_confirmation_before_import() -> None:
    client = TestClient(app)
    discovered = client.post("/discovery-runs", json={})

    assert discovered.status_code == 201
    run = discovered.json()
    assert run["candidates"][0]["size_verification"] == "needs_verification"

    with TestingSession() as session:
        assert session.query(Company).count() == 0

    confirmed = client.post(
        f"/discovery-runs/{run['id']}/confirm", json={"domains": ["example.com"]}
    )
    assert confirmed.status_code == 200
    assert len(confirmed.json()["company_ids"]) == 1


def test_rejects_domain_not_returned_by_discovery() -> None:
    client = TestClient(app)
    run = client.post("/discovery-runs", json={}).json()

    response = client.post(
        f"/discovery-runs/{run['id']}/confirm", json={"domains": ["other.example"]}
    )

    assert response.status_code == 422


def test_repeated_search_reuses_recent_run_without_provider_call() -> None:
    class CountingDiscovery(FakeDiscovery):
        calls = 0

        def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
            self.calls += 1
            return super().discover(request)

    provider = CountingDiscovery()
    app.dependency_overrides[get_discovery_provider] = lambda: provider
    client = TestClient(app)
    first = client.post("/discovery-runs", json={}).json()
    second = client.post("/discovery-runs", json={}).json()
    assert first["id"] == second["id"]
    assert datetime.fromisoformat(first["created_at"]) == datetime.fromisoformat(
        second["created_at"]
    )
    assert provider.calls == 1


def test_preloaded_catalog_avoids_external_provider() -> None:
    class Offline:
        def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
            raise AssertionError("external discovery should not be called")

    request = DiscoveryRequest(limit=1)
    with TestingSession.begin() as session:
        store_candidates(session, FakeDiscovery().discover(request))
    app.dependency_overrides[get_discovery_provider] = Offline

    response = TestClient(app).post("/discovery-runs", json={"limit": 1})

    assert response.status_code == 201
    assert response.json()["candidates"][0]["domain"] == "example.com"


def test_expired_cache_fallback_preserves_original_timestamp() -> None:
    from datetime import timedelta

    from app.discovery import WikidataError
    from app.models.profile import utc_now

    request = DiscoveryRequest()
    recorded = utc_now() - timedelta(hours=1)
    with TestingSession.begin() as session:
        session.add(
            DiscoveryRun(
                id="old-run",
                status="researchable_v1",
                created_at=recorded,
                request=request.model_dump(mode="json"),
                candidates=[FakeDiscovery().discover(request)[0].model_dump(mode="json")],
            )
        )

    class Offline:
        def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
            raise WikidataError("unavailable")

    app.dependency_overrides[get_discovery_provider] = Offline
    response = TestClient(app).post("/discovery-runs", json={})
    assert response.status_code == 201
    assert response.json()["id"] == "old-run"
    assert response.json()["created_at"].startswith(recorded.strftime("%Y-%m-%dT%H:%M:%S"))


def test_retries_a_transient_discovery_failure() -> None:
    class FlakyDiscovery(FakeDiscovery):
        calls = 0

        def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
            self.calls += 1
            if self.calls == 1:
                from app.discovery import WikidataError

                raise WikidataError("temporary provider failure")
            return super().discover(request)

    flaky = FlakyDiscovery()
    app.dependency_overrides[get_discovery_provider] = lambda: flaky

    response = TestClient(app).post("/discovery-runs", json={})

    assert response.status_code == 201
    assert flaky.calls == 2


def test_uses_matching_cached_results_when_provider_is_unavailable() -> None:
    request = DiscoveryRequest()
    candidate = FakeDiscovery().discover(request)[0]
    with TestingSession.begin() as session:
        session.add(
            DiscoveryRun(
                status="researchable_v1",
                request=request.model_dump(mode="json"),
                candidates=[candidate.model_dump(mode="json")],
            )
        )

    class OfflineDiscovery:
        def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
            from app.discovery import WikidataError

            raise WikidataError("provider unavailable")

    app.dependency_overrides[get_discovery_provider] = OfflineDiscovery

    response = TestClient(app).post("/discovery-runs", json={})

    assert response.status_code == 201
    assert response.json()["candidates"][0]["domain"] == "example.com"
