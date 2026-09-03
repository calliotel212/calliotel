"""Send the Calliotel partner launch through approved customer channels.

Safety:
  * Email only verified, non-banned, non-synthetic, non-opted-out users.
  * Telegram only users in telegram_subscribers who have not opted out.
  * In-app only non-banned users.
  * Idempotent campaign logs make reruns safe.
  * Nothing is sent unless --send is explicitly provided.

Usage:
    python scripts/send_partner_launch_blast.py --dry-run
    python scripts/send_partner_launch_blast.py --test
    python scripts/send_partner_launch_blast.py --send
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from html import escape
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv("/var/www/calliotel/.env")
load_dotenv("/var/www/calliotel/backend/.env")

CAMPAIGN_ID = "partner_growth_launch_20260831"
LANDING_URL = "https://calliotel.com/reseller-program"
SUBJECT = "Build recurring revenue with Calliotel business numbers"
TITLE = "🚀 Launch your own virtual-number business"
MESSAGE = (
    "Serve verified businesses with dedicated sales, support and customer-service "
    "phone lines under your own brand. Explore Starter, Agency and White-Label "
    "partner options. Approval and compliance checks apply."
)

EXCLUDED_EMAILS = {
    "monitor-e2e@calliotel.com",
    "calliotel-monitor@calliotel.com",
}


def eligible_email(user: dict) -> bool:
    email = (user.get("email") or "").strip().lower()
    if not email or "@" not in email or not user.get("email_verified"):
        return False
    if user.get("needs_real_email") or user.get("banned") or user.get("is_banned"):
        return False
    if user.get("status") == "banned":
        return False
    if user.get("unsubscribed") or user.get("email_unsubscribed") or user.get("marketing_opt_out"):
        return False
    if email.startswith("deleted_") or email.endswith("@telegram.calliotel.user"):
        return False
    return email not in EXCLUDED_EMAILS


def email_html() -> str:
    safe_title = escape(TITLE)
    safe_message = escape(MESSAGE)
    return f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#07090d;color:#fff;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:30px 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#10141b;border:1px solid #263128;border-radius:20px">
        <tr><td style="padding:36px 32px">
          <div style="color:#22c55e;font-size:12px;font-weight:800;letter-spacing:1.4px">CALLIOTEL PARTNER PROGRAM</div>
          <h1 style="font-size:30px;line-height:1.2;margin:14px 0">{safe_title}</h1>
          <p style="color:#b8c0cc;font-size:16px;line-height:1.7">{safe_message}</p>
          <div style="margin:24px 0;padding:18px;background:#0b1810;border:1px solid #1f5e36;border-radius:12px;color:#d4f8df;font-size:14px;line-height:1.7">
            ✓ Customer sub-accounts and partner branding<br>
            ✓ Transparent wholesale pricing<br>
            ✓ Agency and white-label options
          </div>
          <a href="{LANDING_URL}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#22c55e;color:#07100a;text-decoration:none;font-weight:800">Explore partner plans →</a>
          <p style="color:#7f8997;font-size:12px;line-height:1.6;margin-top:24px">
            Partner services are for lawful business communications. Number availability,
            identity requirements and messaging registration vary.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #263128;color:#7f8997;font-size:11px">
          <a href="https://calliotel.com" style="color:#9aa5b5">Calliotel</a>
          &nbsp;·&nbsp;
          <a href="https://calliotel.com/unsubscribe" style="color:#9aa5b5">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def email_text() -> str:
    return (
        f"{TITLE}\n\n{MESSAGE}\n\n"
        "Explore partner plans: "
        f"{LANDING_URL}\n\n"
        "For lawful business communications only. Availability and requirements vary.\n"
        "Unsubscribe: https://calliotel.com/unsubscribe\n"
    )


async def send_email(client: httpx.AsyncClient, email: str) -> tuple[bool, str]:
    api_key = os.environ.get("RESEND_API_KEY", "")
    payload = {
        "from": os.environ.get("FROM_EMAIL", "Calliotel <noreply@calliotel.com>"),
        "to": [email],
        "subject": SUBJECT,
        "html": email_html(),
        "text": email_text(),
        "headers": {"List-Unsubscribe": "<https://calliotel.com/unsubscribe>"},
    }
    for attempt in range(8):
        try:
            response = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        except Exception as exc:
            if attempt == 7:
                return False, f"{type(exc).__name__}: {exc}"
            await asyncio.sleep(min(60, 5 * (attempt + 1)))
            continue
        if response.status_code in (200, 201, 202):
            return True, ""
        if response.status_code == 429:
            retry_after = response.headers.get("retry-after", "")
            wait = int(retry_after) if retry_after.isdigit() else min(120, 10 * (attempt + 1))
            await asyncio.sleep(max(5, wait))
            continue
        return False, f"{response.status_code}: {response.text[:200]}"
    return False, "rate-limit retries exhausted"


async def send_telegram(client: httpx.AsyncClient, token: str, chat_id: int) -> tuple[bool, str]:
    payload = {
        "chat_id": chat_id,
        "text": f"<b>{escape(TITLE)}</b>\n\n{escape(MESSAGE)}",
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[{"text": "Explore partner plans", "url": LANDING_URL}]]
        },
    }
    response = await client.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json=payload,
    )
    if response.status_code == 200:
        return True, ""
    try:
        detail = (response.json() or {}).get("description", "")
    except Exception:
        detail = response.text[:180]
    return False, detail


async def main() -> None:
    send = "--send" in sys.argv
    test = "--test" in sys.argv
    email_only = "--email-only" in sys.argv
    dry_run = "--dry-run" in sys.argv or (not send and not test)

    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    projection = {
        "_id": 1,
        "email": 1,
        "email_verified": 1,
        "needs_real_email": 1,
        "banned": 1,
        "is_banned": 1,
        "status": 1,
        "unsubscribed": 1,
        "email_unsubscribed": 1,
        "marketing_opt_out": 1,
    }
    users = list(db.users.find({}, projection))
    email_targets = [u for u in users if eligible_email(u)]
    telegram_targets = list(
        db.telegram_subscribers.find(
            {"opted_out": {"$ne": True}},
            {"_id": 0, "chat_id": 1},
        )
    )
    inapp_targets = [
        u for u in users
        if not u.get("banned") and not u.get("is_banned") and u.get("status") != "banned"
    ]

    sent_emails = {
        row["email"].lower()
        for row in db.campaign_email_log.find(
            {"campaign_id": CAMPAIGN_ID, "status": "sent"},
            {"_id": 0, "email": 1},
        )
        if row.get("email")
    }
    email_targets = [
        u for u in email_targets
        if u["email"].strip().lower() not in sent_emails
    ]
    inapp_exists = db.notifications.find_one({"campaign_id": CAMPAIGN_ID}) is not None
    telegram_exists = db.telegram_broadcasts.find_one({"campaign_id": CAMPAIGN_ID}) is not None

    print(
        f"campaign={CAMPAIGN_ID} dry_run={dry_run} test={test} email_only={email_only} "
        f"email_pending={len(email_targets)} telegram={len(telegram_targets)} "
        f"inapp={len(inapp_targets)} inapp_sent={inapp_exists} telegram_sent={telegram_exists}",
        flush=True,
    )
    if dry_run:
        client.close()
        return

    if test:
        async with httpx.AsyncClient(timeout=25) as http:
            ok, error = await send_email(http, "support@calliotel.com")
        print("TEST_OK" if ok else f"TEST_FAILED {error}", flush=True)
        client.close()
        return

    now = datetime.now(timezone.utc).isoformat()

    if not email_only and not inapp_exists:
        notification_id = str(uuid4())
        db.notifications.insert_one({
            "id": notification_id,
            "campaign_id": CAMPAIGN_ID,
            "title": TITLE,
            "message": MESSAGE,
            "url": LANDING_URL,
            "sent_by": "system",
            "sent_by_name": "Calliotel",
            "created_at": now,
        })
        if inapp_targets:
            db.user_notifications.insert_many([
                {
                    "notification_id": notification_id,
                    "user_id": user["_id"],
                    "is_read": False,
                    "is_deleted": False,
                    "created_at": now,
                }
                for user in inapp_targets
            ], ordered=False)
        print(f"INAPP_SENT {len(inapp_targets)}", flush=True)

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not email_only and token and not telegram_exists:
        telegram_sent = telegram_failed = 0
        async with httpx.AsyncClient(timeout=20) as http:
            for row in telegram_targets:
                chat_id = row.get("chat_id")
                if chat_id is None:
                    continue
                ok, error = await send_telegram(http, token, int(chat_id))
                if ok:
                    telegram_sent += 1
                else:
                    telegram_failed += 1
                    if "blocked" in error.lower() or "chat not found" in error.lower():
                        db.telegram_subscribers.update_one(
                            {"chat_id": chat_id},
                            {"$set": {
                                "opted_out": True,
                                "opt_out_reason": error[:180],
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }},
                        )
                await asyncio.sleep(0.05)
        db.telegram_broadcasts.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "title": TITLE,
            "message": MESSAGE,
            "sent": telegram_sent,
            "failed": telegram_failed,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"TELEGRAM_SENT {telegram_sent} failed={telegram_failed}", flush=True)

    email_sent = email_failed = 0
    async with httpx.AsyncClient(timeout=25) as http:
        for user in email_targets:
            email = user["email"].strip()
            ok, error = await send_email(http, email)
            db.campaign_email_log.insert_one({
                "campaign_id": CAMPAIGN_ID,
                "email": email,
                "user_id": user["_id"],
                "status": "sent" if ok else "failed",
                "error": error or None,
                "sent_at": datetime.now(timezone.utc).isoformat(),
            })
            if ok:
                email_sent += 1
            else:
                email_failed += 1
                print(f"EMAIL_FAILED {email}: {error}", flush=True)
            if (email_sent + email_failed) % 100 == 0:
                print(f"EMAIL_PROGRESS sent={email_sent} failed={email_failed}", flush=True)
            await asyncio.sleep(0.7)

    print(f"DONE email_sent={email_sent} email_failed={email_failed}", flush=True)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
