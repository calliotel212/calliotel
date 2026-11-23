"""Platform owner admin console data and campaign moderation."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from app.models.ads import AdEvent, Advertiser, AdvertiserUser, Campaign
from app.services import publisher_service
from app.services.campaign_review_service import (
    LEGACY_PENDING_STATUS,
    PENDING_REVIEW_STATUS,
    ensure_review_processed,
)

# Documented in AdminMetricsResponse.revenue_formula
REVENUE_FORMULA = (
    "SUM(campaigns.max_cpc) for each ad_events row where event_type = 'served' "
    "(estimated click charges; wallet debits on serve are not implemented yet)."
)

_PENDING_STATUSES = (PENDING_REVIEW_STATUS, LEGACY_PENDING_STATUS)


def get_metrics(db: Session) -> tuple[Decimal, int, str]:
    clicks_q = db.scalar(
        select(func.count()).select_from(AdEvent).where(AdEvent.event_type == "served")
    )
    total_clicks = int(clicks_q or 0)

    revenue_row = db.execute(
        select(func.coalesce(func.sum(Campaign.max_cpc), 0))
        .select_from(AdEvent)
        .join(Campaign, Campaign.id == AdEvent.campaign_id)
        .where(AdEvent.event_type == "served")
    ).scalar_one()
    total_revenue = Decimal(str(revenue_row or 0))
    return total_revenue, total_clicks, REVENUE_FORMULA


def list_advertisers(db: Session, *, kyc_status: str | None = None) -> list[dict]:
    users = db.scalars(
        select(AdvertiserUser)
        .options(joinedload(AdvertiserUser.advertiser))
        .order_by(AdvertiserUser.created_at.desc())
    ).all()
    out: list[dict] = []
    for user in users:
        if kyc_status and user.kyc_status != kyc_status:
            continue
        adv = user.advertiser
        campaign_count = db.scalar(
            select(func.count()).select_from(Campaign).where(Campaign.advertiser_id == user.advertiser_id)
        )
        out.append(
            {
                "id": user.advertiser_id,
                "user_id": user.id,
                "email": user.email,
                "name": adv.name if adv else (user.business_name or ""),
                "business_name": user.business_name or (adv.name if adv else ""),
                "phone_number": user.phone_number,
                "website_url": user.website_url,
                "kyc_status": user.kyc_status,
                "wallet_balance": Decimal(str(adv.wallet_balance)) if adv else Decimal("0"),
                "campaign_count": int(campaign_count or 0),
            }
        )
    return out


def list_publishers(db: Session) -> list[dict]:
    return publisher_service.list_publishers_for_admin(db)


def list_campaigns_for_review(db: Session, *, status: str | None = None) -> list[dict]:
    ensure_review_processed(db)
    q = select(Campaign).options(joinedload(Campaign.advertiser)).order_by(Campaign.created_at.desc())
    if status:
        if status == PENDING_REVIEW_STATUS:
            q = q.where(Campaign.status.in_(_PENDING_STATUSES))
        else:
            q = q.where(Campaign.status == status)
    campaigns = db.scalars(q).unique().all()
    ids = [c.id for c in campaigns]
    click_rows = (
        db.execute(
            select(AdEvent.campaign_id, func.count())
            .where(AdEvent.campaign_id.in_(ids), AdEvent.event_type == "served")
            .group_by(AdEvent.campaign_id)
        ).all()
        if ids
        else []
    )
    clicks_map = {str(cid): int(count) for cid, count in click_rows}
    out: list[dict] = []
    for c in campaigns:
        adv = c.advertiser
        out.append(
            {
                "id": c.id,
                "advertiser_id": c.advertiser_id,
                "advertiser_name": adv.name if adv else "",
                "brand_name": c.brand_name,
                "status": c.status,
                "max_cpc": Decimal(str(c.max_cpc)),
                "daily_budget": Decimal(str(c.daily_budget)),
                "clicks": clicks_map.get(c.id, 0),
                "review_ends_at": c.review_ends_at,
                "created_at": c.created_at,
            }
        )
    return out


def approve_campaign(db: Session, *, campaign_id: str) -> Campaign | None:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        return None
    campaign.status = "active"
    db.commit()
    db.refresh(campaign)
    return campaign


def reject_campaign(db: Session, *, campaign_id: str) -> Campaign | None:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        return None
    campaign.status = "rejected"
    db.commit()
    db.refresh(campaign)
    return campaign


def patch_campaign_status(db: Session, *, campaign_id: str, status: str) -> Campaign | None:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        return None
    campaign.status = status
    db.commit()
    db.refresh(campaign)
    return campaign


def approve_advertiser_kyc(db: Session, *, advertiser_id: str) -> AdvertiserUser | None:
    user = db.scalar(select(AdvertiserUser).where(AdvertiserUser.advertiser_id == advertiser_id).limit(1))
    if user is None:
        return None
    user.kyc_status = "approved"
    db.commit()
    db.refresh(user)
    return user


def reject_advertiser_kyc(db: Session, *, advertiser_id: str) -> AdvertiserUser | None:
    user = db.scalar(select(AdvertiserUser).where(AdvertiserUser.advertiser_id == advertiser_id).limit(1))
    if user is None:
        return None
    user.kyc_status = "rejected"
    db.execute(
        update(Campaign)
        .where(
            Campaign.advertiser_id == advertiser_id,
            Campaign.status.in_(_PENDING_STATUSES),
        )
        .values(status="rejected")
    )
    db.commit()
    db.refresh(user)
    return user