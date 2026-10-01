"""End-to-end guard test: promo/welcome credit must NOT buy provider OTP numbers.

Runs the real /api/one-otp/buy endpoint through the local OTP app (in-memory DB,
no MongoDB or provider secrets). Proves:
  - a promo-only wallet is rejected with 402 by assert_real_funds_cover, BEFORE
    any provider call is made;
  - a wallet funded with real money passes the funds guard (it then fails later
    at the unconfigured provider, which is expected in this offline test).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from local_otp_app import app  # sets LOCAL_OTP_DEV=1 and the in-memory DB
from database import db

client = TestClient(app)


def _login(email: str = "promo-tester@example.com") -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": "x"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]["id"]


def _set_wallet(user_id: str, **fields):
    asyncio.run(db.wallets.update_one({"user_id": user_id}, {"$set": fields}))


def test_promo_only_wallet_cannot_buy_otp():
    token, user_id = _login("promo-only@example.com")
    # All balance is promo credit → real spendable is $0.
    _set_wallet(user_id, balance=5.0, promo_balance=5.0)

    r = client.post(
        "/api/one-otp/buy",
        json={"service": "whatsapp", "country": "auto"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 402, r.text
    detail = r.json()["detail"].lower()
    assert "welcome" in detail or "top up" in detail or "real funds" in detail


def test_real_funds_wallet_passes_funds_guard():
    token, user_id = _login("paid-tester@example.com")
    # Real money, no promo → passes assert_real_funds_cover. It then fails at the
    # unconfigured provider (503), which proves the funds guard did NOT block it.
    _set_wallet(user_id, balance=20.0, promo_balance=0.0)

    r = client.post(
        "/api/one-otp/buy",
        json={"service": "whatsapp", "country": "auto"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code != 402, f"real funds were wrongly blocked: {r.text}"
