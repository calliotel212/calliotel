"""Auto-ban for unpaid accounts that repeatedly abandon crypto invoices."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import local_memory_db  # noqa: F401  (ensures in-memory DB is importable)
from database import db
from services.fraud_protection import record_and_check_crypto_abuse, LIMITS


def _reset():
    db.fraud_events.docs.clear()
    db.users.docs.clear()
    db.wallets.docs.clear()


def _seed_user(email: str, lifetime_paid: float = 0.0):
    asyncio.run(db.users.insert_one({"_id": email, "email": email}))
    asyncio.run(db.wallets.insert_one({"user_id": email, "lifetime_paid_usd": lifetime_paid}))


def _is_banned(email: str) -> bool:
    u = asyncio.run(db.users.find_one({"_id": email}))
    return bool(u and u.get("banned"))


def test_unpaid_account_banned_after_threshold():
    _reset()
    email = "npd_bot@gmail.com"
    _seed_user(email, lifetime_paid=0.0)
    threshold = LIMITS["crypto_expired_ban_threshold_24h"]
    assert threshold == 3  # default

    # First (threshold-1) expiries: recorded, not yet banned.
    for _ in range(threshold - 1):
        banned = asyncio.run(record_and_check_crypto_abuse(email, email))
        assert banned is False
    assert _is_banned(email) is False

    # The threshold-th expiry trips the auto-ban.
    banned = asyncio.run(record_and_check_crypto_abuse(email, email))
    assert banned is True
    assert _is_banned(email) is True


def test_paying_customer_never_autobanned():
    _reset()
    email = "real_customer@gmail.com"
    _seed_user(email, lifetime_paid=25.0)  # has paid real money

    for _ in range(10):
        banned = asyncio.run(record_and_check_crypto_abuse(email, email))
        assert banned is False
    assert _is_banned(email) is False


def test_empty_identifier_is_noop():
    _reset()
    assert asyncio.run(record_and_check_crypto_abuse("", "")) is False
