"""Promo / WELCOME5 anti-farm rules for bots — real customers still get the bonus.

  • Disposable / reserved / probe emails cannot redeem
  • One promo redemption per IP per 30 days (stops rotating-email farms)
  • One redemption of a given code per account (enforced by caller used_by)
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from fastapi import HTTPException

from services.disposable_emails import is_disposable_email

PROMO_IP_WINDOW_DAYS = 30


def extract_ip(request) -> str:
    if request is None:
        return ""
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return getattr(getattr(request, "client", None), "host", "") or ""


async def assert_promo_allowed(db, current_user: dict, request=None) -> str:
    email = (current_user.get("email") or current_user.get("_id") or "")
    email = str(email).strip().lower()
    if is_disposable_email(email):
        raise HTTPException(
            status_code=400,
            detail="Promo codes cannot be applied on this account.",
        )

    ip = extract_ip(request)
    if ip and ip not in {"127.0.0.1", "::1"}:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=PROMO_IP_WINDOW_DAYS)).isoformat()
        prior = await db.promo_redemptions.count_documents({
            "ip": ip,
            "created_at": {"$gte": cutoff},
        })
        if prior >= 1:
            raise HTTPException(
                status_code=429,
                detail="A promo was already claimed from this network. Contact support@calliotel.com if this is an error.",
            )
    return ip


async def record_promo_redemption(db, *, user_id: str, code: str, ip: str, amount: float) -> None:
    await db.promo_redemptions.insert_one({
        "user_id": user_id,
        "code": code,
        "ip": ip,
        "amount": amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
