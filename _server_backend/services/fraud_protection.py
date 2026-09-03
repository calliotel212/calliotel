"""
Fraud & Chargeback Protection — velocity limits + account age checks.

Two layers of protection:
  1. Velocity limits   — cap how many purchases / top-ups a user or IP can make per 24 h
  2. New-account hold  — brand-new accounts must wait before making card payments

All blocked events are logged to `fraud_events` in MongoDB so admins can review them.
No external service required — runs entirely from the existing MongoDB connection.

3D Secure note
──────────────
3D Secure (3DS) is enforced at the payment-processor level, not here.
When a new card processor is integrated (e.g. PayPal Advanced Checkout),
enable 3DS on that processor's dashboard. PayPal Advanced Checkout enforces
3DS automatically for all card payments in supported regions.
"""

import logging
from database import db
from datetime import datetime, timezone, timedelta
import os

logger = logging.getLogger(__name__)

# ── Tunable limits ─────────────────────────────────────────────────────────────
# Raise these per-user via support — do NOT hard-code bypasses in route code.

LIMITS = {
    # Card wallet top-ups
    "topup_count_per_user_24h":  3,       # max sessions per user per day
    "topup_usd_per_user_24h":    100.00,  # max $ per user per day
    "topup_count_per_ip_24h":    5,       # max sessions per IP per day

    # Virtual number purchases (wallet-funded)
    "number_purchase_per_user_24h": 4,    # max numbers per user per day

    # OTP number purchases
    "otp_purchase_per_user_24h": 15,      # max OTP numbers per user per day

    # New-account hold (minutes) before card payments are allowed — 3 days
    "new_account_hold_minutes": 4320,

    # New accounts (< 7 days old): max total deposits in first 7 days
    "new_account_max_usd_7days": 50.00,

    # Telegram alert threshold: new account (< 7 days) deposits >= this amount
    "new_account_alert_usd": 20.00,
}

# Support can reopen an account for crypto without waiting out the card hold.
CRYPTO_OPEN_EMAILS = {
    "mavrodimaria6@gmail.com",
}

# IPs that should never be blocked (loopback, LAN, Replit health checks)
_TRUSTED_IPS = {"127.0.0.1", "::1", ""}


def _window_iso() -> str:
    """ISO timestamp for 24 h ago — used as MongoDB gte boundary."""
    return (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()


def extract_ip(http_request) -> str:
    """Pull the real client IP from X-Forwarded-For (Nginx proxy) or fall back."""
    if http_request is None:
        return ""
    xff = http_request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return getattr(getattr(http_request, "client", None), "host", "") or ""


# ── Wallet top-up checks ───────────────────────────────────────────────────────

async def check_wallet_topup(
    user_id: str,
    user_email: str,
    amount_usd: float,
    ip: str,
    user_created_at: str = "",
    method: str = "card",
) -> None:
    """
    Raise ValueError with a user-visible message if this top-up should be blocked.
    Call BEFORE creating any payment session.

    method: "card" (Stripe) or "crypto" (USDT / NOWPayments). Card-only holds
    must never block crypto — clients get a card error while paying USDT.
    """
    window = _window_iso()
    email_l = (user_email or "").strip().lower()
    is_crypto = (method or "card").lower() in ("crypto", "usdt", "bekena", "nowpayments")

    # Support reopen: this account may pay crypto immediately.
    if is_crypto and email_l in CRYPTO_OPEN_EMAILS:
        return

    # 1. New-account hold + 7-day deposit cap  (CARD ONLY)
    if user_created_at and not is_crypto:
        try:
            created = datetime.fromisoformat(user_created_at.replace("Z", "+00:00"))
            age_minutes = (datetime.now(timezone.utc) - created).total_seconds() / 60
            age_days    = age_minutes / 1440

            hold = LIMITS["new_account_hold_minutes"]
            if age_minutes < hold:
                wait_hours = int((hold - age_minutes) / 60) + 1
                logger.warning(
                    f"🚨 New-account hold: {user_email} (account {age_minutes:.0f} min old)"
                )
                await _log_block("new_account_hold", user_id, ip, amount_usd,
                                 f"account age {age_minutes:.0f} min < {hold} min hold")
                raise ValueError(
                    f"For security, card payments unlock 3 days after account creation. "
                    f"Please wait approximately {wait_hours} more hour(s) or contact support@calliotel.com."
                )

            # 1b. 7-day total cap for new accounts
            if age_days < 7:
                seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                pipeline_7d = [
                    {"$match": {"type": "wallet_topup", "user_id": user_id,
                                "created_at": {"$gte": seven_days_ago}, "blocked": False}},
                    {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}},
                ]
                agg_7d = await db.fraud_events.aggregate(pipeline_7d).to_list(1)
                total_7d = agg_7d[0]["total"] if agg_7d else 0.0
                cap_7d = LIMITS["new_account_max_usd_7days"]
                if total_7d + amount_usd > cap_7d:
                    logger.warning(
                        f"🚨 New-account 7-day cap: {user_email} — "
                        f"${total_7d:.2f} this week + ${amount_usd:.2f} > ${cap_7d:.0f} cap"
                    )
                    await _log_block("new_account_7day_cap", user_id, ip, amount_usd,
                                     f"${total_7d:.2f} + ${amount_usd:.2f} > ${cap_7d:.0f} 7-day cap")
                    raise ValueError(
                        f"New accounts are limited to ${cap_7d:.0f} total deposits in the first 7 days. "
                        "Email support@calliotel.com to raise your limit."
                    )

                # 1c. Telegram alert for new-account payments above threshold
                alert_thresh = LIMITS["new_account_alert_usd"]
                if amount_usd >= alert_thresh:
                    try:
                        import httpx as _httpx, os as _os
                        bot_token = _os.environ.get("TELEGRAM_BOT_TOKEN", "")
                        admin_ids = [
                            value.strip()
                            for value in _os.environ.get("TELEGRAM_ADMIN_CHAT_IDS", "").replace(";", ",").split(",")
                            if value.strip()
                        ]
                        chat_id = admin_ids[0] if admin_ids else ""
                        age_str   = f"{age_days:.1f} days" if age_days >= 1 else f"{age_minutes:.0f} min"
                        msg = (
                            f"⚠️ NEW ACCOUNT LARGE PAYMENT\n"
                            f"👤 {user_email}\n"
                            f"💵 ${amount_usd:.2f}\n"
                            f"🕐 Account age: {age_str}\n"
                            f"🌐 IP: {ip or 'unknown'}\n"
                            f"📋 Review at /admin if suspicious"
                        )
                        if bot_token and chat_id:
                            async with _httpx.AsyncClient(timeout=5) as _hc:
                                await _hc.post(
                                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                                    json={"chat_id": chat_id, "text": msg},
                                )
                    except Exception as _ae:
                        logger.warning(f"fraud alert send failed: {_ae}")

        except ValueError:
            raise
        except Exception:
            pass

    # 2. Per-user daily count
    count = await db.fraud_events.count_documents({
        "type": "wallet_topup",
        "user_id": user_id,
        "created_at": {"$gte": window},
        "blocked": False,
    })
    if count >= LIMITS["topup_count_per_user_24h"]:
        logger.warning(f"🚨 Velocity block (count): {user_email} — {count} top-ups today")
        await _log_block("velocity_count", user_id, ip, amount_usd,
                         f"{count} top-ups in 24 h ≥ limit {LIMITS['topup_count_per_user_24h']}")
        raise ValueError(
            f"For your security, top-ups are limited to "
            f"{LIMITS['topup_count_per_user_24h']} per day. "
            "Email support@calliotel.com to raise your limit."
        )

    # 3. Per-user daily $ amount
    pipeline = [
        {"$match": {"type": "wallet_topup", "user_id": user_id,
                    "created_at": {"$gte": window}, "blocked": False}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}},
    ]
    agg = await db.fraud_events.aggregate(pipeline).to_list(1)
    total_today = agg[0]["total"] if agg else 0.0
    if total_today + amount_usd > LIMITS["topup_usd_per_user_24h"]:
        logger.warning(
            f"🚨 Velocity block (amount): {user_email} — "
            f"${total_today:.2f} today + ${amount_usd:.2f} = "
            f">${LIMITS['topup_usd_per_user_24h']:.0f} limit"
        )
        await _log_block("velocity_amount", user_id, ip, amount_usd,
                         f"${total_today:.2f} + ${amount_usd:.2f} > ${LIMITS['topup_usd_per_user_24h']:.0f} daily limit")
        raise ValueError(
            f"For your security, top-ups are limited to "
            f"${LIMITS['topup_usd_per_user_24h']:.0f} per day. "
            "Email support@calliotel.com to raise your limit."
        )

    # 4. Per-IP daily count
    if ip and ip not in _TRUSTED_IPS:
        ip_count = await db.fraud_events.count_documents({
            "type": "wallet_topup",
            "ip": ip,
            "created_at": {"$gte": window},
            "blocked": False,
        })
        if ip_count >= LIMITS["topup_count_per_ip_24h"]:
            logger.warning(f"🚨 IP velocity block: {ip} — {ip_count} top-ups today")
            await _log_block("ip_velocity", user_id, ip, amount_usd,
                             f"IP {ip} made {ip_count} top-ups in 24 h")
            raise ValueError(
                "Too many payment attempts from this network. "
                "Please try again tomorrow or contact support@calliotel.com."
            )


async def record_wallet_topup(
    user_id: str, amount_usd: float, ip: str, session_id: str
) -> None:
    """Record a successful (non-blocked) top-up initiation for velocity tracking."""
    await db.fraud_events.insert_one({
        "type": "wallet_topup",
        "user_id": user_id,
        "amount_usd": amount_usd,
        "ip": ip,
        "session_id": session_id,
        "blocked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ── Number purchase checks ─────────────────────────────────────────────────────

async def check_number_purchase(user_id: str, user_email: str) -> None:
    """
    Raise ValueError if this number purchase should be blocked.
    Call BEFORE deducting the wallet.
    """
    window = _window_iso()
    count = await db.fraud_events.count_documents({
        "type": "number_purchase",
        "user_id": user_id,
        "created_at": {"$gte": window},
        "blocked": False,
    })
    if count >= LIMITS["number_purchase_per_user_24h"]:
        logger.warning(
            f"🚨 Velocity block (numbers): {user_email} — {count} purchases today"
        )
        await _log_block("number_velocity", user_id, "", 0,
                         f"{count} number purchases in 24 h ≥ limit {LIMITS['number_purchase_per_user_24h']}")
        raise ValueError(
            f"For your security, number purchases are limited to "
            f"{LIMITS['number_purchase_per_user_24h']} per day. "
            "Email support@calliotel.com to raise your limit."
        )


async def record_number_purchase(
    user_id: str, phone_number: str, amount_usd: float
) -> None:
    """Record a successful number purchase for velocity tracking."""
    await db.fraud_events.insert_one({
        "type": "number_purchase",
        "user_id": user_id,
        "phone_number": phone_number,
        "amount_usd": amount_usd,
        "blocked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ── OTP purchase checks ────────────────────────────────────────────────────────

async def check_otp_purchase(user_id: str, user_email: str) -> None:
    """Raise ValueError if this OTP purchase should be blocked."""
    window = _window_iso()
    count = await db.fraud_events.count_documents({
        "type": "otp_purchase",
        "user_id": user_id,
        "created_at": {"$gte": window},
        "blocked": False,
    })
    if count >= LIMITS["otp_purchase_per_user_24h"]:
        logger.warning(
            f"🚨 Velocity block (OTP): {user_email} — {count} OTP purchases today"
        )
        await _log_block("otp_velocity", user_id, "", 0,
                         f"{count} OTP purchases in 24 h ≥ limit {LIMITS['otp_purchase_per_user_24h']}")
        raise ValueError(
            f"OTP number purchases are limited to "
            f"{LIMITS['otp_purchase_per_user_24h']} per day. "
            "Email support@calliotel.com if you need more."
        )


async def record_otp_purchase(
    user_id: str, service: str, amount_usd: float
) -> None:
    """Record a successful OTP purchase for velocity tracking."""
    await db.fraud_events.insert_one({
        "type": "otp_purchase",
        "user_id": user_id,
        "service": service,
        "amount_usd": amount_usd,
        "blocked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ── Internal helpers ───────────────────────────────────────────────────────────

async def _log_block(
    reason: str, user_id: str, ip: str, amount_usd: float, detail: str
) -> None:
    """Persist a blocked-event record so admins can review fraud patterns."""
    try:
        await db.fraud_events.insert_one({
            "type": "wallet_topup",
            "user_id": user_id,
            "ip": ip,
            "amount_usd": amount_usd,
            "blocked": True,
            "block_reason": reason,
            "detail": detail,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error(f"Failed to log fraud block event: {e}")
