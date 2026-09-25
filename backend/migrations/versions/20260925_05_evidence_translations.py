"""Cache translated evidence excerpts without altering original evidence."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260925_05"
down_revision: str | None = "20260925_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "evidence_translations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("evidence_id", sa.String(36), sa.ForeignKey("evidence.id"), nullable=False),
        sa.Column("target_language", sa.String(8), nullable=False),
        sa.Column("provider_model", sa.String(160), nullable=False),
        sa.Column("source_text_hash", sa.String(128), nullable=False),
        sa.Column("translated_excerpt", sa.Text(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("cost_usd", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "evidence_id",
            "target_language",
            "provider_model",
            "source_text_hash",
            name="uq_evidence_translation_cache",
        ),
    )
    op.create_index(
        "ix_evidence_translations_evidence_id",
        "evidence_translations",
        ["evidence_id"],
    )


def downgrade() -> None:
    op.drop_table("evidence_translations")
