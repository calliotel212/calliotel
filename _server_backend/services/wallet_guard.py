"""Atomic wallet debit with a non-negative floor."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def debit_if_funded(
    db,
    user_id: str,
    amount: float,
    *,
    now_iso: str | None = None,
) -> dict[str, Any] | None:
    """Subtract ``amount`` only if balance >= amount. Returns updated wallet or None."""
    amt = float(amount)
    if amt <= 0:
        return None
    return await db.wallets.find_one_and_update(
        {"user_id": user_id, "balance": {"$gte": amt}},
        {"$inc": {"balance": -amt}, "$set": {"updated_at": now_iso or _now_iso()}},
        return_document=True,
    )


async def credit(db, user_id: str, amount: float, *, now_iso: str | None = None) -> dict[str, Any] | None:
    amt = float(amount)
    if amt <= 0:
        return None
    return await db.wallets.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"balance": amt}, "$set": {"updated_at": now_iso or _now_iso()}},
        return_document=True,
        upsert=True,
    )
