"""Advertiser user accounts for AdsFind dashboard

Revision ID: 006_advertiser_accounts
Revises: 005_adsfind
Create Date: 2026-11-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_advertiser_accounts"
down_revision: Union[str, None] = "005_adsfind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "advertiser_users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("advertiser_id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["advertiser_id"], ["advertisers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )


def downgrade() -> None:
    op.drop_table("advertiser_users")