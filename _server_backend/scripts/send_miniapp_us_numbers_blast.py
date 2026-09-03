"""
Product update — Telegram Mini App + 50,000+ US numbers.

  cd /var/www/calliotel/backend
  /var/www/calliotel/venv/bin/python scripts/send_miniapp_us_numbers_blast.py --dry-run
  /var/www/calliotel/venv/bin/python scripts/send_miniapp_us_numbers_blast.py --test
  /var/www/calliotel/venv/bin/python scripts/send_miniapp_us_numbers_blast.py
"""
import os
import sys
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/var/www/calliotel/.env")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CAMPAIGN_ID = "aug2026_telegram_miniapp_us_numbers"

EXCLUDED_EMAILS = {
    "gam41@mail.aub.edu",
    "monitor-e2e@calliotel.com",
    "calliotel-monitor@calliotel.com",
    "calliotel.qa.35550@gmail.com",
}

NOTIF_TITLE = "Calliotel is in Telegram — 50,000+ US numbers"
NOTIF_MSG = (
    "Open Calliotel inside Telegram (no extra login). "
    "50,000+ US numbers are ready to pick, plus Canada, UK, Australia and more."
)

EMAIL_SUBJECT = "Calliotel is in Telegram now — 50,000+ US numbers ready"

EMAIL_HTML = """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;padding:10px 22px;background:#F5A623;border-radius:12px;font-weight:900;font-size:22px;color:#000;letter-spacing:-0.5px;">CALLIOTEL</div>
    </div>

    <div style="background:linear-gradient(135deg,rgba(42,171,238,0.22),rgba(245,166,35,0.10));border:1px solid rgba(42,171,238,0.40);border-radius:20px;padding:32px 28px;margin-bottom:24px;text-align:center;">
      <div style="font-size:42px;margin-bottom:10px;">✈️</div>
      <h1 style="font-size:24px;font-weight:900;margin:0 0 12px;line-height:1.3;color:#fff;">We're in Telegram now</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.68);line-height:1.65;margin:0;">
        Open Calliotel inside Telegram — numbers, SMS, calls, and your wallet.<br>
        You're already signed in. No app store. One tap.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://t.me/Calliotelbot/app" style="display:inline-block;padding:16px 36px;background:#2AABEE;color:#fff;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px;box-shadow:0 6px 24px rgba(42,171,238,0.35);">Open in Telegram →</a>
    </div>

    <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.28);border-radius:16px;padding:24px 28px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:800;color:#10b981;letter-spacing:1.4px;margin-bottom:12px;">WHAT'S NEW</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.78);line-height:1.75;">
        <div style="margin-bottom:10px;"><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;<strong style="color:#fff;">50,000+ US numbers</strong> ready to pick</div>
        <div style="margin-bottom:10px;"><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;Canada, UK, Australia, Puerto Rico and more</div>
        <div style="margin-bottom:10px;"><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;SMS, calls, and wallet — now inside Telegram</div>
        <div><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;Same prices: numbers from <strong style="color:#fff;">$1.99/mo</strong></div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://calliotel.com/browse-numbers?first=1" style="display:inline-block;padding:14px 28px;border:1px solid rgba(245,166,35,0.45);color:#f5a623;text-decoration:none;border-radius:12px;font-weight:800;font-size:14px;">Browse US numbers →</a>
    </div>

    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.75;text-align:center;margin:0 0 28px;">
      Thank you for being with Calliotel. We keep building for you.
    </p>

    <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0 0 6px;">Calliotel — Virtual Numbers &amp; Telecom</p>
      <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">
        <a href="https://calliotel.com" style="color:rgba(255,255,255,0.3);text-decoration:none;">calliotel.com</a> ·
        <a href="https://t.me/Calliotelbot/app" style="color:rgba(255,255,255,0.3);text-decoration:none;">Telegram Mini App</a> ·
        <a href="https://calliotel.com/unsubscribe" style="color:rgba(255,255,255,0.25);text-decoration:none;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>"""

EMAIL_TEXT = """CALLIOTEL IS IN TELEGRAM NOW

Open Calliotel inside Telegram — numbers, SMS, calls, and your wallet.
You're already signed in. One tap:
  https://t.me/Calliotelbot/app

What's new:
- 50,000+ US numbers ready to pick
- Canada, UK, Australia, Puerto Rico and more
- Same prices — numbers from $1.99/mo

Browse numbers:
  https://calliotel.com/browse-numbers?first=1

Thank you for being with Calliotel.

© 2026 Calliotel · https://calliotel.com
Unsubscribe: https://calliotel.com/unsubscribe
"""


async def send_one(to: str, subject: str, html: str, text: str) -> bool:
    api_key = os.environ.get("RESEND_API_KEY", "")
    from_addr = os.environ.get("FROM_EMAIL", "Calliotel <noreply@calliotel.com>")
    if not api_key:
        print("❌ RESEND_API_KEY not set")
        return False
    payload = {"from": from_addr, "to": [to], "subject": subject, "html": html, "text": text}
    headers = {"Authorization": f"Bearer {api_key}"}
    for attempt in range(4):
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if resp.status_code in (200, 201, 202):
            return True
        if resp.status_code == 429:
            wait = 5 * (attempt + 1)
            print(f"  429 rate-limit — waiting {wait}s…")
            await asyncio.sleep(wait)
            continue
        print(f"  ✗ {to}: HTTP {resp.status_code} — {resp.text[:160]}")
        return False
    print(f"  ✗ {to}: gave up after retries")
    return False


def _eligible(u: dict) -> bool:
    email = (u.get("email") or "").strip()
    if not u.get("email_verified"):
        return False
    if u.get("needs_real_email"):
        return False
    if not email or "@" not in email:
        return False
    low = email.lower()
    if low.startswith("deleted_"):
        return False
    if low.endswith("@telegram.calliotel.user"):
        return False
    if low.endswith("@calliotel.com") and low.split("@")[0] in {
        "monitor-e2e", "calliotel-monitor", "noreply", "no-reply",
    }:
        return False
    if low in EXCLUDED_EMAILS:
        return False
    if u.get("banned") or u.get("is_banned") or u.get("status") == "banned":
        return False
    if u.get("unsubscribed") or u.get("email_unsubscribed"):
        return False
    return True


async def main():
    dry_run = "--dry-run" in sys.argv
    test_only = "--test" in sys.argv

    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    if not mongo_url or not db_name:
        print("❌ MONGO_URL or DB_NAME not set")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    users = await db.users.find(
        {},
        {
            "_id": 1, "email": 1, "email_verified": 1, "needs_real_email": 1,
            "banned": 1, "is_banned": 1, "status": 1,
            "unsubscribed": 1, "email_unsubscribed": 1,
        },
    ).to_list(None)
    print(f"Total users in DB: {len(users)}")

    if test_only:
        ok = await send_one("support@calliotel.com", EMAIL_SUBJECT, EMAIL_HTML, EMAIL_TEXT)
        print("test to support@calliotel.com:", "OK" if ok else "FAIL")
        client.close()
        return

    if not dry_run:
        notif_id = str(uuid4())
        notif = {
            "id": notif_id,
            "title": NOTIF_TITLE,
            "message": NOTIF_MSG,
            "sent_by": "support@calliotel.com",
            "sent_by_name": "Calliotel Team",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notif)
        await db.user_notifications.insert_many(
            [
                {
                    "notification_id": notif_id,
                    "user_id": u["_id"],
                    "is_read": False,
                    "is_deleted": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                for u in users
            ]
        )
        print(f"✅ In-app notification pushed to {len(users)} users")

    targets = [u for u in users if _eligible(u)]

    already_sent = set()
    async for log in db.campaign_email_log.find(
        {"campaign_id": CAMPAIGN_ID, "status": "sent"}, {"email": 1}
    ):
        already_sent.add(log["email"])

    pending = [u for u in targets if (u.get("email") or "") not in already_sent]
    print(f"📧 {len(targets)} eligible · {len(already_sent)} already sent · {len(pending)} to send")

    if dry_run:
        print("\n🔍 DRY RUN — first 10 targets:")
        for u in pending[:10]:
            print(f"  {u.get('email')}")
        print("\nRe-run without --dry-run to actually send.")
        client.close()
        return

    if not pending:
        print("✨ Already complete — nothing to send.")
        client.close()
        return

    sent = failed = 0
    for u in pending:
        ok = await send_one(u["email"], EMAIL_SUBJECT, EMAIL_HTML, EMAIL_TEXT)
        await db.campaign_email_log.insert_one(
            {
                "campaign_id": CAMPAIGN_ID,
                "email": u["email"],
                "user_id": u["_id"],
                "status": "sent" if ok else "failed",
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        if ok:
            sent += 1
            if sent % 50 == 0:
                print(f"  …{sent} sent, {failed} failed so far")
        else:
            failed += 1
        await asyncio.sleep(2.0)

    print(f"\n✅ Done: {sent} sent, {failed} failed")
    print(f"📊 Campaign total: {len(already_sent) + sent}/{len(targets)} delivered")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
