"""
Telegram Mini App bot helpers.

Optional router — must never crash API boot. Handles @Calliotelbot /start
with an Open Calliotel WebApp button. Auth stays on /api/auth/telegram-webapp.
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from database import db

logger = logging.getLogger(__name__)
# Telegram requires the bot token in the request URL. httpx's INFO logger would
# write that secret to application logs, so only retain warnings and errors.
logging.getLogger("httpx").setLevel(logging.WARNING)
router = APIRouter()

APP_URL = (os.environ.get("FRONTEND_URL") or "https://calliotel.com").rstrip("/")
SERVICES_URL = f"{APP_URL}/services"
SUPPORT_URL = f"{APP_URL}/support"
OPEN_TEXT = (
    "Calliotel is ready inside Telegram.\n\n"
    "Open the Mini App for virtual numbers, calls, person-to-person SMS, "
    "eSIM data plans, wallet access, and support."
)


def _bot_token() -> str:
    return (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()


def webhook_secret() -> str:
    tok = _bot_token()
    return hashlib.sha256(f"calliotel-miniapp:{tok}".encode("utf-8")).hexdigest()[:48]


async def _tg(method: str, payload: Optional[dict] = None) -> dict:
    tok = _bot_token()
    if not tok:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN missing"}
    url = f"https://api.telegram.org/bot{tok}/{method}"
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.post(url, json=payload or {})
        try:
            return r.json()
        except Exception:
            return {"ok": False, "status": r.status_code}


def _web_app_keyboard() -> dict:
    return {
        "inline_keyboard": [
            [{
                "text": "180+ Services",
                "web_app": {"url": SERVICES_URL},
            }],
            [{
                "text": "Numbers & wallet",
                "web_app": {"url": APP_URL},
            }],
        ]
    }


async def _record_subscriber(chat_id: int, sender: dict, *, opted_out: bool = False) -> None:
    """Track private-chat users who explicitly interact with the bot."""
    user_id = sender.get("id")
    if not user_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.telegram_subscribers.update_one(
        {"chat_id": chat_id},
        {
            "$set": {
                "chat_id": chat_id,
                "telegram_user_id": str(user_id),
                "username": sender.get("username"),
                "first_name": sender.get("first_name"),
                "last_name": sender.get("last_name"),
                "language_code": sender.get("language_code"),
                "opted_out": opted_out,
                "last_seen_at": now,
            },
            "$setOnInsert": {"subscribed_at": now},
        },
        upsert=True,
    )


async def _send(chat_id: int, text: str, reply_markup: Optional[dict] = None) -> None:
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    result = await _tg("sendMessage", payload)
    if not result.get("ok"):
        logger.warning("Telegram Mini App reply failed: %s", result.get("description") or result.get("error"))


@router.get("/health")
async def miniapp_health():
    return {"ok": True, "app_url": APP_URL, "services_url": SERVICES_URL}


@router.post("/webhook")
async def miniapp_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Optional[str] = Header(default=None),
):
    expected = webhook_secret()
    if expected and (x_telegram_bot_api_secret_token or "") != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    try:
        update: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return {"ok": True}

    text = (msg.get("text") or "").strip()
    if not text:
        return {"ok": True}

    cmd = text.split()[0].split("@", 1)[0].lower()
    start_arg = (text.split(None, 1)[1].split()[0].lower() if len(text.split()) > 1 else "")
    sender = msg.get("from") or {}

    try:
        if chat.get("type") == "private":
            await _record_subscriber(chat_id, sender, opted_out=(cmd == "/stop"))

        if cmd == "/stop":
            await _send(
                chat_id,
                "You are unsubscribed from Calliotel announcements. "
                "Send /start whenever you want to subscribe again.",
            )
        elif cmd == "/help":
            await _send(
                chat_id,
                "Use /app to open Calliotel, /services to browse services, "
                "/shop to browse numbers and eSIM plans, or /stop to unsubscribe.",
                _web_app_keyboard(),
            )
        elif cmd == "/support":
            await _send(
                chat_id,
                "Open Calliotel Support to create or review your support tickets.",
                {"inline_keyboard": [[{"text": "Open support", "web_app": {"url": SUPPORT_URL}}]]},
            )
        elif cmd in ("/start", "/app", "/open", "/services", "/shop") or start_arg in ("services", "shop"):
            await _send(chat_id, OPEN_TEXT, _web_app_keyboard())
    except Exception as e:
        logger.warning("Telegram Mini App webhook handling failed: %s", e)
    return {"ok": True}
