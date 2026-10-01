#!/usr/bin/env python3
"""Verify the ops Telegram bot that sends signup / purchase / NOWPayments alerts.

Uses the SAME env vars those alerts use — TELEGRAM_BOT_TOKEN and
TELEGRAM_ADMIN_CHAT_IDS — and:
  1. calls getMe to validate the bot token,
  2. sends one test message to each admin chat id,
printing a clear PASS/FAIL for each step. It only sends a test message; it does
not read or change any user data.

Run on the production server (where the env vars live):
  /var/www/calliotel/venv/bin/python scripts/telegram_alert_selftest.py

Exit code 0 = token valid and at least one chat received the message.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def _token() -> str:
    return (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()


def _chat_ids() -> list[str]:
    raw = (os.environ.get("TELEGRAM_ADMIN_CHAT_IDS") or "").replace(";", ",")
    return [x.strip() for x in raw.split(",") if x.strip()]


def _api(token: str, method: str, params: dict) -> tuple[bool, dict]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = urllib.parse.urlencode(params).encode() if params else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=15) as r:
            body = json.loads(r.read() or b"{}")
            return bool(body.get("ok")), body
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read() or b"{}")
        except Exception:
            body = {"description": f"HTTP {e.code}"}
        return False, body
    except Exception as e:
        return False, {"description": str(e)}


def main() -> int:
    token = _token()
    chat_ids = _chat_ids()

    print("=== Ops Telegram bot self-test ===")
    if not token:
        print("FAIL  TELEGRAM_BOT_TOKEN is not set — signup/purchase/NOWPayments alerts cannot send.")
        return 2
    if not chat_ids:
        print("FAIL  TELEGRAM_ADMIN_CHAT_IDS is not set — no destination for alerts.")
        return 2

    ok, info = _api(token, "getMe", {})
    if not ok:
        print(f"FAIL  getMe rejected the token: {info.get('description')}")
        print("      → The bot token is wrong or revoked. Fix TELEGRAM_BOT_TOKEN.")
        return 1
    print(f"OK    Token valid — bot @{info.get('result', {}).get('username', '?')}")

    delivered = 0
    for chat_id in chat_ids:
        ok, info = _api(token, "sendMessage", {
            "chat_id": chat_id,
            "text": "✅ Calliotel alert self-test — if you see this, signup/purchase/NOWPayments alerts can reach this chat.",
            "disable_web_page_preview": "true",
        })
        if ok:
            print(f"OK    Delivered test message to chat {chat_id}")
            delivered += 1
        else:
            desc = info.get("description", "unknown error")
            print(f"FAIL  chat {chat_id}: {desc}")
            if "chat not found" in desc.lower():
                print("      → Wrong chat id, or the bot was never added to that chat.")
            elif "kicked" in desc.lower() or "not a member" in desc.lower():
                print("      → The bot was removed from the group — re-add it.")
            elif "blocked" in desc.lower():
                print("      → The bot is blocked by this user/chat.")
            elif "supergroup" in desc.lower() or "migrate" in desc.lower():
                print("      → Group upgraded to a supergroup; the chat id changed (usually gains a -100 prefix).")

    print(f"\nSummary: token OK, {delivered}/{len(chat_ids)} chat(s) received the test message.")
    return 0 if delivered > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
