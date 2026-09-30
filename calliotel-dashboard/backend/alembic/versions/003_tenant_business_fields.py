"""tenant business setup fields

Revision ID: 003_tenant_business
Revises: 002_tenant_dashboard
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_tenant_business"
down_revision: Union[str, None] = "002_tenant_dashboard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("business_name", sa.String(length=255), nullable=True))
    op.add_column("tenants", sa.Column("business_type", sa.String(length=64), nullable=True))
    op.add_column("tenants", sa.Column("business_hours", sa.JSON(), nullable=True))
    op.add_column("tenants", sa.Column("business_services", sa.Text(), nullable=True))
    op.add_column("tenants", sa.Column("business_faq", sa.Text(), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("preferred_language", sa.String(length=8), nullable=False, server_default="en"),
    )
    op.add_column(
        "tenants",
        sa.Column("agent_voice", sa.String(length=16), nullable=False, server_default="female"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "agent_voice")
    op.drop_column("tenants", "preferred_language")
    op.drop_column("tenants", "business_faq")
    op.drop_column("tenants", "business_services")
    op.drop_column("tenants", "business_hours")
    op.drop_column("tenants", "business_type")
    op.drop_column("tenants", "business_name")
