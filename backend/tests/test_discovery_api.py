from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.discovery import get_discovery_provider
from app.db import Base, get_session
from app.discovery import DiscoveryCandidate, DiscoveryRequest, SizeVerification
from app.main import app
from app.models.research import Company

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
