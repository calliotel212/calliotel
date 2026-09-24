"""
Admin API Routes - Professional Admin Panel
Full platform management for super admins
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import logging
from datetime import datetime, timezone, timedelta
from routes.auth import get_current_user
from database import db
import os
import json
from uuid import uuid4

logger = logging.getLogger(__name__)
router = APIRouter()

ADMIN_EMAILS = [
    "admin@calliotel.com",
    "bigboss@calliotel.com",
    "alinmy77@gmail.com",
    "worl212211@yahoo.com",
    "astor539@gmail.com",
    "g_agroup2@yahoo.com",
]


async def is_admin(current_user) -> bool:
    from services.admin_gate import is_admin_user
    return is_admin_user(current_user)


# ─────────────────────────────────────────────────────────────────────────────
# REVENUE HELPERS — fixes long-standing dashboard $0-revenue bug.
#
# Real money lives in payment_transactions (Stripe checkouts; status='complete' or payment_status='paid').
#
# `wallet_transactions` (legacy name) does NOT exist — old code queried it
# and silently returned $0 for months. `transactions` collection holds wallet
# activity (welcome credits, debits) and is used for transaction COUNTS only.
# Timestamps in payment_transactions are stored as ISO strings.
# ─────────────────────────────────────────────────────────────────────────────

PAID_STATUSES = ("complete", "completed", "paid", "succeeded")

async def _sum_otp_revenue(date_from_iso: Optional[str] = None, date_to_iso: Optional[str] = None) -> float:
    """Sum OTP/verification fees consumed.

    Queries both legacy verification_orders and new otp_orders (HeroSMS).
    Only counts orders that received SMS and were NOT refunded.
    """
    ts_filter: dict = {}
    if date_from_iso or date_to_iso:
        if date_from_iso:
            ts_filter["$gte"] = date_from_iso
        if date_to_iso:
            ts_filter["$lt"] = date_to_iso

    # Legacy verification_orders (old OTP system)
    legacy_match: dict = {"status": {"$in": ["received", "RECEIVED", "completed", "COMPLETED", "done"]}}
    if ts_filter:
        legacy_match["created_at"] = ts_filter
    legacy_pipeline = [{"$match": legacy_match}, {"$group": {"_id": None, "total": {"$sum": "$price"}}}]
    legacy_res = await db.verification_orders.aggregate(legacy_pipeline).to_list(1)
    legacy_total = float(legacy_res[0]["total"] or 0) if legacy_res else 0.0

    # New HeroSMS otp_orders — count got_sms orders that were NOT refunded
    otp_match: dict = {"status": "got_sms", "refunded": {"$ne": True}}
    if ts_filter:
        otp_match["created_at"] = ts_filter
    otp_pipeline = [{"$match": otp_match}, {"$group": {"_id": None, "total": {"$sum": "$price_paid"}}}]
    otp_res = await db.otp_orders.aggregate(otp_pipeline).to_list(1)
    otp_total = float(otp_res[0]["total"] or 0) if otp_res else 0.0

    return round(legacy_total + otp_total, 2)


async def _sum_revenue(date_from_iso: Optional[str] = None, date_to_iso: Optional[str] = None) -> float:
    """Sum REAL revenue (Stripe) over an optional ISO date window."""
    stripe_match: dict = {
        "$or": [
            {"status": {"$in": list(PAID_STATUSES)}},
            {"payment_status": {"$in": list(PAID_STATUSES)}},
        ]
    }
    if date_from_iso or date_to_iso:
        ts_filter: dict = {}
        if date_from_iso:
            ts_filter["$gte"] = date_from_iso
        if date_to_iso:
            ts_filter["$lt"] = date_to_iso
        stripe_match["$and"] = [{
            "$or": [
                {"$and": [{"completed_at": {"$nin": [None, ""]}}, {"completed_at": ts_filter}]},
                {"$and": [{"$or": [{"completed_at": {"$exists": False}}, {"completed_at": {"$in": [None, ""]}}]},
                          {"created_at": ts_filter}]},
            ]
        }]
    pipeline = [{"$match": stripe_match}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    res = await db.payment_transactions.aggregate(pipeline).to_list(1)
    return round(float(res[0]["total"]) if res else 0.0, 2)


async def _count_paid_orders(date_from_iso: Optional[str] = None) -> int:
    """Count completed Stripe transactions — for 'orders today' KPI."""
    stripe_match: dict = {
        "$or": [
            {"status": {"$in": list(PAID_STATUSES)}},
            {"payment_status": {"$in": list(PAID_STATUSES)}},
        ]
    }
    if date_from_iso:
        stripe_match["$and"] = [{
            "$or": [
                {"completed_at": {"$gte": date_from_iso}},
                {"$and": [{"completed_at": {"$exists": False}}, {"created_at": {"$gte": date_from_iso}}]},
            ]
        }]
    return await db.payment_transactions.count_documents(stripe_match)


class CreditAdjust(BaseModel):
    amount: float
    reason: Optional[str] = "Admin adjustment"
    force: bool = False


class PushBroadcast(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/"
    icon: Optional[str] = "/calliotel-icon-192.png"


class BroadcastCreate(BaseModel):
    title: str
    message: str


# ── DASHBOARD ────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(current_user = Depends(get_current_user)):
    """Single-call comprehensive dashboard stats"""
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")

        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Users
        total_users = await db.users.count_documents({})
        new_today = await db.users.count_documents({"created_at": {"$gte": today_start.isoformat()}})
        active_week = await db.users.count_documents({"last_login": {"$gte": week_ago.isoformat()}})
        banned_users = await db.users.count_documents({"banned": True})
        verified_users = await db.users.count_documents({"email_verified": True})

        # Revenue — pulls from REAL payment collections (Stripe + USDT), not phantom wallet_transactions
        total_revenue = await _sum_revenue()
        monthly_revenue = await _sum_revenue(date_from_iso=month_start.isoformat())
        today_revenue = await _sum_revenue(date_from_iso=today_start.isoformat())

        # Numbers
        total_numbers = await db.user_numbers.count_documents({})
        active_numbers = await db.user_numbers.count_documents({"status": "active"})
        pool_available = await db.number_pool.count_documents({"assigned": {"$ne": True}})

        # Push subscriptions
        push_subs = await db.push_subscriptions.count_documents({"active": True})

        # Transaction COUNTS come from `transactions` (wallet activity log), not the phantom collection.
        # Tolerate both `created_at` and `timestamp` field names; both are stored as ISO strings.
        total_transactions = await db.transactions.count_documents({})
        today_transactions = await db.transactions.count_documents({
            "$or": [
                {"created_at": {"$gte": today_start.isoformat()}},
                {"timestamp": {"$gte": today_start.isoformat()}},
            ]
        })

        # Recent signups (last 7 days chart)
        signup_chart = []
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            count = await db.users.count_documents({
                "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
            })
            signup_chart.append({"date": day_start.strftime("%b %d"), "count": count})

        # Recent revenue chart (last 7 days) — REAL revenue from Stripe + USDT
        rev_chart = []
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            day_total = await _sum_revenue(
                date_from_iso=day_start.isoformat(),
                date_to_iso=day_end.isoformat(),
            )
            rev_chart.append({"date": day_start.strftime("%b %d"), "amount": day_total})

        return {
            "success": True,
            "users": {
                "total": total_users,
                "new_today": new_today,
                "active_week": active_week,
                "banned": banned_users,
                "verified": verified_users,
            },
            "revenue": {
                "total": total_revenue,
                "monthly": monthly_revenue,
                "today": today_revenue,
                "otp_today": await _sum_otp_revenue(date_from_iso=today_start.isoformat()),
                "otp_monthly": await _sum_otp_revenue(date_from_iso=month_start.isoformat()),
                "otp_total": await _sum_otp_revenue(),
            },
            "numbers": {
                "total_assigned": total_numbers,
                "active": active_numbers,
                "pool_available": pool_available,
            },
            "push": {
                "subscribers": push_subs,
            },
            "transactions": {
                "total": total_transactions,
                "today": today_transactions,
            },
            "charts": {
                "signups": signup_chart,
                "revenue": rev_chart,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard")


# ── USERS ────────────────────────────────────────────────────

@router.get("/users")
async def get_user_stats(current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        total = await db.users.count_documents({})
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        new_today = await db.users.count_documents({"created_at": {"$gte": today_start.isoformat()}})
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        active = await db.users.count_documents({"last_login": {"$gte": week_ago}})
        return {"success": True, "total": total, "new_today": new_today, "active": active}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/list")
async def get_users_list(
    limit: int = 100,
    skip: int = 0,
    current_user = Depends(get_current_user)
):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        users = await db.users.find(
            {},
            {"password": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        for u in users:
            u["id"] = str(u.get("_id", ""))
            u.pop("_id", None)
        total = await db.users.count_documents({})
        return {"success": True, "users": users, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/search")
async def search_users(
    q: str,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        # Strip phone prefix junk so +1 360 612 5992 == 13606125992
        digits_only = "".join(ch for ch in q if ch.isdigit())
        user_ids: set = set()

        # 1) Direct user-doc match (email/name/username)
        query = {"$or": [
            {"email": {"$regex": q, "$options": "i"}},
            {"full_name": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
        ]}
        users = await db.users.find(query, {"password": 0}).limit(limit).to_list(limit)

        # 2) Phone-number match → look up user_numbers and verification_orders
        if digits_only and len(digits_only) >= 6:
            phone_q = {"$or": [
                {"phone_number": {"$regex": digits_only}},
                {"number": {"$regex": digits_only}},
                {"phone": {"$regex": digits_only}},
            ]}
            for n in await db.user_numbers.find(phone_q).limit(limit).to_list(limit):
                if n.get("user_id"):
                    user_ids.add(n["user_id"])
            for o in await db.verification_orders.find(phone_q).limit(limit).to_list(limit):
                if o.get("user_id"):
                    user_ids.add(o["user_id"])

        # 3) Order-ID match (verification_orders + user_numbers)
        order_q = {"$or": [
            {"order_id": q},
            {"order_code": q},
            {"_id": q},
        ]}
        for o in await db.verification_orders.find(order_q).limit(limit).to_list(limit):
            if o.get("user_id"):
                user_ids.add(o["user_id"])
        for n in await db.user_numbers.find(order_q).limit(limit).to_list(limit):
            if n.get("user_id"):
                user_ids.add(n["user_id"])

        # 4) Resolve any extra user_ids found via numbers/orders
        if user_ids:
            existing = {(u.get("_id") or u.get("email")) for u in users}
            extras = await db.users.find(
                {"$or": [
                    {"_id": {"$in": list(user_ids)}},
                    {"email": {"$in": list(user_ids)}},
                    {"user_id": {"$in": list(user_ids)}},
                ]},
                {"password": 0}
            ).to_list(limit)
            for u in extras:
                key = u.get("_id") or u.get("email")
                if key not in existing:
                    users.append(u)
                    existing.add(key)

        for u in users:
            u["id"] = str(u.get("_id", ""))
            u.pop("_id", None)
        return {"success": True, "users": users}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        result = await db.users.update_one(
            {"$or": [{"user_id": user_id}, {"email": user_id}, {"_id": user_id}]},
            {"$set": {"banned": True, "banned_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "message": "User banned"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        result = await db.users.update_one(
            {"$or": [{"user_id": user_id}, {"email": user_id}, {"_id": user_id}]},
            {"$set": {"banned": False}, "$unset": {"banned_at": ""}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "message": "User unbanned"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/credits")
async def adjust_credits(
    user_id: str,
    body: CreditAdjust,
    current_user = Depends(get_current_user)
):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        user = await db.users.find_one(
            {"$or": [{"user_id": user_id}, {"email": user_id}, {"_id": user_id}]}
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # One inbound SMS = the number was used. Do not refund unless admin overrides.
        if body.amount > 0 and not body.force:
            from services.usage_guard import used_numbers_for_user
            used = await used_numbers_for_user(
                db, user.get("_id") or user_id, user.get("email") or ""
            )
            if used:
                bits = [
                    f"{u['phone']} ({u.get('sms', 0)} SMS"
                    + (f", {u['calls']} calls" if u.get("calls") else "")
                    + ")"
                    for u in used[:8]
                ]
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": (
                            "This account already used a number (SMS received). "
                            "Used numbers are not refundable. "
                            + "; ".join(bits)
                            + ". Override only for a genuine outage."
                        ),
                        "used_numbers": used,
                    },
                )
        current_balance = user.get("wallet_balance", 0)
        new_balance = round(current_balance + body.amount, 2)
        if new_balance < 0:
            raise HTTPException(status_code=400, detail="Balance cannot go negative")
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"wallet_balance": new_balance}}
        )
        tx_type = "admin_credit" if body.amount >= 0 else "admin_debit"
        # Write to canonical `transactions` collection so the activity shows in /transactions and user profile.
        await db.transactions.insert_one({
            "user_id": user.get("_id") or user_id,
            "type": tx_type,
            "category": "admin_adjustment",
            "amount": abs(body.amount),
            "balance_before": current_balance,
            "balance_after": new_balance,
            "description": body.reason,
            "admin_email": current_user.get("_id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "new_balance": new_balance, "message": f"Balance updated to ${new_balance}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}/verify")
async def force_verify_user(user_id: str, current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        result = await db.users.update_one(
            {"$or": [{"user_id": user_id}, {"email": user_id}, {"_id": user_id}]},
            {"$set": {"email_verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "message": "User verified"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        admin_email = current_user.get("_id") or current_user.get("email")
        if user_id in ADMIN_EMAILS:
            raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
        query = {"$or": [{"user_id": user_id}, {"email": user_id}, {"_id": user_id}]}
        # Resolve the user FIRST so numbers keyed by their canonical _id are
        # found even when deletion is addressed by email or legacy user_id.
        user_doc = await db.users.find_one(query)
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        canonical_id = user_doc.get("_id")
        # Release Telnyx numbers via the confirmed-release workflow and RETAIN
        # the records (expired/release_pending) — deleting them would orphan
        # numbers the provider may still be billing us for. Done BEFORE the
        # user row is deleted so a failure here leaves everything recoverable.
        try:
            from services.billing_jobs import release_user_numbers_for_account_deletion
            rel = await release_user_numbers_for_account_deletion(
                str(canonical_id), user_id_obj=canonical_id
            )
            if user_id != str(canonical_id):
                # Path param was an email / legacy id — sweep that keying too.
                rel2 = await release_user_numbers_for_account_deletion(user_id)
                rel = {k: rel[k] + rel2[k] for k in rel}
            logger.info(f"Admin user-delete {user_id}: numbers released={rel['released']} pending={rel['pending']}")
        except Exception as e:
            logger.error(f"Admin user-delete {user_id}: number release failed: {e}")
        result = await db.users.delete_one({"_id": canonical_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        # Clean up related data (number records are retained above)
        await db.push_subscriptions.delete_many({"user_id": user_id})
        await db.user_notifications.delete_many({"user_id": user_id})
        logger.info(f"Admin {admin_email} deleted user {user_id}")
        return {"success": True, "message": "User deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── TRANSACTIONS ─────────────────────────────────────────────

@router.get("/transactions")
async def get_transactions(
    limit: int = 100,
    skip: int = 0,
    current_user = Depends(get_current_user)
):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        # Wallet activity log (welcome credits, debits, admin adjustments) lives in `transactions`.
        transactions = await db.transactions.find(
            {}, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.transactions.count_documents({})
        return {"success": True, "transactions": transactions, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── NUMBERS ──────────────────────────────────────────────────

@router.get("/crypto/pending")
async def get_pending_crypto(limit: int = 100, current_user=Depends(get_current_user)):
    """Pending NOWPayments crypto orders (both direct and invoice-based) for admin reconciliation"""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    pending_statuses = ["waiting", "confirming", "partially_paid", "sending"]

    orders = await db.nowpayments.find(
        {"status": {"$in": pending_statuses}},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.nowpayments.count_documents({"status": {"$in": pending_statuses}})

    # Also include unprocessed invoice-based payments
    invoice_orders = await db.nowpayments_invoices.find(
        {"processed": False},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    invoice_total = await db.nowpayments_invoices.count_documents({"processed": False})

    return {
        "orders": orders,
        "total": total,
        "invoice_orders": invoice_orders,
        "invoice_total": invoice_total,
    }


@router.post("/crypto/{payment_id}/force-grant")
async def force_grant_crypto(payment_id: str, current_user=Depends(get_current_user)):
    """Admin force-credits a crypto payment to the user's wallet"""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    record = await db.nowpayments.find_one({"payment_id": payment_id})
    if not record:
        raise HTTPException(status_code=404, detail="Payment not found")
    if record.get("processed"):
        return {"ok": True, "msg": "Already processed/credited"}

    user_id = record.get("user_id") or ""
    if not user_id:
        raise HTTPException(status_code=400, detail="No user_id on record")

    # Use correct field names: credits_to_add (falls back to amount_usd)
    credits = float(record.get("credits_to_add") or record.get("amount_usd") or 0)
    if credits <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid credit amount: {credits}")

    pay_currency = record.get("pay_currency", "crypto")
    now = datetime.now(timezone.utc)

    await db.wallets.update_one(
        {"user_id": user_id}, {"$inc": {"balance": credits}}, upsert=True
    )
    await db.wallet_transactions.insert_one({
        "user_id": user_id,
        "type": "credit",
        "amount": credits,
        "description": f"Admin force-grant — crypto deposit ${credits:.2f} ({pay_currency.upper()})",
        "source": "nowpayments",
        "payment_method": pay_currency,
        "payment_id": payment_id,
        "created_at": now.isoformat(),
    })
    await db.nowpayments.update_one(
        {"payment_id": payment_id},
        {"$set": {
            "status": "finished",
            "processed": True,
            "processed_at": now.isoformat(),
            "force_granted_by": str(current_user.get("_id", "")),
        }}
    )
    logger.info(f"Admin force-granted ${credits} to {user_id} for payment {payment_id}")

    # Telegram alert
    try:
        from services.telegram_admin_alerts import notify_admins
        import asyncio as _a
        _a.create_task(notify_admins(
            f"🛠 Admin force-grant (crypto)\n"
            f"👤 {record.get('user_email', user_id)}\n"
            f"💰 +${credits:.2f} ({pay_currency.upper()})\n"
            f"🔑 {payment_id}",
            also_email=False,
        ))
    except Exception as _te:
        logger.warning(f"telegram alert failed (force-grant): {_te}")

    return {"ok": True, "user_id": user_id, "credits": credits}


@router.post("/crypto/run-reconciliation")
async def trigger_nowpayments_reconciliation(current_user=Depends(get_current_user)):
    """Trigger the NOWPayments reconciliation job immediately (admin only).

    Checks all unprocessed orders against the live NOWPayments API and credits
    any that are finished/confirmed but were missed by the IPN webhook.
    Also reconciles unprocessed invoice-based payments.
    Returns a summary of what was credited.
    """
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    import asyncio
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        _run_full_reconciliation_sync,
    )
    return result


def _run_full_reconciliation_sync() -> dict:
    """Synchronous reconciliation — runs in a thread pool so it doesn't block the event loop."""
    from services.nowpayments_recovery import run_nowpayments_reconciliation, run_nowpayments_invoice_reconciliation
    try:
        run_nowpayments_reconciliation()
    except Exception as e:
        logger.error(f"reconciliation job error: {e}")
    try:
        run_nowpayments_invoice_reconciliation()
    except Exception as e:
        logger.error(f"invoice reconciliation job error: {e}")
    return {"ok": True, "msg": "Reconciliation complete — check server logs for details"}


@router.get("/numbers")
async def get_all_numbers(
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        numbers = await db.user_numbers.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        total = await db.user_numbers.count_documents({})
        pool_total = await db.number_pool.count_documents({})
        pool_available = await db.number_pool.count_documents({"assigned": {"$ne": True}})
        return {
            "success": True,
            "numbers": numbers,
            "total": total,
            "pool_total": pool_total,
            "pool_available": pool_available
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── PUSH NOTIFICATIONS ───────────────────────────────────────

@router.get("/push/stats")
async def get_push_stats(current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        active_subs = await db.push_subscriptions.count_documents({"active": True})
        total_subs = await db.push_subscriptions.count_documents({})
        sent_count = await db.admin_push_broadcasts.count_documents({})
        recent = await db.admin_push_broadcasts.find({}, {"_id": 0}).sort("sent_at", -1).limit(20).to_list(20)
        return {
            "success": True,
            "active_subscribers": active_subs,
            "total_subscriptions": total_subs,
            "broadcasts_sent": sent_count,
            "recent_broadcasts": recent
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/push/broadcast")
async def broadcast_push_notification(
    payload: PushBroadcast,
    current_user = Depends(get_current_user)
):
    """Send a real Web Push notification to ALL active subscribers"""
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")

        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            raise HTTPException(status_code=500, detail="pywebpush not installed")

        VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
        VAPID_CLAIM_EMAIL = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@calliotel.com')

        if not VAPID_PRIVATE_KEY:
            raise HTTPException(status_code=500, detail="VAPID keys not configured")

        subscriptions = await db.push_subscriptions.find({"active": True}).to_list(10000)

        notification_data = json.dumps({
            "title": payload.title,
            "body": payload.body,
            "icon": payload.icon or "/calliotel-icon-192.png",
            "badge": "/calliotel-icon-192.png",
            "data": {"url": payload.url or "/"}
        })

        sent = 0
        failed = 0
        stale = []

        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}
                    },
                    data=notification_data,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_CLAIM_EMAIL}
                )
                sent += 1
            except Exception as e:
                failed += 1
                err_str = str(e)
                if "410" in err_str or "404" in err_str:
                    stale.append(sub["_id"])

        if stale:
            await db.push_subscriptions.update_many(
                {"_id": {"$in": stale}},
                {"$set": {"active": False}}
            )

        admin_email = current_user.get("_id") or current_user.get("email")
        await db.admin_push_broadcasts.insert_one({
            "title": payload.title,
            "body": payload.body,
            "url": payload.url,
            "sent_by": admin_email,
            "sent_count": sent,
            "failed_count": failed,
            "sent_at": datetime.now(timezone.utc).isoformat()
        })

        return {
            "success": True,
            "sent": sent,
            "failed": failed,
            "stale_removed": len(stale),
            "message": f"Push sent to {sent} devices"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Push broadcast error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── IN-APP BROADCAST ─────────────────────────────────────────

@router.post("/broadcast")
async def send_broadcast(
    broadcast: BroadcastCreate,
    current_user = Depends(get_current_user)
):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        notification_id = str(uuid4())
        sender_email = current_user.get("_id") or current_user.get("email")
        sender_name = current_user.get("full_name") or sender_email
        notification = {
            "id": notification_id,
            "title": broadcast.title,
            "message": broadcast.message,
            "sent_by": sender_email,
            "sent_by_name": sender_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        users = await db.users.find({}, {"_id": 1}).to_list(10000)
        if users:
            await db.user_notifications.insert_many([
                {
                    "notification_id": notification_id,
                    "user_id": u["_id"],
                    "is_read": False,
                    "is_deleted": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                for u in users
            ])
        return {"success": True, "message": f"In-app notification sent to {len(users)} users", "notification_id": notification_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── CONTENT ──────────────────────────────────────────────────

@router.get("/videos")
async def get_video_stats(current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        total = await db.video_messages.count_documents({})
        pipeline = [{"$group": {"_id": None, "total_views": {"$sum": "$total_views"}}}]
        result = await db.video_messages.aggregate(pipeline).to_list(1)
        total_views = result[0]["total_views"] if result else 0
        total_reactions = await db.video_reactions.count_documents({})
        return {"success": True, "total": total, "total_views": total_views, "total_reactions": total_reactions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue")
async def get_revenue_stats(current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        total_revenue = await _sum_revenue()
        monthly_revenue = await _sum_revenue(date_from_iso=month_start.isoformat())
        premium_users = await db.users.count_documents({"premium_story_empire": True})
        return {"success": True, "total": total_revenue, "monthly": monthly_revenue, "premium_users": premium_users}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/content/recent")
async def get_recent_content(limit: int = 20, current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        videos = await db.video_messages.find({}, {"_id": 0}).sort("sent_at", -1).limit(limit).to_list(limit)
        return {"success": True, "videos": videos}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/content/{content_id}/delete")
async def delete_content(content_id: str, current_user = Depends(get_current_user)):
    try:
        if not await is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required")
        result = await db.video_messages.delete_one({"message_id": content_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Content not found")
        await db.video_reactions.delete_many({"video_id": content_id})
        await db.video_views.delete_many({"video_id": content_id})
        return {"success": True, "message": "Content deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# V2 SUPER-ADMIN ENDPOINTS — full visibility for the dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/user/{user_id}/profile")
async def get_user_full_profile(user_id: str, current_user = Depends(get_current_user)):
    """Single comprehensive view for one customer — everything we know."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one(
        {"$or": [{"_id": user_id}, {"email": user_id}, {"client_id": user_id}, {"user_id": user_id}]},
        {"password": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    uid = user.get("_id") or user.get("email")
    wallet = await db.wallets.find_one({"user_id": uid}) or {}
    # Wallet activity log lives in `transactions` (created_at field). Tolerate timestamp too.
    txs = await db.transactions.find(
        {"user_id": uid},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    numbers = await db.user_numbers.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    # Lifetime spend = REAL money this user paid (Stripe)
    spend_pipeline = [
        {"$match": {
            "user_id": uid,
            "$or": [
                {"status": {"$in": list(PAID_STATUSES)}},
                {"payment_status": {"$in": list(PAID_STATUSES)}},
            ],
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    spend_res = await db.payment_transactions.aggregate(spend_pipeline).to_list(1)
    lifetime_spend = round(spend_res[0]["total"], 2) if spend_res else 0
    purchase_count = spend_res[0]["count"] if spend_res else 0
    user["id"] = str(user.get("_id", ""))
    user.pop("_id", None)
    return {
        "success": True,
        "user": user,
        "wallet": {"balance": wallet.get("balance", 0.0)},
        "lifetime_spend": lifetime_spend,
        "purchase_count": purchase_count,
        "transactions": txs,
        "numbers": numbers,
        "number_count": len(numbers),
    }


@router.get("/traffic")
async def get_traffic_breakdown(current_user = Depends(get_current_user)):
    """UTM source / referrer breakdown — where do paying users come from?"""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Signups by source
    src_pipeline = [
        {"$group": {
            "_id": {"$ifNull": ["$utm_source", "direct"]},
            "signups": {"$sum": 1},
            "verified": {"$sum": {"$cond": [{"$eq": ["$email_verified", True]}, 1, 0]}},
        }},
        {"$sort": {"signups": -1}},
        {"$limit": 25},
    ]
    by_source = await db.users.aggregate(src_pipeline).to_list(25)

    # Signups by medium
    med_pipeline = [
        {"$group": {"_id": {"$ifNull": ["$utm_medium", "(none)"]}, "signups": {"$sum": 1}}},
        {"$sort": {"signups": -1}},
        {"$limit": 15},
    ]
    by_medium = await db.users.aggregate(med_pipeline).to_list(15)

    # Auth-provider breakdown (email vs google vs telegram)
    auth_pipeline = [
        {"$group": {"_id": {"$ifNull": ["$auth_provider", "email"]}, "signups": {"$sum": 1}}},
        {"$sort": {"signups": -1}},
    ]
    by_provider = await db.users.aggregate(auth_pipeline).to_list(10)

    # Top landing pages
    lp_pipeline = [
        {"$match": {"landing_page": {"$ne": None}}},
        {"$group": {"_id": "$landing_page", "signups": {"$sum": 1}}},
        {"$sort": {"signups": -1}},
        {"$limit": 10},
    ]
    landing_pages = await db.users.aggregate(lp_pipeline).to_list(10)

    return {
        "success": True,
        "by_source": [{"source": (r["_id"] or "direct"), "signups": r["signups"], "verified": r.get("verified", 0)} for r in by_source],
        "by_medium": [{"medium": (r["_id"] or "(none)"), "signups": r["signups"]} for r in by_medium],
        "by_provider": [{"provider": (r["_id"] or "email"), "signups": r["signups"]} for r in by_provider],
        "landing_pages": [{"page": r["_id"], "signups": r["signups"]} for r in landing_pages],
    }


@router.get("/top-customers")
async def get_top_customers(limit: int = 10, current_user = Depends(get_current_user)):
    """Top spenders — lifetime revenue per user."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    # Top spenders = sum of REAL paid Stripe amounts per user.
    pipeline_stripe = [
        {"$match": {"$or": [
            {"status": {"$in": list(PAID_STATUSES)}},
            {"payment_status": {"$in": list(PAID_STATUSES)}},
        ]}},
        {"$group": {"_id": "$user_id", "spend": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    stripe_rows = await db.payment_transactions.aggregate(pipeline_stripe).to_list(1000)

    merged: dict = {}
    for r in stripe_rows:
        uid = r["_id"]
        if not uid:
            continue
        m = merged.setdefault(uid, {"spend": 0.0, "count": 0})
        m["spend"] += float(r.get("spend") or 0)
        m["count"] += int(r.get("count") or 0)

    top = sorted(merged.items(), key=lambda kv: kv[1]["spend"], reverse=True)[:limit]
    out = []
    for uid, agg in top:
        u = await db.users.find_one({"$or": [{"_id": uid}, {"email": uid}]}, {"password": 0}) or {}
        out.append({
            "user_id": uid,
            "email": u.get("email", uid),
            "full_name": u.get("full_name"),
            "profile_picture": u.get("profile_picture"),
            "lifetime_spend": round(agg["spend"], 2),
            "purchase_count": agg["count"],
        })
    return {"success": True, "top_customers": out}


@router.get("/recent-orders")
async def get_recent_orders(limit: int = 25, current_user = Depends(get_current_user)):
    """Most recent purchase transactions enriched with customer info."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    # Pull recent paid Stripe orders.
    stripe_txs = await db.payment_transactions.find(
        {"$or": [
            {"status": {"$in": list(PAID_STATUSES)}},
            {"payment_status": {"$in": list(PAID_STATUSES)}},
        ]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    for t in stripe_txs:
        t["source"] = "stripe"
        t["timestamp"] = t.get("completed_at") or t.get("created_at")

    enriched = []
    cache: dict = {}
    for t in stripe_txs:
        uid = t.get("user_id")
        if uid not in cache:
            u = await db.users.find_one({"$or": [{"_id": uid}, {"email": uid}]}, {"password": 0, "_id": 0}) or {}
            cache[uid] = {"email": u.get("email", uid), "full_name": u.get("full_name"), "profile_picture": u.get("profile_picture")}
        enriched.append({**t, "customer": cache[uid]})
    return {"success": True, "orders": enriched}


# ── DUPLICATE-ACCOUNT DETECTION ────────────────────────────────────────────
@router.get("/duplicate-accounts")
async def list_duplicate_accounts(
    days: int = 30,
    min_count: int = 2,
    current_user = Depends(get_current_user)
):
    """List IP-clusters with multiple signups (likely same person, different emails)."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"signup_ip": {"$nin": [None, ""]}, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$signup_ip",
            "count": {"$sum": 1},
            "emails": {"$push": {"email": "$email", "full_name": "$full_name", "created_at": "$created_at",
                                  "client_id": "$client_id", "verified": "$email_verified",
                                  "user_agent": "$signup_user_agent"}}
        }},
        {"$match": {"count": {"$gte": min_count}}},
        {"$sort": {"count": -1}},
        {"$limit": 100}
    ]
    clusters = await db.users.aggregate(pipeline).to_list(100)
    return {"success": True, "days": days, "clusters": [
        {"ip": c["_id"], "count": c["count"], "accounts": sorted(c["emails"], key=lambda x: x.get("created_at", ""), reverse=True)}
        for c in clusters
    ]}


@router.post("/winback/run-now")
async def trigger_winback(current_user = Depends(get_current_user)):
    """Manually fire the winback email job (also runs daily 11:30 UTC)."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    from services.winback_email import run_winback
    result = await run_winback()
    return {"success": True, "result": result}


# ── CAMPAIGN BLAST ────────────────────────────────────────────────────────────

class CampaignBlastRequest(BaseModel):
    hours_until_launch: int = 48   # 48 or 72
    dry_run: bool = False           # True = count only, no sends


def _esim_email_html(username: str, hours: int, referral_link: str) -> str:
    name = username or "there"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Big News from Calliotel</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
        <img src="https://calliotel.com/calliotel-icon-192.png" width="64" height="64"
             style="border-radius:16px;margin-bottom:16px;" alt="Calliotel">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
          Something Big Is Coming
        </h1>
        <p style="margin:12px 0 0;color:#c4b5fd;font-size:16px;">
          In just <strong style="color:#fff;">{hours} hours</strong> — Calliotel goes next-level
        </p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#1e293b;padding:40px;">
        <p style="margin:0 0 20px;color:#94a3b8;font-size:16px;line-height:1.6;">
          Hey <strong style="color:#f1f5f9;">{name}</strong>,
        </p>
        <p style="margin:0 0 28px;color:#cbd5e1;font-size:16px;line-height:1.6;">
          We're about to launch two features our users have been asking for since day one:
        </p>

        <!-- Feature cards -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td width="48%" style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:24px;text-align:center;vertical-align:top;">
              <div style="font-size:36px;margin-bottom:12px;">📱</div>
              <h3 style="margin:0 0 8px;color:#f1f5f9;font-size:18px;font-weight:700;">eSIM Support</h3>
              <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.5;">
                Activate your virtual number instantly — no physical SIM, no waiting. Works on any eSIM-capable device.
              </p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:24px;text-align:center;vertical-align:top;">
              <div style="font-size:36px;margin-bottom:12px;">⚡</div>
              <h3 style="margin:0 0 8px;color:#f1f5f9;font-size:18px;font-weight:700;">5G Networks</h3>
              <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.5;">
                Blazing-fast 5G connectivity for your virtual numbers. Crystal clear calls, instant SMS.
              </p>
            </td>
          </tr>
        </table>

        <!-- Referral CTA -->
        <div style="background:linear-gradient(135deg,#1e40af20,#7c3aed20);border:1px solid #6d28d9;border-radius:12px;padding:28px;margin-bottom:32px;text-align:center;">
          <h3 style="margin:0 0 8px;color:#a78bfa;font-size:20px;font-weight:700;">
            Refer a Friend — Earn Together
          </h3>
          <p style="margin:0 0 20px;color:#cbd5e1;font-size:15px;line-height:1.6;">
            Share Calliotel with friends <strong style="color:#f1f5f9;">before the launch</strong> and earn
            <strong style="color:#fbbf24;">20% lifetime commission</strong> on everything they spend.
            The earlier you refer, the more you earn.
          </p>
          <a href="{referral_link}"
             style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#2563eb);color:#ffffff;
                    font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;
                    border-radius:8px;letter-spacing:0.3px;">
            Share My Referral Link →
          </a>
          <p style="margin:16px 0 0;color:#64748b;font-size:13px;">
            Your link: <a href="{referral_link}" style="color:#818cf8;">{referral_link}</a>
          </p>
        </div>

        <!-- What's included -->
        <h3 style="margin:0 0 16px;color:#f1f5f9;font-size:17px;">What's included at launch:</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          {"".join(f'<tr><td style="padding:8px 0;color:#cbd5e1;font-size:15px;border-bottom:1px solid #1e293b;">✅ &nbsp;{item}</td></tr>' for item in [
            "eSIM activation for US, CA, GB, NL, SE numbers",
            "5G-ready virtual numbers",
            "Exclusive launch pricing for existing users",
            "Keep your existing numbers — no migration needed",
            "Same great SMS + call forwarding you already love",
          ])}
        </table>
      </td></tr>

      <!-- CTA footer -->
      <tr><td style="background:#0f172a;border-radius:0 0 16px 16px;padding:32px 40px;text-align:center;border-top:1px solid #1e293b;">
        <p style="margin:0 0 20px;color:#64748b;font-size:14px;">
          You're receiving this because you have a Calliotel account.<br>
          Launch drops in <strong style="color:#f1f5f9;">{hours} hours</strong> — stay tuned.
        </p>
        <a href="https://calliotel.com"
           style="display:inline-block;background:#1e293b;color:#a78bfa;font-size:14px;
                  text-decoration:none;padding:10px 24px;border-radius:6px;border:1px solid #334155;">
          Open Calliotel →
        </a>
        <p style="margin:20px 0 0;color:#334155;font-size:12px;">
          © 2026 Calliotel · <a href="https://calliotel.com" style="color:#475569;">calliotel.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""


def _esim_email_text(username: str, hours: int, referral_link: str) -> str:
    name = username or "there"
    return f"""Hey {name},

Big news — in {hours} hours Calliotel is launching eSIM Support and 5G Networks.

eSIM: Activate your virtual number instantly, no physical SIM needed.
5G: Blazing-fast connectivity for clearer calls and instant SMS.

REFER A FRIEND BEFORE LAUNCH
Earn 20% lifetime commission on everything your friends spend.
Your referral link: {referral_link}

What's included at launch:
- eSIM activation for US, CA, GB, NL, SE numbers
- 5G-ready virtual numbers
- Exclusive launch pricing for existing users
- Keep your existing numbers — no migration needed

See you at launch → https://calliotel.com

— The Calliotel Team
"""


@router.post("/campaigns/esim-blast")
async def send_esim_campaign(
    req: CampaignBlastRequest,
    current_user = Depends(get_current_user)
):
    """
    Admin-only: Send eSIM & 5G launch campaign.
    - Push notification to all active subscribers
    - In-app notification to all users
    - Personalized email to all verified users (with referral link)
    """
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    hours = req.hours_until_launch
    results = {"push": 0, "push_failed": 0, "email": 0, "email_failed": 0,
               "inapp": 0, "dry_run": req.dry_run}

    # ── 1. PUSH NOTIFICATION ─────────────────────────────────────────────────
    import json as _json
    from pywebpush import webpush, WebPushException
    import os as _os

    vapid_private = _os.environ.get("VAPID_PRIVATE_KEY", "")
    vapid_claim   = _os.environ.get("VAPID_CLAIM_EMAIL", "mailto:admin@calliotel.com")

    push_subs = await db.push_subscriptions.find({"active": True}).to_list(10000)
    push_payload = _json.dumps({
        "title": f"🚀 eSIM & 5G Launching in {hours}h",
        "body": "Calliotel is going next-level. Refer a friend & earn 20% lifetime!",
        "icon": "/calliotel-icon-192.png",
        "badge": "/calliotel-icon-192.png",
        "data": {"url": "https://calliotel.com"}
    })

    if not req.dry_run:
        for sub in push_subs:
            try:
                webpush(
                    subscription_info={"endpoint": sub["endpoint"],
                                       "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                    data=push_payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": vapid_claim}
                )
                results["push"] += 1
            except WebPushException as e:
                results["push_failed"] += 1
                if e.response and e.response.status_code in [404, 410]:
                    await db.push_subscriptions.update_one(
                        {"_id": sub["_id"]}, {"$set": {"active": False}}
                    )
            except Exception:
                results["push_failed"] += 1
    else:
        results["push"] = len(push_subs)

    # ── 2. IN-APP NOTIFICATION ────────────────────────────────────────────────
    notif_id = str(uuid4())
    notif_doc = {
        "id": notif_id,
        "title": f"🚀 eSIM & 5G launching in {hours} hours!",
        "message": (f"We're adding eSIM support and 5G networks in {hours} hours. "
                    "Refer friends now and earn 20% lifetime commission on their spending!"),
        "sent_by": "system",
        "sent_by_name": "Calliotel",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    all_users = await db.users.find({}, {"_id": 1}).to_list(10000)
    if not req.dry_run and all_users:
        await db.notifications.insert_one(notif_doc)
        await db.user_notifications.insert_many([
            {"notification_id": notif_id, "user_id": u["_id"],
             "is_read": False, "is_deleted": False,
             "created_at": datetime.now(timezone.utc).isoformat()}
            for u in all_users
        ])
    results["inapp"] = len(all_users)

    # ── 3. EMAIL BLAST ────────────────────────────────────────────────────────
    import asyncio as _asyncio
    from services.resend_service import send_email

    verified_users = await db.users.find(
        {"email_verified": True, "email": {"$exists": True, "$ne": ""}},
        {"_id": 0, "email": 1, "username": 1, "full_name": 1, "referral_code": 1, "client_id": 1}
    ).to_list(10000)

    subject = f"Calliotel is launching eSIM & 5G in {hours} hours"

    for user in verified_users:
        # Build referral link — generate code on-the-fly if missing
        ref_code = user.get("referral_code") or ""
        if not ref_code:
            cid = user.get("client_id", user.get("email", ""))
            import hashlib, base64
            ref_code = base64.urlsafe_b64encode(
                hashlib.md5(cid.encode()).digest()
            )[:8].decode()

        referral_link = f"https://calliotel.com/signup?ref={ref_code}"
        username = user.get("username") or user.get("full_name") or user.get("email", "").split("@")[0]
        html = _esim_email_html(username, hours, referral_link)
        txt  = _esim_email_text(username, hours, referral_link)

        if not req.dry_run:
            ok = await send_email(user["email"], subject, html, txt)
            if ok:
                results["email"] += 1
            else:
                results["email_failed"] += 1
            await _asyncio.sleep(0.6)   # ~100/min — safe for Resend
        else:
            results["email"] += 1

    logger.info(f"eSIM campaign blast: push={results['push']} email={results['email']} inapp={results['inapp']}")
    return {
        "success": True,
        "hours_until_launch": hours,
        "dry_run": req.dry_run,
        "results": results
    }


# ─── EMAIL BROADCAST ────────────────────────────────────────────────────────

class EmailBroadcastRequest(BaseModel):
    subject: str
    body: str
    dry_run: bool = False


@router.post("/email/broadcast")
async def email_broadcast(req: EmailBroadcastRequest, current_user=Depends(get_current_user)):
    """Send a one-off email to ALL registered users (admins only)."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    if not req.subject.strip() or not req.body.strip():
        raise HTTPException(status_code=400, detail="Subject and body required")

    from services.resend_service import send_email as _send_email

    # Fetch all users with an email address
    users = await db.users.find(
        {"email": {"$exists": True, "$ne": ""}},
        {"email": 1, "full_name": 1, "_id": 1}
    ).to_list(50000)

    sent = 0
    failed = 0

    for u in users:
        email_addr = u.get("email") or u.get("_id", "")
        if "@" not in email_addr:
            continue
        name = u.get("full_name") or email_addr.split("@")[0]
        personalised = req.body.replace("[first name]", name).replace("[name]", name)
        html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  {personalised}
  <br><br>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <small style="color:#888">
    You're receiving this because you have a Calliotel account.<br>
    <a href="https://calliotel.com">calliotel.com</a>
  </small>
</div>"""
        if not req.dry_run:
            try:
                ok = await _send_email(email_addr, req.subject, html)
                if ok:
                    sent += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
            import asyncio as _aio
            await _aio.sleep(0.6)   # ~100/min — Resend rate limit
        else:
            sent += 1

    logger.info(f"Email broadcast: subject='{req.subject}' sent={sent} failed={failed} dry_run={req.dry_run}")
    return {"success": True, "sent": sent, "failed": failed, "dry_run": req.dry_run, "total_users": len(users)}


# ─────────────────────────────────────────────────────────────────────────────
# MARGIN REPORT — revenue vs Telnyx provider cost per destination country.
#
# Provider cost is captured asynchronously (services/provider_cost.py) on
# each outbound SMS / billed call. Records missing a cost show up in
# `missing_cost_count`; POST /margin-report/backfill re-fetches them from
# Telnyx on demand. Coverage limit: pre-feature SMS can be backfilled by
# message id, but pre-feature calls stored no Telnyx correlation id and can
# never be costed — call margin data is only complete from rollout onward.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/margin-report")
async def get_margin_report(days: int = 30, current_user = Depends(get_current_user)):
    """Revenue vs provider cost for SMS + calls, broken down by destination country."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    from utils.dial_codes import country_for_number
    from routes.wallet import SMS_COST_US, SMS_COST_INTL, CALL_COST_PER_MINUTE

    days = max(1, min(days, 365))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    def _bucket():
        return {
            "count": 0, "revenue": 0.0,
            "provider_cost": 0.0, "costed_count": 0, "costed_revenue": 0.0,
            "missing_cost_count": 0,
        }

    countries: dict = {}

    def _add(country: str, kind: str, revenue: float, provider_cost):
        c = countries.setdefault(country, {"sms": _bucket(), "calls": _bucket()})
        b = c[kind]
        b["count"] += 1
        b["revenue"] += revenue
        if provider_cost is not None:
            b["provider_cost"] += float(provider_cost)
            b["costed_count"] += 1
            b["costed_revenue"] += revenue
        else:
            b["missing_cost_count"] += 1

    # ── SMS (outbound only — inbound is free to the customer) ──
    cursor = db.sms_messages.find(
        {"direction": "outbound", "created_at": {"$gte": cutoff}},
        {"to_number": 1, "cost": 1, "provider_cost": 1, "destination_country": 1},
    )
    async for m in cursor:
        country = m.get("destination_country") or country_for_number(m.get("to_number", ""))
        _add(country, "sms", float(m.get("cost") or 0), m.get("provider_cost"))

    # ── Calls (only ones we billed) ──
    cursor = db.voice_calls.find(
        {"created_at": {"$gte": cutoff}, "cost": {"$gt": 0}},
        {"to_number": 1, "cost": 1, "provider_cost": 1, "destination_country": 1},
    )
    async for c in cursor:
        country = c.get("destination_country") or country_for_number(c.get("to_number", ""))
        _add(country, "calls", float(c.get("cost") or 0), c.get("provider_cost"))

    rows = []
    for country, data in countries.items():
        revenue = data["sms"]["revenue"] + data["calls"]["revenue"]
        provider_cost = data["sms"]["provider_cost"] + data["calls"]["provider_cost"]
        costed_revenue = data["sms"]["costed_revenue"] + data["calls"]["costed_revenue"]
        # Margin compares like with like: only records where we KNOW the
        # provider cost. Mixing in un-costed revenue would overstate margin.
        margin = costed_revenue - provider_cost
        # Below-cost flag: average provider cost per SMS exceeds the price
        # charged for that destination (per-unit, so partial cost coverage
        # still gives a fair signal).
        sms_avg_cost = (
            data["sms"]["provider_cost"] / data["sms"]["costed_count"]
            if data["sms"]["costed_count"] else None
        )
        sms_price = SMS_COST_US if country == "US/CA" else SMS_COST_INTL
        below_cost = bool(sms_avg_cost is not None and sms_avg_cost > sms_price)
        rows.append({
            "country": country,
            "revenue": round(revenue, 4),
            "provider_cost": round(provider_cost, 4),
            "margin": round(margin, 4),
            "margin_pct": round(margin / costed_revenue * 100, 1) if costed_revenue else None,
            "below_cost": below_cost,
            "sms": {
                "count": data["sms"]["count"],
                "revenue": round(data["sms"]["revenue"], 4),
                "provider_cost": round(data["sms"]["provider_cost"], 4),
                "avg_provider_cost": round(sms_avg_cost, 5) if sms_avg_cost is not None else None,
                "price_charged": sms_price,
                "missing_cost_count": data["sms"]["missing_cost_count"],
            },
            "calls": {
                "count": data["calls"]["count"],
                "revenue": round(data["calls"]["revenue"], 4),
                "provider_cost": round(data["calls"]["provider_cost"], 4),
                "missing_cost_count": data["calls"]["missing_cost_count"],
            },
        })

    # Loss-makers first, then biggest revenue.
    rows.sort(key=lambda r: (not r["below_cost"], -r["revenue"]))

    return {
        "days": days,
        "since": cutoff,
        "pricing": {
            "sms_us": SMS_COST_US,
            "sms_intl": SMS_COST_INTL,
            "call_per_minute": CALL_COST_PER_MINUTE,
        },
        "countries": rows,
        "below_cost_countries": [r["country"] for r in rows if r["below_cost"]],
        "totals": {
            "revenue": round(sum(r["revenue"] for r in rows), 4),
            "provider_cost": round(sum(r["provider_cost"] for r in rows), 4),
            "margin": round(sum(r["margin"] for r in rows), 4),
            "missing_cost_count": sum(
                r["sms"]["missing_cost_count"] + r["calls"]["missing_cost_count"] for r in rows
            ),
        },
    }


@router.post("/margin-report/backfill")
async def backfill_margin_costs(days: int = 30, limit: int = 200, current_user = Depends(get_current_user)):
    """Re-fetch provider costs for recent records that are still missing one."""
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    from services.provider_cost import backfill_missing_costs
    days = max(1, min(days, 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = await backfill_missing_costs(since, limit=max(1, min(limit, 1000)))
    return {"success": True, "since": since, **result}
