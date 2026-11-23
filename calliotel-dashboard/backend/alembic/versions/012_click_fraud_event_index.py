"""AdsFind click fraud event types index.

Revision ID: 012_click_fraud_events
Revises: 011_user_advertiser
Create Date: 2026-11-23

``valid_click`` and ``invalid_fraud`` use existing ``ad_events.event_type`` (varchar).
This migration adds indexes for admin/advertiser aggregates.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "012_click_fraud_events"
down_revision: str | None = "011_user_advertiser"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_ad_events_event_type", "ad_events", ["event_type"], unique=False)
    op.create_index(
        "ix_ad_events_campaign_id_event_type",
        "ad_events",
        ["campaign_id", "event_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_ad_events_campaign_id_event_type", table_name="ad_events")
    op.drop_index("ix_ad_events_event_type", table_name="ad_events")