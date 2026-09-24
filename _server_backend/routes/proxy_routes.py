"""Sell SMSPVA HQ proxies on Calliotel. Optional router — must not take down auth."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db

try:
    from routes.auth import get_current_user
except Exception:
    from routes.auth_deps import get_current_user

import services.smspva_proxy_client as smspva

logger = logging.getLogger(__name__)
router = APIRouter()

ADMIN_EMAILS = {
    "admin@calliotel.com",
    "bigboss@calliotel.com",
    "alinmy77@gmail.com",
    "worl212211@yahoo.com",
    "astor539@gmail.com",
    "g_agroup2@yahoo.com",
}

POPULAR = ("us", "gb", "de", "fr", "nl", "es", "it", "ca", "pl", "tr", "al", "ua", "in", "br", "mx")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_admin(user: dict) -> bool:
    email = (user.get("email") or user.get("_id") or "").lower()
    return email in {a.lower() for a in ADMIN_EMAILS}


def _public_order(doc: dict) -> dict:
    host = doc.get("host") or ""
    http_port = int(doc.get("http_port") or 0)
    socks_port = int(doc.get("socks5_port") or http_port or 0)
    user = doc.get("username") or ""
    password = doc.get("password") or ""
    auth = f"{user}:{password}@" if user else ""
    return {
        "order_id": str(doc.get("order_id")),
        "country": doc.get("country"),
        "country_name": doc.get("country_name") or "",
        "type": doc.get("type") or smspva.TYPE_DEDICATED,
        "period": doc.get("period"),
        "price_paid": doc.get("price_paid"),
        "status": doc.get("status"),
        "host": host,
        "http_port": http_port,
        "socks5_port": socks_port,
        "username": user,
        "password": password,
        "http": f"http://{auth}{host}:{http_port}" if host and http_port else "",
        "socks5": f"socks5://{auth}{host}:{socks_port}" if host and socks_port else "",
        "line": f"{host}:{http_port}:{user}:{password}" if host and http_port else "",
        "expires_at": doc.get("expires_at") or "",
        "created_at": doc.get("created_at"),
    }


class BuyBody(BaseModel):
    country: str = Field(..., min_length=2, max_length=8)
    period: int = Field(default=5)
    amount: int = Field(default=1, ge=1, le=5)
    type: str = Field(default=smspva.TYPE_DEDICATED, max_length=32)


class AdminAuthBody(BaseModel):
    apikey: str = Field(default="", max_length=8000)
    cookie: str = Field(default="", max_length=8000)
    enabled: bool = True


@router.get("/status")
async def proxy_status():
    cookie = await smspva.load_cookie(db)
    return {
        "enabled": True,
        "sell": True,
        "supplier_ready": smspva.configured(cookie),
        "periods": list(smspva.PERIODS),
        "type": smspva.TYPE_DEDICATED,
        "type_label": "IPv4 Dedicated",
    }


@router.get("/catalog")
async def catalog():
    try:
        countries = await smspva.countries()
    except Exception as e:
        logger.warning("SMSPVA countries failed: %s", e)
        countries = []
    popular = [c for code in POPULAR for c in countries if c["code"] == code]
    rest = [c for c in countries if c["code"] not in POPULAR]
    cookie = await smspva.load_cookie(db)
    return {
        "configured": smspva.configured(cookie),
        "type": smspva.TYPE_DEDICATED,
        "type_label": "IPv4 Dedicated",
        "periods": list(smspva.PERIODS),
        "countries": popular + rest,
        "note": "Match proxy country to your OTP / WhatsApp number country.",
    }


def _public_quote(quoted: dict) -> dict:
    return {
        "available": bool(quoted.get("available")),
        "country": quoted.get("country"),
        "type": quoted.get("type"),
        "period": quoted.get("period"),
        "amount": quoted.get("amount"),
        "stock": quoted.get("stock"),
        "price": quoted.get("price"),
    }


@router.get("/quote")
async def quote(country: str, period: int = 5, amount: int = 1):
    try:
        return _public_quote(await smspva.quote(country, period, amount))
    except smspva.SmspvaProxyError as e:
        raise HTTPException(e.status_code, str(e)) from e
    except Exception as e:
        logger.warning("proxy quote failed: %s", e)
        return {"available": False, "country": country, "period": period, "price": None}


@router.post("/buy")
async def buy_proxy(body: BuyBody, current_user: dict = Depends(get_current_user)):
    cookie = await smspva.load_cookie(db)
    if not smspva.configured(cookie):
        raise HTTPException(
            503,
            "Proxy sales are not linked to the supplier yet. Try again in a few minutes.",
        )
    user_id = current_user["_id"]
    email = current_user.get("email", "")
    proxy_type = body.type if body.type in (smspva.TYPE_DEDICATED, "mtproxy") else smspva.TYPE_DEDICATED
    try:
        quoted = await smspva.quote(body.country, body.period, body.amount, proxy_type)
    except smspva.SmspvaProxyError as e:
        raise HTTPException(e.status_code, str(e)) from e
    except Exception as e:
        logger.warning("proxy quote on buy failed: %s", e)
        raise HTTPException(503, "Could not price that proxy right now.") from e
    if not quoted.get("available") or not quoted.get("price"):
        raise HTTPException(503, "That country is out of stock. Try another country or fewer days.")

    price = float(quoted["price"])
    cost = float(quoted.get("provider_cost") or 0)
    from services.paid_funds import assert_paid_covers
    from services.wallet_guard import credit as wallet_credit
    from services.wallet_guard import debit_if_funded

    wallet = await db.wallets.find_one({"user_id": user_id})
    assert_paid_covers(wallet, price)
    reserved = await debit_if_funded(db, user_id, price)
    if not reserved:
        balance = float(wallet.get("balance", 0)) if wallet else 0.0
        raise HTTPException(
            402,
            f"Insufficient balance. This proxy is ${price:.2f}. You have ${balance:.2f}.",
        )
    balance = float(reserved.get("balance", 0))

    owned = await db.proxy_orders.find({"provider_id": {"$exists": True}}).to_list(500)
    known_ids = {str(r.get("provider_id")) for r in owned if r.get("provider_id")}

    try:
        rented = await smspva.buy(
            cookie,
            quoted["country"],
            quoted["period"],
            quoted["amount"],
            proxy_type,
            known_ids=known_ids,
        )
    except smspva.SmspvaProxyError as e:
        logger.warning("SMSPVA buy refused: %s", e)
        await wallet_credit(db, user_id, price)
        raise HTTPException(e.status_code, str(e)) from e
    except Exception as e:
        logger.error("SMSPVA buy failed: %s", e)
        await wallet_credit(db, user_id, price)
        raise HTTPException(503, "Could not rent a proxy right now. You were not charged.") from e

    item = rented[0]
    now_iso = _now_iso()
    new_balance = round(float(balance), 2)
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "debit",
        "amount": price,
        "description": f"Proxy {quoted['country'].upper()} {quoted['period']}d IPv4",
        "balance_after": new_balance,
        "created_at": now_iso,
    })

    expires_at = ""
    ts = int(item.get("expire_timestamp") or 0)
    if ts:
        expires_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

    names = {c["code"]: c["name"] for c in await smspva.countries()}
    doc = {
        "order_id": str(uuid.uuid4()),
        "user_id": user_id,
        "provider": "smspva",
        "provider_id": item.get("provider_id"),
        "country": quoted["country"],
        "country_name": names.get(quoted["country"], quoted["country"].upper()),
        "type": proxy_type,
        "period": quoted["period"],
        "amount": quoted["amount"],
        "price_paid": price,
        "provider_cost": cost,
        "status": "active",
        "host": item.get("host"),
        "http_port": item.get("http_port"),
        "socks5_port": item.get("socks5_port"),
        "username": item.get("username"),
        "password": item.get("password"),
        "expires_at": expires_at,
        "created_at": now_iso,
    }
    await db.proxy_orders.insert_one(doc)

    try:
        from services.telegram_admin_alerts import notify_admins
        import asyncio
        asyncio.create_task(notify_admins(
            (
                f"🌐 PROXY SOLD\n"
                f"{quoted['country'].upper()} · {quoted['period']} days\n"
                f"💵 Paid ${price:.2f} · cost ${cost:.2f}\n"
                f"👤 {email}\n"
                f"💰 Wallet ${new_balance:.2f}"
            ),
            email_subject="🌐 Proxy sold",
        ))
    except Exception as tg_err:
        logger.warning("proxy admin alert failed: %s", tg_err)

    return {"success": True, **_public_order(doc), "new_balance": new_balance}


@router.get("/my-orders")
async def my_orders(current_user: dict = Depends(get_current_user)):
    rows = await db.proxy_orders.find({"user_id": current_user["_id"]}).sort("created_at", -1).to_list(50)
    return {"orders": [_public_order(r) for r in rows]}


@router.get("/admin")
async def proxy_admin_get(current_user: dict = Depends(get_current_user)):
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    cookie = await smspva.load_cookie(db)
    ready = smspva.configured(cookie)
    sold = await db.proxy_orders.count_documents({})
    return {
        "configured": ready,
        "supplier_ready": ready,
        "cookie_set": ready,
        "sold": sold,
        "source": "env" if smspva.cookie_from_env() else ("db" if ready else ""),
    }


@router.put("/admin")
async def proxy_admin_save(body: AdminAuthBody, current_user: dict = Depends(get_current_user)):
    if not _is_admin(current_user):
        raise HTTPException(403, "Admin only")
    if not body.enabled:
        await smspva.save_cookie(db, "")
        return {"ok": True, "configured": False, "supplier_ready": False}
    cookie = (body.apikey or body.cookie or "").strip()
    if not cookie:
        raise HTTPException(400, "Paste the SMSPVA API key from Profile & API key.")
    await smspva.save_cookie(db, cookie)
    try:
        await smspva.list_active(cookie)
        linked = True
    except Exception as e:
        logger.warning("SMSPVA cookie check failed: %s", e)
        linked = False
    return {
        "ok": True,
        "configured": True,
        "supplier_ready": linked,
        "cookie_set": True,
        "note": None if linked else "Saved, but SMSPVA did not accept that key yet. Copy API key from Profile & API key.",
    }
