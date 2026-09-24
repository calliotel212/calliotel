import os
import logging
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routes.auth import get_current_user
from database import db
from services.fraud_protection import check_otp_purchase, record_otp_purchase

logger = logging.getLogger(__name__)
router = APIRouter()

HEROSMS_API_KEY = os.environ.get("HEROSMS_API_KEY", "")
HEROSMS_BASE = "https://hero-sms.com/stubs/handler_api.php"
MARKUP = 2.0
MIN_PRICE = 0.50
OTP_EXPIRE_MINUTES = 20

# Known service codes → display info (icon + color)
SERVICES = {
    "wa":  {"name": "WhatsApp",        "icon": "💬", "color": "#25D366"},
    "tg":  {"name": "Telegram",        "icon": "✈️",  "color": "#2AABEE"},
    "go":  {"name": "Google",          "icon": "🔍", "color": "#4285F4"},
    "ig":  {"name": "Instagram",       "icon": "📸", "color": "#E1306C"},
    "fb":  {"name": "Facebook",        "icon": "👤", "color": "#1877F2"},
    "tt":  {"name": "TikTok",          "icon": "🎵", "color": "#010101"},
    "tw":  {"name": "Twitter / X",     "icon": "🐦", "color": "#1DA1F2"},
    "am":  {"name": "Amazon",          "icon": "📦", "color": "#FF9900"},
    "nf":  {"name": "Netflix",         "icon": "🎬", "color": "#E50914"},
    "ub":  {"name": "Uber",            "icon": "🚗", "color": "#000000"},
    "li":  {"name": "LinkedIn",        "icon": "💼", "color": "#0A66C2"},
    "ya":  {"name": "Yahoo",           "icon": "📧", "color": "#720E9E"},
    "vk":  {"name": "VKontakte",       "icon": "🌐", "color": "#4680C2"},
    "wb":  {"name": "WeChat",          "icon": "💚", "color": "#07C160"},
    "ds":  {"name": "Discord",         "icon": "🎮", "color": "#5865F2"},
    "ms":  {"name": "Messenger",       "icon": "💬", "color": "#0099FF"},
    "sp":  {"name": "Spotify",         "icon": "🎵", "color": "#1DB954"},
    "ap":  {"name": "Apple",           "icon": "🍎", "color": "#555555"},
    "pp":  {"name": "PayPal",          "icon": "💳", "color": "#003087"},
    "sk":  {"name": "Skype",           "icon": "☎️",  "color": "#00AFF0"},
    "sn":  {"name": "Snapchat",        "icon": "👻", "color": "#FFFC00"},
    "pi":  {"name": "Pinterest",       "icon": "📌", "color": "#E60023"},
    "rb":  {"name": "Roblox",          "icon": "🎮", "color": "#FF0000"},
    "st":  {"name": "Steam",           "icon": "🎮", "color": "#1B2838"},
    "bc":  {"name": "Binance",         "icon": "₿",  "color": "#F3BA2F"},
    "al":  {"name": "AliExpress",      "icon": "🛍️", "color": "#FF4747"},
    "vi":  {"name": "Viber",           "icon": "📲", "color": "#665CAC"},
    "sl":  {"name": "Slack",           "icon": "💬", "color": "#4A154B"},
    "ok":  {"name": "Odnoklassniki",   "icon": "🌐", "color": "#EE8208"},
    "ma":  {"name": "Mail.ru",         "icon": "📧", "color": "#005FF9"},
    "av":  {"name": "Avito",           "icon": "🏪", "color": "#00AAFF"},
    "oz":  {"name": "Ozon",            "icon": "🛒", "color": "#005BFF"},
    "wu":  {"name": "Western Union",   "icon": "💸", "color": "#FCC200"},
    "bk":  {"name": "Booking.com",     "icon": "🏨", "color": "#003580"},
    "yt":  {"name": "YouTube",         "icon": "▶️",  "color": "#FF0000"},
    "tr":  {"name": "Truecaller",      "icon": "📞", "color": "#009FDA"},
    "tu":  {"name": "Tumblr",          "icon": "🌐", "color": "#35465C"},
    "sd":  {"name": "Shopee",          "icon": "🛍️", "color": "#EE4D2D"},
    "la":  {"name": "Lazada",          "icon": "🛒", "color": "#F57224"},
    "td":  {"name": "Tokopedia",       "icon": "🛒", "color": "#42B549"},
    "mm":  {"name": "Microsoft",       "icon": "🪟", "color": "#0078D4"},
    "ku":  {"name": "KuCoin",          "icon": "💰", "color": "#23AF91"},
    "dp":  {"name": "Dropbox",         "icon": "📁", "color": "#0061FF"},
    "wm":  {"name": "WebMoney",        "icon": "💳", "color": "#005BAC"},
    "nb":  {"name": "Naver",           "icon": "🔍", "color": "#03C75A"},
    "in":  {"name": "Indeed",          "icon": "💼", "color": "#2557A7"},
    "lb":  {"name": "Lyft",            "icon": "🚗", "color": "#FF00BF"},
    "wi":  {"name": "Wildberries",     "icon": "🛒", "color": "#CC1F78"},
    "yb":  {"name": "YooMoney",        "icon": "💳", "color": "#8B3BFF"},
    "jt":  {"name": "Just Eat",        "icon": "🍔", "color": "#FF8000"},
    "gm":  {"name": "Gmail",           "icon": "📧", "color": "#EA4335"},
    "ot":  {"name": "Other",           "icon": "📱", "color": "#888888"},
    "mx":  {"name": "Maxim",           "icon": "🚗", "color": "#FF6600"},
    "mk":  {"name": "MoiKrug",         "icon": "🌐", "color": "#0077FF"},
    "pt":  {"name": "Paytm",           "icon": "💳", "color": "#002970"},
    "nx":  {"name": "Nexon",           "icon": "🎮", "color": "#E23636"},
    "dr":  {"name": "Drom.ru",         "icon": "🚗", "color": "#E30613"},
    "kz":  {"name": "Kaspi",           "icon": "💳", "color": "#F14635"},
    "ev":  {"name": "Exmo",            "icon": "💰", "color": "#2D6EBE"},
    "hh":  {"name": "HeadHunter",      "icon": "💼", "color": "#D1021B"},
    "gi":  {"name": "Grindr",          "icon": "🌐", "color": "#FFCC00"},
    "fp":  {"name": "FreedomPay",      "icon": "💳", "color": "#0065BD"},
    "bz":  {"name": "Bumble",          "icon": "💛", "color": "#FFCC00"},
    "td2": {"name": "Tinder",          "icon": "🔥", "color": "#FF4458"},
    "tn":  {"name": "Tinder",          "icon": "🔥", "color": "#FF4458"},
    "ba":  {"name": "Badoo",           "icon": "💬", "color": "#E83E8C"},
    "lv":  {"name": "Letgo / Wallapop","icon": "🛒", "color": "#13C1AC"},
    "cr":  {"name": "Craigslist",      "icon": "🌐", "color": "#6B3FA0"},
    "po":  {"name": "POF Dating",      "icon": "💬", "color": "#0197C8"},
    "ek":  {"name": "eBay Kleinanz.",  "icon": "🛒", "color": "#E53238"},
    "eb":  {"name": "eBay",            "icon": "🛒", "color": "#E53238"},
    "et":  {"name": "Etsy",            "icon": "🛒", "color": "#F56400"},
    "ol":  {"name": "OLX",             "icon": "🛒", "color": "#3498DB"},
    "mx2": {"name": "MercadoLibre",    "icon": "🛒", "color": "#FFE600"},
    "fl":  {"name": "Flipkart",        "icon": "🛒", "color": "#2874F0"},
    "sw":  {"name": "Swiggy",          "icon": "🍔", "color": "#FC8019"},
    "zo":  {"name": "Zomato",          "icon": "🍔", "color": "#E23744"},
    "gj":  {"name": "Grab",            "icon": "🚗", "color": "#00B14F"},
    "go2": {"name": "GoJek",           "icon": "🚗", "color": "#00AA13"},
    "di":  {"name": "DiDi",            "icon": "🚗", "color": "#FF6600"},
    "lf":  {"name": "Lazada Food",     "icon": "🍔", "color": "#F57224"},
    "cf":  {"name": "Carrefour",       "icon": "🛒", "color": "#0070AC"},
    "ab":  {"name": "Airbnb",          "icon": "🏠", "color": "#FF5A5F"},
    "ep":  {"name": "Expedia",         "icon": "✈️",  "color": "#00355F"},
    "bw":  {"name": "Bybit",           "icon": "💰", "color": "#F7A600"},
    "ok2": {"name": "OKX",             "icon": "💰", "color": "#000000"},
    "ga":  {"name": "Gate.io",         "icon": "💰", "color": "#2354E6"},
    "ht":  {"name": "HTX (Huobi)",     "icon": "💰", "color": "#2F70BC"},
    "mx3": {"name": "MEXC",            "icon": "💰", "color": "#1B51CE"},
    "bm":  {"name": "Bitmart",         "icon": "💰", "color": "#1F8EFA"},
    "ph":  {"name": "Phemex",          "icon": "💰", "color": "#00B8D9"},
    "co":  {"name": "Coinbase",        "icon": "💰", "color": "#0052FF"},
    "kr":  {"name": "Kraken",          "icon": "💰", "color": "#5841D8"},
    "ce":  {"name": "Celsius",         "icon": "💰", "color": "#0F2B5B"},
    "nx2": {"name": "Nexus",           "icon": "💰", "color": "#7C3AED"},
    "ld":  {"name": "Ledger",          "icon": "💰", "color": "#000000"},
    "cm":  {"name": "CoinMarketCap",   "icon": "📊", "color": "#3861FB"},
    "cg":  {"name": "CoinGecko",       "icon": "📊", "color": "#8DC647"},
    "pn":  {"name": "PancakeSwap",     "icon": "🥞", "color": "#1FC7D4"},
    "un":  {"name": "Uniswap",         "icon": "🦄", "color": "#FF007A"},
    "tm2": {"name": "Trust Wallet",    "icon": "💰", "color": "#3375BB"},
    "mm2": {"name": "MetaMask",        "icon": "🦊", "color": "#F6851B"},
    "pi2": {"name": "Pi Network",      "icon": "π",  "color": "#9B59B6"},
    "ft":  {"name": "FTX",             "icon": "💰", "color": "#02A9C7"},
    "bb":  {"name": "BitBay",          "icon": "💰", "color": "#1F4FBF"},
    "zb":  {"name": "ZB.com",          "icon": "💰", "color": "#2B6DE8"},
    "nx3": {"name": "NEXO",            "icon": "💰", "color": "#1A67CB"},
}

COUNTRIES = [
    {"code": "187", "name": "United States", "flag": "🇺🇸"},
    {"code": "16",  "name": "United Kingdom","flag": "🇬🇧"},
    {"code": "15",  "name": "India",          "flag": "🇮🇳"},
    {"code": "22",  "name": "Indonesia",      "flag": "🇮🇩"},
    {"code": "6",   "name": "China",          "flag": "🇨🇳"},
    {"code": "73",  "name": "Vietnam",        "flag": "🇻🇳"},
    {"code": "5",   "name": "Myanmar",        "flag": "🇲🇲"},
    {"code": "14",  "name": "Hong Kong",      "flag": "🇭🇰"},
]

# Category mapping — used by frontend tabs
SERVICE_CATEGORIES = {
    "social":        ["wa", "tg", "ig", "fb", "tt", "tw", "vk", "ok", "ds", "ms", "sk", "sn", "vi", "sl", "wb", "pi", "tu", "ba", "bz", "tn", "gi", "po"],
    "google_apple":  ["go", "gm", "ap", "yt"],
    "finance":       ["pp", "wu", "wm", "yb", "pa", "fp", "kz", "pt"],
    "crypto":        ["bc", "ku", "bw", "ok2", "ga", "ht", "mx3", "bm", "ph", "co", "kr", "cm", "cg", "pn", "un", "tm2", "mm2", "pi2", "ev"],
    "shopping":      ["am", "al", "oz", "av", "wi", "sd", "la", "td", "eb", "et", "ol", "fl", "mx2", "lv", "ek", "cf"],
    "entertainment": ["nf", "sp", "rb", "st", "yt", "nx"],
    "transport":     ["ub", "lb", "mx", "gj", "go2", "di"],
    "food":          ["jt", "sw", "zo"],
    "work":          ["li", "in", "hh"],
    "travel":        ["bk", "ab", "ep"],
    "other":         ["tr", "ya", "nb", "dr", "mk", "mm", "dp", "ot"],
}


def _service_info(code: str) -> dict:
    """Return display info for a service code. Falls back to generic for unknown codes."""
    if code in SERVICES:
        return SERVICES[code]
    return {"name": code.upper(), "icon": "📱", "color": "#6366f1"}


def _service_category(code: str) -> str:
    for cat, codes in SERVICE_CATEGORIES.items():
        if code in codes:
            return cat
    return "other"


def calc_user_price(cost: float) -> float:
    return round(max(MIN_PRICE, cost * MARKUP), 2)


async def _provider_request(params: dict) -> str:
    params["api_key"] = HEROSMS_API_KEY
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(HEROSMS_BASE, params=params)
        return r.text.strip()


@router.get("/countries")
async def get_countries():
    return {"countries": COUNTRIES}


@router.get("/services")
async def get_services(country: str = "187"):
    """Return ALL available services with user-facing prices for a given country."""
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(HEROSMS_BASE, params={
                "api_key": HEROSMS_API_KEY,
                "action":  "getPrices",
                "country": country,
            })
            data = r.json()

        if not isinstance(data, dict):
            return {"services": _default_services(), "countries": COUNTRIES}

        seen   = set()
        out    = []

        for op_data in data.values():
            if not isinstance(op_data, dict):
                continue
            for code, svc_data in op_data.items():
                if code in seen:
                    continue
                if not isinstance(svc_data, dict):
                    continue
                cost  = float(svc_data.get("cost", 0))
                count = int(svc_data.get("count", 0))
                if count > 0 and cost > 0:
                    info = _service_info(code)
                    out.append({
                        "code":      code,
                        "name":      info["name"],
                        "icon":      info["icon"],
                        "color":     info["color"],
                        "available": count,
                        "price":     calc_user_price(cost),
                        "category":  _service_category(code),
                    })
                    seen.add(code)

        # Sort: most available first
        out.sort(key=lambda x: x["available"], reverse=True)
        return {"services": out, "countries": COUNTRIES, "total": len(out)}

    except Exception as e:
        logger.error(f"OTP get_services error: {e}")
        return {"services": _default_services(), "countries": COUNTRIES, "total": len(_default_services())}


def _default_services():
    return [
        {"code": "wa",  "name": "WhatsApp",  "icon": "💬", "color": "#25D366", "available": 330000, "price": MIN_PRICE, "category": "social"},
        {"code": "tg",  "name": "Telegram",  "icon": "✈️",  "color": "#2AABEE", "available": 120000, "price": MIN_PRICE, "category": "social"},
        {"code": "go",  "name": "Google",    "icon": "🔍", "color": "#4285F4", "available": 95000,  "price": MIN_PRICE, "category": "google_apple"},
        {"code": "ig",  "name": "Instagram", "icon": "📸", "color": "#E1306C", "available": 80000,  "price": MIN_PRICE, "category": "social"},
        {"code": "fb",  "name": "Facebook",  "icon": "👤", "color": "#1877F2", "available": 75000,  "price": MIN_PRICE, "category": "social"},
        {"code": "tt",  "name": "TikTok",    "icon": "🎵", "color": "#555555", "available": 60000,  "price": MIN_PRICE, "category": "social"},
    ]


class BuyRequest(BaseModel):
    service: str
    country: str = "187"


@router.post("/buy")
async def buy_otp_number(req: BuyRequest, current_user=Depends(get_current_user)):
    """Purchase an OTP number and deduct from wallet."""
    user_id = current_user["_id"]

    # 1. Get live price from provider
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(HEROSMS_BASE, params={
            "api_key": HEROSMS_API_KEY,
            "action":  "getPrices",
            "service": req.service,
            "country": req.country,
        })
        price_data = r.json()

    cost = 0.0
    if isinstance(price_data, dict):
        for op_data in price_data.values():
            if isinstance(op_data, dict) and req.service in op_data:
                cost = float(op_data[req.service].get("cost", 0))
                break

    if cost <= 0:
        raise HTTPException(status_code=404, detail="Service not available in this country right now. Try a different country.")

    user_price = calc_user_price(cost)

    # 2. Fraud / velocity check
    try:
        await check_otp_purchase(user_id=str(user_id), user_email=current_user.get("email", ""))
    except ValueError as fraud_err:
        raise HTTPException(status_code=429, detail=str(fraud_err))

    from services.wallet_guard import credit as wallet_credit
    from services.wallet_guard import debit_if_funded

    wallet  = await db.wallets.find_one({"user_id": user_id})
    reserved = await debit_if_funded(db, user_id, user_price)
    if not reserved:
        balance = float(wallet.get("balance", 0)) if wallet else 0.0
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance. You need ${user_price:.2f} but have ${balance:.2f}."
        )
    balance = float(reserved.get("balance", 0))

    # 3. Get number from provider
    result = await _provider_request({"action": "getNumber", "service": req.service, "operator": "any", "country": req.country})
    logger.info(f"OTP getNumber [{req.service}/{req.country}]: {result[:40]}")

    if not result.startswith("ACCESS_NUMBER"):
        await wallet_credit(db, user_id, user_price)
        if "NO_NUMBERS" in result:
            raise HTTPException(status_code=503, detail="No numbers available right now. Try a different country or check back in a few minutes.")
        raise HTTPException(status_code=503, detail="Could not assign a number right now. Please try again.")

    parts        = result.split(":")
    order_id     = parts[1]
    phone_number = parts[2]

    svc_name = _service_info(req.service)["name"]

    now_iso = datetime.now(timezone.utc).isoformat()
    new_balance = round(float(balance), 2)

    # Fraud record (velocity tracking)
    try:
        await record_otp_purchase(user_id=str(user_id), service=req.service, amount_usd=user_price)
    except Exception as _fe:
        logger.warning(f"fraud record failed (non-critical): {_fe}")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    # 5. Log transaction
    await db.transactions.insert_one({
        "user_id":       user_id,
        "type":          "debit",
        "amount":        user_price,
        "description":   f"OTP number — {svc_name} ({phone_number})",
        "balance_after": new_balance,
        "created_at":    now_iso,
    })

    # 6. Save order
    await db.otp_orders.insert_one({
        "user_id":      user_id,
        "order_id":     order_id,
        "phone_number": phone_number,
        "service":      req.service,
        "service_name": svc_name,
        "country":      req.country,
        "price_paid":   user_price,
        "status":       "waiting",
        "sms_code":     None,
        "sms_text":     None,
        "created_at":   now_iso,
        "expires_at":   expires_at.isoformat(),
        "refunded":     False,
    })

    # 7. Admin Telegram alert
    try:
        from services.telegram_admin_alerts import notify_admins
        user_email = current_user.get("email", "unknown")
        country_names = {
            "187": "🇺🇸 US", "16": "🇬🇧 UK", "15": "🇮🇳 India",
            "22": "🇮🇩 Indonesia", "6": "🇨🇳 China", "73": "🇻🇳 Vietnam",
            "5": "🇲🇲 Myanmar", "14": "🇭🇰 Hong Kong",
        }
        country_label = country_names.get(str(req.country), f"Country {req.country}")
        alert_msg = (
            f"🔢 NEW OTP NUMBER PURCHASED\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"📱 Number: {phone_number}\n"
            f"🌍 Country: {country_label}\n"
            f"📲 Service: {svc_name}\n"
            f"👤 User: {user_email}\n"
            f"💰 Charged: ${user_price:.2f}\n"
            f"💵 Balance after: ${new_balance:.2f}\n"
            f"🔑 Order ID: {order_id}"
        )
        import asyncio as _asyncio
        _asyncio.create_task(notify_admins(alert_msg, email_subject="🔢 New OTP Number Purchase"))
    except Exception as _tg_err:
        logger.warning(f"Admin OTP alert failed (non-critical): {_tg_err}")

    return {
        "success":      True,
        "order_id":     order_id,
        "phone_number": phone_number,
        "service":      req.service,
        "service_name": svc_name,
        "price_paid":   user_price,
        "expires_at":   expires_at.isoformat(),
        "new_balance":  new_balance,
    }


@router.get("/status/{order_id}")
async def check_status(order_id: str, current_user=Depends(get_current_user)):
    """Poll for SMS code. Call every 5s from the frontend."""
    user_id = current_user["_id"]

    order = await db.otp_orders.find_one({"order_id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["status"] in ("got_sms", "cancelled"):
        return {
            "status":       order["status"],
            "sms_code":     order.get("sms_code"),
            "sms_text":     order.get("sms_text"),
            "phone_number": order["phone_number"],
            "service_name": order["service_name"],
            "expires_at":   order["expires_at"],
            "refunded":     order.get("refunded", False),
        }

    expires_dt = datetime.fromisoformat(order["expires_at"].replace("Z", "+00:00"))

    result = await _provider_request({"action": "getStatus", "id": order_id})
    logger.info(f"OTP status [{order_id}]: {str(result)[:40]}")

    if str(result).startswith("STATUS_OK"):
        code    = result.split(":", 1)[1] if ":" in result else result
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.otp_orders.update_one(
            {"order_id": order_id},
            {"$set": {"status": "got_sms", "sms_code": code, "sms_text": result, "received_at": now_iso}}
        )
        await _provider_request({"action": "setStatus", "id": order_id, "status": 6})
        return {
            "status":       "got_sms",
            "sms_code":     code,
            "sms_text":     result,
            "phone_number": order["phone_number"],
            "service_name": order["service_name"],
            "expires_at":   order["expires_at"],
            "refunded":     False,
        }

    if datetime.now(timezone.utc) >= expires_dt:
        await _cancel_and_refund(order_id, user_id, order)
        return {
            "status":       "expired",
            "phone_number": order["phone_number"],
            "service_name": order["service_name"],
            "expires_at":   order["expires_at"],
            "refunded":     True,
        }

    return {
        "status":       "waiting",
        "phone_number": order["phone_number"],
        "service_name": order["service_name"],
        "expires_at":   order["expires_at"],
        "refunded":     False,
    }


@router.post("/cancel/{order_id}")
async def cancel_order(order_id: str, current_user=Depends(get_current_user)):
    """Cancel an active order and refund to wallet."""
    user_id = current_user["_id"]
    order   = await db.otp_orders.find_one({"order_id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] == "got_sms":
        raise HTTPException(status_code=400, detail="SMS already received — nothing to cancel")
    if order.get("refunded"):
        raise HTTPException(status_code=400, detail="Already refunded")

    # Re-check the provider so they cannot refund after the OTP already landed.
    result = await _provider_request({"action": "getStatus", "id": order_id})
    if str(result).startswith("STATUS_OK"):
        code = result.split(":", 1)[1] if ":" in result else result
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.otp_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "status": "got_sms",
                "sms_code": code,
                "sms_text": result,
                "received_at": now_iso,
            }},
        )
        raise HTTPException(
            status_code=400,
            detail="SMS already received — this order is not refundable",
        )

    await _cancel_and_refund(order_id, user_id, order)
    return {"success": True, "refunded": order["price_paid"]}


@router.get("/my-orders")
async def my_orders(limit: int = 20, current_user=Depends(get_current_user)):
    user_id = current_user["_id"]
    orders  = await db.otp_orders.find(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        limit=limit
    ).to_list(length=limit)
    for o in orders:
        o["_id"] = str(o["_id"])
    return {"orders": orders}


async def _cancel_and_refund(order_id: str, user_id: str, order: dict):
    """Cancel at provider (status=8) and refund the user's wallet."""
    if order.get("status") == "got_sms" or order.get("sms_code"):
        logger.warning(f"Blocked OTP refund — SMS already on {order_id}")
        return
    await _provider_request({"action": "setStatus", "id": order_id, "status": 8})

    wallet = await db.wallets.find_one({"user_id": user_id})
    if wallet:
        new_bal = float(wallet.get("balance", 0)) + order["price_paid"]
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.wallets.update_one(
            {"user_id": user_id},
            {"$set": {"balance": new_bal, "updated_at": now_iso}}
        )
        await db.transactions.insert_one({
            "user_id":       user_id,
            "type":          "credit",
            "amount":        order["price_paid"],
            "description":   f"Refund — OTP {order['service_name']} ({order['phone_number']}) no SMS received",
            "balance_after": new_bal,
            "created_at":    now_iso,
        })

    await db.otp_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "cancelled", "refunded": True}}
    )
