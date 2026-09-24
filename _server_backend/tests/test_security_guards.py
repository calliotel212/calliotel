"""Unit tests for disposable signup, paid-vs-promo, and promo IP rules."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.disposable_emails import is_disposable_email, normalize_email
from services.paid_funds import assert_paid_covers, lifetime_paid, paid_spendable
from services.admin_gate import is_admin_user
from services.auth_throttle import window_iso
from services.promo_guard import extract_ip


def test_blocks_reserved_and_probe_domains():
    assert is_disposable_email("race_x@example.com")
    assert is_disposable_email("a@mailtest-zz9.com")
    assert is_disposable_email("a@999mailtest-zz9.com")
    assert is_disposable_email("x@reseller-test-vta7.com")
    assert is_disposable_email("tmp@mailinator.com")
    assert not is_disposable_email("customer@gmail.com")
    assert not is_disposable_email("ok@yahoo.com")


def test_gmail_normalize_strips_dots_and_plus():
    assert normalize_email("J.ohn+spam@gmail.com") == "john@gmail.com"


def test_promo_not_spendable_on_provider_products():
    wallet = {"balance": 6.0, "promo_balance": 5.0, "lifetime_paid_usd": 1.0}
    assert paid_spendable(wallet) == 1.0
    assert lifetime_paid(wallet) == 1.0
    with pytest.raises(Exception) as exc:
        assert_paid_covers(wallet, 1.49)
    assert getattr(exc.value, "status_code", None) == 402
    assert_paid_covers(wallet, 1.0)


def test_extract_ip_uses_xff():
    class Req:
        headers = {"X-Forwarded-For": "203.0.113.9, 10.0.0.1"}
        client = None

    assert extract_ip(Req()) == "203.0.113.9"


def test_admin_flag_on_user_doc_is_ignored():
    fake = {"email": "hacker@gmail.com", "is_admin": True}
    assert not is_admin_user(fake)
    assert is_admin_user({"email": "admin@calliotel.com"})


def test_throttle_window_is_iso():
    assert "T" in window_iso(15)
