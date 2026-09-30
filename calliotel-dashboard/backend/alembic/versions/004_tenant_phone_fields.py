"""tenant phone activation fields

Revision ID: 004_tenant_phone
Revises: 003_tenant_business
Create Date: 2026-09-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_tenant_phone"
down_revision: Union[str, None] = "003_tenant_business"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("phone_number_id", sa.String(length=64), nullable=True))
    op.add_column(
        "tenants",
        sa.Column(
            "activation_status",
            sa.String(length=32),
            nullable=False,
            server_default="inactive",
        ),
    )
    op.add_column("tenants", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "activated_at")
    op.drop_column("tenants", "activation_status")
    op.drop_column("tenants", "phone_number_id")
