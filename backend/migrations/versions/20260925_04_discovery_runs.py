"""Persist bounded discovery candidates for confirmation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "20260925_04"
down_revision: str | None = "20260925_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "discovery_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("request", JSONB(), nullable=False),
        sa.Column("candidates", JSONB(), nullable=False),
        sa.Column("confirmed_domains", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("discovery_runs")
