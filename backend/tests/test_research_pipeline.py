from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.assessment import AssessmentStatus, EvidenceStrength, ProposedAssessment, ProposedEvidence
from app.assessment.providers import AssessmentBatch, OpenRouterTransientError
from app.collection.models import CollectedDocument, CollectionResult
from app.contracts.evidence import SourceType
from app.db import Base
from app.jobs.runner import RetryableResearchError
from app.models.profile import ServiceProfile, ServiceProfileVersion
from app.models.research import Company, ResearchRun
from app.models.results import Opportunity, StoredScoreSnapshot, StoredSourceDocument
from app.research import IntegratedResearchPipeline


class FakeNews:
    def discover(self, company_name: str) -> list[object]:
        return []


class FakeCollector:
    def collect(self, company: object, targets: object) -> CollectionResult:
        text = "The company announced an operational efficiency program."
        return CollectionResult(
            documents=(
                CollectedDocument(
                    id="source-1",
                    company_id="company-1",
                    canonical_url="https://example.com/news",
                    source_type=SourceType.COMPANY,
                    title="Efficiency program",
                    retrieved_at=datetime.now(UTC),
                    publication_date=datetime(2026, 9, 1, tzinfo=UTC),
                    event_date=datetime(2026, 9, 1, tzinfo=UTC),
                    content_hash="hash-1",
                    normalized_text=text,
                ),
            ),
            errors=(),
        )


class FakeAssessmentProvider:
    def assess(self, **kwargs: object) -> AssessmentBatch:
        text = "operational efficiency program"
        return AssessmentBatch(
            assessments=(
                ProposedAssessment(
                    signal_id="efficiency",
                    status=AssessmentStatus.SUPPORTED,
                    evidence=[
                        ProposedEvidence(
                            source_id="source-1",
                            excerpt=text,
                            start_offset=25,
                            end_offset=25 + len(text),
                            factual_claim="The company announced an efficiency program.",
                            event_group_key="efficiency-2026",
                        )
                    ],
                    evidence_strength=EvidenceStrength.STRONG,
                    rationale="A named efficiency program is present.",
                    model_version="test-model",
                    prompt_version="assessment-v1",
                ),
            ),
            model="test-model",
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            cost_usd=0,
        )


class TransientAssessmentProvider:
    def assess(self, **kwargs: object) -> AssessmentBatch:
        raise OpenRouterTransientError("Service temporarily overloaded")


class PartiallyInvalidAssessmentProvider:
    def assess(self, **kwargs: object) -> AssessmentBatch:
        valid_text = "operational efficiency program"
        return AssessmentBatch(
            assessments=(
                ProposedAssessment(
                    signal_id="efficiency",
                    status=AssessmentStatus.SUPPORTED,
                    evidence=[
                        ProposedEvidence(
                            source_id="source-1",
                            excerpt=valid_text,
                            start_offset=0,
                            end_offset=len(valid_text),
                            factual_claim="The company announced an efficiency program.",
                            event_group_key="efficiency-2026",
                        )
                    ],
                    evidence_strength=EvidenceStrength.STRONG,
                    rationale="A named efficiency program is present.",
                    model_version="test-model",
                    prompt_version="assessment-v1",
                ),
                ProposedAssessment(
                    signal_id="capability",
                    status=AssessmentStatus.SUPPORTED,
                    evidence=[
                        ProposedEvidence(
                            source_id="source-1",
                            excerpt="a sentence that is not in the source",
                            start_offset=0,
                            end_offset=40,
                            factual_claim="The company has internal capability.",
                            event_group_key="capability-2026",
                        )
                    ],
                    evidence_strength=EvidenceStrength.MODERATE,
                    rationale="Internal capability is claimed.",
                    model_version="test-model",
                    prompt_version="assessment-v1",
                ),
            ),
            model="test-model",
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            cost_usd=0,
        )


def test_pipeline_persists_sources_assessments_score_and_opportunity() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as session:
        company = Company(id="company-1", canonical_domain="example.com", display_name="Example")
        profile = ServiceProfile(id="profile-1", name="Automation")
        version = ServiceProfileVersion(
            id="profile-v1",
            version=1,
            configuration={
                "service_description": "Automation",
                "icp": {},
                "signals": [
                    {
                        "id": "efficiency",
                        "question": "Is there an efficiency initiative?",
                        "positive_criteria": ["Named program"],
                        "exclusions": [],
                        "weight": 20,
                        "effect": "positive",
                        "freshness_window_days": 365,
                    }
                ],
            },
        )
        profile.versions.append(version)
        run = ResearchRun(
            id="run-1",
            company_id=company.id,
            profile_version_id=version.id,
            idempotency_key="pipeline-test",
        )
        session.add_all([company, profile, run])

    pipeline = IntegratedResearchPipeline(
        sessions,
        FakeAssessmentProvider(),  # type: ignore[arg-type]
        collector=FakeCollector(),  # type: ignore[arg-type]
        news=FakeNews(),  # type: ignore[arg-type]
    )
    with sessions() as session:
        company = session.get_one(Company, "company-1")
        version = session.get_one(ServiceProfileVersion, "profile-v1")
        session.expunge(company)
        session.expunge(version)
    collected = pipeline.collect("run-1", company)
    assessed = pipeline.assess("run-1", company, version, collected.data)

    assert assessed.completed == 1
    with sessions() as session:
        assert session.get(StoredSourceDocument, "source-1") is not None
        snapshot = session.scalar(select(StoredScoreSnapshot))
        opportunity = session.scalar(select(Opportunity))
        assert snapshot is not None and snapshot.score > 0
        assert opportunity is not None and opportunity.latest_snapshot_id == snapshot.id


def test_transient_provider_overload_is_retryable() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as session:
        company = Company(id="company-1", canonical_domain="example.com", display_name="Example")
        profile = ServiceProfile(id="profile-1", name="Automation")
        version = ServiceProfileVersion(
            id="profile-v1",
            version=1,
            configuration={
                "service_description": "Automation",
                "icp": {},
                "signals": [
                    {
                        "id": "efficiency",
                        "question": "Is there an efficiency initiative?",
                        "positive_criteria": ["Named program"],
                        "exclusions": [],
                        "weight": 20,
                        "effect": "positive",
                        "freshness_window_days": 365,
                    }
                ],
            },
        )
        profile.versions.append(version)
        run = ResearchRun(
            id="run-1",
            company_id=company.id,
            profile_version_id=version.id,
            idempotency_key="pipeline-retry",
        )
        session.add_all([company, profile, run])

    pipeline = IntegratedResearchPipeline(
        sessions,
        TransientAssessmentProvider(),  # type: ignore[arg-type]
        collector=FakeCollector(),  # type: ignore[arg-type]
        news=FakeNews(),  # type: ignore[arg-type]
    )
    with sessions() as session:
        company = session.get_one(Company, "company-1")
        version = session.get_one(ServiceProfileVersion, "profile-v1")
        session.expunge(company)
        session.expunge(version)
    collected = pipeline.collect("run-1", company)

    with pytest.raises(RetryableResearchError, match="temporarily unavailable"):
        pipeline.assess("run-1", company, version, collected.data)


def test_pipeline_keeps_valid_signals_when_one_citation_is_invalid() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as session:
        company = Company(id="company-1", canonical_domain="example.com", display_name="Example")
        profile = ServiceProfile(id="profile-1", name="Automation")
        version = ServiceProfileVersion(
            id="profile-v1",
            version=1,
            configuration={
                "service_description": "Automation",
                "icp": {},
                "signals": [
                    {
                        "id": "efficiency",
                        "question": "Efficiency?",
                        "positive_criteria": ["Named program"],
                        "exclusions": [],
                        "weight": 20,
                        "effect": "positive",
                        "freshness_window_days": 365,
                    },
                    {
                        "id": "capability",
                        "question": "Internal capability?",
                        "positive_criteria": ["Named team"],
                        "exclusions": [],
                        "weight": 10,
                        "effect": "penalty",
                        "freshness_window_days": 365,
                    },
                ],
            },
        )
        profile.versions.append(version)
        session.add_all([
            company,
            profile,
            ResearchRun(
                id="run-1",
                company_id=company.id,
                profile_version_id=version.id,
                idempotency_key="partial-validation",
            ),
        ])
    pipeline = IntegratedResearchPipeline(
        sessions,
        PartiallyInvalidAssessmentProvider(),  # type: ignore[arg-type]
        collector=FakeCollector(),  # type: ignore[arg-type]
        news=FakeNews(),  # type: ignore[arg-type]
    )
    with sessions() as session:
        company = session.get_one(Company, "company-1")
        version = session.get_one(ServiceProfileVersion, "profile-v1")
        session.expunge(company)
        session.expunge(version)

    collected = pipeline.collect("run-1", company)
    assessed = pipeline.assess("run-1", company, version, collected.data)

    assert assessed.completed == 1
    assert assessed.total == 2
    assert [error.code for error in assessed.errors] == ["invalid_evidence"]
    with sessions() as session:
        snapshot = session.scalar(select(StoredScoreSnapshot))
        assert snapshot is not None
        assert snapshot.coverage == 0.5
        assert len(snapshot.contributions) == 1


def test_unconfigured_pipeline_names_required_environment() -> None:
    from app.jobs.runner import UnconfiguredPipeline

    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        UnconfiguredPipeline().collect("run-1", None)  # type: ignore[arg-type]
