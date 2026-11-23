"""48-hour campaign review window and auto-activation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.ads import AdvertiserUser, Campaign

# Statuses that may become active after the review window (matcher still only serves ``active``).
PENDING_REVIEW_STATUS = "pending_review"
LEGACY_PENDING_STATUS = "pending_approval"
AUTO_ACTIVATE_KYC_STATUSES = frozenset({"unverified", "approved"})


def review_deadline_from(now: datetime | None = None) -> datetime:
    base = now or datetime.now(timezone.utc)
    return base + timedelta(hours=48)


def _advertiser_kyc_for_campaign(db: Session, campaign: Campaign) -> str:
    row = db.scalar(
        select(AdvertiserUser.kyc_status)
        .where(AdvertiserUser.advertiser_id == campaign.advertiser_id)
        .limit(1)
    )
    return str(row or "unverified")


def process_due_campaign_reviews(db: Session) -> int:
    """Activate or reject campaigns whose 48h review window has elapsed."""
    now = datetime.now(timezone.utc)
    campaigns = (
        db.scalars(
            select(Campaign)
            .where(
                Campaign.status.in_((PENDING_REVIEW_STATUS, LEGACY_PENDING_STATUS)),
                Campaign.review_ends_at.is_not(None),
                Campaign.review_ends_at <= now,
            )
            .options(joinedload(Campaign.advertiser))
        )
        .unique()
        .all()
    )
    processed = 0
    for campaign in campaigns:
        kyc = _advertiser_kyc_for_campaign(db, campaign)
        if kyc == "rejected":
            campaign.status = "rejected"
            processed += 1
        elif kyc in AUTO_ACTIVATE_KYC_STATUSES:
            campaign.status = "active"
            processed += 1
    if processed:
        db.commit()
    return processed


def ensure_review_processed(db: Session) -> None:
    """Lightweight hook for list/match paths."""
    process_due_campaign_reviews(db)