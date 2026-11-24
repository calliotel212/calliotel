"""Sponsored ad matching: LLM semantic rank with keyword fallback."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ads import AdEvent, Campaign, Publisher, PublisherEvent
from app.services.campaign_review_service import ensure_review_processed
from app.services.click_token_service import build_click_url
from app.services.llm_client import llm_model_for_provider, resolve_llm_provider
from app.services.publisher_service import publisher_earnings_for_event

logger = logging.getLogger(__name__)

# Only live (post-review) campaigns serve in voice/AdsFind matching.
SERVABLE_CAMPAIGN_STATUSES = frozenset({"active"})

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_KEYWORD_MIN_SCORE = 2
_SEMANTIC_MIN_SCORE = 4
_LLM_TIMEOUT_SECONDS = 2.0

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


def _keyword_best_match(
    query: str,
    campaigns: list[Campaign],
    *,
    country: str | None,
    language: str | None,
) -> tuple[Campaign | None, int]:
    best: Campaign | None = None
    best_score = 0
    for campaign in campaigns:
        if not campaign_matches_targeting(campaign, country=country, language=language):
            continue
        score = _score_query_against_campaign(query, campaign)
        if score > best_score:
            best_score = score
            best = campaign
    if best is None or best_score < _KEYWORD_MIN_SCORE:
        return None, 0
    return best, best_score


def _clamp_match_score(score: int) -> int:
    return max(1, min(10, score))


async def _semantic_match_async(
    user_query: str,
    campaigns: list[Campaign],
) -> tuple[str, int] | None:
    """Rank campaigns via LLM; return ``(campaign_id, match_score 1-10)`` or None."""
    provider_info = resolve_llm_provider()
    if not provider_info or not campaigns:
        return None

    provider, endpoint, api_key = provider_info
    model = llm_model_for_provider(provider)
    catalog = [
        {
            "campaign_id": c.id,
            "brand_name": c.brand_name,
            "intent_description": c.intent_description,
            "ad_copy": (c.ad_copy or "")[:300],
        }
        for c in campaigns
    ]
    system = (
        "You rank sponsored ad campaigns for relevance to a user query. "
        "Output valid JSON only with keys: campaign_id (string or null), match_score (integer 1-10). "
        "Pick the single best campaign_id from the list, or null only if none are relevant (score below 4). "
        "match_score is relevance of the best pick only. "
        "Mapping hints for demo campaigns: "
        "If the user asks for a vehicle, car, ride, drive, or transport, prefer the Car Rental campaign. "
        "If they ask to sleep, stay, rest, or lodging tonight, prefer the Hotel campaign. "
        "If they want flowers, a gift, or a present, prefer the Flower Shop campaign."
    )
    user_content = json.dumps(
        {"user_query": user_query, "campaigns": catalog},
        ensure_ascii=False,
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=_LLM_TIMEOUT_SECONDS) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (httpx.HTTPError, asyncio.TimeoutError, KeyError, json.JSONDecodeError, ValueError) as exc:
        logger.debug("Semantic ad match LLM failed: %s", exc)
        return None

    logger.info("DeepSeek match result: %s", parsed)

    campaign_id = parsed.get("campaign_id")
    if campaign_id in (None, "", "null"):
        return None
    try:
        score = int(parsed.get("match_score", 0))
    except (TypeError, ValueError):
        return None
    if score < _SEMANTIC_MIN_SCORE:
        return None
    score = _clamp_match_score(score)
    return str(campaign_id), score


def _semantic_match(
    user_query: str,
    campaigns: list[Campaign],
) -> tuple[Campaign | None, int]:
    """Sync wrapper for asyncio LLM rank."""
    try:
        result = asyncio.run(_semantic_match_async(user_query, campaigns))
    except RuntimeError:
        # Nested event loop (e.g. some test runners): skip LLM
        return None, 0
    if not result:
        return None, 0
    campaign_id, score = result
    by_id = {c.id: c for c in campaigns}
    campaign = by_id.get(campaign_id)
    if campaign is None:
        return None, 0
    return campaign, score


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

    eligible = [
        c
        for c in campaigns
        if campaign_matches_targeting(c, country=country, language=language)
    ]
    if not eligible:
        return None

    best: Campaign | None = None
    match_score = 0

    semantic_campaign, semantic_score = _semantic_match(query, eligible)
    if semantic_campaign is not None:
        best = semantic_campaign
        match_score = semantic_score
    else:
        best, kw_score = _keyword_best_match(
            query, campaigns, country=country, language=language
        )
        if best is None:
            return None
        match_score = _clamp_match_score(kw_score)

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
        "match_score": match_score,
    }