from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ads import AdEvent, Campaign


def campaign_served_counts(db: Session, *, campaign_ids: list[str]) -> dict[str, int]:
    if not campaign_ids:
        return {}
    rows = db.execute(
        select(AdEvent.campaign_id, func.count())
        .where(AdEvent.campaign_id.in_(campaign_ids), AdEvent.event_type == "served")
        .group_by(AdEvent.campaign_id)
    ).all()
    return {str(cid): int(count) for cid, count in rows}


def list_campaigns(db: Session, *, advertiser_id: str) -> list[Campaign]:
    return (
        db.query(Campaign)
        .filter(Campaign.advertiser_id == advertiser_id)
        .order_by(Campaign.brand_name)
        .all()
    )


def get_campaign(db: Session, *, advertiser_id: str, campaign_id: str) -> Campaign | None:
    return (
        db.query(Campaign)
        .filter(Campaign.advertiser_id == advertiser_id, Campaign.id == campaign_id)
        .first()
    )


def create_campaign(
    db: Session,
    *,
    advertiser_id: str,
    brand_name: str,
    ad_copy: str,
    destination_url: str,
    intent_description: str,
    max_cpc: Decimal,
    daily_budget: Decimal = Decimal("0"),
    target_countries: list[str] | None = None,
    target_languages: list[str] | None = None,
    status: str = "active",
) -> Campaign:
    campaign = Campaign(
        advertiser_id=advertiser_id,
        brand_name=brand_name,
        ad_copy=ad_copy,
        destination_url=destination_url,
        intent_description=intent_description,
        max_cpc=max_cpc,
        daily_budget=daily_budget,
        target_countries=target_countries or [],
        target_languages=target_languages or [],
        status=status,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def update_campaign(
    db: Session,
    *,
    campaign: Campaign,
    brand_name: str | None = None,
    ad_copy: str | None = None,
    destination_url: str | None = None,
    intent_description: str | None = None,
    max_cpc: Decimal | None = None,
    daily_budget: Decimal | None = None,
    target_countries: list[str] | None = None,
    target_languages: list[str] | None = None,
    status: str | None = None,
) -> Campaign:
    if brand_name is not None:
        campaign.brand_name = brand_name
    if ad_copy is not None:
        campaign.ad_copy = ad_copy
    if destination_url is not None:
        campaign.destination_url = destination_url
    if intent_description is not None:
        campaign.intent_description = intent_description
    if max_cpc is not None:
        campaign.max_cpc = max_cpc
    if daily_budget is not None:
        campaign.daily_budget = daily_budget
    if target_countries is not None:
        campaign.target_countries = target_countries
    if target_languages is not None:
        campaign.target_languages = target_languages
    if status is not None:
        campaign.status = status
    db.commit()
    db.refresh(campaign)
    return campaign