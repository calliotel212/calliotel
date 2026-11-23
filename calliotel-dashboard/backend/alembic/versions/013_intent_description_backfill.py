"""Backfill campaign intent_description for semantic matching.

Revision ID: 013_intent_backfill
Revises: 012_click_fraud_events
Create Date: 2026-11-24

``intent_description`` exists from 005_adsfind; enrich rows that only have short keyword stubs.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "013_intent_backfill"
down_revision: str | None = "012_click_fraud_events"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE campaigns
            SET intent_description = trim(brand_name) || '. ' || trim(ad_copy)
            WHERE char_length(trim(coalesce(intent_description, ''))) < 24
            """
        )
    )


def downgrade() -> None:
    pass