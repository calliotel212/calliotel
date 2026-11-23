"""Publisher portal, API keys, publisher events

Revision ID: 009_publisher_portal
Revises: 007_campaign_targeting
Create Date: 2026-11-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_publisher_portal"
down_revision: Union[str, None] = "007_campaign_targeting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "publishers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("pending_balance", sa.Numeric(precision=12, scale=4), nullable=False, server_default="0"),
        sa.Column("paid_balance", sa.Numeric(precision=12, scale=4), nullable=False, server_default="0"),
        sa.Column(
            "revenue_share_percentage",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default="70.0",
        ),
        sa.Column("api_key_hash", sa.String(length=64), nullable=False),
        sa.Column("api_key_last4", sa.String(length=4), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "publisher_users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("publisher_id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["publisher_id"], ["publishers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "publisher_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("publisher_id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("revenue_amount", sa.Numeric(precision=12, scale=4), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["publisher_id"], ["publishers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_publisher_events_publisher_id", "publisher_events", ["publisher_id"])


def downgrade() -> None:
    op.drop_index("ix_publisher_events_publisher_id", table_name="publisher_events")
    op.drop_table("publisher_events")
    op.drop_table("publisher_users")
    op.drop_table("publishers")