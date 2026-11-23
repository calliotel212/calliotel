"""Keyword-based sponsored ad matching for AdsFind."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ads import AdEvent, Campaign

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


def find_sponsored_ad(db: Session, user_query: str, *, log_event: bool = True) -> dict[str, Any] | None:
    """Return the best active campaign match for ``user_query``, or None."""
    query = user_query.strip()
    if not query:
        return None

    campaigns = db.scalars(select(Campaign).where(Campaign.status == "active")).all()
    if not campaigns:
        return None

    best: Campaign | None = None
    best_score = 0
    for campaign in campaigns:
        score = _score_query_against_campaign(query, campaign)
        if score > best_score:
            best_score = score
            best = campaign

    if best is None or best_score < _MIN_SCORE:
        return None

    if log_event:
        db.add(AdEvent(campaign_id=best.id, event_type="served"))
        db.commit()

    return {
        "brand_name": best.brand_name,
        "ad_copy": best.ad_copy,
        "campaign_id": best.id,
        "destination_url": best.destination_url,
        "match_score": best_score,
    }