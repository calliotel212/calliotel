"""
One-time OTP numbers via North SMS.

Optional router — import failure must never take down signup/login.
Lane B: keep off production until the owner says push.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
try:
    from routes.auth import get_current_user
except Exception:
    from routes.auth_deps import get_current_user
import services.northsms_client as north
from services.fraud_protection import check_otp_purchase, record_otp_purchase

logger = logging.getLogger(__name__)
router = APIRouter()

SELL_PRICE = 0.99
OTP_EXPIRE_MINUTES = 6
NORTH_CANCEL_WAIT_SECONDS = 120

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,78}$")

COUNTRIES = [
    {"code": "auto", "name": "Auto (cheapest)", "flag": "🌍"},
    {"code": "usa", "name": "United States", "flag": "🇺🇸"},
    {"code": "england", "name": "United Kingdom", "flag": "🇬🇧"},
    {"code": "canada", "name": "Canada", "flag": "🇨🇦"},
    {"code": "philippines", "name": "Philippines", "flag": "🇵🇭"},
    {"code": "indonesia", "name": "Indonesia", "flag": "🇮🇩"},
    {"code": "southafrica", "name": "South Africa", "flag": "🇿🇦"},
    {"code": "cambodia", "name": "Cambodia", "flag": "🇰🇭"},
    {"code": "malaysia", "name": "Malaysia", "flag": "🇲🇾"},
    {"code": "egypt", "name": "Egypt", "flag": "🇪🇬"},
]

class BuyBody(BaseModel):
    service: str = Field(..., min_length=2, max_length=80)
    country: str = Field(default="auto", min_length=2, max_length=40)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


async def _require_service(code: str) -> str:
    slug = north.slug_for(code)
    if not _SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="Unknown service")
    try:
        known = await north.known_slugs()
    except Exception:
        known = set()
    if known and slug not in known:
        raise HTTPException(status_code=404, detail="Unknown service")
    return slug


def _price(service: str, provider_cost: Optional[float] = None) -> float:
    if provider_cost is not None:
        quoted = north.quote_sell(service, provider_cost)
        if quoted is not None:
            return quoted
    return north.sell_price(service)


def _public_order(doc: dict) -> dict:
    return {
        "order_id": str(doc.get("order_id")),
        "phone_number": doc.get("phone_number"),
        "service": doc.get("service"),
        "service_name": doc.get("service_name"),
        "country": doc.get("country"),
        "price_paid": doc.get("price_paid", SELL_PRICE),
        "status": doc.get("status"),
        "sms_code": doc.get("sms_code"),
        "sms_text": doc.get("sms_text"),
        "created_at": doc.get("created_at"),
        "expires_at": doc.get("expires_at"),
        "refunded": bool(doc.get("refunded")),
    }


def _block_usa_whatsapp(service: str, iso2: Optional[str]) -> None:
    if north.is_whatsapp(service) and (iso2 or "").upper() == "US":
        raise HTTPException(
            status_code=503,
            detail="USA WhatsApp is not sold here — the supplier costs $1.49. Use Auto country instead.",
        )


@router.get("/catalog")
async def catalog():
    services = await north.catalog_services()
    return {
        "price": SELL_PRICE,
        "expire_minutes": OTP_EXPIRE_MINUTES,
        "provider": "calliotel",
        "service_count": len(services),
        "services": services,
        "countries": COUNTRIES,
        "configured": north.configured(),
    }


@router.get("/availability")
async def availability(service: str, country: str = "auto"):
    service = await _require_service(service)
    country = country.strip().lower()
    price = _price(service)
    try:
        if country in ("auto", "any"):
            best = await north.cheapest_country(service, cap=1.45)
            if not best:
                return {"available": False, "price": price}
            quoted = north.quote_sell(service, best[1])
            if not quoted:
                return {"available": False, "price": price, "country": best[0]}
            return {
                "available": True,
                "price": quoted,
                "country": best[0],
                "provider_cost": best[1],
            }
        iso2 = north.iso_for(country)
        if not iso2:
            return {"available": False, "price": price, "country": country}
        if north.is_whatsapp(service) and iso2 == "US":
            return {
                "available": False,
                "price": price,
                "country": iso2,
                "reason": "usa_whatsapp_hidden",
            }
        cost = await north.country_price(service, iso2)
        quoted = north.quote_sell(service, cost) if cost is not None else None
        if cost is None or quoted is None or cost > north.max_provider_cost(service, quoted):
            return {"available": False, "price": price, "country": iso2}
        return {"available": True, "price": quoted, "country": iso2, "provider_cost": cost}
    except Exception as e:
        logger.error("North SMS availability error: %s", e)
        return {"available": False, "price": price}


@router.post("/buy")
async def buy_one_otp(body: BuyBody, current_user=Depends(get_current_user)):
    if not north.configured() and os.environ.get("LOCAL_OTP_DEV") != "1":
        raise HTTPException(
            status_code=503,
            detail="This product is not available right now. Please try again shortly.",
        )

    service = await _require_service(body.service)
    country_req = body.country.strip().lower()
    user_id = current_user["_id"]
    email = current_user.get("email", "")
    svc_name = await north.service_name(service)
    price = _price(service)
    iso2 = "PH"
    provider_cost = None

    try:
        await check_otp_purchase(user_id=str(user_id), user_email=email)
    except ValueError as fraud_err:
        raise HTTPException(status_code=429, detail=str(fraud_err))

    try:
        if country_req in ("auto", "any"):
            best = None
            try:
                best = await north.cheapest_country(service, cap=1.45)
            except Exception as e:
                logger.warning("North SMS cheapest lookup failed: %s", e)
            if not best and os.environ.get("LOCAL_OTP_DEV") == "1" and not north.configured():
                iso2 = "PH" if north.is_whatsapp(service) else "US"
            elif not best:
                raise HTTPException(
                    status_code=503,
                    detail="No numbers available under our cost cap for that service right now.",
                )
            else:
                iso2, provider_cost = best
                quoted = north.quote_sell(service, provider_cost)
                if not quoted:
                    raise HTTPException(
                        status_code=503,
                        detail="That service costs more than we can sell right now. Try another app.",
                    )
                price = quoted
        else:
            iso2 = north.iso_for(country_req)
            if not iso2:
                raise HTTPException(status_code=400, detail="Unknown country")
            _block_usa_whatsapp(service, iso2)
            cost = None
            try:
                cost = await north.country_price(service, iso2)
            except Exception as e:
                logger.warning("North SMS country price failed: %s", e)
            if cost is None and not (os.environ.get("LOCAL_OTP_DEV") == "1" and not north.configured()):
                raise HTTPException(
                    status_code=503,
                    detail="That country is out of stock or costs too much. Try Auto.",
                )
            if cost is not None:
                quoted = north.quote_sell(service, cost)
                if not quoted or cost > north.max_provider_cost(service, quoted):
                    raise HTTPException(
                        status_code=503,
                        detail="That country costs more than we can sell at this price. Try Auto.",
                    )
                price = quoted
                provider_cost = cost
        _block_usa_whatsapp(service, iso2)

        wallet = await db.wallets.find_one({"user_id": user_id})
        balance = float(wallet.get("balance", 0)) if wallet else 0.0
        if balance < price:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient balance. One OTP is ${price:.2f}. You have ${balance:.2f}.",
            )

        purchased = await north.buy(service, iso2, max_price=north.max_provider_cost(service, price))
    except HTTPException:
        raise
    except north.NorthSmsError as e:
        logger.warning("buy refused: %s", e)
        raise HTTPException(status_code=e.status_code, detail="Could not assign a number right now. Please try again.")
    except Exception as e:
        logger.error("North SMS buy failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not assign a number right now. Please try again.")

    order_id = purchased.get("code")
    phone = purchased.get("phoneNumber") or purchased.get("phone_number")
    if not order_id or not phone:
        raise HTTPException(status_code=503, detail="Could not assign a number right now. Please try again.")

    now_iso = _now_iso()
    expires_at = _now() + timedelta(minutes=OTP_EXPIRE_MINUTES)
    new_balance = round(balance - price, 2)
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$set": {"balance": new_balance, "updated_at": now_iso}},
    )
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "debit",
        "amount": price,
        "description": f"One-time OTP — {svc_name} ({phone})",
        "balance_after": new_balance,
        "created_at": now_iso,
    })
    try:
        await record_otp_purchase(user_id=str(user_id), service=service, amount_usd=price)
    except Exception as fe:
        logger.warning("fraud record failed (non-critical): %s", fe)

    doc = {
        "user_id": user_id,
        "order_id": str(order_id),
        "phone_number": phone,
        "service": service,
        "service_name": svc_name,
        "country": iso2,
        "price_paid": price,
        "provider_cost": purchased.get("sellingPrice"),
        "provider": "calliotel",
        "status": "waiting",
        "sms_code": None,
        "sms_text": None,
        "created_at": now_iso,
        "expires_at": expires_at.isoformat(),
        "refunded": False,
    }
    await db.fivesim_otp_orders.insert_one(doc)

    try:
        from services.telegram_admin_alerts import notify_admins
        import asyncio
        asyncio.create_task(notify_admins(
            (
                f"🔢 NEW ONE-TIME OTP PURCHASED\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📱 Number: {phone}\n"
                f"🌍 Country: {iso2}\n"
                f"📲 Service: {svc_name}\n"
                f"💵 Paid: ${price:.2f}\n"
                f"🏭 North cost: ${purchased.get('sellingPrice')}\n"
                f"👤 {email}\n"
                f"💰 Wallet after: ${new_balance:.2f}"
            ),
            email_subject="🔢 One-time OTP purchase",
        ))
    except Exception as tg_err:
        logger.warning("Admin OTP alert failed (non-critical): %s", tg_err)

    return {
        "success": True,
        **_public_order(doc),
        "new_balance": new_balance,
    }


def _got_code(remote: dict) -> bool:
    label = north.status_label(remote)
    code, _ = north.extract_sms(remote)
    return label in ("completed", "complete") or bool(code)


@router.get("/status/{order_id}")
async def status(order_id: str, current_user=Depends(get_current_user)):
    user_id = current_user["_id"]
    order = await db.fivesim_otp_orders.find_one({"order_id": str(order_id), "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["status"] in ("got_sms", "cancelled"):
        return _public_order(order)

    expires_dt = datetime.fromisoformat(order["expires_at"].replace("Z", "+00:00"))
    try:
        remote = await north.get_order(order_id)
    except north.NorthSmsError as e:
        logger.warning("status refused: %s", e)
        raise HTTPException(status_code=e.status_code, detail="Could not check this number right now. Please try again.")
    except Exception as e:
        logger.error("North SMS status failed: %s", e)
        remote = {}

    code, text = north.extract_sms(remote if isinstance(remote, dict) else {})
    label = north.status_label(remote if isinstance(remote, dict) else {})

    if _got_code(remote if isinstance(remote, dict) else {}):
        now_iso = _now_iso()
        await db.fivesim_otp_orders.update_one(
            {"order_id": str(order_id)},
            {"$set": {
                "status": "got_sms",
                "sms_code": code,
                "sms_text": text,
                "received_at": now_iso,
            }},
        )
        try:
            await north.finish(order_id)
        except Exception:
            pass
        order["status"] = "got_sms"
        order["sms_code"] = code
        order["sms_text"] = text
        return _public_order(order)

    if label in ("cancelled", "canceled", "expired") or _now() >= expires_dt:
        await _cancel_and_refund(str(order_id), user_id, order, force=True)
        order["status"] = "cancelled"
        order["refunded"] = True
        return _public_order(order)

    return _public_order(order)


@router.post("/cancel/{order_id}")
async def cancel(order_id: str, current_user=Depends(get_current_user)):
    user_id = current_user["_id"]
    order = await db.fivesim_otp_orders.find_one({"order_id": str(order_id), "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] == "got_sms" or order.get("sms_code"):
        raise HTTPException(status_code=400, detail="SMS already received — this order is not refundable")
    if order.get("refunded"):
        raise HTTPException(status_code=400, detail="Already refunded")

    created = datetime.fromisoformat(str(order["created_at"]).replace("Z", "+00:00"))
    waited = (_now() - created).total_seconds()
    if waited < NORTH_CANCEL_WAIT_SECONDS:
        left = int(NORTH_CANCEL_WAIT_SECONDS - waited)
        raise HTTPException(
            status_code=400,
            detail=f"Wait {left}s more before cancel. Cancel opens after 2 minutes. Your 6-minute refund clock is still running.",
        )

    try:
        remote = await north.get_order(order_id)
        if _got_code(remote if isinstance(remote, dict) else {}):
            code, text = north.extract_sms(remote)
            await db.fivesim_otp_orders.update_one(
                {"order_id": str(order_id)},
                {"$set": {
                    "status": "got_sms",
                    "sms_code": code,
                    "sms_text": text,
                    "received_at": _now_iso(),
                }},
            )
            raise HTTPException(status_code=400, detail="SMS already received — this order is not refundable")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("North SMS pre-cancel check failed: %s", e)

    await _cancel_and_refund(str(order_id), user_id, order, force=False)
    return {"success": True, "refunded": order.get("price_paid", SELL_PRICE)}


@router.get("/my-orders")
async def my_orders(limit: int = 20, current_user=Depends(get_current_user)):
    user_id = current_user["_id"]
    rows = await db.fivesim_otp_orders.find(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        limit=min(limit, 50),
    ).to_list(length=min(limit, 50))
    return {"orders": [_public_order(r) for r in rows]}


async def _cancel_and_refund(order_id: str, user_id, order: dict, force: bool) -> None:
    if order.get("status") == "got_sms" or order.get("sms_code"):
        logger.warning("Blocked North SMS OTP refund — SMS already on %s", order_id)
        return
    try:
        await north.cancel(order_id)
    except north.NorthSmsError as e:
        waitish = "2 minute" in (e.message or "").lower() or "two minute" in (e.message or "").lower()
        if waitish and not force:
            raise HTTPException(
                status_code=400,
                detail="Wait a bit longer before cancel. Cancel opens after 2 minutes.",
            )
        logger.warning("North SMS cancel failed (still refunding if unused): %s", e)
    except Exception as e:
        logger.warning("North SMS cancel failed (still refunding if unused): %s", e)

    wallet = await db.wallets.find_one({"user_id": user_id})
    refund = float(order.get("price_paid") or SELL_PRICE)
    if wallet:
        new_bal = round(float(wallet.get("balance", 0)) + refund, 2)
        now_iso = _now_iso()
        await db.wallets.update_one(
            {"user_id": user_id},
            {"$set": {"balance": new_bal, "updated_at": now_iso}},
        )
        await db.transactions.insert_one({
            "user_id": user_id,
            "type": "credit",
            "amount": refund,
            "description": f"Refund — OTP {order['service_name']} ({order['phone_number']}) no SMS",
            "balance_after": new_bal,
            "created_at": now_iso,
        })
    await db.fivesim_otp_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "cancelled", "refunded": True}},
    )
