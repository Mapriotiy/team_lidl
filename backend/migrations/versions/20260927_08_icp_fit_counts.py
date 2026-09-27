"""Persist the target-fit breakdown on score snapshots."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260927_08"
down_revision: str | None = "20260926_07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for column in (
        "icp_matched_count",
        "icp_mismatched_count",
        "icp_unknown_count",
        "icp_total_count",
    ):
        op.add_column("score_snapshots", sa.Column(column, sa.Integer(), nullable=True))


def downgrade() -> None:
    for column in (
        "icp_total_count",
        "icp_unknown_count",
        "icp_mismatched_count",
        "icp_matched_count",
    ):
        op.drop_column("score_snapshots", column)
