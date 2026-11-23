"""Publisher API key hashing and match auth."""

from decimal import Decimal

from app.services.publisher_service import (
    hash_publisher_api_key,
    publisher_earnings_for_event,
)


def test_api_key_hash_is_sha256_hex():
    raw = "pub_test_key_123"
    digest = hash_publisher_api_key(raw)
    assert len(digest) == 64
    assert digest == hash_publisher_api_key(raw)
    assert digest != hash_publisher_api_key(raw + "x")


def test_publisher_earnings_formula():
    # Mock: publisher share = campaign max_cpc * (revenue_share_percentage / 100)
    amount = publisher_earnings_for_event(Decimal("2.00"), Decimal("70"))
    assert amount == Decimal("1.4000")