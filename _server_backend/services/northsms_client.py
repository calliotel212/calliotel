"""NorthSMS activation API. Token never logged."""
from __future__ import annotations

import logging
import os
import time
import asyncio
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

NORTH_BASE = "https://northsms.com/api"

SERVICE_SLUG = {
    "whatsapp": "whatsapp",
    "telegram": "telegram",
    "google": "googleyoutubegmail",
    "facebook": "facebook",
    "instagram": "instagramthreads",
    "tiktok": "tiktokdouyin",
    "microsoft": "microsoft",
    "amazon": "amazon",
    "apple": "apple",
    "openai": "openai",
    "twitter": "twitter",
    "airbnb": "airbnb",
}

COUNTRY_ISO = {
    "auto": None,
    "any": None,
    "usa": "US",
    "england": "GB",
    "uk": "GB",
    "canada": "CA",
    "indonesia": "ID",
    "philippines": "PH",
    "cambodia": "KH",
    "malaysia": "MY",
    "egypt": "EG",
    "india": "IN",
    "southafrica": "ZA",
}

HARD_SERVICES = {"whatsapp", "telegram"}

POPULAR = [
    ("whatsapp", "WhatsApp", "💬"),
    ("telegram", "Telegram", "✈️"),
    ("googleyoutubegmail", "Google", "🔍"),
    ("instagramthreads", "Instagram", "📸"),
    ("tiktokdouyin", "TikTok", "🎵"),
    ("facebook", "Facebook", "👤"),
    ("microsoft", "Microsoft", "🪟"),
    ("amazon", "Amazon", "📦"),
    ("apple", "Apple", "🍎"),
    ("openai", "OpenAI / ChatGPT", "🤖"),
    ("twitter", "X / Twitter", "🐦"),
    ("airbnb", "Airbnb", "🏠"),
]

_POPULAR_ICONS = {slug: icon for slug, _name, icon in POPULAR}
_SERVICES_CACHE: dict[str, Any] = {"at": 0.0, "rows": []}
_SERVICES_TTL = 600


def slug_for(service: str) -> str:
    raw = (service or "").strip().lower()
    return SERVICE_SLUG.get(raw, raw)


def is_whatsapp(service: str) -> bool:
    return slug_for(service) == "whatsapp"


def sell_price(service: str, iso2: Optional[str] = None) -> float:
    if slug_for(service) in HARD_SERVICES:
        return 1.49
    return 0.99


def quote_sell(service: str, provider_cost: float) -> Optional[float]:
    """Map supplier cost to a Calliotel sell price. None = too expensive to list."""
    slug = slug_for(service)
    if slug in HARD_SERVICES:
        return 1.49 if provider_cost <= 0.99 else None
    if provider_cost <= 0.50:
        return 0.99
    if provider_cost <= 0.95:
        return 1.49
    if provider_cost <= 1.45:
        return 1.99
    return None


def max_provider_cost(service: str, sell: Optional[float] = None) -> float:
    if sell is None:
        sell = sell_price(service)
    if sell <= 1.00:
        return 0.55
    if sell <= 1.50:
        return 0.99
    return 1.50


def icon_for(slug: str) -> str:
    return _POPULAR_ICONS.get(slug_for(slug), "📱")


LOGO_DOMAINS = {
    "whatsapp": "whatsapp.com",
    "telegram": "telegram.org",
    "googleyoutubegmail": "google.com",
    "google-chat": "google.com",
    "instagramthreads": "instagram.com",
    "tiktokdouyin": "tiktok.com",
    "facebook": "facebook.com",
    "microsoft": "microsoft.com",
    "amazon": "amazon.com",
    "apple": "apple.com",
    "openai": "openai.com",
    "twitter": "x.com",
    "airbnb": "airbnb.com",
    "paypal": "paypal.com",
    "discord": "discord.com",
    "snapchat": "snapchat.com",
    "linkedin": "linkedin.com",
    "netflix": "netflix.com",
    "uber": "uber.com",
    "binance": "binance.com",
    "coinbase": "coinbase.com",
}


def logo_url(slug: str, north_icon: Optional[str] = None) -> str:
    if isinstance(north_icon, str) and north_icon.startswith("http"):
        return north_icon
    key = slug_for(slug)
    domain = LOGO_DOMAINS.get(key)
    if not domain:
        domain = f"{key.split('-')[0]}.com"
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"


def _token() -> str:
    return (
        os.environ.get("NORTHSMS_API_TOKEN")
        or os.environ.get("NORTHSMS_TOKEN")
        or ""
    ).strip()


def configured() -> bool:
    return bool(_token())


def _local_mock() -> bool:
    return os.environ.get("LOCAL_OTP_DEV") == "1" and not _token()


class NorthSmsError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _headers() -> dict:
    token = _token()
    if not token:
        raise RuntimeError("NORTHSMS_API_TOKEN is not set")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _parse(resp: httpx.Response) -> Any:
    try:
        return resp.json()
    except Exception:
        return (resp.text or "").strip()


def _msg(body: Any) -> str:
    if isinstance(body, dict):
        detail = body.get("message") or body.get("detail")
        if isinstance(detail, str) and detail:
            return detail
    if isinstance(body, str) and body:
        return body[:200]
    return "North SMS request failed"


async def _get(path: str, auth: bool = True) -> Any:
    url = f"{NORTH_BASE}{path}"
    headers = _headers() if auth else {"Accept": "application/json"}
    headers["User-Agent"] = "Calliotel/1.0"
    async with httpx.AsyncClient(timeout=25, trust_env=False, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
    body = _parse(resp)
    if resp.status_code >= 400:
        raise NorthSmsError(_msg(body), status_code=503 if resp.status_code >= 500 else resp.status_code)
    return body


async def _post(path: str, payload: Optional[dict] = None) -> Any:
    url = f"{NORTH_BASE}{path}"
    headers = _headers()
    headers["User-Agent"] = "Calliotel/1.0"
    async with httpx.AsyncClient(timeout=30, trust_env=False, follow_redirects=True) as client:
        resp = await client.post(url, headers=headers, json=payload or {})
    body = _parse(resp)
    if resp.status_code >= 400:
        raise NorthSmsError(_msg(body), status_code=resp.status_code if resp.status_code in (400, 401, 402, 409, 422) else 503)
    return body


def iso_for(country_code: str) -> Optional[str]:
    raw = (country_code or "").strip()
    if len(raw) == 2 and raw.isalpha():
        return raw.upper()
    return COUNTRY_ISO.get(raw.lower())


def _min_price(country: dict) -> Optional[float]:
    for key in ("min_price", "price", "minPrice"):
        if country.get(key) is not None:
            try:
                val = float(country[key])
                if val > 0:
                    return val
            except (TypeError, ValueError):
                continue
    return None


async def list_services() -> list[dict]:
    now = time.time()
    cached = _SERVICES_CACHE.get("rows") or []
    if cached and now - float(_SERVICES_CACHE.get("at") or 0) < _SERVICES_TTL:
        return cached
    data = await _get("/activation/services", auth=False)
    rows = data.get("data") if isinstance(data, dict) else []
    if not isinstance(rows, list):
        rows = []
    clean = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        slug = str(row.get("slug") or "").strip().lower()
        name = str(row.get("name") or slug).strip()
        if not slug or not name:
            continue
        clean.append({
            "slug": slug,
            "name": name,
            "icon": row.get("icon"),
        })
    clean.sort(key=lambda r: r["name"].lower())
    if clean:
        _SERVICES_CACHE["at"] = now
        _SERVICES_CACHE["rows"] = clean
    return clean or cached


async def catalog_services() -> list[dict]:
    try:
        live = await list_services()
    except Exception as e:
        logger.warning("North SMS service list failed, using popular fallback: %s", e)
        live = []
    by_slug = {row["slug"]: row for row in live}
    out = []
    seen = set()
    for slug, name, icon in POPULAR:
        if slug not in by_slug and live:
            continue
        out.append({
            "code": slug,
            "name": name,
            "icon": icon,
            "logo": logo_url(slug, (by_slug.get(slug) or {}).get("icon")),
            "price": sell_price(slug),
            "popular": True,
        })
        seen.add(slug)
    for row in live:
        slug = row["slug"]
        if slug in seen:
            continue
        out.append({
            "code": slug,
            "name": row["name"],
            "icon": icon_for(slug),
            "logo": logo_url(slug, row.get("icon")),
            "price": sell_price(slug),
            "popular": False,
        })

    async def _fill_live_price(item: dict) -> None:
        try:
            best = await cheapest_country(item["code"], cap=1.45)
            if not best:
                return
            quoted = quote_sell(item["code"], best[1])
            if quoted:
                item["price"] = quoted
                item["from_country"] = best[0]
        except Exception as e:
            logger.warning("live price skip %s: %s", item.get("code"), e)

    await asyncio.gather(*[_fill_live_price(item) for item in out if item.get("popular")])
    return out


async def known_slugs() -> set[str]:
    try:
        rows = await list_services()
    except Exception:
        rows = []
    slugs = {row["slug"] for row in rows}
    slugs.update(SERVICE_SLUG.keys())
    slugs.update(SERVICE_SLUG.values())
    return slugs


async def service_name(service: str) -> str:
    slug = slug_for(service)
    for code, name, _icon in POPULAR:
        if code == slug:
            return name
    try:
        for row in await list_services():
            if row["slug"] == slug:
                return row["name"]
    except Exception:
        pass
    return slug.replace("-", " ").title()


async def countries_for_service(service: str) -> list[dict]:
    slug = slug_for(service)
    data = await _get(f"/activation/services/{slug}/countries", auth=False)
    rows = data.get("countries") if isinstance(data, dict) else []
    return rows if isinstance(rows, list) else []


async def cheapest_country(service: str, cap: Optional[float] = None) -> Optional[tuple[str, float]]:
    if cap is None:
        cap = max_provider_cost(service)
    best = None
    for row in await countries_for_service(service):
        if not isinstance(row, dict):
            continue
        iso = (row.get("iso2") or "").upper()
        price = _min_price(row)
        if not iso or price is None or price > cap:
            continue
        if is_whatsapp(service) and iso == "US":
            continue
        if best is None or price < best[1]:
            best = (iso, price)
    return best


async def country_price(service: str, iso2: str) -> Optional[float]:
    iso2 = iso2.upper()
    for row in await countries_for_service(service):
        if isinstance(row, dict) and (row.get("iso2") or "").upper() == iso2:
            return _min_price(row)
    return None


_MOCK: dict[str, float] = {}


async def buy(service: str, iso2: str, max_price: Optional[float] = None) -> dict:
    if _local_mock():
        order_id = f"NS-DEMO-{int(time.time() * 1000)}"
        _MOCK[order_id] = time.time()
        return {
            "code": order_id,
            "phoneNumber": "+15555550123",
            "sellingPrice": 0.12,
            "status": {"value": "active", "label": "Active"},
            "country": {"iso2": iso2},
        }
    body = await _post("/activation/orders", {
        "country": iso2.upper(),
        "service": slug_for(service),
        "max_price": max_price if max_price is not None else max_provider_cost(service),
        "selection": "cheap-first",
    })
    order = body.get("order") if isinstance(body, dict) else None
    if not isinstance(order, dict):
        raise NorthSmsError("North SMS did not return an order")
    return order


async def get_order(order_code: str) -> dict:
    if _local_mock():
        started = _MOCK.get(str(order_code))
        if started and time.time() - started >= 8:
            return {
                "code": order_code,
                "phoneNumber": "+15555550123",
                "status": {"value": "completed", "label": "Completed"},
                "messages": [{
                    "code": "482911",
                    "text": "Your Calliotel demo code is 482911",
                }],
            }
        return {
            "code": order_code,
            "status": {"value": "active", "label": "Active"},
            "messages": [],
        }
    body = await _get(f"/activation/orders/{order_code}")
    if isinstance(body, dict) and isinstance(body.get("data"), dict):
        return body["data"]
    if isinstance(body, dict):
        return body
    raise NorthSmsError("Could not read North SMS order")


async def cancel(order_code: str) -> Any:
    if _local_mock():
        _MOCK.pop(str(order_code), None)
        return {"message": "Order cancelled successfully."}
    return await _post(f"/activation/orders/{order_code}/cancel")


async def finish(order_code: str) -> Any:
    if _local_mock():
        return {"message": "Order finished successfully."}
    return await _post(f"/activation/orders/{order_code}/finish")


def status_label(order: dict) -> str:
    st = order.get("status")
    if isinstance(st, dict):
        return str(st.get("label") or st.get("value") or "").lower()
    return str(st or "").lower()


def extract_sms(order: dict) -> tuple[Optional[str], Optional[str]]:
    messages = order.get("messages")
    if not isinstance(messages, list):
        return None, None
    for item in messages:
        if not isinstance(item, dict):
            continue
        code = item.get("code")
        text = item.get("text")
        if code or text:
            return (str(code) if code else None, str(text) if text else None)
    return None, None
