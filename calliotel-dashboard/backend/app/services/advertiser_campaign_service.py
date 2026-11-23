from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.ads import Campaign


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
    status: str = "active",
) -> Campaign:
    campaign = Campaign(
        advertiser_id=advertiser_id,
        brand_name=brand_name,
        ad_copy=ad_copy,
        destination_url=destination_url,
        intent_description=intent_description,
        max_cpc=max_cpc,
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
    if status is not None:
        campaign.status = status
    db.commit()
    db.refresh(campaign)
    return campaign