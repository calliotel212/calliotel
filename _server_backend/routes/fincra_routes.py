"""Fincra Naira checkout — wallet top-up. Optional router: missing keys must not take down auth.

Env (sandbox first):
  FINCRA_SECRET_KEY
  FINCRA_PUBLIC_KEY
  FINCRA_BUSINESS_ID
  FINCRA_WEBHOOK_KEY
  FINCRA_BASE_URL   default https://sandboxapi.fincra.com  (live: https://api.fincra.com)
  FINCRA_NGN_PER_USD  optional override if FX fetch fails
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import db
try:
    from routes.auth_deps import get_current_user
except Exception:  # pragma: no cover
    from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

FINCRA_SECRET = os.environ.get("FINCRA_SECRET_KEY", "").strip()
FINCRA_PUBLIC = os.environ.get("FINCRA_PUBLIC_KEY", "").strip()
FINCRA_BUSINESS_ID = os.environ.get("FINCRA_BUSINESS_ID", "").strip()
FINCRA_WEBHOOK_KEY = os.environ.get("FINCRA_WEBHOOK_KEY", "").strip()
FINCRA_BASE = (os.environ.get("FINCRA_BASE_URL") or "https://sandboxapi.fincra.com").rstrip("/")
_business_id_cache = FINCRA_BUSINESS_ID

MIN_USD = 2.0
MAX_USD = 50.0
FX_FALLBACK = float(os.environ.get("FINCRA_NGN_PER_USD") or 1550)
FX_BUFFER = 1.03  # small pad so NGN devaluation does not undercharge
_fx_cache: dict = {"rate": 0.0, "at": 0.0}

SUCCESS_EVENTS = {"charge.successful", "collection.successful"}
SUCCESS_STATUSES = {"success", "successful", "paid", "completed"}


class CreateBody(BaseModel):
    amount: float


def _enabled() -> bool:
    return bool(FINCRA_SECRET and FINCRA_PUBLIC)


def _frontend() -> str:
    return (os.environ.get("FRONTEND_URL") or os.environ.get("PUBLIC_BASE_URL") or "https://calliotel.com").rstrip("/")


async def _resolve_business_id() -> str:
    """Env first. Else Fincra profile — dashboard often hides this hex id."""
    global _business_id_cache
    if _business_id_cache:
        return _business_id_cache
    if not FINCRA_SECRET:
        return ""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{FINCRA_BASE}/profile/business/me",
                headers={"accept": "application/json", "api-key": FINCRA_SECRET, "x-pub-key": FINCRA_PUBLIC},
            )
        data = r.json() if r.content else {}
        inner = data.get("data") if isinstance(data.get("data"), dict) else {}
        bid = str(inner.get("_id") or (inner.get("business") or {}).get("id") or "").strip()
        if bid:
            _business_id_cache = bid
            logger.info("Fincra business id resolved from profile")
            return bid
    except Exception as e:
        logger.warning("Fincra business id lookup failed: %s", e)
    return ""


async def _headers() -> dict:
    h = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": FINCRA_SECRET,
        "x-pub-key": FINCRA_PUBLIC,
    }
    bid = await _resolve_business_id()
    if bid:
        h["x-business-id"] = bid
    return h


async def _ngn_per_usd() -> float:
    now = time.time()
    if _fx_cache["rate"] and now - _fx_cache["at"] < 3600:
        return _fx_cache["rate"]
    rate = FX_FALLBACK
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://open.er-api.com/v6/latest/USD")
            data = r.json() if r.content else {}
            n = float((data.get("rates") or {}).get("NGN") or 0)
            if n > 100:
                rate = n
    except Exception as e:
        logger.warning("Fincra FX fetch failed, using %s: %s", rate, e)
    _fx_cache["rate"] = rate
    _fx_cache["at"] = now
    return rate


def _ngn_amount(usd: float, rate: float) -> int:
    return max(1, int(round(float(usd) * rate * FX_BUFFER)))


def _hmac_hex(raw: bytes) -> str:
    return hmac.new(FINCRA_WEBHOOK_KEY.encode("utf-8"), raw, hashlib.sha512).hexdigest()


def _signature_ok(raw: bytes, request: Request, payload: dict) -> bool:
    if not FINCRA_WEBHOOK_KEY:
        return False
    got = (
        request.headers.get("signature")
        or request.headers.get("Signature")
        or request.headers.get("x-fincra-signature")
        or ""
    ).strip().lower()
    if not got:
        return False
    candidates = [_hmac_hex(raw)]
    try:
        compact = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        candidates.append(_hmac_hex(compact))
    except Exception:
        pass
    return any(hmac.compare_digest(got, c.lower()) for c in candidates if c)


async def _verify_checkout(merchant_ref: str) -> dict | None:
    url = f"{FINCRA_BASE}/checkout/payments/merchant-reference/{merchant_ref}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=await _headers())
        data = r.json() if r.content else {}
    except Exception as e:
        logger.warning("Fincra verify failed for %s: %s", merchant_ref, e)
        return None
    if not isinstance(data, dict):
        return None
    inner = data.get("data") if isinstance(data.get("data"), dict) else data
    return inner if isinstance(inner, dict) else None


def _is_paid(doc: dict) -> bool:
    status = str(doc.get("status") or "").lower()
    if status not in SUCCESS_STATUSES:
        return False
    if str(doc.get("varianceType") or "").lower() == "underpayment":
        return False
    return True


async def _credit(record: dict, fincra_ref: str) -> bool:
    order_id = record["order_id"]
    claimed = await db.fincra_payments.find_one_and_update(
        {"order_id": order_id, "status": "pending"},
        {"$set": {
            "status": "completed",
            "fincra_reference": fincra_ref,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if not claimed:
        return False
    user_id = claimed["user_id"]
    amount_usd = float(claimed["amount_usd"])
    now = datetime.now(timezone.utc)
    from services.paid_funds import record_paid_topup
    await record_paid_topup(db, user_id, amount_usd)
    wallet = await db.wallets.find_one({"user_id": user_id})
    new_balance = float((wallet or {}).get("balance", amount_usd))
    tx_doc = {
        "user_id": user_id,
        "amount": amount_usd,
        "type": "credit",
        "description": f"Naira payment — ${amount_usd:.2f}",
        "source": "fincra",
        "payment_method": "fincra",
        "payment_id": fincra_ref or order_id,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(dict(tx_doc))
    await db.transactions.insert_one(dict(tx_doc))
    logger.info("Fincra credited $%s to %s | %s", amount_usd, claimed.get("email"), order_id)
    try:
        from services.transaction_emails import send_topup_receipt
        send_topup_receipt(
            email=claimed.get("email") or "",
            name="",
            amount=amount_usd,
            method="Naira (Fincra)",
            new_balance=new_balance,
            order_code=order_id,
        )
    except Exception as e:
        logger.warning("Fincra receipt email failed: %s", e)
    try:
        from services.telegram_admin_alerts import notify_admins
        await notify_admins(
            f"🇳🇬 Naira payment received\n"
            f"💰 Amount: ${amount_usd:.2f}\n"
            f"👤 User: {claimed.get('email')}\n"
            f"🆔 Order: {order_id}\n"
            f"✅ Wallet credited",
            also_email=False,
        )
    except Exception as e:
        logger.warning("Fincra telegram alert failed: %s", e)
    try:
        from routes.push_notifications import send_push_notification, NotificationPayload
        await send_push_notification(
            user_id,
            NotificationPayload(
                title="Balance added",
                body=f"${amount_usd:.2f} has been added to your Calliotel wallet.",
                icon="/icon-192.png",
                data={"type": "balance_added", "amount": amount_usd},
            ),
        )
    except Exception as e:
        logger.warning("Fincra push failed: %s", e)
    return True


async def _credit_if_paid(order_id: str) -> dict:
    record = await db.fincra_payments.find_one({"order_id": order_id})
    if not record:
        raise HTTPException(404, "Payment not found")
    if record.get("status") == "completed":
        return {"ok": True, "credited": False, "status": "completed", "duplicate": True}
    verified = await _verify_checkout(order_id)
    if not verified or not _is_paid(verified):
        return {"ok": True, "credited": False, "status": (verified or {}).get("status") or "pending"}
    fincra_ref = str(verified.get("reference") or verified.get("merchantReference") or order_id)
    credited = await _credit(record, fincra_ref)
    return {"ok": True, "credited": credited, "status": "completed"}


@router.get("/config")
async def fincra_config():
    rate = 0.0
    if _enabled():
        try:
            rate = await _ngn_per_usd()
        except Exception:
            rate = FX_FALLBACK
    return {
        "enabled": _enabled(),
        "currency": "NGN",
        "ngn_per_usd": round(rate, 2) if rate else None,
        "sandbox": "sandbox" in FINCRA_BASE,
    }


@router.post("/create-checkout")
async def create_checkout(body: CreateBody, current_user: dict = Depends(get_current_user)):
    if not _enabled():
        raise HTTPException(503, "Naira payments are not available yet")
    amt = round(float(body.amount), 2)
    if amt < MIN_USD or amt > MAX_USD:
        raise HTTPException(400, f"Amount must be between ${MIN_USD:.0f} and ${MAX_USD:.0f}")

    user_id = str(current_user["_id"])
    email = current_user.get("email") or ""
    name = (current_user.get("name") or email.split("@")[0] or "Calliotel user")[:80]
    order_id = str(uuid.uuid4())
    rate = await _ngn_per_usd()
    ngn = _ngn_amount(amt, rate)
    frontend = _frontend()
    local_front = any(h in frontend for h in ("localhost", "127.0.0.1"))
    # Fincra rejects localhost redirectUrl (no TLD) and "Close checkout" then goes about:blank.
    # Always send a public HTTPS return URL; local wallet credit still uses confirm/poll.
    redirect_base = "https://calliotel.com" if local_front else frontend
    payload = {
        "amount": ngn,
        "currency": "NGN",
        "feeBearer": "customer",
        "reference": order_id,
        "settlementDestination": "wallet",
        # Fincra validates casing strictly; payattitude is often unavailable on NGN accounts
        "paymentMethods": ["card", "bank_transfer"],
        "defaultPaymentMethod": "card",
        "successMessage": "Calliotel wallet credited.",
        "customer": {"name": name, "email": email},
        "metadata": {"userId": user_id, "orderId": order_id, "amountUsd": str(amt)},
        "redirectUrl": (
            f"{redirect_base}/buy-credits"
            f"?fincra_success=1&amount={amt:.0f}&order={order_id}"
        ),
    }
    await db.fincra_payments.insert_one({
        "order_id": order_id,
        "user_id": user_id,
        "email": email,
        "amount_usd": amt,
        "amount_ngn": ngn,
        "fx_ngn_per_usd": rate,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.post(f"{FINCRA_BASE}/checkout/payments", headers=await _headers(), json=payload)
        data = r.json() if r.content else {}
    except Exception as e:
        logger.exception("Fincra checkout request failed")
        await db.fincra_payments.update_one({"order_id": order_id}, {"$set": {"status": "error", "error": str(e)}})
        raise HTTPException(502, "Could not start Naira checkout")

    inner = data.get("data") if isinstance(data.get("data"), dict) else {}
    link = (inner or {}).get("link") or data.get("link")
    pay_code = (inner or {}).get("payCode") or (inner or {}).get("reference")
    if r.status_code >= 400 or not link:
        logger.warning("Fincra checkout rejected: %s %s", r.status_code, str(data)[:400])
        await db.fincra_payments.update_one(
            {"order_id": order_id},
            {"$set": {"status": "error", "error": str(data)[:500]}},
        )
        raise HTTPException(502, "Could not start Naira checkout")

    await db.fincra_payments.update_one(
        {"order_id": order_id},
        {"$set": {"checkout_url": link, "pay_code": pay_code}},
    )
    return {
        "checkout_url": link,
        "order_id": order_id,
        "amount_usd": amt,
        "amount_ngn": ngn,
    }


@router.get("/confirm/{order_id}")
async def confirm_checkout(order_id: str, current_user: dict = Depends(get_current_user)):
    record = await db.fincra_payments.find_one({"order_id": order_id})
    if not record:
        raise HTTPException(404, "Payment not found")
    if record.get("user_id") != str(current_user["_id"]):
        raise HTTPException(404, "Payment not found")
    return await _credit_if_paid(order_id)


@router.post("/confirm-latest")
async def confirm_latest(current_user: dict = Depends(get_current_user)):
    """Local/sandbox helper: credit the newest pending checkout if Fincra shows paid."""
    user_id = str(current_user["_id"])
    rows = await db.fincra_payments.find(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        limit=1,
    ).to_list(1)
    record = rows[0] if rows else None
    if not record:
        raise HTTPException(404, "No recent Naira payment found")
    if record.get("status") == "completed":
        return {
            "ok": True,
            "credited": False,
            "status": "completed",
            "duplicate": True,
            "order_id": record["order_id"],
            "amount_usd": record.get("amount_usd"),
        }
    result = await _credit_if_paid(record["order_id"])
    result["order_id"] = record["order_id"]
    result["amount_usd"] = record.get("amount_usd")
    return result


@router.post("/webhook")
async def fincra_webhook(request: Request):
    raw = await request.body()
    try:
        payload = json.loads(raw or b"{}")
    except Exception:
        raise HTTPException(400, "Invalid webhook payload")
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid webhook payload")
    if not _signature_ok(raw, request, payload):
        logger.warning("Fincra webhook signature rejected")
        raise HTTPException(400, "Invalid webhook signature")

    event = str(payload.get("event") or "").lower()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    if event not in SUCCESS_EVENTS and str(data.get("status") or "").lower() not in SUCCESS_STATUSES:
        return {"ok": True, "ignored": True}

    refs = [
        data.get("merchantReference"),
        data.get("reference"),
        data.get("paymentReference"),
        (data.get("metadata") or {}).get("orderId") if isinstance(data.get("metadata"), dict) else None,
    ]
    record = None
    for ref in refs:
        if not ref:
            continue
        record = await db.fincra_payments.find_one({"order_id": str(ref)}) or await db.fincra_payments.find_one({"pay_code": str(ref)})
        if record:
            break
    if not record:
        logger.info("Fincra webhook with no matching payment: %s", refs)
        return {"ok": True}

    if str(data.get("varianceType") or "").lower() == "underpayment":
        logger.warning("Fincra underpayment ignored for %s", record.get("order_id"))
        return {"ok": True, "ignored": "underpayment"}

    await _credit_if_paid(record["order_id"])
    return {"ok": True}
