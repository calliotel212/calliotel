"""LLM semantic matcher falls back to keywords on timeout."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import ad_matcher


def _campaign(
    *,
    cid: str,
    brand: str,
    intent: str,
    ad_copy: str = "",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=cid,
        brand_name=brand,
        intent_description=intent,
        ad_copy=ad_copy or intent,
        destination_url="https://example.com",
        max_cpc="1.0",
        target_countries=[],
        target_languages=[],
        status="active",
    )


@pytest.mark.asyncio
async def test_semantic_match_timeout_returns_none():
    with patch.object(
        httpx.AsyncClient,
        "post",
        side_effect=httpx.TimeoutException("timed out"),
    ):
        with patch(
            "app.services.ad_matcher.resolve_llm_provider",
            return_value=("deepseek", "http://x", "key"),
        ):
            result = await ad_matcher._semantic_match_async("hotel stay", [_campaign(cid="c1", brand="Hotel", intent="lodging")])
    assert result is None


def test_find_sponsored_ad_falls_back_to_keywords_on_llm_timeout():
    car = _campaign(
        cid="car-1",
        brand="Demo Car Rental",
        intent="car rental rent vehicle hire automobile driving",
        ad_copy="Rent cars",
    )
    hotel = _campaign(
        cid="hotel-1",
        brand="Demo Hotel",
        intent="hotel room lodging stay",
        ad_copy="Stay with us",
    )

    db = MagicMock()
    result = MagicMock()
    result.all.return_value = [car, hotel]
    db.scalars.return_value = result

    with patch.object(ad_matcher, "_semantic_match", return_value=(None, 0)):
        with patch("app.services.ad_matcher.ensure_review_processed"):
            matched = ad_matcher.find_sponsored_ad(
                db,
                "rent vehicle hire airport",
                log_event=False,
            )

    assert matched is not None
    assert matched["brand_name"] == "Demo Car Rental"
    assert 1 <= matched["match_score"] <= 10


def test_semantic_match_used_when_llm_returns_campaign():
    flower = _campaign(
        cid="fl-1",
        brand="Demo Flower Shop",
        intent="flowers gift bouquet",
        ad_copy="Roses",
    )

    db = MagicMock()
    result = MagicMock()
    result.all.return_value = [flower]
    db.scalars.return_value = result

    with patch.object(ad_matcher, "_semantic_match", return_value=(flower, 8)):
        with patch("app.services.ad_matcher.ensure_review_processed"):
            matched = ad_matcher.find_sponsored_ad(
                db,
                "present for my wife",
                log_event=False,
            )

    assert matched is not None
    assert matched["brand_name"] == "Demo Flower Shop"
    assert matched["match_score"] == 8