"""5sim.net guest + authenticated HTTP client. Token never logged."""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

FIVESIM_BASE = "https://5sim.net/v1"
# Refuse buys that would wipe the Calliotel margin (USA WhatsApp on 5sim is ~$0.90).
MAX_PROVIDER_COST = 0.95


def _token() -> str:
    return (os.environ.get("FIVESIM_API_TOKEN") or os.environ.get("FIVESIM_TOKEN") or "").strip()


def configured() -> bool:
    return bool(_token())


def _auth_headers() -> dict:
    token = _token()
    if not token:
        raise RuntimeError("FIVESIM_API_TOKEN is not set")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


class FiveSimError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _parse_body(resp: httpx.Response) -> Any:
    text = (resp.text or "").strip()
    if not text:
        raise FiveSimError("Empty response from number provider")
    try:
        return resp.json()
    except Exception:
        return text


async def guest_get(path: str) -> Any:
    url = f"{FIVESIM_BASE}{path}"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers={"Accept": "application/json"})
    return _parse_body(resp)


async def user_get(path: str) -> Any:
    url = f"{FIVESIM_BASE}{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=_auth_headers())
    body = _parse_body(resp)
    if resp.status_code >= 400:
        raise FiveSimError(_friendly_error(body), status_code=503)
    if isinstance(body, str):
        raise FiveSimError(_friendly_error(body), status_code=503)
    return body


def _friendly_error(body: Any) -> str:
    raw = body if isinstance(body, str) else str(body)
    low = raw.lower()
    if "no free" in low or "no number" in low:
        return "No numbers available for that country right now. Try Auto or another country."
    if "not enough" in low and "balance" in low:
        return "OTP inventory is temporarily empty. Try again in a few minutes."
    if "bad country" in low or "bad operator" in low or "bad product" in low:
        return "That service is not available in this country."
    logger.warning("5sim error (truncated): %s", raw[:120])
    return "Could not assign a number right now. Please try again."


async def cheapest_offer(product: str) -> Optional[tuple[str, str, float, int]]:
    """Return (country, operator, cost, qty) cheapest in-stock under MAX_PROVIDER_COST."""
    data = await guest_get(f"/guest/prices?product={product}")
    block = data.get(product) if isinstance(data, dict) else None
    if not isinstance(block, dict):
        return None
    best = None
    for country, ops in block.items():
        if not isinstance(ops, dict):
            continue
        for operator, spec in ops.items():
            if not isinstance(spec, dict):
                continue
            try:
                cost = float(spec.get("cost") or 0)
                count = int(spec.get("count") or 0)
            except (TypeError, ValueError):
                continue
            if count <= 0 or cost <= 0 or cost > MAX_PROVIDER_COST:
                continue
            if best is None or cost < best[2]:
                best = (str(country), str(operator), cost, count)
    return best


async def country_cost(product: str, country: str) -> Optional[tuple[float, int]]:
    data = await guest_get(f"/guest/products/{country}/any")
    if not isinstance(data, dict):
        return None
    spec = data.get(product)
    if not isinstance(spec, dict):
        return None
    try:
        cost = float(spec.get("Price") or spec.get("cost") or 0)
        qty = int(spec.get("Qty") or spec.get("count") or 0)
    except (TypeError, ValueError):
        return None
    if qty <= 0 or cost <= 0 or cost > MAX_PROVIDER_COST:
        return None
    return cost, qty


def _local_mock() -> bool:
    return os.environ.get("LOCAL_OTP_DEV") == "1" and not _token()


_MOCK_ORDERS: dict[str, float] = {}


async def buy_activation(country: str, product: str, operator: str = "any") -> dict:
    if _local_mock():
        import time
        order_id = str(int(time.time() * 1000))
        _MOCK_ORDERS[order_id] = time.time()
        return {
            "id": order_id,
            "phone": "+15555550123",
            "price": 0.15,
            "status": "PENDING",
            "country": country,
            "product": product,
            "operator": operator,
        }
    return await user_get(f"/user/buy/activation/{country}/{operator}/{product}")


async def check_order(order_id: int | str) -> dict:
    if _local_mock():
        import time
        started = _MOCK_ORDERS.get(str(order_id))
        if started and time.time() - started >= 8:
            return {
                "status": "RECEIVED",
                "sms": [{"code": "482911", "text": "Your Calliotel demo code is 482911"}],
            }
        return {"status": "PENDING", "sms": None}
    return await user_get(f"/user/check/{order_id}")


async def cancel_order(order_id: int | str) -> Any:
    if _local_mock():
        _MOCK_ORDERS.pop(str(order_id), None)
        return {"status": "CANCELED"}
    return await user_get(f"/user/cancel/{order_id}")


async def finish_order(order_id: int | str) -> Any:
    if _local_mock():
        return {"status": "FINISHED"}
    return await user_get(f"/user/finish/{order_id}")
