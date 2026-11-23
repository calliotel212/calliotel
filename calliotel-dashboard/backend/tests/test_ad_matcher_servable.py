"""Servable campaign status filter."""

from types import SimpleNamespace

from app.services.ad_matcher import SERVABLE_CAMPAIGN_STATUSES, campaign_matches_targeting


def test_servable_statuses_include_active_only():
    assert "active" in SERVABLE_CAMPAIGN_STATUSES
    assert "pending_approval" not in SERVABLE_CAMPAIGN_STATUSES


def test_targeting_unchanged_for_publishers():
    c = SimpleNamespace(target_countries=["AE"], target_languages=["en"])
    assert campaign_matches_targeting(c, country="AE", language="en")