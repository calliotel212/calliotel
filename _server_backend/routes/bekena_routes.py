"""Bekena crypto top-ups ($5+ per coin; ETH is not offered). Optional — must not take down auth."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import db
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

BEKENA_BASE = "https://api.bekena.com"
BEKENA_PUBLIC_KEY = os.environ.get("BEKENA_PUBLIC_KEY", "")
BEKENA_SECRET_KEY = os.environ.get("BEKENA_SECRET_KEY", "")
BEKENA_WEBHOOK_SECRET = os.environ.get("BEKENA_WEBHOOK_SECRET", "") or BEKENA_SECRET_KEY
MIN_USD = 5.0
MAX_USD = 500.0
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
CREDIT_STATUSES = {
    "invoice.completed",
    "invoice.paid",
    "payment.completed",
    "payment.paid",
}
# Dashboard revenue is $0 on sweeping. Only credit after Bekena completes settlement.
CREDIT_REMOTE = {"completed", "paid"}

# Bekena codes that accepted a $5 invoice in live probes. ETH is $10 — omit.
BEKENA_COINS = {
    "USDT_TRC20": "USDT TRC-20",
    "USDT_BEP20": "USDT BNB",
    "USDT_SOL": "USDT Solana",
    "USDT_TON": "USDT TON",
    "USDT_POLYGON": "USDT Polygon",
    "USDT_ARB": "USDT Arbitrum",
    "USDT_ERC20": "USDT Ethereum",
    "USDC_BEP20": "USDC BNB",
    "USDC_SOL": "USDC Solana",
    "USDC_BASE": "USDC Base",
    "TRX": "TRON",
    "LTC": "Litecoin",
    "XRP": "XRP",
    "DOGE": "Dogecoin",
    "BCH": "Bitcoin Cash",
    "SOL": "Solana",
    "TON": "TON",
    "BNB": "BNB",
    "BTC": "Bitcoin",
}


class CreateBody(BaseModel):
    amount: float
    currency: str = "USDT_TRC20"


def _public_base() -> str:
    return (os.environ.get("PUBLIC_BASE_URL") or "https://calliotel.com").rstrip("/")


def _sign(secret: str, timestamp: str, body: str) -> str:
    digest = hmac.new(
        secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256
    ).hexdigest()
    return f"sha256={digest}"


def _verify(secret: str, timestamp: str, body: str, signature: str) -> bool:
    if not secret or not signature:
        return False
    expected = _sign(secret, timestamp, body)
    raw = signature if signature.startswith("sha256=") else f"sha256={signature}"
    if len(expected) != len(raw):
        return False
    return hmac.compare_digest(expected, raw)


def _sig_hex(signature: str) -> str:
    if not signature:
        return ""
    return signature.split("=")[-1].strip().lower()


def _hex_eq(a: str, b: str) -> bool:
    if not a or not b or len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


def _verify_webhook(raw: bytes, request: Request) -> bool:
    """Bekena docs sign the raw body as x-bekena-sig. API calls use timestamp.body."""
    sig = (
        request.headers.get("x-bekena-sig")
        or request.headers.get("X-Bekena-Signature")
        or request.headers.get("x-bekena-signature")
        or ""
    )
    ts = request.headers.get("X-Bekena-Timestamp") or request.headers.get("x-bekena-timestamp") or ""
    got = _sig_hex(sig)
    if not got:
        return False
    secrets = []
    for s in (os.environ.get("BEKENA_WEBHOOK_SECRET") or "", BEKENA_WEBHOOK_SECRET, BEKENA_SECRET_KEY):
        if s and s not in secrets:
            secrets.append(s)
    body = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
    raw_b = raw if isinstance(raw, (bytes, bytearray)) else body.encode()
    for secret in secrets:
        body_hex = hmac.new(secret.encode(), raw_b, hashlib.sha256).hexdigest()
        if _hex_eq(body_hex, got):
            return True
        if ts and _verify(secret, ts, body, sig):
            return True
    return False


async def _bekena_request(method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    if not BEKENA_PUBLIC_KEY or not BEKENA_SECRET_KEY:
        raise HTTPException(503, "USDT payments unavailable")
    body = json.dumps(payload, separators=(",", ":")) if payload is not None else ""
    ts = str(int(time.time()))
    headers = {
        "Authorization": f"Bearer {BEKENA_PUBLIC_KEY}",
        "X-Bekena-Timestamp": ts,
        "X-Bekena-Signature": _sign(BEKENA_SECRET_KEY, ts, body),
        "Accept": "application/json",
        "User-Agent": BROWSER_UA,
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.request(
            method,
            f"{BEKENA_BASE}{path}",
            content=body.encode() if payload is not None else None,
            headers=headers,
        )
    try:
        data = r.json() if r.content else {}
    except Exception:
        data = {"raw": (r.text or "")[:400]}
    return r.status_code, data if isinstance(data, dict) else {"data": data}


async def _credit(record: dict, status: str) -> None:
    if record.get("processed"):
        return
    user_id = record["user_id"]
    credits = float(record["credits_to_add"])
    now = datetime.now(timezone.utc).isoformat()
    invoice_id = record["invoice_id"]
    claimed = await db.bekena_invoices.find_one_and_update(
        {"invoice_id": invoice_id, "processed": False},
        {"$set": {"status": status, "processed": True, "processed_at": now}},
    )
    if not claimed:
        return
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": credits}, "$set": {"updated_at": now}},
        upsert=True,
    )
    tx_doc = {
        "user_id": user_id,
        "amount": credits,
        "type": "credit",
        "description": f"Crypto deposit — ${credits:.2f} ({record.get('pay_currency') or 'USDT_TRC20'})",
        "source": "bekena",
        "payment_method": record.get("pay_currency") or "USDT_TRC20",
        "payment_id": invoice_id,
        "created_at": now,
    }
    await db.wallet_transactions.insert_one(dict(tx_doc))
    await db.transactions.insert_one(dict(tx_doc))
    logger.info("Bekena credited $%s to %s | %s", credits, record.get("user_email"), invoice_id)
    try:
        import asyncio
        from services.telegram_admin_alerts import notify_admins

        wallet = await db.wallets.find_one({"user_id": user_id})
        bal = float((wallet or {}).get("balance") or credits)
        asyncio.create_task(
            notify_admins(
                f"💰 New payment! {record.get('user_email')} paid ${credits:.2f} ({record.get('pay_currency') or 'USDT'}) · wallet now ${bal:.2f}",
                also_email=False,
            )
        )
    except Exception as e:
        logger.warning("Bekena telegram alert failed: %s", e)
    try:
        from routes.push_notifications import NotificationPayload, send_push_notification

        await send_push_notification(
            user_id,
            NotificationPayload(
                title="💰 Balance Added",
                body=f"${credits:.2f} has been added to your Calliotel wallet.",
                icon="/icon-192.png",
                data={"type": "balance_added", "amount": credits},
            ),
        )
    except Exception as e:
        logger.warning("Bekena push failed: %s", e)
    try:
        import asyncio
        from routes.payments import _maybe_grant_first_deposit_bonus

        asyncio.create_task(_maybe_grant_first_deposit_bonus(db, user_id, credits))
    except Exception as e:
        logger.warning("Bekena first-deposit bonus failed: %s", e)
    try:
        import asyncio as _aio
        from services.talk_offer import maybe_grant_talk_offer
        _aio.create_task(maybe_grant_talk_offer(db, user_id, credits))
    except Exception as e:
        logger.warning("Bekena talk offer failed: %s", e)


@router.post("/create")
async def create_bekena_invoice(body: CreateBody, request: Request, current_user=Depends(get_current_user)):
    raise HTTPException(
        503,
        "This crypto provider is paused. Pay with USDT on Buy Credits — same wallet.",
    )
    amount = round(float(body.amount or 0), 2)
    coin = (body.currency or "USDT_TRC20").strip().upper()
    if coin not in BEKENA_COINS:
        raise HTTPException(400, "That coin is not available")
    if amount < MIN_USD or amount > MAX_USD:
        raise HTTPException(400, f"Crypto is ${MIN_USD:.0f}–${MAX_USD:.0f}")

    user_id = str(current_user["_id"])
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    existing = await db.bekena_invoices.find_one(
        {
            "user_id": user_id,
            "pay_currency": coin,
            "amount_usd": amount,
            "processed": False,
            "status": {"$in": ["pending", "awaiting_payment", "seen", "confirmed", "sweeping"]},
            "created_at": {"$gte": cutoff},
            "checkout_url": {"$exists": True, "$ne": None},
        }
    )
    if existing and existing.get("checkout_url"):
        return {
            "checkout_url": existing["checkout_url"],
            "invoice_id": existing.get("invoice_id"),
            "order_id": existing.get("order_id"),
            "amount": existing.get("amount_usd"),
            "currency": existing.get("pay_currency") or coin,
        }

    try:
        from services.fraud_protection import check_wallet_topup, extract_ip

        await check_wallet_topup(
            user_id=user_id,
            user_email=current_user.get("email", ""),
            amount_usd=amount,
            ip=extract_ip(request),
            user_created_at=str(current_user.get("created_at", "")),
            method="crypto",
        )
    except ValueError as fe:
        raise HTTPException(429, str(fe))
    except Exception as e:
        logger.warning("Bekena fraud check skipped: %s", e)

    order_id = f"CT{uuid.uuid4().hex[:10].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "amount": f"{amount:.2f}",
        "currency": "USD",
        "accepted_currencies": [coin],
        "order_id": order_id,
        "description": f"Calliotel credits ${amount:.2f}",
        "return_url": f"{_public_base()}/buy-credits?bekena=1&amount={amount:.2f}",
        "webhook_url": f"{_public_base()}/api/payments/bekena/webhook",
    }
    status, data = await _bekena_request("POST", "/v1/invoices", payload)
    if status not in (200, 201) or not data.get("checkout_url"):
        payload.pop("webhook_url", None)
        status, data = await _bekena_request("POST", "/v1/invoices", payload)
    if status not in (200, 201) or not data.get("checkout_url"):
        logger.error("Bekena create failed %s %s", status, str(data)[:300])
        raise HTTPException(502, "Could not start crypto payment. Try again.")

    invoice_id = data.get("id") or data.get("invoice_id")
    await db.bekena_invoices.insert_one(
        {
            "order_id": order_id,
            "invoice_id": invoice_id,
            "user_id": user_id,
            "user_email": current_user.get("email"),
            "amount_usd": amount,
            "credits_to_add": amount,
            "pay_currency": coin,
            "status": data.get("status") or "pending",
            "checkout_url": data.get("checkout_url"),
            "processed": False,
            "created_at": now,
        }
    )
    try:
        from services.fraud_protection import extract_ip, record_wallet_topup

        await record_wallet_topup(
            user_id=user_id, amount_usd=amount, ip=extract_ip(request), session_id=order_id
        )
    except Exception:
        pass
    return {
        "checkout_url": data["checkout_url"],
        "invoice_id": invoice_id,
        "order_id": order_id,
        "amount": amount,
        "currency": coin,
    }


@router.get("/status/{invoice_id}")
async def bekena_status(invoice_id: str, current_user=Depends(get_current_user)):
    rec = await db.bekena_invoices.find_one(
        {"invoice_id": invoice_id, "user_id": str(current_user["_id"])}
    )
    if not rec:
        raise HTTPException(404, "Invoice not found")
    if not rec.get("processed"):
        st, data = await _bekena_request("GET", f"/v1/invoices/{invoice_id}")
        remote = (data.get("status") or "").lower() if st == 200 else ""
        settled = bool(data.get("settlementId") or data.get("settlement_id") or data.get("completedAt") or data.get("completed_at"))
        if remote in CREDIT_REMOTE and settled:
            await _credit(rec, remote or "confirmed")
            rec = await db.bekena_invoices.find_one({"invoice_id": invoice_id})
    return {
        "status": rec.get("status"),
        "processed": bool(rec.get("processed")),
        "credits_to_add": rec.get("credits_to_add"),
        "invoice_id": invoice_id,
    }


@router.post("/webhook")
async def bekena_webhook(request: Request):
    raw_b = await request.body()
    raw = raw_b.decode("utf-8")
    if not _verify_webhook(raw_b, request):
        logger.warning(
            "Bekena webhook bad signature header_names=%s",
            [k for k in request.headers.keys() if "bekena" in k.lower() or k.lower().endswith("sig")],
        )
        raise HTTPException(401, "Invalid signature")
    try:
        payload = json.loads(raw or "{}")
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    event = (
        payload.get("event")
        or payload.get("type")
        or (payload.get("data") or {}).get("event")
        or ""
    )
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    invoice_id = data.get("id") or data.get("invoice_id") or payload.get("invoice_id")
    if not invoice_id:
        return {"ok": True, "ignored": "no_invoice"}
    rec = await db.bekena_invoices.find_one({"invoice_id": invoice_id})
    if not rec:
        logger.warning("Bekena webhook unknown invoice %s", invoice_id)
        return {"ok": True, "ignored": "unknown"}
    status = (data.get("status") or event or "").lower()
    await db.bekena_invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"remote_status": status, "last_webhook_at": datetime.now(timezone.utc).isoformat()}},
    )
    settled = bool(data.get("settlementId") or data.get("settlement_id") or data.get("completedAt") or data.get("completed_at"))
    if (event in CREDIT_STATUSES or status in CREDIT_REMOTE or status.split(".")[-1] in CREDIT_REMOTE) and settled:
        await _credit(rec, status or event)
    return {"ok": True}


async def _reconcile_once() -> int:
    n = 0
    cur = db.bekena_invoices.find({"processed": False})
    async for rec in cur:
        iid = rec.get("invoice_id")
        if not iid:
            continue
        try:
            st, data = await _bekena_request("GET", f"/v1/invoices/{iid}")
        except Exception as e:
            logger.warning("Bekena reconcile fetch %s: %s", iid, e)
            continue
        remote = (data.get("status") or "").lower() if st == 200 else ""
        if remote in ("expired", "cancelled", "canceled"):
            await db.bekena_invoices.update_one(
                {"invoice_id": iid},
                {"$set": {"status": remote, "remote_status": remote}},
            )
            continue
        if remote in CREDIT_REMOTE and (data.get("settlementId") or data.get("completedAt") or data.get("completed_at")):
            await _credit(rec, remote)
            n += 1
    if n:
        logger.info("Bekena reconcile credited %s invoices", n)
    return n


async def _reconcile_forever() -> None:
    import asyncio
    await asyncio.sleep(8)
    while True:
        try:
            await _reconcile_once()
        except Exception:
            logger.exception("Bekena reconcile loop")
        await asyncio.sleep(90)


@router.on_event("startup")
async def _bekena_reconcile_startup():
    import asyncio
    if BEKENA_PUBLIC_KEY and BEKENA_SECRET_KEY:
        asyncio.create_task(_reconcile_forever())
