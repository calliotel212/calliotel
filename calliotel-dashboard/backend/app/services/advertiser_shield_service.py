from sqlalchemy.orm import Session

from app.models.ad_event_types import INVALID_FRAUD
from app.models.ads import AdEvent, Campaign
from sqlalchemy import func, select


def blocked_fraud_clicks_for_advertiser(db: Session, *, advertiser_id: str) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(AdEvent)
            .join(Campaign, Campaign.id == AdEvent.campaign_id)
            .where(Campaign.advertiser_id == advertiser_id, AdEvent.event_type == INVALID_FRAUD)
        )
        or 0
    )