from fastapi.testclient import TestClient
from test_profiles_api import profile_payload, setup_function, teardown_function  # noqa: F401

from app.main import app


def test_import_submit_and_read() -> None:
    client = TestClient(app)
    response = client.post(
        "/companies/import",
        json={
            "domains": [
                "https://www.example.com/about",
                "EXAMPLE.COM",
                "localhost",
                "https://@example.com",
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert [c["created"] for c in body["accepted"]] == [True, False]
    assert len(body["rejected"]) == 2
    company_id = body["accepted"][0]["company"]["id"]
    listed = client.get("/companies")
    assert listed.status_code == 200
    assert [company["id"] for company in listed.json()] == [company_id]
    profile = client.post("/service-profiles", json=profile_payload()).json()
    payload = {
        "company_id": company_id,
        "profile_version_id": profile["current_version"]["id"],
        "idempotency_key": "example-research",
    }
    submitted = client.post("/research-runs", json=payload)
    assert submitted.status_code == 202
    assert submitted.json()["status"] == "queued"
    repeated = client.post("/research-runs", json=payload)
    assert repeated.json()["id"] == submitted.json()["id"]
    assert client.get("/research-runs/" + submitted.json()["id"]).json()["status"] == "queued"
    other = client.post("/companies/import", json={"domains": ["other.com"]}).json()
    payload["company_id"] = other["accepted"][0]["company"]["id"]
    assert client.post("/research-runs", json=payload).status_code == 409
    missing = client.get("/research-runs/missing")
    assert missing.status_code == 404
    assert missing.json()["detail"]["request_id"]
