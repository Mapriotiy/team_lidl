from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_session
from app.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, expire_on_commit=False)


def override_session() -> Generator[Session, None, None]:
    with TestingSession() as session:
        yield session


def profile_payload(weight: float = 20) -> dict[str, object]:
    return {
        "name": "Process automation",
        "configuration": {
            "service_role": "RPA developers",
            "service_description": "Intelligent automation services.",
            "icp": {"geographies": ["Europe"]},
            "signals": [
                {
                    "id": "efficiency",
                    "question": "Is there an efficiency program?",
                    "positive_criteria": ["Named program"],
                    "exclusions": [],
                    "weight": weight,
                    "effect": "positive",
                    "freshness_window_days": 365,
                }
            ],
        },
    }


def setup_function() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_session] = override_session


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_create_list_and_version_profile() -> None:
    client = TestClient(app)
    created = client.post("/service-profiles", json=profile_payload())

    assert created.status_code == 201
    profile = created.json()
    assert profile["current_version"]["version"] == 1

    listed = client.get("/service-profiles")
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["Process automation"]

    update = profile_payload(weight=35)["configuration"]
    changed = client.patch(
        f"/service-profiles/{profile['id']}",
        json={"name": "Operational automation", "configuration": update},
    )

    assert changed.status_code == 200
    assert changed.json()["name"] == "Operational automation"
    assert changed.json()["current_version"]["configuration"]["service_role"] == "RPA developers"
    assert changed.json()["current_version"]["version"] == 2
    assert changed.json()["current_version"]["configuration"]["signals"][0]["weight"] == 35


def test_rejects_profile_without_positive_weight() -> None:
    response = TestClient(app).post("/service-profiles", json=profile_payload(weight=0))

    assert response.status_code == 422


def test_lists_rpa_as_the_default_profile() -> None:
    client = TestClient(app)
    cybersecurity = profile_payload()
    cybersecurity["name"] = "Cybersecurity"
    rpa = profile_payload()
    rpa["name"] = "RPA"
    client.post("/service-profiles", json=cybersecurity)
    client.post("/service-profiles", json=rpa)

    listed = client.get("/service-profiles")

    assert [item["name"] for item in listed.json()] == ["RPA", "Cybersecurity"]


def test_rejects_rename_to_an_existing_profile_name() -> None:
    client = TestClient(app)
    first = client.post("/service-profiles", json=profile_payload()).json()
    second_payload = profile_payload()
    second_payload["name"] = "Transformation advisory"
    client.post("/service-profiles", json=second_payload)

    response = client.patch(
        f"/service-profiles/{first['id']}",
        json={
            "name": "Transformation advisory",
            "configuration": profile_payload()["configuration"],
        },
    )

    assert response.status_code == 409
