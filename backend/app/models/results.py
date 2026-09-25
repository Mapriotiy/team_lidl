"""Persisted research evidence, assessments, scores, and sales workflow state."""

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.profile import json_type, new_id, utc_now


class StoredSourceDocument(Base):
    __tablename__ = "source_documents"
    __table_args__ = (
        UniqueConstraint("company_id", "content_hash", name="uq_company_source_hash"),
        Index("ix_source_expiry", "text_expires_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    research_run_id: Mapped[str] = mapped_column(ForeignKey("research_runs.id"), index=True)
    canonical_url: Mapped[str] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(Text)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    publication_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    content_hash: Mapped[str] = mapped_column(String(128))
    normalized_text: Mapped[str | None] = mapped_column(Text)
    text_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StoredEvidence(Base):
    __tablename__ = "evidence"
    __table_args__ = (
        UniqueConstraint(
            "source_id", "start_offset", "end_offset", "event_group_key", name="uq_evidence_span"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    source_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id"), index=True)
    excerpt: Mapped[str] = mapped_column(Text)
    start_offset: Mapped[int] = mapped_column(Integer)
    end_offset: Mapped[int] = mapped_column(Integer)
    factual_claim: Mapped[str] = mapped_column(Text)
    event_group_key: Mapped[str] = mapped_column(String(200), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class EvidenceTranslation(Base):
    __tablename__ = "evidence_translations"
    __table_args__ = (
        UniqueConstraint(
            "evidence_id",
            "target_language",
            "provider_model",
            "source_text_hash",
            name="uq_evidence_translation_cache",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.id"), index=True)
    target_language: Mapped[str] = mapped_column(String(8))
    provider_model: Mapped[str] = mapped_column(String(160))
    source_text_hash: Mapped[str] = mapped_column(String(128))
    translated_excerpt: Mapped[str] = mapped_column(Text)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StoredSignalAssessment(Base):
    __tablename__ = "signal_assessments"
    __table_args__ = (
        UniqueConstraint("research_run_id", "signal_id", name="uq_run_signal_assessment"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    research_run_id: Mapped[str] = mapped_column(ForeignKey("research_runs.id"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    profile_version_id: Mapped[str] = mapped_column(
        ForeignKey("service_profile_versions.id"), index=True
    )
    signal_id: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(32))
    evidence_strength: Mapped[str | None] = mapped_column(String(16))
    evidence_ids: Mapped[list[str]] = mapped_column(json_type, default=list)
    rationale: Mapped[str] = mapped_column(Text)
    model_version: Mapped[str] = mapped_column(String(160))
    prompt_version: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StoredScoreSnapshot(Base):
    __tablename__ = "score_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    research_run_id: Mapped[str] = mapped_column(ForeignKey("research_runs.id"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    profile_version_id: Mapped[str] = mapped_column(
        ForeignKey("service_profile_versions.id"), index=True
    )
    calculation_version: Mapped[str] = mapped_column(String(40))
    score: Mapped[float] = mapped_column(Float)
    eligibility: Mapped[str] = mapped_column(String(32))
    coverage: Mapped[float] = mapped_column(Float)
    icp_fit: Mapped[float] = mapped_column(Float)
    positive_strength: Mapped[float] = mapped_column(Float)
    penalty_points: Mapped[float] = mapped_column(Float)
    contributions: Mapped[list[dict[str, object]]] = mapped_column(json_type, default=list)
    exclusion_reasons: Mapped[list[str]] = mapped_column(json_type, default=list)
    warnings: Mapped[list[str]] = mapped_column(json_type, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        UniqueConstraint("company_id", "profile_id", name="uq_company_profile_opportunity"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    profile_id: Mapped[str] = mapped_column(ForeignKey("service_profiles.id"), index=True)
    latest_snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("score_snapshots.id"))
    status: Mapped[str] = mapped_column(String(20), default="new")
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DiscoveryRun(Base):
    __tablename__ = "discovery_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    status: Mapped[str] = mapped_column(String(20), default="completed")
    request: Mapped[dict[str, object]] = mapped_column(json_type)
    candidates: Mapped[list[dict[str, object]]] = mapped_column(json_type, default=list)
    confirmed_domains: Mapped[list[str]] = mapped_column(json_type, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
