"""Signup wallets start at $0. Promo credit is earned via /api/promo after a real top-up."""
from __future__ import annotations

from datetime import datetime, timezone


async def create_wallet_with_welcome_credit(
    db,
    user_id: str,
    extra_credit: float = 0.0,
    extra_description: str | None = None,
) -> float:
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.wallets.find_one({"user_id": user_id})
    if existing:
        return float(existing.get("balance") or 0)
    await db.wallets.insert_one({
        "user_id": user_id,
        "balance": 0.0,
        "promo_balance": 0.0,
        "lifetime_paid_usd": 0.0,
        "created_at": now,
        "updated_at": now,
    })
    return 0.0
