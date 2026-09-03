"""
Telnyx Call Control API client.
Handles inbound call answering, forwarding, TTS, and hangup.
"""

import httpx
import logging
import os

logger = logging.getLogger(__name__)

TELNYX_API_BASE = "https://api.telnyx.com/v2"
CALLIOTEL_CALL_CONTROL_APP_ID = "2965523922440684700"


def _headers():
    key = os.environ.get("TELNYX_API_KEY", "")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


async def answer_call(call_control_id: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/answer",
            headers=_headers(),
            json={},
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx answer failed: {r.status_code} {r.text[:200]}")
            return False
        return True


async def transfer_call(call_control_id: str, to: str, from_: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/transfer",
            headers=_headers(),
            json={"to": to, "from": from_},
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx transfer failed: {r.status_code} {r.text[:200]}")
            return False
        return True


async def speak_call(call_control_id: str, text: str, language: str = "en-US") -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/speak",
            headers=_headers(),
            json={"payload": text, "voice": "female", "language": language},
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx speak failed: {r.status_code} {r.text[:200]}")
            return False
        return True


async def dial_call(from_number: str, to_number: str, connection_id: str = "") -> dict:
    """Initiate an outbound call from a Telnyx number to a destination."""
    payload: dict = {
        "to": to_number,
        "from": from_number,
        "connection_id": connection_id or CALLIOTEL_CALL_CONTROL_APP_ID,
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls",
            headers=_headers(),
            json=payload,
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx dial failed: {r.status_code} {r.text[:300]}")
            return {"ok": False, "error": r.text[:300], "status": r.status_code}
        data = r.json().get("data", {})
        logger.info(f"📞 Outbound call initiated: {from_number} → {to_number}")
        return {"ok": True, "call_control_id": data.get("call_control_id", ""), "call_leg_id": data.get("call_leg_id", "")}


async def hangup_call(call_control_id: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/hangup",
            headers=_headers(),
            json={},
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx hangup failed: {r.status_code} {r.text[:200]}")
            return False
        return True
