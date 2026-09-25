from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from test_profiles_api import TestingSession, setup_function, teardown_function  # noqa: F401

from app.api.results import get_translation_provider
from app.assessment.providers.openrouter import OpenRouterError
from app.main import app
from app.models.profile import ServiceProfile, ServiceProfileVersion
from app.models.research import Company, ResearchRun
from app.models.results import (
    Opportunity,
    StoredEvidence,
    StoredScoreSnapshot,
    StoredSignalAssessment,
    StoredSourceDocument,
)
from app.translation.openrouter import TranslationBatch


class FakeTranslationProvider:
    model = "translation-test-model"

    def __init__(self, *, fails: bool = False) -> None:
        self.calls = 0
        self.fails = fails

    def translate(self, excerpt: str, target_language: str) -> TranslationBatch:
        self.calls += 1
        if self.fails:
            raise OpenRouterError("provider unavailable")
        return TranslationBatch(
            translated_excerpt=f"{target_language}: {excerpt}",
            model=self.model,
            prompt_tokens=5,
            completion_tokens=3,
            total_tokens=8,
            cost_usd=0.001,
        )


def seed_result(company_name: str = "Example Logistics") -> tuple[str, str]:
    now = datetime.now(UTC)
    with TestingSession.begin() as session:
        company = Company(
            canonical_domain="example.com",
            display_name=company_name,
            aliases=[],
            facts={"industry": {"value": "Logistics", "source_ids": ["source-1"]}},
        )
        profile = ServiceProfile(name="Process automation")
        version = ServiceProfileVersion(
            version=1,
            configuration={
                "service_description": "Automation",
                "icp": {},
                "signals": [],
            },
        )
        profile.versions.append(version)
        session.add_all([company, profile])
        session.flush()
        run = ResearchRun(
            company_id=company.id,
            profile_version_id=version.id,
            idempotency_key="result-test",
            status="completed",
            progress=[
                {"stage": "collection", "completed": 2, "total": 4},
                {"stage": "assessment", "completed": 1, "total": 1},
            ],
            partial_errors=[],
            usage={"cost_usd": 0.01},
            finished_at=now,
        )
        session.add(run)
        session.flush()
        source = StoredSourceDocument(
            id="source-1",
            company_id=company.id,
            research_run_id=run.id,
            canonical_url="https://example.com/news",
            source_type="company",
            title="Efficiency program",
            retrieved_at=now,
            publication_date=now - timedelta(days=3),
            event_date=None,
            content_hash="hash-1",
            normalized_text="The company announced an efficiency program.",
            text_expires_at=now + timedelta(days=30),
        )
        session.add(source)
        evidence = StoredEvidence(
            source_id="source-1",
            excerpt="efficiency program",
            start_offset=25,
            end_offset=43,
            factual_claim="The company announced an efficiency program.",
            event_group_key="efficiency-2026",
        )
        session.add(evidence)
        session.flush()
        assessment = StoredSignalAssessment(
            research_run_id=run.id,
            company_id=company.id,
            profile_version_id=version.id,
            signal_id="efficiency",
            status="supported",
            evidence_strength="strong",
            evidence_ids=[evidence.id],
            rationale="Named current program.",
            model_version="test-model",
            prompt_version="v1",
        )
        snapshot = StoredScoreSnapshot(
            research_run_id=run.id,
            company_id=company.id,
            profile_version_id=version.id,
            calculation_version="v1",
            score=82,
            eligibility="eligible",
            coverage=0.75,
            icp_fit=1,
            positive_strength=0.8,
            penalty_points=4,
            contributions=[
                {
                    "signal_id": "efficiency",
                    "effect": "positive",
                    "weighted_value": 16,
                }
            ],
            exclusion_reasons=[],
            warnings=[],
        )
        session.add_all([assessment, snapshot])
        session.flush()
        opportunity = Opportunity(
            company_id=company.id,
            profile_id=profile.id,
            latest_snapshot_id=snapshot.id,
        )
        session.add(opportunity)
        session.flush()
        return company.id, opportunity.id


def test_lists_filters_and_updates_persisted_opportunities() -> None:
    company_id, opportunity_id = seed_result()
    client = TestClient(app)
    response = client.get("/opportunities", params={"search": "logistics"})
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 1
    assert body["items"][0]["company_id"] == company_id
    assert body["items"][0]["collection_completion"] == 0.5
    assert body["items"][0]["strongest_signal"] == "efficiency"

    changed = client.patch(
        f"/opportunities/{opportunity_id}",
        json={"status": "shortlisted", "note": "Review with sales."},
    )
    assert changed.status_code == 200
    assert changed.json()["status"] == "shortlisted"
    assert changed.json()["note"] == "Review with sales."


def test_company_detail_exposes_excerpt_but_not_private_source_text() -> None:
    company_id, _ = seed_result()
    response = TestClient(app).get(f"/companies/{company_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["assessments"][0]["evidence"][0]["excerpt"] == "efficiency program"
    assert "normalized_text" not in str(body)
    assert body["scores"][0]["score"] == 82


def test_csv_neutralizes_formula_prefixes() -> None:
    seed_result(company_name="=HYPERLINK('bad')")
    response = TestClient(app).get("/exports/opportunities.csv")
    assert response.status_code == 200
    assert "'=HYPERLINK" in response.text
    assert "normalized_text" not in response.text


def test_translation_is_cached_without_changing_original_evidence() -> None:
    company_id, _ = seed_result()
    with TestingSession() as session:
        evidence = session.query(StoredEvidence).one()
        evidence_id = evidence.id
        original_excerpt = evidence.excerpt
    provider = FakeTranslationProvider()
    app.dependency_overrides[get_translation_provider] = lambda: provider
    try:
        client = TestClient(app)
        first = client.post(
            f"/evidence/{evidence_id}/translations", json={"target_language": "ro"}
        )
        second = client.post(
            f"/evidence/{evidence_id}/translations", json={"target_language": "ro"}
        )
        detail = client.get(f"/companies/{company_id}")
    finally:
        app.dependency_overrides.pop(get_translation_provider, None)
    assert first.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert provider.calls == 1
    assert detail.json()["assessments"][0]["evidence"][0]["translations"][0][
        "translated_excerpt"
    ] == "ro: efficiency program"
    with TestingSession() as session:
        stored = session.get(StoredEvidence, evidence_id)
        assert stored is not None and stored.excerpt == original_excerpt


def test_translation_failure_preserves_evidence() -> None:
    seed_result()
    with TestingSession() as session:
        evidence = session.query(StoredEvidence).one()
        evidence_id = evidence.id
        original_excerpt = evidence.excerpt
    app.dependency_overrides[get_translation_provider] = lambda: FakeTranslationProvider(fails=True)
    try:
        response = TestClient(app).post(
            f"/evidence/{evidence_id}/translations", json={"target_language": "en"}
        )
    finally:
        app.dependency_overrides.pop(get_translation_provider, None)
    assert response.status_code == 502
    with TestingSession() as session:
        stored = session.get(StoredEvidence, evidence_id)
        assert stored is not None and stored.excerpt == original_excerpt
