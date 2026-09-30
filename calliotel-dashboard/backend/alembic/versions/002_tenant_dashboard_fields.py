"""tenant dashboard summary fields

Revision ID: 002_tenant_dashboard
Revises: 001_initial
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_tenant_dashboard"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("agent_status", sa.String(length=32), nullable=False, server_default="offline"),
    )
    op.add_column("tenants", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("calls_this_month", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("minutes_used", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenants",
        sa.Column("billing_status", sa.String(length=32), nullable=False, server_default="trial"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "billing_status")
    op.drop_column("tenants", "minutes_used")
    op.drop_column("tenants", "calls_this_month")
    op.drop_column("tenants", "phone_number")
    op.drop_column("tenants", "agent_status")
