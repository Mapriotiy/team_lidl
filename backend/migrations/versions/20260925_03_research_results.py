"""Persist research documents, evidence, assessments, scores and opportunities."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "20260925_03"
down_revision: str | None = "20260925_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "source_documents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column(
            "research_run_id", sa.String(36), sa.ForeignKey("research_runs.id"), nullable=False
        ),
        sa.Column("canonical_url", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("publication_date", sa.DateTime(timezone=True)),
        sa.Column("event_date", sa.DateTime(timezone=True)),
        sa.Column("content_hash", sa.String(128), nullable=False),
        sa.Column("normalized_text", sa.Text()),
        sa.Column("text_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("company_id", "content_hash", name="uq_company_source_hash"),
    )
    op.create_index("ix_source_documents_company_id", "source_documents", ["company_id"])
    op.create_index("ix_source_documents_research_run_id", "source_documents", ["research_run_id"])
    op.create_index("ix_source_expiry", "source_documents", ["text_expires_at"])

    op.create_table(
        "evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(64), sa.ForeignKey("source_documents.id"), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("start_offset", sa.Integer(), nullable=False),
        sa.Column("end_offset", sa.Integer(), nullable=False),
        sa.Column("factual_claim", sa.Text(), nullable=False),
        sa.Column("event_group_key", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "source_id", "start_offset", "end_offset", "event_group_key", name="uq_evidence_span"
        ),
    )
    op.create_index("ix_evidence_source_id", "evidence", ["source_id"])
    op.create_index("ix_evidence_event_group_key", "evidence", ["event_group_key"])

    op.create_table(
        "signal_assessments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "research_run_id", sa.String(36), sa.ForeignKey("research_runs.id"), nullable=False
        ),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column(
            "profile_version_id",
            sa.String(36),
            sa.ForeignKey("service_profile_versions.id"),
            nullable=False,
        ),
        sa.Column("signal_id", sa.String(80), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("evidence_strength", sa.String(16)),
        sa.Column("evidence_ids", JSONB(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("model_version", sa.String(160), nullable=False),
        sa.Column("prompt_version", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("research_run_id", "signal_id", name="uq_run_signal_assessment"),
    )
    for column in ("research_run_id", "company_id", "profile_version_id"):
        op.create_index(f"ix_signal_assessments_{column}", "signal_assessments", [column])

    op.create_table(
        "score_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "research_run_id", sa.String(36), sa.ForeignKey("research_runs.id"), nullable=False
        ),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column(
            "profile_version_id",
            sa.String(36),
            sa.ForeignKey("service_profile_versions.id"),
            nullable=False,
        ),
        sa.Column("calculation_version", sa.String(40), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("eligibility", sa.String(32), nullable=False),
        sa.Column("coverage", sa.Float(), nullable=False),
        sa.Column("icp_fit", sa.Float(), nullable=False),
        sa.Column("positive_strength", sa.Float(), nullable=False),
        sa.Column("penalty_points", sa.Float(), nullable=False),
        sa.Column("contributions", JSONB(), nullable=False),
        sa.Column("exclusion_reasons", JSONB(), nullable=False),
        sa.Column("warnings", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("research_run_id", "company_id", "profile_version_id"):
        op.create_index(f"ix_score_snapshots_{column}", "score_snapshots", [column])

    op.create_table(
        "opportunities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column(
            "profile_id", sa.String(36), sa.ForeignKey("service_profiles.id"), nullable=False
        ),
        sa.Column("latest_snapshot_id", sa.String(36), sa.ForeignKey("score_snapshots.id")),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("company_id", "profile_id", name="uq_company_profile_opportunity"),
    )
    op.create_index("ix_opportunities_company_id", "opportunities", ["company_id"])
    op.create_index("ix_opportunities_profile_id", "opportunities", ["profile_id"])


def downgrade() -> None:
    op.drop_table("opportunities")
    op.drop_table("score_snapshots")
    op.drop_table("signal_assessments")
    op.drop_table("evidence")
    op.drop_table("source_documents")
