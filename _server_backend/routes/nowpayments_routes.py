"""NOWPayments.io crypto payment integration."""
import os
import uuid
import hmac
import hashlib
import json
import logging
import math
import time
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from routes.auth import get_current_user
from database import db
from services.telegram_admin_alerts import alert as tg_alert, alert_throttled as tg_alert_throttled

logger = logging.getLogger(__name__)
router = APIRouter()

NOWPAYMENTS_API_KEY = os.environ.get("NOWPAYMENTS_API_KEY", "")
NOWPAYMENTS_IPN_SECRET = os.environ.get("NOWPAYMENTS_IPN_SECRET", "")
NOWPAYMENTS_BASE = "https://api.nowpayments.io/v1"

# Fallback floors if the live min-amount probe fails. Live TRX/USDT sit near $12;
# the old hardcoded $25 made the first top-up fail while the UI offered $5.
COIN_MIN_FALLBACK = {
    "usdttrc20": 12,
    "trx": 12, "tron": 12,
    "xlm": 12, "ltc": 12, "xrp": 12, "bch": 12,
    "sol": 12, "ton": 12, "doge": 13,
}
DEFAULT_MIN_USD = 12
_MIN_CACHE_TTL = 600.0
_min_cache: dict = {}


async def live_coin_min_usd(currency: str) -> float:
    """NOWPayments min in USD, with a small whole-dollar headroom for price drift."""
    cur = (currency or "trx").lower().strip()
    now = time.monotonic()
    hit = _min_cache.get(cur)
    if hit and hit[1] > now:
        return hit[0]
    fallback = float(COIN_MIN_FALLBACK.get(cur, DEFAULT_MIN_USD))
    min_usd = fallback
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"{NOWPAYMENTS_BASE}/min-amount",
                params={"currency_from": cur, "fiat_equivalent": "usd"},
                headers={"x-api-key": NOWPAYMENTS_API_KEY},
            )
        if r.status_code == 200:
            fiat = float((r.json() or {}).get("fiat_equivalent") or 0)
            if fiat > 0:
                min_usd = float(max(12, math.ceil(fiat) + 1))
    except Exception as e:
        logger.warning("NOWPayments min-amount probe failed (%s): %s", cur, e)
        min_usd = fallback
    _min_cache[cur] = (min_usd, now + _MIN_CACHE_TTL)
    return min_usd


@router.get("/mins")
async def nowpayments_mins(current_user: dict = Depends(get_current_user)):
    """Live per-coin USD floors for the buy-credits screen."""
    coins = ["trx", "usdttrc20", "ltc", "xrp", "xlm", "bch"]
    out = {}
    for c in coins:
        out[c] = await live_coin_min_usd(c)
    return {"mins": out, "floor": DEFAULT_MIN_USD}

FINISHED_STATUSES = {"finished", "confirmed", "sending"}
# Terminal states where the user's money did NOT arrive — worth an admin ping so a
# stuck or lost top-up is noticed without someone reading logs.
FAILED_STATUSES = {"failed", "expired", "refunded"}


class CreatePaymentRequest(BaseModel):
    amount: float
    currency: str = "usdttrc20"


async def _credit_user(record: dict, status: str):
    """Credit wallet for a completed NOWPayments order."""
    user_id = record["user_id"]
    credits = float(record["credits_to_add"])
    now = datetime.now(timezone.utc)

    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": credits}},
        upsert=True,
    )
    tx_doc = {
        "user_id": user_id,
        "amount": credits,
        "type": "credit",
        "description": f"Crypto deposit — ${credits:.2f} ({record.get('pay_currency', 'crypto').upper()})",
        "source": "nowpayments",
        "payment_method": record.get("pay_currency", "crypto"),
        "payment_id": record["payment_id"],
        "created_at": now.isoformat(),
    }
    # Write to both collections: wallet_transactions (revenue ledger / admin) and
    # transactions (user-visible wallet history).
    await db.wallet_transactions.insert_one(dict(tx_doc))
    await db.transactions.insert_one(dict(tx_doc))
    await db.nowpayments.update_one(
        {"payment_id": record["payment_id"]},
        {"$set": {
            "status": status,
            "processed": True,
            "processed_at": now.isoformat(),
        }},
    )
    logger.info(
        f"NOWPayments: ✅ Credited ${credits} to {record['user_email']} | {record['payment_id']}"
    )
    # Telegram admin alert
    try:
        import asyncio as _asyncio
        wallet_after = await db.wallets.find_one({"user_id": user_id})
        _bal = wallet_after["balance"] if wallet_after else credits
        _coin = record.get("pay_currency", "crypto").upper()
        _email = record.get("user_email", user_id)
        from services.telegram_admin_alerts import notify_admins
        _asyncio.create_task(notify_admins(
            f"💰 New payment! {_email} paid ${credits:.2f} ({_coin}) · wallet now ${_bal:.2f}",
            also_email=False,
        ))
    except Exception as _te:
        logger.warning(f"telegram alert failed (nowpayments): {_te}")

    # Push notification to user
    try:
        from routes.push_notifications import send_push_notification, NotificationPayload
        await send_push_notification(
            user_id,
            NotificationPayload(
                title="💰 Balance Added",
                body=f"${credits:.2f} has been added to your Calliotel wallet.",
                icon="/icon-192.png",
                data={"type": "balance_added", "amount": credits},
            )
        )
    except Exception as _pe:
        logger.warning(f"push notification failed (nowpayments): {_pe}")

    try:
        from routes.payments import _maybe_grant_first_deposit_bonus
        import asyncio as _asyncio
        _asyncio.create_task(_maybe_grant_first_deposit_bonus(db, user_id, credits))
    except Exception as _be:
        logger.warning(f"first-deposit bonus check failed: {_be}")
    try:
        from services.talk_offer import maybe_grant_talk_offer
        import asyncio as _a_talk
        _a_talk.create_task(maybe_grant_talk_offer(db, user_id, credits))
    except Exception as _te:
        logger.warning(f"talk offer check failed: {_te}")


class CreateInvoiceRequest(BaseModel):
    amount: float


@router.post("/create-invoice")
async def create_nowpayments_invoice(
    body: CreateInvoiceRequest,
    current_user=Depends(get_current_user),
    http_request: Request = None,
):
    """Create a NOWPayments hosted-checkout invoice.
    The hosted page shows ALL crypto coins + 'Buy with Card' via Simplex.
    Returns invoice_url to redirect the user to."""
    if not NOWPAYMENTS_API_KEY:
        raise HTTPException(503, "Crypto payments unavailable")

    MIN_AMOUNT = 12.0
    MAX_AMOUNT = 500.0
    if body.amount < MIN_AMOUNT or body.amount > MAX_AMOUNT:
        raise HTTPException(400, f"Amount must be between ${MIN_AMOUNT:.0f} and ${MAX_AMOUNT:.0f}")

    # Guard: block duplicate pending invoices (same as /create endpoint)
    _inv_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    _inv_existing = await db.nowpayments_invoices.find_one({
        "user_id": str(current_user["_id"]),
        "processed": False,
        "status": "pending",
        "created_at": {"$gte": _inv_cutoff},
    })
    if _inv_existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "You already have a pending crypto payment. "
                "Please wait for it to complete or expire before creating a new one."
            ),
        )

    # Fraud / velocity check
    from services.fraud_protection import check_wallet_topup, record_wallet_topup, extract_ip
    try:
        await check_wallet_topup(
            user_id=str(current_user["_id"]),
            user_email=current_user.get("email", ""),
            amount_usd=body.amount,
            ip=extract_ip(http_request),
            user_created_at=str(current_user.get("created_at", "")),
            method="crypto",
        )
    except ValueError as fe:
        raise HTTPException(429, str(fe))

    order_id = str(uuid.uuid4())[:8].upper()
    user_id  = str(current_user["_id"])
    now_iso  = datetime.now(timezone.utc).isoformat()

    # Store pending record keyed by order_id (payment_id unknown until IPN)
    await db.nowpayments_invoices.insert_one({
        "order_id":       order_id,
        "invoice_id":     None,
        "user_id":        user_id,
        "user_email":     current_user["email"],
        "amount_usd":     body.amount,
        "credits_to_add": body.amount,
        "status":         "pending",
        "processed":      False,
        "created_at":     now_iso,
    })

    payload = {
        "price_amount":    body.amount,
        "price_currency":  "usd",
        "order_id":        order_id,
        "order_description": f"Calliotel Credits — ${body.amount:.2f}",
        "ipn_callback_url": "https://calliotel.com/api/payments/nowpayments/ipn",
        "success_url": "https://calliotel.com/payment-success?nowp=1",
        "cancel_url":  "https://calliotel.com/add-funds?nowp_canceled=1",
        "is_fee_paid_by_user": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{NOWPAYMENTS_BASE}/invoice",
                json=payload,
                headers={"x-api-key": NOWPAYMENTS_API_KEY, "Content-Type": "application/json"},
            )
        if r.status_code not in (200, 201):
            logger.error(f"NOWPayments invoice create failed: {r.status_code} {r.text[:300]}")
            tg_alert(
                f"🚨 Crypto invoice FAILED\n"
                f"👤 User: {current_user['email']}\n"
                f"💰 Amount: ${body.amount:.2f}\n"
                f"❌ NOWPayments returned {r.status_code}: {r.text[:200]}\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
            )
            raise HTTPException(400, r.json().get("message", "Could not create payment. Try again."))
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"NOWPayments invoice error: {e}")
        tg_alert(
            f"🚨 Crypto invoice ERROR\n"
            f"👤 User: {current_user['email']}\n"
            f"💰 Amount: ${body.amount:.2f}\n"
            f"❌ {e}\n"
            f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        )
        raise HTTPException(502, "Payment service unavailable")

    invoice_id  = str(data.get("id", ""))
    invoice_url = data.get("invoice_url", "")

    await db.nowpayments_invoices.update_one(
        {"order_id": order_id},
        {"$set": {"invoice_id": invoice_id}},
    )

    # Record in fraud velocity tracker
    try:
        from services.fraud_protection import record_wallet_topup
        await record_wallet_topup(user_id=user_id, amount_usd=body.amount, ip=extract_ip(http_request), session_id=order_id)
    except Exception as _fe:
        logger.warning(f"fraud record failed (nowpay invoice): {_fe}")

    logger.info(f"NOWPayments invoice created: {invoice_id} | {current_user['email']} | ${body.amount}")
    tg_alert(
        f"🛒 Crypto checkout started\n"
        f"👤 User: {current_user['email']}\n"
        f"💰 Amount: ${body.amount:.2f}\n"
        f"🧾 Order: {order_id}\n"
        f"⏳ Awaiting payment — will confirm when the coin lands"
    )
    return {"invoice_url": invoice_url, "order_id": order_id, "invoice_id": invoice_id}


@router.post("/create")
async def create_nowpayment(
    request: CreatePaymentRequest,
    current_user=Depends(get_current_user),
):
    if not NOWPAYMENTS_API_KEY:
        raise HTTPException(status_code=503, detail="Crypto payments temporarily unavailable")
    min_amount = await live_coin_min_usd(request.currency)
    if request.amount < min_amount or request.amount > 500:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum ${min_amount:.0f} for this coin",
        )

    # Guard: block duplicate pending payments. Users sometimes click multiple times
    # or retry while the first payment is still waiting — each creates a new
    # NOWPayments order, all of which eventually expire and fire separate alerts.
    _cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    _existing = await db.nowpayments.find_one({
        "user_id": str(current_user["_id"]),
        "processed": False,
        "status": {"$in": ["waiting", "confirming", "confirmed",
                            "partially_filled", "sending", "pending"]},
        "created_at": {"$gte": _cutoff},
    })
    if _existing:
        # Reopen the pending payment instead of trapping the customer for 30
        # minutes when they accidentally close the payment sheet.
        return {
            "payment_id": _existing["payment_id"],
            "order_id": _existing["order_id"],
            "pay_address": _existing.get("pay_address"),
            "pay_amount": _existing.get("pay_amount"),
            "pay_currency": _existing.get("pay_currency", request.currency),
            "amount_usd": _existing.get("amount_usd", request.amount),
            "status": _existing.get("status", "waiting"),
            "resumed": True,
        }

    order_id = str(uuid.uuid4())[:8].upper()

    payload = {
        "price_amount": request.amount,
        "price_currency": "usd",
        "pay_currency": request.currency,
        "order_id": order_id,
        "order_description": f"Calliotel Credits - ${request.amount:.2f}",
        "ipn_callback_url": "https://calliotel.com/api/payments/nowpayments/ipn",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{NOWPAYMENTS_BASE}/payment",
                json=payload,
                headers={
                    "x-api-key": NOWPAYMENTS_API_KEY,
                    "Content-Type": "application/json",
                },
            )
        if r.status_code not in (200, 201):
            logger.error(f"NOWPayments create failed: {r.status_code} {r.text[:300]}")
            err_json = {}
            try:
                err_json = r.json()
            except Exception:
                pass
            detail = err_json.get("message") or "Could not create crypto payment. Please try again."
            tg_alert(
                f"🚨 Crypto payment FAILED\n"
                f"👤 User: {current_user['email']}\n"
                f"💰 Amount: ${request.amount:.2f} ({request.currency.upper()})\n"
                f"❌ NOWPayments returned {r.status_code}: {r.text[:200]}\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
            )
            raise HTTPException(status_code=400, detail=detail)
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"NOWPayments create error: {e}")
        tg_alert(
            f"🚨 Crypto payment ERROR\n"
            f"👤 User: {current_user['email']}\n"
            f"💰 Amount: ${request.amount:.2f} ({request.currency.upper()})\n"
            f"❌ {e}\n"
            f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        )
        raise HTTPException(status_code=502, detail="Crypto payment service unavailable")

    payment_id = str(data.get("payment_id", ""))
    doc = {
        "payment_id": payment_id,
        "order_id": order_id,
        "user_id": str(current_user["_id"]),
        "user_email": current_user["email"],
        "amount_usd": request.amount,
        "pay_currency": request.currency,
        "pay_amount": data.get("pay_amount"),
        "pay_address": data.get("pay_address"),
        "status": data.get("payment_status", "waiting"),
        "credits_to_add": request.amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed": False,
    }
    await db.nowpayments.insert_one(doc)
    logger.info(
        f"NOWPayments: created {payment_id} | {current_user['email']} | ${request.amount}"
    )

    return {
        "payment_id": payment_id,
        "order_id": order_id,
        "pay_address": data.get("pay_address"),
        "pay_amount": data.get("pay_amount"),
        "pay_currency": request.currency,
        "amount_usd": request.amount,
        "status": data.get("payment_status", "waiting"),
    }


@router.get("/status/{payment_id}")
async def get_nowpayment_status(
    payment_id: str,
    current_user=Depends(get_current_user),
):
    record = await db.nowpayments.find_one({
        "payment_id": payment_id,
        "user_id": str(current_user["_id"]),
    })
    if not record:
        raise HTTPException(status_code=404, detail="Payment not found")

    if not record.get("processed") and NOWPAYMENTS_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"{NOWPAYMENTS_BASE}/payment/{payment_id}",
                    headers={"x-api-key": NOWPAYMENTS_API_KEY},
                )
            if r.status_code == 200:
                api_status = r.json().get("payment_status", record["status"])
                if api_status != record["status"]:
                    await db.nowpayments.update_one(
                        {"payment_id": payment_id},
                        {"$set": {"status": api_status}},
                    )
                    record["status"] = api_status
                if api_status in FINISHED_STATUSES:
                    await _credit_user(record, api_status)
                    record["processed"] = True
        except Exception as e:
            logger.warning(f"NOWPayments status check error: {e}")

    return {
        "payment_id": payment_id,
        "status": record["status"],
        "pay_amount": record.get("pay_amount"),
        "pay_currency": record.get("pay_currency"),
        "credits_to_add": record.get("credits_to_add"),
        "processed": record.get("processed", False),
    }


async def _verify_payment_with_api(payment_id: str) -> dict | None:
    """Call NOWPayments API directly to confirm a payment's real status."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{NOWPAYMENTS_BASE}/payment/{payment_id}",
                headers={"x-api-key": NOWPAYMENTS_API_KEY},
            )
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.warning(f"NOWPayments API verify failed for {payment_id}: {e}")
    return None


@router.post("/ipn")
async def nowpayments_ipn(request: Request):
    """NOWPayments IPN webhook — called when payment status changes."""
    body = await request.body()

    sig_ok = False
    if NOWPAYMENTS_IPN_SECRET:
        sig_header = request.headers.get("x-nowpayments-sig", "")
        if sig_header:
            try:
                sorted_body = json.dumps(
                    json.loads(body), sort_keys=True, separators=(",", ":")
                )
                expected = hmac.new(
                    NOWPAYMENTS_IPN_SECRET.encode(),
                    sorted_body.encode(),
                    hashlib.sha512,
                ).hexdigest()
                if sig_header == expected:
                    sig_ok = True
                else:
                    logger.warning(
                        f"NOWPayments IPN: sig mismatch "
                        f"(got={sig_header[:16]}… expected={expected[:16]}…) — will verify via API"
                    )
            except Exception as e:
                logger.error(f"NOWPayments IPN sig verify error: {e}")
        else:
            # No signature header. NOWPayments sometimes omits it, but an unsigned
            # body must NEVER be trusted: anyone who knows a payment_id could POST a
            # forged "finished" status and credit themselves without paying.
            # Leave sig_ok False so the payment is confirmed against the NOWPayments
            # API below before any wallet is touched.
            logger.info("NOWPayments IPN: no signature header — verifying via API instead")

    try:
        data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # If signature didn't match, verify directly with NOWPayments API before proceeding
    if not sig_ok:
        payment_id_check = str(data.get("payment_id", ""))
        if not payment_id_check:
            # Nothing to act on — this is a connectivity check or dashboard validator
            # ping, not a payment. Acknowledge it, but credit nothing.
            logger.info("NOWPayments IPN: unverified payload with no payment_id — acknowledged, no action taken")
            return {"ok": True, "note": "no payment_id — no action"}
        # Cheap local check BEFORE spending an outbound provider call. A genuine
        # callback always refers to a record we created (payment_id for direct
        # payments, order_id for hosted invoices). Unknown ids are junk or forgeries,
        # so reject them without letting a stranger make us do paid network work.
        order_id_check = str(data.get("order_id", ""))
        known = await db.nowpayments.find_one({"payment_id": payment_id_check}, {"_id": 1})
        if not known and order_id_check:
            known = await db.nowpayments_invoices.find_one({"order_id": order_id_check}, {"_id": 1})
        if not known:
            logger.warning(f"NOWPayments IPN: unknown payment {payment_id_check} — rejected without API call")
            tg_alert_throttled(
                "nowpay-ipn-unknown",
                f"🚨 NOWPayments IPN rejected — unknown payment\n"
                f"🆔 Payment: {payment_id_check}\n"
                f"❌ Unsigned callback for an id we never issued — no credit issued\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            )
            raise HTTPException(status_code=400, detail="Unknown payment")

        verified = await _verify_payment_with_api(payment_id_check)
        if not verified:
            logger.warning(f"NOWPayments IPN: API verification failed for {payment_id_check} — rejecting")
            tg_alert_throttled(
                "nowpay-ipn-reject",
                f"🚨 NOWPayments IPN REJECTED\n"
                f"🆔 Payment: {payment_id_check}\n"
                f"❌ Unsigned/forged callback failed API verification — no credit issued\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            )
            raise HTTPException(status_code=400, detail="Could not verify payment")
        # Use the authoritative API data instead of the (possibly tampered) IPN body
        data = verified
        logger.info(f"NOWPayments IPN: sig mismatch but API confirmed {payment_id_check} → {data.get('payment_status')}")

    payment_id = str(data.get("payment_id", ""))
    payment_status = data.get("payment_status", "")
    logger.info(f"NOWPayments IPN: {payment_id} → {payment_status}")

    await db.nowpayments.update_one(
        {"payment_id": payment_id},
        {"$set": {"status": payment_status}},
    )

    if payment_status in FAILED_STATUSES:
        _rec = await db.nowpayments.find_one({"payment_id": payment_id})
        _who = (_rec or {}).get("user_email", "unknown")
        _amt = (_rec or {}).get("amount_usd", data.get("price_amount", 0)) or 0
        # Atomic dedup: only alert once per payment even if NOWPayments retries the IPN
        _flag = await db.nowpayments.update_one(
            {"payment_id": payment_id, "expired_alerted": {"$exists": False}},
            {"$set": {"expired_alerted": True,
                      "expired_alerted_at": datetime.now(timezone.utc).isoformat()}},
        )
        if _flag.modified_count == 1:
            tg_alert(
                f"⚠️ Crypto payment {payment_status.upper()}\n"
                f"👤 User: {_who}\n"
                f"💰 Amount: ${float(_amt):.2f}\n"
                f"🆔 Payment: {payment_id}\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
            )

    if payment_status in FINISHED_STATUSES:
        # 1. Try manual payment record — atomic claim prevents double-credit
        record = await db.nowpayments.find_one_and_update(
            {"payment_id": payment_id, "processed": False},
            {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}},
            return_document=True,
        )
        if record:
            await _credit_user(record, payment_status)
        else:
            # 2. Try invoice-based record (look up by order_id) — atomic claim
            order_id_from_ipn = data.get("order_id", "")
            if order_id_from_ipn:
                inv_record = await db.nowpayments_invoices.find_one_and_update(
                    {"order_id": order_id_from_ipn, "processed": False},
                    {"$set": {
                        "processed": True,
                        "processed_at": datetime.now(timezone.utc).isoformat(),
                        "payment_id": payment_id,
                        "pay_currency": data.get("pay_currency", "crypto"),
                        "status": payment_status,
                    }},
                    return_document=True,
                )
                if inv_record:
                    inv_record["payment_id"] = payment_id
                    inv_record["pay_currency"] = data.get("pay_currency", "crypto")
                    uid = inv_record["user_id"]
                    amt = float(inv_record["credits_to_add"])
                    now = datetime.now(timezone.utc)
                    await db.wallets.update_one({"user_id": uid}, {"$inc": {"balance": amt}}, upsert=True)
                    inv_tx_doc = {
                        "user_id": uid, "amount": amt, "type": "credit",
                        "description": f"Top-up via NOWPayments — ${amt:.2f} ({inv_record['pay_currency'].upper()})",
                        "source": "nowpayments", "payment_method": inv_record["pay_currency"],
                        "payment_id": payment_id, "order_id": order_id_from_ipn,
                        "created_at": now.isoformat(),
                    }
                    # Write to both collections: transactions (user-visible history) and
                    # wallet_transactions (revenue ledger / admin / telegram bot).
                    await db.transactions.insert_one(dict(inv_tx_doc))
                    await db.wallet_transactions.insert_one(dict(inv_tx_doc))
                    logger.info(f"NOWPayments invoice ✅ Credited ${amt} to {inv_record['user_email']} | order {order_id_from_ipn}")
                    try:
                        from services.telegram_admin_alerts import notify_admins
                        import asyncio as _a
                        wallet_doc = await db.wallets.find_one({"user_id": uid})
                        _bal = wallet_doc["balance"] if wallet_doc else amt
                        _coin = inv_record.get("pay_currency", "crypto").upper()
                        _a.create_task(notify_admins(
                            f"💰 New payment! {inv_record['user_email']} paid ${amt:.2f} ({_coin}) · wallet now ${_bal:.2f}",
                            also_email=False,
                        ))
                    except Exception as _te:
                        logger.warning(f"telegram alert failed (nowpay invoice): {_te}")
                    try:
                        from routes.push_notifications import send_push_notification, NotificationPayload
                        await send_push_notification(
                            uid,
                            NotificationPayload(
                                title="💰 Balance Added",
                                body=f"${amt:.2f} has been added to your Calliotel wallet.",
                                icon="/icon-192.png",
                                data={"type": "balance_added", "amount": amt},
                            )
                        )
                    except Exception as _pe:
                        logger.warning(f"push notification failed (nowpay invoice): {_pe}")
                    try:
                        from routes.payments import _maybe_grant_first_deposit_bonus
                        import asyncio as _a2
                        _a2.create_task(_maybe_grant_first_deposit_bonus(db, uid, amt))
                    except Exception as _be:
                        logger.warning(f"first-deposit bonus check failed: {_be}")
                    try:
                        from services.talk_offer import maybe_grant_talk_offer
                        import asyncio as _a3
                        _a3.create_task(maybe_grant_talk_offer(db, uid, amt))
                    except Exception as _te:
                        logger.warning(f"talk offer check failed: {_te}")
                else:
                    logger.info(f"NOWPayments IPN: order {order_id_from_ipn} already processed or not found — skipping")

    return {"ok": True}
