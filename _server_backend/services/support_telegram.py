"""
Calliotel Support Tickets Telegram bot — SEPARATE from the ops/purchase bot.

Uses SUPPORT_TELEGRAM_BOT_TOKEN + SUPPORT_TELEGRAM_CHAT_ID only.
Never touches TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_IDS.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


def support_bot_token() -> str:
    return (os.environ.get("SUPPORT_TELEGRAM_BOT_TOKEN") or "").strip()


def support_chat_id() -> str:
    return (os.environ.get("SUPPORT_TELEGRAM_CHAT_ID") or "").strip()


def configured() -> bool:
    return bool(support_bot_token() and support_chat_id())


async def send_support_message(
    text: str,
    *,
    reply_to_message_id: Optional[int] = None,
    parse_mode: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Send a message to the support tickets Telegram group. Returns Telegram result or None."""
    token = support_bot_token()
    chat_id = support_chat_id()
    if not token or not chat_id:
        logger.warning("support telegram not configured (missing SUPPORT_TELEGRAM_* env)")
        return None

    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    if reply_to_message_id:
        payload["reply_to_message_id"] = int(reply_to_message_id)
        payload["allow_sending_without_reply"] = True
    if parse_mode:
        payload["parse_mode"] = parse_mode

    try:
        async with httpx.AsyncClient(timeout=15) as cx:
            r = await cx.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json=payload,
            )
            data = r.json() if r.content else {}
            if r.status_code != 200 or not data.get("ok"):
                logger.warning(
                    "support telegram send failed: status=%s body=%s",
                    r.status_code,
                    (r.text or "")[:200],
                )
                return None
            return data.get("result") or {}
    except Exception as e:
        logger.warning("support telegram send error: %s", e)
        return None


async def set_webhook(url: str, *, secret_token: Optional[str] = None) -> Dict[str, Any]:
    token = support_bot_token()
    if not token:
        return {"ok": False, "error": "SUPPORT_TELEGRAM_BOT_TOKEN missing"}
    payload: Dict[str, Any] = {
        "url": url,
        "allowed_updates": ["message"],
        "drop_pending_updates": False,
    }
    if secret_token:
        payload["secret_token"] = secret_token
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.post(f"https://api.telegram.org/bot{token}/setWebhook", json=payload)
        return r.json() if r.content else {"ok": False, "status": r.status_code}
