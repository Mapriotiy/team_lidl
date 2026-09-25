"""Add imported companies and lease-fenced research runs."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "20260925_02"
down_revision: str | None = "20260925_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("canonical_domain", sa.String(253), nullable=False, unique=True),
        sa.Column("display_name", sa.String(253), nullable=False),
        sa.Column("aliases", JSONB(), nullable=False),
        sa.Column("facts", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "research_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column(
            "profile_version_id",
            sa.String(36),
            sa.ForeignKey("service_profile_versions.id"),
            nullable=False,
        ),
        sa.Column("operation", sa.String(32), nullable=False),
        sa.Column("idempotency_key", sa.String(200), nullable=False, unique=True),
        sa.Column("status", sa.String(16), nullable=False),
        *[
            sa.Column(name, JSONB(), nullable=False)
            for name in ("progress", "partial_errors", "result_links", "stage_results", "usage")
        ],
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("lease_token", sa.String(36)),
        *[
            sa.Column(name, sa.DateTime(timezone=True), nullable=True)
            for name in ("lease_expires_at", "heartbeat_at", "started_at", "finished_at")
        ],
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("attempts >= 0 AND attempts <= max_attempts", name="ck_run_attempts"),
        sa.CheckConstraint("max_attempts BETWEEN 1 AND 3", name="ck_run_max_attempts"),
        sa.CheckConstraint(
            "status IN ('queued','running','completed','partial','failed')", name="ck_run_status"
        ),
    )
    op.create_index("ix_research_runs_company_id", "research_runs", ["company_id"])
    op.create_index("ix_run_claim", "research_runs", ["status", "available_at", "lease_expires_at"])


def downgrade() -> None:
    op.drop_table("research_runs")
    op.drop_table("companies")
