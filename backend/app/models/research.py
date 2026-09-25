"""Persistent company identities and lease-fenced research jobs."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.profile import json_type, new_id, utc_now


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    canonical_domain: Mapped[str] = mapped_column(String(253), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(253), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(json_type, default=list)
    facts: Mapped[dict[str, object]] = mapped_column(json_type, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ResearchRun(Base):
    __tablename__ = "research_runs"
    __table_args__ = (
        CheckConstraint("attempts >= 0 AND attempts <= max_attempts", name="ck_run_attempts"),
        CheckConstraint("max_attempts BETWEEN 1 AND 3", name="ck_run_max_attempts"),
        CheckConstraint(
            "status IN ('queued','running','completed','partial','failed')", name="ck_run_status"
        ),
        Index("ix_run_claim", "status", "available_at", "lease_expires_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    profile_version_id: Mapped[str] = mapped_column(ForeignKey("service_profile_versions.id"))
    operation: Mapped[str] = mapped_column(String(32), default="research")
    idempotency_key: Mapped[str] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="queued")
    progress: Mapped[list[dict[str, object]]] = mapped_column(json_type, default=list)
    partial_errors: Mapped[list[dict[str, object]]] = mapped_column(json_type, default=list)
    result_links: Mapped[dict[str, str]] = mapped_column(json_type, default=dict)
    stage_results: Mapped[dict[str, object]] = mapped_column(json_type, default=dict)
    usage: Mapped[dict[str, object]] = mapped_column(json_type, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    lease_token: Mapped[str | None] = mapped_column(String(36))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
