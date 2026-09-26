"""Allow service profiles to share a display name."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_07"
down_revision: str | None = "20260926_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        convention = {"uq": "uq_%(table_name)s_%(column_0_name)s"}
        with op.batch_alter_table(
            "service_profiles", naming_convention=convention
        ) as batch_op:
            batch_op.drop_constraint("uq_service_profiles_name", type_="unique")
        return

    constraints = sa.inspect(bind).get_unique_constraints("service_profiles")
    name_constraint = next(
        constraint
        for constraint in constraints
        if constraint.get("column_names") == ["name"]
    )
    constraint_name = name_constraint.get("name")
    if not constraint_name:
        raise RuntimeError("The service profile name constraint has no database name")
    op.drop_constraint(constraint_name, "service_profiles", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("uq_service_profiles_name", "service_profiles", ["name"])
