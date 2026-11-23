"""Process AdsFind click redirects with Redis duplicate shield and wallet debits."""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core import redis as redis_core
from app.models.ad_event_types import INVALID_FRAUD, VALID_CLICK
from app.models.ads import AdEvent, Campaign, Publisher, PublisherEvent
from app.services import advertiser_wallet_service
from app.services.click_token_service import decode_click_token
from app.services.publisher_service import publisher_earnings_for_event

logger = logging.getLogger(__name__)


@dataclass
class ClickProcessResult:
    destination_url: str
    event_type: str
    debited: bool
    redis_available: bool


def client_ip_from_headers(*, x_forwarded_for: str | None, client_host: str | None) -> str:
    if x_forwarded_for:
        first = x_forwarded_for.split(",")[0].strip()
        if first:
            return first
    return client_host or "unknown"


def build_fraud_hash(*, ip_address: str, user_agent: str, campaign_id: str) -> str:
    raw = f"{ip_address}|{user_agent}|{campaign_id}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def process_click_redirect(
    db: Session,
    *,
    token: str,
    ip_address: str,
    user_agent: str,
) -> ClickProcessResult:
    payload = decode_click_token(token)
    campaign_id = payload["campaign_id"]
    publisher_id = payload.get("publisher_id")

    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise ValueError("Campaign not found")

    destination = campaign.destination_url
    fraud_hash = build_fraud_hash(ip_address=ip_address, user_agent=user_agent, campaign_id=campaign_id)

    seen_before, redis_up = await redis_core.fraud_key_exists(fraud_hash)

    if redis_up and seen_before:
        db.add(AdEvent(campaign_id=campaign.id, event_type=INVALID_FRAUD))
        db.commit()
        return ClickProcessResult(
            destination_url=destination,
            event_type=INVALID_FRAUD,
            debited=False,
            redis_available=True,
        )

    if not redis_up:
        logger.warning("Redis unavailable; allowing click without duplicate shield (campaign=%s)", campaign_id)

    if redis_up and not seen_before:
        await redis_core.mark_fraud_key(fraud_hash)

    debited = False
    try:
        advertiser_wallet_service.debit_funds(
            db, advertiser_id=campaign.advertiser_id, amount_usd=Decimal(str(campaign.max_cpc))
        )
        debited = True
    except ValueError as exc:
        logger.info("Click debit skipped for campaign %s: %s", campaign_id, exc)

    db.add(AdEvent(campaign_id=campaign.id, event_type=VALID_CLICK))

    if publisher_id:
        publisher = db.get(Publisher, publisher_id)
        if publisher is not None:
            earnings = publisher_earnings_for_event(campaign.max_cpc, publisher.revenue_share_percentage)
            db.add(
                PublisherEvent(
                    publisher_id=publisher.id,
                    campaign_id=campaign.id,
                    event_type="click",
                    revenue_amount=earnings,
                )
            )
            publisher.pending_balance = float(Decimal(str(publisher.pending_balance)) + earnings)

    db.commit()
    return ClickProcessResult(
        destination_url=destination,
        event_type=VALID_CLICK,
        debited=debited,
        redis_available=redis_up,
    )