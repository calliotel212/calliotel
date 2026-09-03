"""
Email the funded-no-number list (Talk Starter 72h).

  /var/www/calliotel/venv/bin/python scripts/send_talk_starter_109.py
"""
import os
import sys
import asyncio
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

load_dotenv("/var/www/calliotel/.env")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CAMPAIGN_ID = "talk_starter_72h_109_email_v1"

EMAIL_SUBJECT = "Your Calliotel balance can buy a US number today"

EMAIL_HTML = """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;padding:10px 22px;background:#F5A623;border-radius:12px;font-weight:900;font-size:22px;color:#000;">CALLIOTEL</div>
    </div>
    <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.35);border-radius:20px;padding:28px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:1.4px;color:#93c5fd;">LATE SUMMER TALK · ENDS SEP 21</p>
      <h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#fff;">You already have credit</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.65;margin:0;">
        A US number is from <strong style="color:#fff;">$1.99/mo</strong>. First $5 unlocks
        <strong style="color:#fff;">60 minutes</strong> of US/Canada calls, then $0.02/min.
        Real calls — not a one-time code.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://calliotel.com/browse-numbers?first=1" style="display:inline-block;padding:16px 36px;background:#F5A623;color:#000;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px;">Activate a number →</a>
    </div>
    <p style="font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;">
      If you only need a WhatsApp code, use onetimeotp.com — do not spend a monthly number on one SMS.
    </p>
    <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);margin-top:28px;">
      <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0;">
        <a href="https://calliotel.com" style="color:rgba(255,255,255,0.35);text-decoration:none;">calliotel.com</a>
        · <a href="https://calliotel.com/unsubscribe" style="color:rgba(255,255,255,0.25);text-decoration:none;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>"""

EMAIL_TEXT = """CALLIOTEL — YOUR BALANCE CAN BUY A US NUMBER

A US number is from $1.99/mo. First $5 unlocks 60 minutes of US/Canada calls, then $0.02/min.

Activate: https://calliotel.com/browse-numbers?first=1

If you only need a WhatsApp code, use onetimeotp.com.

© 2026 Calliotel
"""


async def send_one(to: str, subject: str, html: str, text: str) -> bool:
    api_key = os.environ.get("RESEND_API_KEY", "")
    from_addr = os.environ.get("FROM_EMAIL", "Calliotel <noreply@calliotel.com>")
    if not api_key:
        print("RESEND_API_KEY missing")
        return False
    payload = {"from": from_addr, "to": [to], "subject": subject, "html": html, "text": text}
    headers = {"Authorization": f"Bearer {api_key}"}
    for attempt in range(4):
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if resp.status_code in (200, 201, 202):
            return True
        if resp.status_code == 429:
            await asyncio.sleep(5 * (attempt + 1))
            continue
        print(f"  fail HTTP {resp.status_code}")
        return False
    return False


def _eligible(u: dict) -> bool:
    email = (u.get("email") or "").strip()
    if not u.get("email_verified"):
        return False
    if not email or "@" not in email:
        return False
    low = email.lower()
    if low.startswith("deleted_") or low.endswith("@telegram.calliotel.user"):
        return False
    if u.get("banned") or u.get("is_banned") or u.get("status") == "banned":
        return False
    return True


async def funded_no_number(db):
    owners = set()
    async for doc in db.user_numbers.find({"status": "active"}, {"user_id": 1}):
        if doc.get("user_id"):
            owners.add(str(doc["user_id"]))
    funded = []
    async for w in db.wallets.find({}, {"user_id": 1, "balance": 1}):
        bal = float(w.get("balance") or 0)
        uid = str(w.get("user_id") or "")
        if bal >= 1.99 and uid and uid not in owners:
            funded.append(uid)
    users = []
    for uid in funded:
        u = None
        try:
            u = await db.users.find_one({"_id": ObjectId(uid)})
        except Exception:
            u = None
        if not u:
            u = await db.users.find_one({"_id": uid})
        if u and _eligible(u):
            users.append(u)
    return users


async def main():
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    ok = await send_one("support@calliotel.com", EMAIL_SUBJECT, EMAIL_HTML, EMAIL_TEXT)
    print("test support:", "OK" if ok else "FAIL")
    if not ok:
        client.close()
        return

    targets = await funded_no_number(db)
    already = set()
    async for log in db.campaign_email_log.find(
        {"campaign_id": CAMPAIGN_ID, "status": "sent"}, {"email": 1}
    ):
        already.add((log.get("email") or "").lower())
    pending = [u for u in targets if (u.get("email") or "").lower() not in already]
    print(f"eligible {len(targets)} already {len(already)} pending {len(pending)}")

    sent = failed = 0
    for u in pending:
        email = u["email"]
        ok = await send_one(email, EMAIL_SUBJECT, EMAIL_HTML, EMAIL_TEXT)
        await db.campaign_email_log.insert_one({
            "campaign_id": CAMPAIGN_ID,
            "email": email,
            "user_id": u["_id"],
            "status": "sent" if ok else "failed",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        if ok:
            sent += 1
        else:
            failed += 1
        if (sent + failed) % 25 == 0:
            print(f"progress sent {sent} failed {failed}")
        await asyncio.sleep(2.0)

    print(f"done sent {sent} failed {failed}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
