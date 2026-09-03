"""
Late Summer Talk — first $5+ deposit grants 60 US/CA minutes as $1.20 wallet credit.

Safe to import from payment webhooks. Never raises into the caller.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

TALK_OFFER_ID = "late_summer_talk_2026"
TALK_OFFER_ENDS = datetime(2026, 9, 21, 23, 59, 59, tzinfo=timezone.utc)
TALK_OFFER_MIN = 5.00
TALK_OFFER_BONUS = 1.20
TALK_OFFER_MINUTES = 60
TALK_OFFER_CATEGORY = "talk_offer_60min"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def maybe_grant_talk_offer(db: Any, user_id: str, deposit_amount: float) -> float:
    """Grant the campaign bonus once. Returns amount granted, or 0."""
    try:
        if _now() > TALK_OFFER_ENDS:
            return 0.0
        if float(deposit_amount or 0) < TALK_OFFER_MIN:
            return 0.0
        if not user_id:
            return 0.0

        existing = await db.transactions.find_one({
            "user_id": user_id,
            "category": TALK_OFFER_CATEGORY,
        })
        if existing:
            return 0.0

        wallet = await db.wallets.find_one({"user_id": user_id})
        if not wallet:
            return 0.0

        now_iso = _now().isoformat()
        new_bal = round(float(wallet.get("balance") or 0) + TALK_OFFER_BONUS, 4)
        await db.wallets.update_one(
            {"user_id": user_id},
            {"$set": {"balance": new_bal, "updated_at": now_iso}},
        )
        await db.transactions.insert_one({
            "user_id": user_id,
            "type": "credit",
            "amount": TALK_OFFER_BONUS,
            "description": f"Late Summer Talk — {TALK_OFFER_MINUTES} min US/CA (${TALK_OFFER_BONUS:.2f})",
            "balance_after": new_bal,
            "category": TALK_OFFER_CATEGORY,
            "campaign": TALK_OFFER_ID,
            "created_at": now_iso,
        })
        logger.info("Talk offer $%.2f granted to %s", TALK_OFFER_BONUS, user_id)
        return TALK_OFFER_BONUS
    except Exception as exc:
        logger.warning("Talk offer grant skipped: %s", exc)
        return 0.0
