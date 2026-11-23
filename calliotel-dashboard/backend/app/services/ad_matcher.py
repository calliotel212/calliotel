"""Keyword-based sponsored ad matching for AdsFind."""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ads import AdEvent, Campaign, Publisher, PublisherEvent
from app.services.campaign_review_service import ensure_review_processed
from app.services.click_token_service import build_click_url
from app.services.publisher_service import publisher_earnings_for_event

# Only live (post-review) campaigns serve in voice/AdsFind matching.
SERVABLE_CAMPAIGN_STATUSES = frozenset({"active"})

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_MIN_SCORE = 2


def _tokenize(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def _score_query_against_campaign(user_query: str, campaign: Campaign) -> int:
    query_tokens = _tokenize(user_query)
    if not query_tokens:
        return 0

    haystack = " ".join(
        (campaign.intent_description, campaign.brand_name, campaign.ad_copy)
    )
    campaign_tokens = _tokenize(haystack)
    overlap = query_tokens & campaign_tokens
    score = len(overlap)
    for token in query_tokens:
        if len(token) >= 4 and any(token in t for t in campaign_tokens if len(t) >= 4):
            score += 1
    return score


def campaign_matches_targeting(
    campaign: Campaign,
    *,
    country: str | None,
    language: str | None,
) -> bool:
    """Geo/language filter for match API.

    Empty ``target_countries`` / ``target_languages`` on a campaign means no
    restriction for that dimension. When the match request includes ``country``
    or ``language``, the campaign must either have an empty target list or
    include that value (case-insensitive).
    """
    if country:
        norm = country.strip().upper()
        targets = [c.upper() for c in (campaign.target_countries or []) if c]
        if targets and norm not in targets:
            return False
    if language:
        norm = language.strip().lower()
        targets = [lang.lower() for lang in (campaign.target_languages or []) if lang]
        if targets and norm not in targets:
            return False
    return True


def find_sponsored_ad(
    db: Session,
    user_query: str,
    *,
    country: str | None = None,
    language: str | None = None,
    log_event: bool = True,
    publisher: Publisher | None = None,
) -> dict[str, Any] | None:
    """Return the best active campaign match for ``user_query``, or None."""
    query = user_query.strip()
    if not query:
        return None

    ensure_review_processed(db)

    campaigns = db.scalars(
        select(Campaign).where(Campaign.status.in_(SERVABLE_CAMPAIGN_STATUSES))
    ).all()
    if not campaigns:
        return None

    best: Campaign | None = None
    best_score = 0
    for campaign in campaigns:
        if not campaign_matches_targeting(campaign, country=country, language=language):
            continue
        score = _score_query_against_campaign(query, campaign)
        if score > best_score:
            best_score = score
            best = campaign

    if best is None or best_score < _MIN_SCORE:
        return None

    if log_event:
        db.add(AdEvent(campaign_id=best.id, event_type="served"))
        if publisher is not None:
            earnings = publisher_earnings_for_event(best.max_cpc, publisher.revenue_share_percentage)
            db.add(
                PublisherEvent(
                    publisher_id=publisher.id,
                    campaign_id=best.id,
                    event_type="impression",
                    revenue_amount=earnings,
                )
            )
            publisher.pending_balance = float(Decimal(str(publisher.pending_balance)) + earnings)
        db.commit()

    publisher_id = publisher.id if publisher is not None else None
    return {
        "brand_name": best.brand_name,
        "ad_copy": best.ad_copy,
        "campaign_id": best.id,
        "destination_url": best.destination_url,
        "click_url": build_click_url(campaign_id=best.id, publisher_id=publisher_id),
        "match_score": best_score,
    }