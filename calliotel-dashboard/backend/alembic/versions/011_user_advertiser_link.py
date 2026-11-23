"""Link tenant users to AdsFind advertiser accounts.

Revision ID: 011_user_advertiser
Revises: 010_kyc_review
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "011_user_advertiser"
down_revision: str | None = "010_kyc_review"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("advertiser_user_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_advertiser_user_id",
        "users",
        "advertiser_users",
        ["advertiser_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_advertiser_user_id", "users", ["advertiser_user_id"])


def downgrade() -> None:
    op.drop_index("ix_users_advertiser_user_id", table_name="users")
    op.drop_constraint("fk_users_advertiser_user_id", "users", type_="foreignkey")
    op.drop_column("users", "advertiser_user_id")