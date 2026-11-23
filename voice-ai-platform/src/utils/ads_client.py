"""HTTP client for Calliotel Dashboard AdsFind internal API."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from utils.config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SponsoredAd:
    brand_name: str
    ad_copy: str
    campaign_id: str
    destination_url: str
    match_score: int


def fetch_sponsored_ad(settings: Settings, user_query: str) -> SponsoredAd | None:
    base = settings.dashboard_api_url.rstrip("/")
    if not base:
        return None

    url = f"{base}/api/v1/internal/ads/match"
    headers: dict[str, str] = {}
    if settings.internal_ads_api_key:
        headers["X-Internal-Ads-Api-Key"] = settings.internal_ads_api_key

    try:
        with httpx.Client(timeout=settings.ads_match_timeout_seconds) as client:
            response = client.get(url, params={"q": user_query}, headers=headers)
    except httpx.HTTPError:
        logger.warning("AdsFind match request failed", exc_info=True)
        return None

    if response.status_code == 404:
        return None
    if response.status_code != 200:
        logger.warning("AdsFind match unexpected status %s", response.status_code)
        return None

    data = response.json()
    return SponsoredAd(
        brand_name=data["brand_name"],
        ad_copy=data["ad_copy"],
        campaign_id=data["campaign_id"],
        destination_url=data["destination_url"],
        match_score=int(data.get("match_score", 0)),
    )