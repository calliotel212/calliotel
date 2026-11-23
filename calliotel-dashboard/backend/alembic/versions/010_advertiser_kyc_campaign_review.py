"""Advertiser KYC fields and 48h campaign pending_review

Revision ID: 010_kyc_review
Revises: 009_publisher_portal
Create Date: 2026-11-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_kyc_review"
down_revision: Union[str, None] = "009_publisher_portal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "advertiser_users",
        sa.Column("business_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "advertiser_users",
        sa.Column("phone_number", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "advertiser_users",
        sa.Column("website_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "advertiser_users",
        sa.Column(
            "kyc_status",
            sa.String(length=16),
            nullable=False,
            server_default="unverified",
        ),
    )
    op.add_column(
        "advertiser_users",
        sa.Column("kyc_document_url", sa.String(length=2048), nullable=True),
    )
    op.execute(
        """
        UPDATE advertiser_users u
        SET business_name = a.name
        FROM advertisers a
        WHERE u.advertiser_id = a.id AND u.business_name IS NULL
        """
    )

    op.add_column(
        "campaigns",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column("review_ends_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        """
        UPDATE campaigns
        SET status = 'pending_review'
        WHERE status = 'pending_approval'
        """
    )
    op.execute(
        """
        UPDATE campaigns
        SET review_ends_at = created_at + interval '48 hours'
        WHERE status = 'pending_review' AND review_ends_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE campaigns SET status = 'pending_approval' WHERE status = 'pending_review'
        """
    )
    op.drop_column("campaigns", "review_ends_at")
    op.drop_column("campaigns", "created_at")
    op.drop_column("advertiser_users", "kyc_document_url")
    op.drop_column("advertiser_users", "kyc_status")
    op.drop_column("advertiser_users", "website_url")
    op.drop_column("advertiser_users", "phone_number")
    op.drop_column("advertiser_users", "business_name")