"""
Ensure MongoDB indexes for Calliotel hot paths.

Safe to run repeatedly (create_index is idempotent).
Does NOT create unique email indexes yet — a few historical duplicate
emails exist; equality indexes still kill COLLSCAN.

Usage:
  /var/www/calliotel/venv/bin/python scripts/ensure_indexes.py
Or imported from server lifespan.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Allow running as a standalone script from backend root
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def backfill_email_normalized(db) -> int:
    """Fill email_normalized for users missing it (lowercase email)."""
    updated = 0
    cursor = db.users.find(
        {
            "$or": [
                {"email_normalized": {"$exists": False}},
                {"email_normalized": None},
                {"email_normalized": ""},
            ]
        },
        {"email": 1},
    )
    async for doc in cursor:
        email = (doc.get("email") or "").strip().lower()
        if not email:
            continue
        try:
            from services.disposable_emails import normalize_email
            norm = normalize_email(email) or email
        except Exception:
            norm = email
        await db.users.update_one(
            {"_id": doc["_id"]},
            {"$set": {"email_normalized": norm, "email": email}},
        )
        updated += 1
    return updated


async def ensure_indexes(db=None) -> dict:
    """Create P0/P1 indexes. Returns summary dict."""
    if db is None:
        from database import db as _db
        db = _db

    summary = {"indexes": [], "backfill_email_normalized": 0, "errors": []}

    try:
        n = await backfill_email_normalized(db)
        summary["backfill_email_normalized"] = n
        logger.info(f"email_normalized backfill: {n} users")
    except Exception as e:
        summary["errors"].append(f"backfill: {e}")
        logger.warning(f"email_normalized backfill failed: {e}")

    # (collection, keys, kwargs, label)
    specs = [
        # users
        ("users", [("email", 1)], {}, "users.email"),
        ("users", [("email_normalized", 1)], {}, "users.email_normalized"),
        ("users", [("client_id", 1)], {"unique": True, "sparse": True}, "users.client_id"),
        ("users", [("signup_ip", 1), ("created_at", 1)], {}, "users.signup_ip_created"),
        ("users", [("verification_token", 1)], {"sparse": True}, "users.verification_token"),
        ("users", [("referral_code", 1)], {"sparse": True}, "users.referral_code"),
        # numbers
        ("user_numbers", [("phone_number", 1), ("status", 1)], {}, "user_numbers.phone_status"),
        ("user_numbers", [("user_id", 1), ("status", 1)], {}, "user_numbers.user_status"),
        ("user_numbers", [("status", 1), ("next_renewal_date", 1)], {}, "user_numbers.renewal"),
        ("purchased_numbers", [("phone_number", 1), ("status", 1)], {}, "purchased_numbers.phone_status"),
        ("purchased_numbers", [("user_id", 1), ("status", 1)], {}, "purchased_numbers.user_status"),
        ("purchased_numbers", [("status", 1), ("next_billing_date", 1)], {}, "purchased_numbers.billing"),
        # messaging / calls
        ("sms_messages", [("user_id", 1), ("created_at", -1)], {}, "sms_messages.user_created"),
        ("sms_messages", [("to_number", 1), ("created_at", -1)], {}, "sms_messages.to_created"),
        ("voice_calls", [("user_id", 1), ("created_at", -1)], {}, "voice_calls.user_created"),
        ("voice_calls", [("call_control_id", 1)], {}, "voice_calls.call_control_id"),
        ("call_forwarding", [("user_id", 1), ("calliotel_number", 1)], {}, "call_forwarding.user_number"),
        ("user_settings", [("user_id", 1)], {"unique": True}, "user_settings.user_id"),
        ("active_calls", [("user_id", 1)], {}, "active_calls.user_id"),
        # wallet / payments
        ("auth_throttle", [("kind", 1), ("ip", 1), ("created_at", -1)], {}, "auth_throttle.ip"),
        ("auth_throttle", [("kind", 1), ("identity", 1), ("created_at", -1)], {}, "auth_throttle.identity"),
        ("wallets", [("user_id", 1)], {}, "wallets.user_id"),
        ("promo_redemptions", [("ip", 1), ("created_at", -1)], {}, "promo_redemptions.ip_created"),
        ("promo_redemptions", [("user_id", 1), ("code", 1)], {}, "promo_redemptions.user_code"),
        ("transactions", [("user_id", 1), ("created_at", -1)], {}, "transactions.user_created"),
        ("transactions", [("call_control_id", 1)], {"sparse": True}, "transactions.call_control_id"),
        ("payment_transactions", [("user_id", 1), ("created_at", -1)], {}, "payment_transactions.user_created"),
        ("payment_transactions", [("session_id", 1)], {"sparse": True}, "payment_transactions.session_id"),
        ("payment_transactions", [("status", 1), ("created_at", -1)], {}, "payment_transactions.status_created"),
        ("number_checkout_intents", [("stripe_session_id", 1)], {"sparse": True}, "checkout.stripe_session"),
        # ops
        ("email_queue", [("status", 1), ("created_at", 1)], {}, "email_queue.status_created"),
        ("verification_tokens", [("token", 1)], {"sparse": True}, "verification_tokens.token"),
        ("password_resets", [("token", 1)], {"sparse": True}, "password_resets.token"),
        ("password_resets", [("email", 1)], {}, "password_resets.email"),
        ("telegram_links", [("user_id", 1)], {}, "telegram_links.user_id"),
        ("push_subscriptions", [("user_id", 1), ("active", 1)], {}, "push_subscriptions.user_active"),
        ("device_tokens", [("user_id", 1), ("active", 1)], {}, "device_tokens.user_active"),
        ("voicemails", [("user_id", 1), ("created_at", -1)], {}, "voicemails.user_created"),
        ("voicemails", [("call_control_id", 1)], {"sparse": True}, "voicemails.call_control_id"),
        ("voicemails", [("user_id", 1), ("read", 1)], {}, "voicemails.user_read"),
        ("call_recordings", [("user_id", 1), ("created_at", -1)], {}, "call_recordings.user_created"),
        ("call_recordings", [("call_control_id", 1)], {"sparse": True}, "call_recordings.call_control_id"),
        ("call_recordings", [("user_id", 1), ("read", 1)], {}, "call_recordings.user_read"),
        ("webrtc_sessions", [("user_id", 1), ("created_at", -1)], {}, "webrtc_sessions.user_created"),
        ("webrtc_sessions", [("id", 1)], {"unique": True}, "webrtc_sessions.id"),
    ]

    for coll, keys, kwargs, label in specs:
        try:
            name = await db[coll].create_index(keys, background=True, **kwargs)
            summary["indexes"].append(f"{label} -> {name}")
            logger.info(f"index ok: {label} ({name})")
        except Exception as e:
            msg = f"{label}: {e}"
            summary["errors"].append(msg)
            logger.warning(f"index skip/fail: {msg}")

    return summary


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from dotenv import load_dotenv
    # Prefer production env (systemd EnvironmentFile). Do not let an empty
    # backend/.env wipe MONGO_URL (load_dotenv does not override by default,
    # so loading empty first would block the real value).
    load_dotenv("/var/www/calliotel/.env", override=True)
    load_dotenv(ROOT / ".env")

    async def _run():
        from database import db
        summary = await ensure_indexes(db)
        print(summary)
        if summary["errors"]:
            # Non-zero only if EVERYTHING failed
            if len(summary["errors"]) > len(summary["indexes"]):
                raise SystemExit(1)

    asyncio.run(_run())


if __name__ == "__main__":
    main()
