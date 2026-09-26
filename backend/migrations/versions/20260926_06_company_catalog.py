"""Add a preloaded company catalog for local discovery."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_06"
down_revision: str | None = "20260925_05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "company_catalog",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("entity_id", sa.String(32), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("domain", sa.String(253), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("country_name", sa.String(120), nullable=False),
        sa.Column("industry", sa.String(200)),
        sa.Column("employee_count", sa.Integer()),
        sa.Column("website_url", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_id", name="uq_catalog_entity"),
        sa.UniqueConstraint("domain", name="uq_catalog_domain"),
    )
    op.create_index(
        "ix_catalog_country_employees", "company_catalog", ["country_code", "employee_count"]
    )
    op.create_index("ix_catalog_industry", "company_catalog", ["industry"])
    op.create_index("ix_catalog_updated", "company_catalog", ["updated_at"])


def downgrade() -> None:
    op.drop_table("company_catalog")
