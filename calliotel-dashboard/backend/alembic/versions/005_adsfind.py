"""AdsFind advertisers, campaigns, ad events

Revision ID: 005_adsfind
Revises: 004_tenant_phone
Create Date: 2026-11-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_adsfind"
down_revision: Union[str, None] = "004_tenant_phone"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "advertisers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("wallet_balance", sa.Numeric(precision=12, scale=4), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "campaigns",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("advertiser_id", sa.String(length=36), nullable=False),
        sa.Column("brand_name", sa.String(length=255), nullable=False),
        sa.Column("ad_copy", sa.Text(), nullable=False),
        sa.Column("destination_url", sa.String(length=2048), nullable=False),
        sa.Column("intent_description", sa.Text(), nullable=False),
        sa.Column("max_cpc", sa.Numeric(precision=12, scale=4), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.ForeignKeyConstraint(["advertiser_id"], ["advertisers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ad_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("ad_events")
    op.drop_table("campaigns")
    op.drop_table("advertisers")