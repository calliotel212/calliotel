"""
Telnyx SMS Client — Outbound & Inbound webhook support
Docs: https://developers.telnyx.com/api/messaging/send-message

Outbound:
  POST https://api.telnyx.com/v2/messages
  Auth: Bearer {TELNYX_API_KEY}

Inbound (webhook):
  Configure in Telnyx portal → Messaging → Messaging Profiles → Webhook URL
  Set to: https://calliotel.com/api/sms/webhook/telnyx
"""

import httpx
import logging
import os
import re
import time

logger = logging.getLogger(__name__)

TELNYX_API_BASE = "https://api.telnyx.com/v2"
TELNYX_API_KEY = os.environ.get("TELNYX_API_KEY", "")

_NUMBER_CACHE: dict = {"numbers": set(), "fetched_at": 0.0}
_NUMBER_CACHE_TTL = 300  # 5 minutes


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {TELNYX_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def is_configured() -> bool:
    return bool(TELNYX_API_KEY)


def _e164(phone_number: str) -> str:
    """Normalize common UI formatting to strict E.164 for Telnyx."""
    raw = (phone_number or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not 8 <= len(digits) <= 15:
        raise ValueError("Phone number must include a valid country code")
    return f"+{digits}"


async def _refresh_number_cache():
    """Pull the live list of phone numbers owned on the Telnyx account (5-min cache)."""
    if not TELNYX_API_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                f"{TELNYX_API_BASE}/phone_numbers",
                headers=_headers(),
                params={"page[size]": 250},
            )
            if r.status_code == 200:
                data = r.json().get("data", [])
                nums = set()
                for item in data:
                    num = item.get("phone_number", "").lstrip("+")
                    if num:
                        nums.add(num)
                _NUMBER_CACHE["numbers"] = nums
                _NUMBER_CACHE["fetched_at"] = time.time()
                logger.info(f"Telnyx number cache refreshed: {len(nums)} numbers")
            else:
                logger.warning(f"Telnyx number list HTTP {r.status_code}")
    except Exception as e:
        logger.warning(f"Telnyx number cache refresh failed: {e}")


async def is_telnyx_number(phone_number: str) -> bool:
    """Check if `phone_number` is owned on our Telnyx account."""
    if not TELNYX_API_KEY:
        return False
    if time.time() - _NUMBER_CACHE["fetched_at"] > _NUMBER_CACHE_TTL:
        await _refresh_number_cache()
    try:
        normalized = _e164(phone_number).lstrip("+")
    except ValueError:
        return False
    return normalized in _NUMBER_CACHE["numbers"]


async def send_sms(source: str, destination: str, content: str) -> dict:
    """
    Send a single SMS via Telnyx messaging API.

    Args:
        source:      Sender number (E.164, e.g. '+14046788553')
        destination: Recipient number (E.164, e.g. '+12029367113')
        content:     Message text

    Returns:
        {"message_id": str, "status": "sent"}
    """
    if not is_configured():
        raise RuntimeError("Telnyx not configured — TELNYX_API_KEY is missing")

    src = _e164(source)
    dst = _e164(destination)

    payload = {
        "from": src,
        "to": dst,
        "text": content,
        "messaging_profile_id": "40019e50-165e-4e04-8ddc-933d3df38567",
    }

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/messages",
            headers=_headers(),
            json=payload,
        )

        if r.status_code in (200, 201, 202):
            data = r.json().get("data", {})
            msg_id = data.get("id", "")
            status = data.get("to", [{}])[0].get("status", "queued") if isinstance(data.get("to"), list) else "queued"
            logger.info(f"✅ Telnyx SMS sent from {src} to {dst} (id={msg_id}, status={status})")
            return {"message_id": msg_id, "status": "sent"}
        elif r.status_code in (400, 422):
            detail = r.text[:300]
            logger.error(f"❌ Telnyx SMS rejected ({r.status_code}): {detail}")
            raise Exception(f"Telnyx rejected SMS: {detail}")
        elif r.status_code == 409:
            logger.error(f"❌ Telnyx SMS failed: 409 - {r.text[:300]}")
            try:
                err = r.json().get("errors", [{}])[0]
                err_code = err.get("code", "")
                err_title = err.get("title", "")
                if err_code == "40306" and "alpha" in err_title.lower():
                    raise Exception(
                        "This country requires an alphanumeric sender ID to receive SMS. "
                        "Unfortunately Telnyx does not support sending to this destination from a US virtual number. "
                        "Try sending from a UK (+44) or other international number instead."
                    )
            except Exception as parse_ex:
                if "alphanumeric" in str(parse_ex) or "sender ID" in str(parse_ex):
                    raise
            raise Exception(
                "SMS could not be delivered to this destination. "
                "Some international destinations are not reachable from US/CA virtual numbers."
            )
        else:
            logger.error(f"❌ Telnyx SMS failed: {r.status_code} - {r.text[:300]}")
            raise Exception(f"Telnyx SMS send failed: {r.status_code}")


def invalidate_cache():
    """Force cache refresh on next call (call after purchasing a new number)."""
    _NUMBER_CACHE["fetched_at"] = 0.0
