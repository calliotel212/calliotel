"""
Google Play + iOS update, 100K+ US number options, and Australia launch.

  cd /var/www/calliotel/backend
  /var/www/calliotel/venv/bin/python scripts/send_store_updates_australia_blast.py --dry-run
  /var/www/calliotel/venv/bin/python scripts/send_store_updates_australia_blast.py --test
  /var/www/calliotel/venv/bin/python scripts/send_store_updates_australia_blast.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/var/www/calliotel/.env")

CAMPAIGN_ID = "aug2026_store_updates_us100k_australia"
IMAGE_URL = "https://calliotel.com/email-assets/store-updates-australia-2026-08.png"
GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=app.calliotel"
APP_STORE_URL = "https://apps.apple.com/us/app/calliotel/id6761994577"
BROWSE_URL = "https://calliotel.com/browse-numbers?first=1"

EMAIL_SUBJECT = "Calliotel updated on iOS & Google Play — Australia is here 🇦🇺"

EMAIL_HTML = f"""<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#070b1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#fff;">
  <div style="display:none;max-height:0;overflow:hidden;">
    Explore 100K+ US number options, new Australian numbers, and our latest mobile updates.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070b1a;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0c1228;border:1px solid #202b4d;border-radius:22px;overflow:hidden;">
        <tr>
          <td>
            <img src="{IMAGE_URL}" width="620" alt="Calliotel virtual numbers in the United States and Australia" style="display:block;width:100%;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:34px 30px 12px;text-align:center;">
            <div style="display:inline-block;color:#f5a623;font-size:13px;font-weight:800;letter-spacing:1.5px;margin-bottom:12px;">CALLIOTEL PRODUCT UPDATE</div>
            <h1 style="margin:0 0 14px;font-size:30px;line-height:1.18;color:#fff;">Better on iOS and Google Play</h1>
            <p style="margin:0;color:#aeb8d4;font-size:16px;line-height:1.65;">
              The latest Calliotel experience is now available on both mobile stores—with more number choices than ever.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 30px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding:18px;background:#111a36;border:1px solid #273456;border-radius:14px;">
                  <div style="font-size:23px;margin-bottom:7px;">🇺🇸 <strong style="color:#fff;">100K+ US number options</strong></div>
                  <div style="color:#9da9c8;font-size:14px;line-height:1.55;">Search more US numbers and area codes to find the right fit.</div>
                </td>
              </tr>
              <tr><td height="12"></td></tr>
              <tr>
                <td style="padding:18px;background:#111a36;border:1px solid #273456;border-radius:14px;">
                  <div style="font-size:23px;margin-bottom:7px;">🇦🇺 <strong style="color:#fff;">Australian numbers are live</strong></div>
                  <div style="color:#9da9c8;font-size:14px;line-height:1.55;">Browse Australian mobile numbers with SMS and calling support.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:10px 30px 26px;">
            <a href="{BROWSE_URL}" style="display:inline-block;background:linear-gradient(135deg,#f5a623,#e68a00);color:#111;text-decoration:none;font-size:16px;font-weight:900;padding:15px 30px;border-radius:12px;">Browse numbers →</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 32px;text-align:center;">
            <p style="margin:0 0 14px;color:#9da9c8;font-size:14px;">Get the latest version:</p>
            <a href="{GOOGLE_PLAY_URL}" style="display:inline-block;margin:4px;padding:11px 18px;border:1px solid #3b496f;border-radius:10px;color:#fff;text-decoration:none;font-weight:700;">Google Play</a>
            <a href="{APP_STORE_URL}" style="display:inline-block;margin:4px;padding:11px 18px;border:1px solid #3b496f;border-radius:10px;color:#fff;text-decoration:none;font-weight:700;">iOS App Store</a>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 30px;border-top:1px solid #202b4d;text-align:center;color:#66728f;font-size:11px;line-height:1.6;">
            Number inventory and features vary by region and availability.<br>
            <a href="https://calliotel.com" style="color:#8a96b5;text-decoration:none;">Calliotel</a>
            &nbsp;·&nbsp;
            <a href="https://calliotel.com/help" style="color:#8a96b5;text-decoration:none;">Help</a>
            &nbsp;·&nbsp;
            <a href="https://calliotel.com/unsubscribe" style="color:#8a96b5;text-decoration:none;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

EMAIL_TEXT = f"""CALLIOTEL PRODUCT UPDATE

The latest Calliotel experience is available on iOS and Google Play.

What's new:
- 100K+ US number options
- Australian mobile numbers with SMS and calling support
- Updated Calliotel apps for iPhone and Android

Browse numbers: {BROWSE_URL}
Google Play: {GOOGLE_PLAY_URL}
iOS App Store: {APP_STORE_URL}

Number inventory and features vary by region and availability.

Calliotel: https://calliotel.com
Unsubscribe: https://calliotel.com/unsubscribe
"""

EXCLUDED_EMAILS = {
    "monitor-e2e@calliotel.com",
    "calliotel-monitor@calliotel.com",
}


def eligible(user: dict) -> bool:
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
    if email in EXCLUDED_EMAILS:
        return False
    return True


async def send_one(client: httpx.AsyncClient, email: str) -> tuple[bool, str]:
    api_key = os.environ.get("RESEND_API_KEY", "")
    from_addr = os.environ.get("FROM_EMAIL", "Calliotel <noreply@calliotel.com>")
    payload = {
        "from": from_addr,
        "to": [email],
        "subject": EMAIL_SUBJECT,
        "html": EMAIL_HTML,
        "text": EMAIL_TEXT,
        "headers": {
            "List-Unsubscribe": "<https://calliotel.com/unsubscribe>",
        },
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
            wait = int(retry_after) if retry_after.isdigit() else min(300, 15 * (attempt + 1))
            await asyncio.sleep(max(5, wait))
            continue
        return False, f"HTTP {response.status_code}: {response.text[:180]}"
    return False, "rate limit retries exhausted"


async def main() -> None:
    dry_run = "--dry-run" in sys.argv
    test_only = "--test" in sys.argv
    limit = None
    if "--limit" in sys.argv:
        limit = max(1, int(sys.argv[sys.argv.index("--limit") + 1]))

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name or not os.environ.get("RESEND_API_KEY"):
        raise SystemExit("Missing MONGO_URL, DB_NAME, or RESEND_API_KEY")

    mongo = AsyncIOMotorClient(mongo_url)
    db = mongo[db_name]
    users = await db.users.find(
        {},
        {
            "_id": 1, "email": 1, "email_verified": 1, "needs_real_email": 1,
            "banned": 1, "is_banned": 1, "status": 1, "unsubscribed": 1,
            "email_unsubscribed": 1, "marketing_opt_out": 1,
        },
    ).to_list(None)
    targets = [user for user in users if eligible(user)]

    if test_only:
        async with httpx.AsyncClient(timeout=25) as client:
            ok, error = await send_one(client, "support@calliotel.com")
        print("TEST_OK" if ok else f"TEST_FAILED {error}")
        mongo.close()
        return

    sent_emails = {
        row["email"].lower()
        async for row in db.campaign_email_log.find(
            {"campaign_id": CAMPAIGN_ID, "status": "sent"}, {"email": 1}
        )
    }
    pending = [user for user in targets if user["email"].strip().lower() not in sent_emails]
    if limit:
        pending = pending[:limit]

    print(
        f"users={len(users)} eligible={len(targets)} "
        f"already_sent={len(sent_emails)} pending={len(pending)}"
    )
    if dry_run or not pending:
        mongo.close()
        return

    sent = failed = 0
    async with httpx.AsyncClient(timeout=25) as client:
        for user in pending:
            email = user["email"].strip()
            ok, error = await send_one(client, email)
            await db.campaign_email_log.insert_one({
                "campaign_id": CAMPAIGN_ID,
                "email": email,
                "user_id": user["_id"],
                "status": "sent" if ok else "failed",
                "error": error or None,
                "sent_at": datetime.now(timezone.utc).isoformat(),
            })
            if ok:
                sent += 1
            else:
                failed += 1
                print(f"FAILED {email}: {error}")
            if (sent + failed) % 50 == 0:
                print(f"progress sent={sent} failed={failed}", flush=True)
            await asyncio.sleep(0.7)

    print(f"DONE sent={sent} failed={failed}", flush=True)
    mongo.close()


if __name__ == "__main__":
    asyncio.run(main())
