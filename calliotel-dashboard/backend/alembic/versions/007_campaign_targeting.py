"""Campaign geo/language targeting and daily budget

Revision ID: 007_campaign_targeting
Revises: 006_advertiser_accounts
Create Date: 2026-11-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007_campaign_targeting"
down_revision: Union[str, None] = "006_advertiser_accounts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column(
            "target_countries",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "target_languages",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "daily_budget",
            sa.Numeric(precision=12, scale=4),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("campaigns", "daily_budget")
    op.drop_column("campaigns", "target_languages")
    op.drop_column("campaigns", "target_countries")