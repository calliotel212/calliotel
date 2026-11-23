"""Unit tests for campaign geo/language targeting."""

from types import SimpleNamespace

from app.services.ad_matcher import campaign_matches_targeting


def _campaign(countries=None, languages=None):
    return SimpleNamespace(
        target_countries=countries or [],
        target_languages=languages or [],
    )


def test_empty_targets_match_any_request():
    c = _campaign()
    assert campaign_matches_targeting(c, country="AE", language="ar")
    assert campaign_matches_targeting(c, country=None, language=None)


def test_country_filter():
    c = _campaign(countries=["AE", "SA"])
    assert campaign_matches_targeting(c, country="ae", language=None)
    assert not campaign_matches_targeting(c, country="EG", language=None)


def test_language_filter():
    c = _campaign(languages=["en"])
    assert campaign_matches_targeting(c, country=None, language="EN")
    assert not campaign_matches_targeting(c, country=None, language="ar")