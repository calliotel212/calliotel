"""Platform owner admin console data and campaign moderation."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.ads import AdEvent, Advertiser, AdvertiserUser, Campaign
from app.models.user import Tenant, User

# Documented in AdminMetricsResponse.revenue_formula
REVENUE_FORMULA = (
    "SUM(campaigns.max_cpc) for each ad_events row where event_type = 'served' "
    "(estimated click charges; wallet debits on serve are not implemented yet)."
)


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


def list_advertisers(db: Session) -> list[dict]:
    advertisers = db.scalars(select(Advertiser).order_by(Advertiser.name)).all()
    out: list[dict] = []
    for adv in advertisers:
        user_count = db.scalar(
            select(func.count()).select_from(AdvertiserUser).where(AdvertiserUser.advertiser_id == adv.id)
        )
        campaign_count = db.scalar(
            select(func.count()).select_from(Campaign).where(Campaign.advertiser_id == adv.id)
        )
        out.append(
            {
                "id": adv.id,
                "name": adv.name,
                "wallet_balance": Decimal(str(adv.wallet_balance)),
                "user_count": int(user_count or 0),
                "campaign_count": int(campaign_count or 0),
            }
        )
    return out


def list_publishers(db: Session) -> list[dict]:
    """Voice/dashboard tenants treated as publishers (no separate publisher entity)."""
    tenants = db.scalars(select(Tenant).order_by(Tenant.created_at.desc())).all()
    out: list[dict] = []
    for tenant in tenants:
        user_count = db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant.id))
        out.append(
            {
                "id": tenant.id,
                "business_name": tenant.business_name or tenant.name,
                "activation_status": tenant.activation_status,
                "agent_status": tenant.agent_status,
                "user_count": int(user_count or 0),
                "phone_number": tenant.phone_number,
            }
        )
    return out


def list_campaigns_for_review(db: Session) -> list[dict]:
    campaigns = (
        db.scalars(
            select(Campaign)
            .options(joinedload(Campaign.advertiser))
            .order_by(Campaign.status, Campaign.brand_name)
        )
        .unique()
        .all()
    )
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