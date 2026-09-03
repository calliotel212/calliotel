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


async def transfer_call(
    call_control_id: str,
    to: str,
    from_: str,
    timeout_secs: int | None = None,
) -> bool:
    body = {"to": to, "from": from_}
    if timeout_secs:
        body["timeout_secs"] = int(timeout_secs)
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/transfer",
            headers=_headers(),
            json=body,
        )
        if r.status_code not in (200, 201):
            logger.error(
                f"Telnyx transfer failed: {r.status_code} from={from_} to={to} "
                f"ccid={call_control_id} body={r.text[:400]}"
            )
            return False
        logger.info(f"📲 Transfer OK: {from_} → {to} (ccid={call_control_id})")
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


async def dial_call(
    from_number: str,
    to_number: str,
    connection_id: str = "",
    *,
    timeout_secs: int | None = None,
    link_to: str | None = None,
    bridge_on_answer: bool = False,
) -> dict:
    """Initiate an outbound call from a Telnyx number to a destination."""
    payload: dict = {
        "to": to_number,
        "from": from_number,
        "connection_id": connection_id or CALLIOTEL_CALL_CONTROL_APP_ID,
    }
    if timeout_secs:
        payload["timeout_secs"] = int(timeout_secs)
    if link_to:
        payload["link_to"] = link_to
        if bridge_on_answer:
            payload["bridge_on_answer"] = True
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


async def bridge_call(call_control_id: str, other_call_control_id: str) -> bool:
    """Bridge two live Call Control legs."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/bridge",
            headers=_headers(),
            json={"call_control_id": other_call_control_id},
        )
        if r.status_code not in (200, 201):
            logger.error(
                f"Telnyx bridge failed: {r.status_code} a={call_control_id} "
                f"b={other_call_control_id} body={r.text[:300]}"
            )
            return False
        logger.info(f"🔗 Bridged {call_control_id} ↔ {other_call_control_id}")
        return True


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


async def start_recording(
    call_control_id: str,
    *,
    format: str = "mp3",
    channels: str = "single",
    play_beep: bool = True,
    max_length: int = 90,
    transcription: bool = True,
) -> bool:
    """Start call recording; optionally enable post-recording transcription."""
    body = {
        "format": format,
        "channels": channels,
        "play_beep": play_beep,
        "max_length": max_length,
        "transcription": bool(transcription),
    }
    if transcription:
        body["transcription_engine"] = "B"
        body["transcription_language"] = "en"
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/record_start",
            headers=_headers(),
            json=body,
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx record_start failed: {r.status_code} {r.text[:300]}")
            return False
        logger.info(
            f"🎙️ record_start ok ccid={call_control_id} max={max_length}s "
            f"beep={play_beep} transcript={bool(transcription)}"
        )
        return True


async def stop_recording(call_control_id: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/record_stop",
            headers=_headers(),
            json={},
        )
        if r.status_code not in (200, 201):
            logger.error(f"Telnyx record_stop failed: {r.status_code} {r.text[:200]}")
            return False
        return True
