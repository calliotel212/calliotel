"""SMSPVA HQ proxy catalog + rent. Cookie never logged."""
from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

BASE = "https://smspva.com/proxies_api.php"
TYPE_DEDICATED = "dedicated_ipv4"
PERIODS = (5, 10, 20, 30)
AUTH_DOC = "smspva_proxy_auth"
_COUNTRY_CACHE: dict[str, Any] = {"at": 0.0, "rows": []}
_COUNTRY_TTL = 300


class SmspvaProxyError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def quote_sell(provider_cost: float) -> Optional[float]:
    cost = float(provider_cost or 0)
    if cost <= 0 or cost > 80:
        return None
    raw = cost * 1.45 + 0.50
    cents = int(round(raw * 100))
    snapped = ((cents + 9) // 10) * 10 + 9
    return round(snapped / 100.0, 2)


def cookie_from_env() -> str:
    return (
        os.environ.get("SMSPVA_API_KEY")
        or os.environ.get("SMSPVA_PROXY_COOKIE")
        or os.environ.get("SMSPVA_COOKIE")
        or ""
    ).strip()


async def load_cookie(db) -> str:
    env = cookie_from_env()
    if env:
        return env
    if db is None:
        return ""
    row = await db.app_settings.find_one({"_id": AUTH_DOC})
    return ((row or {}).get("apikey") or (row or {}).get("cookie") or "").strip()


async def save_cookie(db, cookie: str) -> None:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    text = (cookie or "").strip()
    if not text:
        await db.app_settings.delete_one({"_id": AUTH_DOC})
        return
    await db.app_settings.update_one(
        {"_id": AUTH_DOC},
        {"$set": {"apikey": text, "cookie": text, "updated_at": now}},
        upsert=True,
    )


def configured(cookie: str) -> bool:
    return bool((cookie or "").strip())


def _auth_for(token: str) -> tuple[dict, dict]:
    text = (token or "").strip()
    if not text:
        return {}, {}
    if ";" in text or "PHPSESSID=" in text or "dle_" in text:
        return {"Cookie": text}, {}
    return (
        {"Cookie": f"userkey={text}"},
        {"apikey": text, "userkey": text},
    )


def _ok(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise SmspvaProxyError("Bad supplier response")
    code = payload.get("code")
    if code not in (0, "0", None) and str(payload.get("message", "")).lower() not in ("ok",):
        msg = payload.get("message")
        if code in (3, "3") or str(msg).lower() in ("3", "not authenticated"):
            raise SmspvaProxyError("Supplier account is not linked. Paste the SMSPVA API key in Admin → Proxy.", 503)
        raise SmspvaProxyError("Proxy supplier refused that order. Try another country.", 503)
    return payload


async def _get(params: dict) -> dict:
    async with httpx.AsyncClient(timeout=25.0) as client:
        r = await client.get(BASE, params=params)
        r.raise_for_status()
        return _ok(r.json())


async def _post(method: str, body: dict, cookie: str = "") -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    extra_headers, extra_params = _auth_for(cookie)
    headers.update(extra_headers)
    payload = dict(body)
    payload.update(extra_params)
    async with httpx.AsyncClient(timeout=40.0) as client:
        r = await client.post(
            BASE,
            params={"method": method, **extra_params},
            headers=headers,
            json=payload,
        )
        r.raise_for_status()
        return _ok(r.json())


async def countries() -> list[dict]:
    now = time.time()
    if _COUNTRY_CACHE["rows"] and now - _COUNTRY_CACHE["at"] < _COUNTRY_TTL:
        return _COUNTRY_CACHE["rows"]
    payload = await _get({"method": "countries"})
    data = payload.get("data") or {}
    rows = []
    for code, meta in data.items():
        if not isinstance(meta, dict):
            continue
        cc = str(code).lower()
        if cc in ("ru",):
            continue
        flag = meta.get("flag") or ""
        if flag.startswith("/"):
            flag = "https://smspva.com" + flag
        rows.append({
            "code": cc,
            "name": meta.get("name") or cc.upper(),
            "flag": flag,
        })
    rows.sort(key=lambda r: r["name"])
    _COUNTRY_CACHE["at"] = now
    _COUNTRY_CACHE["rows"] = rows
    return rows


async def stock(country: str, proxy_type: str = TYPE_DEDICATED) -> int:
    payload = await _post("proxy_count", {"country": country, "type": proxy_type})
    data = payload.get("data") or {}
    return int(data.get("count") or 0)


async def provider_price(
    country: str,
    period: int,
    amount: int = 1,
    proxy_type: str = TYPE_DEDICATED,
) -> float:
    payload = await _post("proxy_price", {
        "country": country,
        "type": proxy_type,
        "period": int(period),
        "amount": int(amount),
    })
    data = payload.get("data") or {}
    return float(data.get("price") or 0)


async def quote(
    country: str,
    period: int,
    amount: int = 1,
    proxy_type: str = TYPE_DEDICATED,
) -> dict:
    cc = (country or "").strip().lower()
    days = int(period)
    qty = max(1, min(int(amount or 1), 5))
    if days not in PERIODS:
        raise SmspvaProxyError("Choose 5, 10, 20, or 30 days.", 400)
    if not cc or len(cc) > 8:
        raise SmspvaProxyError("Unknown country", 400)
    count = await stock(cc, proxy_type)
    if count < qty:
        return {
            "available": False,
            "country": cc,
            "period": days,
            "amount": qty,
            "stock": count,
            "price": None,
        }
    cost = await provider_price(cc, days, qty, proxy_type)
    sell = quote_sell(cost)
    if not sell or cost >= sell:
        return {
            "available": False,
            "country": cc,
            "period": days,
            "amount": qty,
            "stock": count,
            "price": None,
            "reason": "too_expensive",
        }
    return {
        "available": True,
        "country": cc,
        "type": proxy_type,
        "period": days,
        "amount": qty,
        "stock": count,
        "price": sell,
        "provider_cost": cost,
    }


def _as_rows(data: Any) -> list[dict]:
    if not data:
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        if isinstance(data.get("proxies"), list):
            return [x for x in data["proxies"] if isinstance(x, dict)]
        if all(isinstance(v, dict) for v in data.values()):
            return list(data.values())
    return []


def normalize_proxy(row: dict) -> dict:
    host = str(row.get("ip") or row.get("host") or "").strip()
    http_port = int(row.get("http_port") or row.get("port") or 0)
    socks_port = int(row.get("socks5_port") or row.get("socks_port") or 0)
    user = str(row.get("username") or row.get("user") or "")
    password = str(row.get("password") or row.get("pass") or "")
    return {
        "provider_id": str(row.get("proxy_id") or row.get("id") or ""),
        "host": host,
        "http_port": http_port,
        "socks5_port": socks_port or http_port,
        "username": user,
        "password": password,
        "country": str(row.get("country") or "").lower(),
        "type": str(row.get("type") or TYPE_DEDICATED),
        "expire_timestamp": int(row.get("expire_timestamp") or 0),
    }


async def list_active(cookie: str) -> list[dict]:
    payload = await _post("proxy_list", {"state": "active", "offset": 0, "limit": 200}, cookie=cookie)
    return [normalize_proxy(r) for r in _as_rows(payload.get("data"))]


async def buy(
    cookie: str,
    country: str,
    period: int,
    amount: int = 1,
    proxy_type: str = TYPE_DEDICATED,
    known_ids: Optional[set[str]] = None,
) -> list[dict]:
    if not configured(cookie):
        raise SmspvaProxyError(
            "Supplier account is not linked. Paste the SMSPVA API key in Admin → Proxy.",
            503,
        )
    known_ids = known_ids or set()
    await _post("proxy_buy", {
        "country": country,
        "type": proxy_type,
        "period": int(period),
        "amount": int(amount),
    }, cookie=cookie)
    rows = await list_active(cookie)
    fresh = [
        r for r in rows
        if r.get("host") and r.get("http_port") and r.get("provider_id") not in known_ids
        and (not country or r.get("country") == country or not r.get("country"))
    ]
    fresh.sort(key=lambda r: r.get("expire_timestamp") or 0, reverse=True)
    picked = fresh[: max(1, int(amount))]
    if len(picked) < int(amount):
        leftover = [r for r in rows if r.get("host") and r.get("provider_id") not in known_ids]
        leftover.sort(key=lambda r: r.get("expire_timestamp") or 0, reverse=True)
        picked = leftover[: max(1, int(amount))]
    if not picked:
        raise SmspvaProxyError("Proxy was rented but connection data is not ready yet. Contact support.")
    return picked
