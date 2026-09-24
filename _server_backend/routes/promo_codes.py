"""Apply marketing promo codes (WELCOME5, etc.) after paid-funds + IP checks."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import db
from routes.auth_deps import get_current_user
from services.promo_guard import (
    assert_code_not_retired,
    assert_promo_allowed,
    record_promo_redemption,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class ApplyPromoCode(BaseModel):
    code: str


@router.post("/apply")
async def apply_promo_code(
    data: ApplyPromoCode,
    request: Request,
    current_user=Depends(get_current_user),
):
    code = data.code.upper().strip()
    assert_code_not_retired(code)
    user_id = str(current_user["_id"])
    ip = await assert_promo_allowed(db, current_user, request)

    now = datetime.now(timezone.utc)
    result = await db.promo_codes.find_one_and_update(
        {
            "code": code,
            "is_active": True,
            "$expr": {"$lt": ["$used_count", "$max_uses"]},
            "used_by": {"$nin": [user_id]},
        },
        {
            "$inc": {"used_count": 1},
            "$push": {"used_by": user_id},
        },
        return_document=True,
    )
    if not result:
        existing = await db.promo_codes.find_one({"code": code})
        if not existing or not existing.get("is_active"):
            raise HTTPException(status_code=404, detail="Invalid or expired promo code")
        if user_id in [str(u) for u in existing.get("used_by", [])]:
            raise HTTPException(status_code=400, detail="You have already used this promo code")
        if existing.get("used_count", 0) >= existing.get("max_uses", 0):
            raise HTTPException(status_code=400, detail="This promo code has reached its usage limit")
        raise HTTPException(status_code=400, detail="This promo code cannot be applied right now")

    amount = float(
        result.get("credit_usd")
        or result.get("amount_usd")
        or result.get("amount")
        or result.get("credit")
        or 0
    )
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid promo code")

    await db.wallets.update_one(
        {"user_id": user_id},
        {
            "$inc": {"balance": amount, "promo_balance": amount},
            "$set": {"updated_at": now.isoformat()},
        },
        upsert=True,
    )
    wallet = await db.wallets.find_one({"user_id": user_id})
    new_balance = float((wallet or {}).get("balance") or 0)
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "credit",
        "amount": amount,
        "description": f"Promo code: {code}",
        "source": "promo",
        "created_at": now.isoformat(),
        "balance_after": new_balance,
    })
    await record_promo_redemption(db, user_id=user_id, code=code, ip=ip, amount=amount)
    logger.info("Promo %s applied by %s — $%s credited (promo_balance)", code, user_id, amount)
    return {"success": True, "code": code, "credited": amount, "new_balance": new_balance}
