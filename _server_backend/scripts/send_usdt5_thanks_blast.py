"""
Product update blast — USDT from $5, numbers, thank you.

  cd /var/www/calliotel/backend
  /var/www/calliotel/venv/bin/python scripts/send_usdt5_thanks_blast.py --dry-run
  /var/www/calliotel/venv/bin/python scripts/send_usdt5_thanks_blast.py
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

CAMPAIGN_ID = "aug2026_usdt5_numbers_thanks"

EXCLUDED_EMAILS = {
    "gam41@mail.aub.edu",
}

NOTIF_TITLE = "USDT from $5 is live — plus more numbers"
NOTIF_MSG = (
    "You can now add USDT (TRC-20 and more) from $5. "
    "US, Canada, UK and 100+ countries are ready to pick. Thank you for being with Calliotel."
)

EMAIL_SUBJECT = "You can add USDT from $5 now — plus more numbers"

EMAIL_HTML = """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#f97316,#ef4444);border-radius:12px;font-weight:900;font-size:24px;letter-spacing:-0.5px;">CALLIOTEL</div>
    </div>

    <div style="background:linear-gradient(135deg,rgba(38,161,123,0.18),rgba(245,166,35,0.10));border:1px solid rgba(38,161,123,0.35);border-radius:20px;padding:32px 28px;margin-bottom:28px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">₮</div>
      <h1 style="font-size:24px;font-weight:900;margin:0 0 12px;line-height:1.3;color:#fff;">USDT from $5 is live</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.65);line-height:1.65;margin:0;">
        Add <strong style="color:#26a17b;">$5, $6, $7</strong> or any amount from $5 with USDT TRC-20 — and other coins too.<br>
        Card still works from $2.
      </p>
    </div>

    <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.28);border-radius:16px;padding:24px 28px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:rgba(16,185,129,0.85);letter-spacing:1.5px;margin-bottom:12px;">ADD CREDITS IN SECONDS</div>
      <p style="font-size:14px;color:rgba(255,255,255,0.55);margin:0 0 20px;line-height:1.55;">
        Open Buy Credits, pick USDT TRC-20, enter $5 (or more), and <strong style="color:#fff;">scan the QR</strong>. Wallet updates after the network confirms.
      </p>
      <a href="https://calliotel.com/buy-credits" style="display:inline-block;padding:16px 38px;background:linear-gradient(135deg,#26a17b,#059669);color:#fff;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px;box-shadow:0 6px 24px rgba(38,161,123,0.35);">Add $5 USDT →</a>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:1.5px;margin-bottom:14px;">WHAT’S NEW</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;">
        <div style="margin-bottom:10px;"><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;Crypto from <strong style="color:#fff;">$5</strong> — USDT TRC-20, TRX, and more</div>
        <div style="margin-bottom:10px;"><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;US, Canada, UK numbers ready to pick — plus 100+ countries</div>
        <div style="margin-bottom:10px;"><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;SMS, calls, and your wallet on <a href="https://calliotel.com" style="color:#f5a623;text-decoration:none;">calliotel.com</a></div>
        <div><span style="color:#10b981;font-weight:700;">✓</span> &nbsp;Card top-up still from $2</div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://calliotel.com/numbers" style="display:inline-block;padding:14px 28px;border:1px solid rgba(245,166,35,0.45);color:#f5a623;text-decoration:none;border-radius:12px;font-weight:800;font-size:14px;">Browse numbers →</a>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.75;margin:0;">
        Thank you for being with Calliotel.<br>
        You made this possible — we keep building for you.
      </p>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px 20px;margin-bottom:32px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.45);font-size:13px;">
        Need help? We’re here.<br>
        💬 <a href="https://wa.me/96171525354" style="color:#10b981;text-decoration:none;">WhatsApp</a> &nbsp;·&nbsp;
        📱 <a href="https://t.me/calliotel" style="color:#3b82f6;text-decoration:none;">Telegram @calliotel</a> &nbsp;·&nbsp;
        ✉ <a href="mailto:support@calliotel.com" style="color:#f5a623;text-decoration:none;">support@calliotel.com</a>
      </p>
    </div>

    <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0 0 6px;">Calliotel — Virtual Numbers &amp; Telecom</p>
      <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">
        <a href="https://calliotel.com" style="color:rgba(255,255,255,0.3);text-decoration:none;">calliotel.com</a> ·
        <a href="https://calliotel.com/help" style="color:rgba(255,255,255,0.3);text-decoration:none;">Help</a> ·
        <a href="https://calliotel.com/unsubscribe" style="color:rgba(255,255,255,0.25);text-decoration:none;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>"""

EMAIL_TEXT = """CALLIOTEL — USDT FROM $5 IS LIVE

You can now add $5, $6, $7 or any amount from $5 with USDT TRC-20 (and other coins).
Card still works from $2.

Add credits:
  https://calliotel.com/buy-credits

Tip: scan the QR on the payment page.

US, Canada, UK numbers are ready to pick — plus 100+ countries.
  https://calliotel.com/numbers

Thank you for being with Calliotel. You made this possible — we keep building for you.

Need help?
WhatsApp: +961 71 525 354
Telegram: @calliotel
Email: support@calliotel.com

© 2026 Calliotel · https://calliotel.com
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
    if not email or "@" not in email:
        return False
    low = email.lower()
    if low.startswith("deleted_"):
        return False
    if low.endswith("@telegram.calliotel.user"):
        return False
    if low in EXCLUDED_EMAILS:
        return False
    if u.get("banned") or u.get("is_banned") or u.get("status") == "banned":
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
        {"_id": 1, "email": 1, "email_verified": 1, "banned": 1, "is_banned": 1, "status": 1},
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

    pending = [u for u in targets if u["email"] not in already_sent]
    print(f"📧 {len(targets)} eligible · {len(already_sent)} already sent · {len(pending)} to send")

    if dry_run:
        print("\n🔍 DRY RUN — first 10 targets:")
        for u in pending[:10]:
            print(f"  {u['email']}")
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
