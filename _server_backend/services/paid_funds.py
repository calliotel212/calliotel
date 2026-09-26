"""Track real money vs promo credit.

Provider inventory (OTP, eSIM, proxy, DID) must be paid with topped-up funds,
not WELCOME5 / referral promo. Callers credit ``lifetime_paid_usd`` on Stripe,
NOWPayments, Fincra, and Bekena success paths.
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

MIN_PAID_FOR_PROMO_USD = 1.00


def paid_spendable(wallet: dict[str, Any] | None) -> float:
    if not wallet:
        return 0.0
    balance = float(wallet.get("balance") or 0)
    promo = float(wallet.get("promo_balance") or 0)
    return round(max(0.0, balance - max(0.0, promo)), 2)


def lifetime_paid(wallet: dict[str, Any] | None) -> float:
    if not wallet:
        return 0.0
    return round(float(wallet.get("lifetime_paid_usd") or 0), 2)


def assert_paid_covers(wallet: dict[str, Any] | None, amount: float) -> None:
    need = float(amount)
    have = paid_spendable(wallet)
    if have + 1e-9 < need:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Welcome or promo credit cannot pay for this product. "
                f"Add at least ${need:.2f} in real funds. You have ${have:.2f} spendable."
            ),
        )


PAID_SOURCES = ("stripe", "nowpayments", "fincra", "bekena", "usdt", "square", "card", "crypto")
_PROMO_DESC_PREFIXES = ("Promo code", "Welcome", "Referral", "Signup bonus")


def _is_promo_tx(tx: dict[str, Any]) -> bool:
    if (tx.get("source") or "").lower() == "promo":
        return True
    desc = str(tx.get("description") or "")
    return desc.startswith(_PROMO_DESC_PREFIXES)


async def real_spendable(db, user_id: str, wallet: dict[str, Any] | None) -> float:
    """Wallet balance minus every promo credit ever granted (conservative).

    Works on wallets that predate ``promo_balance`` / ``lifetime_paid_usd``:
    falls back to the transactions history.
    """
    if not wallet:
        return 0.0
    balance = float(wallet.get("balance") or 0)
    promo = float(wallet.get("promo_balance") or 0)
    txs = await db.transactions.find(
        {"user_id": user_id, "type": "credit"},
        {"source": 1, "description": 1, "amount": 1},
    ).to_list(length=500)
    promo_hist = sum(float(t.get("amount") or 0) for t in txs if _is_promo_tx(t))
    promo = max(promo, promo_hist)
    return round(max(0.0, balance - promo), 2)


async def assert_real_funds_cover(db, user_id: str, wallet: dict[str, Any] | None, amount: float) -> None:
    need = float(amount)
    have = await real_spendable(db, user_id, wallet)
    if have + 1e-9 < need:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Welcome credit can be used for calls and SMS, not for buying a number. "
                f"Please top up at least ${need - have:.2f} to get this number."
            ),
        )


async def record_paid_topup(db, user_id: str, amount_usd: float) -> None:
    amt = float(amount_usd)
    if amt <= 0:
        return
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": amt, "lifetime_paid_usd": amt}},
        upsert=True,
    )
