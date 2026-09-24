"""Stripe card payment — production gateway with multi-layer fraud protection."""
import os
import uuid
import logging
import html as _html
import stripe
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from pymongo import ReturnDocument
from routes.auth import get_current_user
from database import db
try:
    from services.telegram_admin_alerts import alert as tg_alert, alert_throttled as tg_alert_throttled
except Exception:
    # Operational alerts are optional. A missing Telegram helper must never
    # disable Stripe checkout or crash the API during startup.
    def tg_alert(*_args, **_kwargs):
        return None

    def tg_alert_throttled(*_args, **_kwargs):
        return None

logger = logging.getLogger(__name__)
router = APIRouter()

# Live .env uses STRIPE_API_KEY (sk_live). Keep STRIPE_SECRET_KEY as an alias.
STRIPE_SECRET_KEY      = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY") or ""
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET  = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# ── Fraud guard constants ────────────────────────────────────────────────────
MIN_AMOUNT_USD                = 2.0
MAX_AMOUNT_USD                = 50.0
DAILY_CARD_LIMIT_USD          = 100.0
VELOCITY_WINDOW_HOURS         = 24
RESERVATION_WINDOW_MINUTES    = 15   # how long an unpaid attempt holds against the daily cap
MIN_ACCOUNT_AGE_HOURS         = 0      # new ad users can pay by card immediately
MAX_CHECKOUT_ATTEMPTS_PER_HOUR = 5     # was 12 — testers were opening a new Stripe session every ~2 min
CHECKOUT_BURST_LOCK            = 3     # lock cards if this many new sessions in CHECKOUT_BURST_MINUTES
CHECKOUT_BURST_MINUTES         = 20
MAX_IP_ATTEMPTS_PER_HOUR      = 20
FINGERPRINT_BLOCK_THRESHOLD   = 3      # same card declined this many times → lock that card
USER_DECLINE_WARN_AT          = 2      # email + in-app/push warning
USER_DECLINE_BLOCK_AT         = 3      # lock ALL cards on the account; open a support ticket

# Burner/disposable email domains — blocked from card payments
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com","guerrillamail.com","guerrillamail.info","guerrillamail.biz",
    "guerrillamail.de","guerrillamail.net","guerrillamail.org","guerrillamailblock.com",
    "grr.la","sharklasers.com","spam4.me","tempmail.com","yopmail.com",
    "fakeinbox.com","trashmail.com","throwaway.email","dispostable.com",
    "maildrop.cc","mailnull.com","spamgourmet.com","spamgourmet.net",
    "spamex.com","spamfree24.org","10minutemail.com","10minutemail.net",
    "10minutemail.org","minutemail.com","tempr.email","discard.email",
    "discardmail.com","discardmail.de","mailnesia.com","notsharingmy.info",
    "filzmail.com","0-mail.com","haltospam.com","tafmail.com","boun.cr",
    "getonemail.com","tempinbox.com","proxymail.eu","trash-mail.at",
    "spamgrap.com","drdrb.com","spamgap.com","0815.ru","spamfree.eu",
    "emalupe.com",
}


class CreateCheckoutRequest(BaseModel):
    amount: float  # USD


def _monitor_email_set() -> set[str]:
    base = {
        "monitor-e2e@calliotel.com",
        "calliotel-monitor@calliotel.com",
        "calliotel.qa.35550@gmail.com",
    }
    for e in os.environ.get("MONITOR_EMAILS", "").split(","):
        e = e.strip().lower()
        if e:
            base.add(e)
    return base


@router.get("/config")
async def stripe_config():
    """Return the publishable key so the frontend can init Stripe.js if needed."""
    return {"publishable_key": STRIPE_PUBLISHABLE_KEY, "enabled": bool(STRIPE_SECRET_KEY)}


async def _enforce_card_payment_guards(
    request: Request,
    current_user: dict,
    amount: float,
) -> tuple[str, bool]:
    """Fraud/abuse guards shared by EVERY card payment entry point.

    Both the hosted Checkout flow and the native Apple Pay / Google Pay
    PaymentIntent flow must call this. Applying these guards to only one
    endpoint makes the daily cap, velocity limits and block lists trivially
    bypassable by calling the other endpoint instead.

    Returns (client_ip, is_monitor). Raises HTTPException when a guard trips.
    """
    user_id = str(current_user["_id"])
    email   = current_user.get("email", "")

    # ── 1. Amount range (any $2–$50 — do not reject $6/$7/$8) ───────────────
    amt = round(float(amount), 2)
    if amt < MIN_AMOUNT_USD or amt > MAX_AMOUNT_USD:
        raise HTTPException(400, f"Card amount must be between ${MIN_AMOUNT_USD:.0f} and ${MAX_AMOUNT_USD:.0f}")

    # Monitor / internal service accounts skip all fraud guards so hourly
    # E2E health checks never trip rate limits or age restrictions.
    _monitor_emails = _monitor_email_set()
    is_monitor = email.lower() in _monitor_emails

    # ── 2. Account age guard ─────────────────────────────────────────────────
    created_raw = current_user.get("created_at")
    if created_raw and not is_monitor:
        try:
            if isinstance(created_raw, str):
                ts = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
            else:
                ts = created_raw
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
            if age_h < MIN_ACCOUNT_AGE_HOURS:
                raise HTTPException(
                    403,
                    "For security, card payments require an account at least 24 hours old. "
                    "Use crypto to add balance in the meantime."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # ── 3. Daily spend cap ───────────────────────────────────────────────────
    if not is_monitor:
        window_start = (datetime.now(timezone.utc) - timedelta(hours=VELOCITY_WINDOW_HOURS)).isoformat()
        # Completed payments count for the full 24h window. Pending ones count too, but only
        # briefly: without them, two checkouts opened at the same moment each see the same
        # remaining allowance and can both complete, busting the cap. Expiring the reservation
        # after RESERVATION_WINDOW_MINUTES keeps an abandoned checkout from locking the user out.
        reservation_start = (
            datetime.now(timezone.utc) - timedelta(minutes=RESERVATION_WINDOW_MINUTES)
        ).isoformat()
        recent_payments = await db.stripe_payments.find(
            {
                "user_id": user_id,
                "$or": [
                    {"status": "completed", "created_at": {"$gte": window_start}},
                    {"status": "pending",   "created_at": {"$gte": reservation_start}},
                ],
            },
            {"amount_usd": 1},
        ).to_list(length=100)
        spent_today = sum(float(p.get("amount_usd", 0)) for p in recent_payments)
        remaining = DAILY_CARD_LIMIT_USD - spent_today
        if remaining <= 0:
            raise HTTPException(429,
                f"You have reached the ${DAILY_CARD_LIMIT_USD:.0f} daily card limit. "
                "You can top up again tomorrow, or use crypto for additional balance.")
        if amount > remaining:
            raise HTTPException(429,
                f"You can only add ${remaining:.0f} more by card today "
                f"(daily limit is ${DAILY_CARD_LIMIT_USD:.0f}). Choose a smaller amount or use crypto.")

    # ── 4. IP rate limit ─────────────────────────────────────────────────────
    client_ip = (
        request.headers.get("X-Real-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or "unknown"
    )
    if not is_monitor:
        ip_hour_start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        ip_count = await db.stripe_ip_log.count_documents(
            {"ip": client_ip, "created_at": {"$gte": ip_hour_start}}
        )
        if ip_count >= MAX_IP_ATTEMPTS_PER_HOUR:
            logger.warning(f"🚨 IP rate limit hit: {client_ip} — {ip_count} attempts/hour by {email}")
            raise HTTPException(429, "Too many payment attempts from this location. Please wait and try again.")

    # ── 5. User attempt rate ─────────────────────────────────────────────────
    if not is_monitor:
        user_hour_start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        user_attempts = await db.stripe_payments.count_documents(
            {"user_id": user_id, "created_at": {"$gte": user_hour_start}}
        )
        if user_attempts >= MAX_CHECKOUT_ATTEMPTS_PER_HOUR:
            logger.warning(f"🚨 User checkout rate limit: {email} — {user_attempts} attempts/hour")
            raise HTTPException(429, "Too many payment attempts. Please wait an hour before trying again.")

        burst_start = (datetime.now(timezone.utc) - timedelta(minutes=CHECKOUT_BURST_MINUTES)).isoformat()
        burst = await db.stripe_ip_log.count_documents(
            {"user_id": user_id, "created_at": {"$gte": burst_start}}
        )
        if burst >= CHECKOUT_BURST_LOCK:
            now = datetime.now(timezone.utc).isoformat()
            await db.stripe_blocked_users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "user_id": user_id,
                    "email": email,
                    "blocked_at": now,
                    "reason": f"auto-blocked: {burst} checkout opens in {CHECKOUT_BURST_MINUTES} min",
                    "documents_required": True,
                    "unlock": "email ID photo + selfie to support@calliotel.com",
                }},
                upsert=True,
            )
            logger.warning(f"🚫 Checkout burst lock: {email} — {burst} opens / {CHECKOUT_BURST_MINUTES}m")
            raise HTTPException(
                403,
                "Too many unfinished card checkouts. Card payments are locked. "
                "Email ID + selfie to support@calliotel.com or use crypto.",
            )

    # ── 6. Disposable / burner email block ───────────────────────────────────
    email_domain = email.split("@")[-1].lower() if "@" in email else ""
    if email_domain in DISPOSABLE_EMAIL_DOMAINS:
        logger.warning(f"🚨 Disposable email blocked from card payment: {email}")
        raise HTTPException(403,
            "Card payments require a permanent email address. "
            "Please update your email or use crypto to add balance.")

    # ── 7. Blocked card fingerprint check ────────────────────────────────────
    blocked_fp = await db.stripe_blocked_fingerprints.find_one(
        {"$or": [{"user_id": user_id}, {"email": email}]}
    )
    if blocked_fp:
        logger.warning(f"🚨 Blocked fingerprint/user attempted card payment: {email}")
        raise HTTPException(403,
            "Card payments are locked on this account after declined attempts. "
            "Open Support — a ticket was created. Crypto still works.")

    # ── 8. Account card lock (3 declines = no more cards) ────────────────────
    blocked_user = await db.stripe_blocked_users.find_one(
        {"$or": [{"user_id": user_id}, {"email": email}]}
    )
    if not blocked_user:
        strikes = await db.stripe_user_declines.find_one(
            {"$or": [{"user_id": user_id}, {"email": email}]}
        ) or {}
        if int(strikes.get("count") or 0) >= USER_DECLINE_BLOCK_AT:
            blocked_user = strikes
    if blocked_user:
        reason = blocked_user.get("reason", "too many declined cards")
        logger.warning(f"🚨 Card-locked user attempted card payment: {email} — {reason}")
        raise HTTPException(403,
            "Card payments are locked after 3 declined attempts. "
            "You cannot try another card. Open Support — we created a ticket for you. "
            "Crypto still works.")

    return client_ip, is_monitor


async def _record_card_attempt(client_ip, user_id, email, amount, **ref):
    """Record a card attempt against the IP rate-limit log.

    _enforce_card_payment_guards() COUNTS these rows, so every endpoint that passes the guard
    must also write one. Otherwise that endpoint never consumes the IP allowance and becomes a
    free bypass of the limit the other endpoints are subject to.
    """
    try:
        await db.stripe_ip_log.insert_one({
            "ip":         client_ip,
            "user_id":    user_id,
            "email":      email,
            "amount":     amount,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **ref,
        })
    except Exception:
        # Rate-limit bookkeeping must never fail a payment the guards already approved.
        logger.warning(f"Could not record card attempt for IP rate limiting: {email}")


def _esc(val) -> str:
    return _html.escape(str(val or ""), quote=True)


async def _inapp_notify(user_id: str, title: str, message: str) -> None:
    if not user_id:
        return
    nid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.notifications.insert_one({
        "id": nid,
        "title": title,
        "message": message,
        "sent_by": "system",
        "sent_by_name": "Calliotel Security",
        "created_at": now,
    })
    await db.user_notifications.insert_one({
        "notification_id": nid,
        "user_id": user_id,
        "is_read": False,
        "is_deleted": False,
        "created_at": now,
    })


async def _push_notify(user_id: str, title: str, body: str, url: str = "/notifications") -> None:
    if not user_id:
        return
    try:
        from routes.push_notifications import send_push_notification, NotificationPayload
        await send_push_notification(
            user_id,
            NotificationPayload(title=title, body=body, icon="/icon-192.png", data={"url": url, "type": "card_security"}),
        )
    except Exception as pe:
        logger.warning(f"Card-security push failed: {pe}")


async def _send_card_email(to: str, subject: str, html: str) -> None:
    if not to or "@" not in to:
        return
    try:
        from services.resend_service import send_email
        await send_email(to=to, subject=subject, html=html)
    except Exception as me:
        logger.warning(f"Card-security email failed for {to}: {me}")


def _decline_email_shell(title: str, border: str, inner: str) -> str:
    return f"""<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0d0d0d;color:#fff;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1a1a1a,#111);padding:32px;text-align:center;border-bottom:2px solid {border};">
    <h1 style="font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;">{title}</h1>
    <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0;">Calliotel · Card Payment</p>
  </div>
  <div style="padding:32px;">{inner}
    <p style="font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin-top:28px;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;">
      The Calliotel Team · <a href="https://calliotel.com" style="color:#F5A623;text-decoration:none;">calliotel.com</a>
    </p>
  </div>
</div>"""


async def _resolve_declined_user(meta: dict, email: str, pi_id: str, order_id: str = "") -> tuple[str, str]:
    """Checkout reuses one PaymentIntent; metadata is sometimes missing on failure events."""
    user_id = str((meta or {}).get("user_id") or "").strip()
    order_id = str(order_id or (meta or {}).get("order_id") or "").strip()
    email = (email or "").strip()
    if email == "unknown":
        email = ""
    if user_id and user_id != "unknown" and "@" in email:
        return user_id, email
    clauses = []
    if pi_id:
        clauses.append({"payment_intent_id": pi_id})
    if order_id:
        clauses.append({"order_id": order_id})
    if email and "@" in email:
        clauses.append({"email": email, "status": "pending"})
    rec = None
    if clauses:
        rec = await db.stripe_payments.find_one({"$or": clauses}, sort=[("created_at", -1)])
    if rec:
        user_id = str(rec.get("user_id") or user_id or "").strip()
        email = (rec.get("email") or email or "").strip()
    if (not user_id or user_id == "unknown") and email:
        user_id = email
    return user_id, email


async def _expire_open_card_checkouts(user_id: str, email: str) -> None:
    """Kill the hosted Stripe page so they cannot keep typing another card."""
    if not STRIPE_SECRET_KEY:
        return
    q = {"status": "pending"}
    ors = []
    if user_id:
        ors.append({"user_id": user_id})
    if email:
        ors.append({"email": email})
    if not ors:
        return
    q["$or"] = ors
    pending = await db.stripe_payments.find(q).to_list(25)
    stripe.api_key = STRIPE_SECRET_KEY
    now = datetime.now(timezone.utc).isoformat()
    for pay in pending:
        sid = pay.get("session_id")
        if sid:
            try:
                stripe.checkout.Session.expire(sid)
            except Exception as ex:
                logger.info(f"Checkout expire skipped {sid}: {ex}")
        await db.stripe_payments.update_one(
            {"_id": pay["_id"]},
            {"$set": {
                "status": "cancelled",
                "cancelled_reason": "card_locked_after_declines",
                "updated_at": now,
            }},
        )


async def _open_card_lock_ticket(user_id: str, email: str, count: int, reason: str) -> str:
    ticket_id = ""
    try:
        from routes.support_tickets import create_system_ticket
        ticket_id = await create_system_ticket(
            user_email=email or user_id,
            subject="Card payments locked — declined cards",
            message=(
                f"Card payments were locked after {count} declined attempts. "
                "Trying another card is not allowed. Crypto still works.\n\n"
                f"Last decline: {reason}\n\n"
                "Reply here if this is your own card and you need help."
            ),
            category="billing",
            priority="high",
            extra={"user_id": user_id, "source": "stripe_decline_lock"},
        ) or ""
    except Exception as te:
        logger.warning(f"Card-lock support ticket failed: {te}")
    return ticket_id


async def _apply_user_decline_strikes(
    *,
    user_id: str,
    email: str,
    amount_usd: float,
    reason: str,
    payment_intent_id: str,
    decline_key: str = "",
) -> int:
    """
    Per-user declined-card policy:
      1st decline → notice
      2nd decline → warning email + in-app + push
      3rd decline → lock ALL cards, expire open checkout, open a support ticket

    Stripe Checkout reuses one PaymentIntent while the customer tries more cards,
    so we must NOT skip later declines just because the PI id was already seen.
    Dedup only exact webhook replays (same charge / event key).
    """
    uid = (user_id or "").strip()
    if not uid or uid == "unknown":
        uid = (email or "").strip()
    if not uid:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    pi_id = (payment_intent_id or "").strip()
    dkey = (decline_key or "").strip()
    if not dkey:
        dkey = f"{pi_id}:{now}"
    already = await db.stripe_user_declines.find_one(
        {"user_id": uid, "decline_keys": dkey}
    )
    if already:
        return int(already.get("count") or 0)

    update = {
        "$inc": {"count": 1},
        "$set": {
            "email": email,
            "last_reason": reason,
            "last_declined_at": now,
            "updated_at": now,
        },
        "$setOnInsert": {"user_id": uid, "first_seen_at": now},
        "$addToSet": {"decline_keys": dkey},
    }
    if pi_id:
        update["$addToSet"]["payment_intent_ids"] = pi_id

    doc = await db.stripe_user_declines.find_one_and_update(
        {"user_id": uid},
        update,
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    count = int((doc or {}).get("count") or 1)
    safe_reason = _esc(reason)
    amt = f"{float(amount_usd or 0):.2f}"

    if count >= USER_DECLINE_BLOCK_AT:
        await db.stripe_blocked_users.update_one(
            {"user_id": uid},
            {"$set": {
                "user_id": uid,
                "email": email,
                "blocked_at": now,
                "reason": f"auto-blocked after {count} declined card payments",
                "documents_required": True,
                "unlock": "email ID photo + selfie to support@calliotel.com",
            }},
            upsert=True,
        )
        await db.users.update_one(
            {"_id": uid},
            {"$set": {
                "card_locked": True,
                "documents_required": True,
                "card_locked_at": now,
                "card_locked_reason": f"{count} declined card payments",
            }},
        )
        await db.stripe_user_declines.update_one(
            {"user_id": uid},
            {"$set": {"blocked_at": now, "documents_required": True}},
        )
        ticket_id = await _open_card_lock_ticket(uid, email, count, reason)
        try:
            await _expire_open_card_checkouts(uid, email)
        except Exception as ee:
            logger.warning(f"Could not expire checkouts after card lock: {ee}")
        inner = f"""
    <p style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 16px;">
      Your card payment of <strong>${amt}</strong> was declined again. After <strong>{count} declined attempts</strong>, card payments are locked on this account. You cannot try another card.
    </p>
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:16px;margin:0 0 24px;">
      <p style="font-size:15px;color:#fca5a5;margin:0;font-weight:700;line-height:1.6;">
        A support ticket{(' ' + ticket_id) if ticket_id else ''} was opened for you.
        Reply at <a href="https://calliotel.com/support" style="color:#F5A623;">calliotel.com/support</a>
        or email <a href="mailto:support@calliotel.com" style="color:#F5A623;">support@calliotel.com</a>.
      </p>
    </div>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 24px;">
      You can still add credit with crypto. Last decline reason: {safe_reason}.
    </p>
    <div style="text-align:center;">
      <a href="https://calliotel.com/support" style="background:#F5A623;color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block;">Open support</a>
    </div>"""
        await _send_card_email(
            email,
            "Card payments locked — contact support",
            _decline_email_shell("Card payments locked", "#ef4444", inner),
        )
        msg = (
            "Card payments are locked after 3 declined attempts. "
            "You cannot try another card. Open Support — we created a ticket."
        )
        await _inapp_notify(uid, "Card payments locked", msg)
        await _push_notify(uid, "Card payments locked", msg, "/support")
        try:
            from services.telegram_admin_alerts import notify_admins
            await notify_admins(
                f"🚫 Account cards locked (3 declines)\n"
                f"👤 User: {email}\n"
                f"❌ Declines: {count}\n"
                f"⚠️ Reason: {reason}\n"
                f"🎫 Ticket: {ticket_id or 'pending'}\n"
                f"ℹ️ No more cards — support only",
                also_email=False,
            )
        except Exception as te:
            logger.warning(f"Telegram card-lock alert failed: {te}")
        logger.warning(f"🚫 User card-locked after {count} declines: {email}")
        return count

    if count == USER_DECLINE_WARN_AT:
        inner = f"""
    <p style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 16px;">
      Your <strong>${amt}</strong> card payment was declined. This is the <strong>second</strong> declined attempt on your account.
    </p>
    <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.35);border-radius:10px;padding:16px;margin:0 0 24px;">
      <p style="font-size:15px;color:#F5A623;margin:0;font-weight:700;line-height:1.6;">
        One more declined card will lock card payments on this account. We will then ask for ID documents before unlocking.
      </p>
    </div>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 8px;">
      Use a card that belongs to you. Do not keep trying other cards. Crypto still works.
    </p>
    <p style="font-size:13px;color:rgba(255,255,255,0.45);margin:0 0 24px;">Reason: {safe_reason}</p>
    <div style="text-align:center;">
      <a href="https://calliotel.com/buy-credits" style="background:#F5A623;color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block;">Add credit</a>
    </div>"""
        await _send_card_email(
            email,
            "Warning: one more declined card will lock your account",
            _decline_email_shell("Warning — card payments", "#F5A623", inner),
        )
        msg = (
            "Second declined card. One more decline locks card payments. "
            "Do not try another card — open Support if you need help."
        )
        await _inapp_notify(uid, "Card payment warning", msg)
        await _push_notify(uid, "Card payment warning", msg, "/notifications")
        await db.stripe_user_declines.update_one(
            {"user_id": uid},
            {"$set": {"warning_sent_at": now}},
        )
        try:
            from services.telegram_admin_alerts import notify_admins
            await notify_admins(
                f"⚠️ Card warning (2 declines)\n"
                f"👤 User: {email}\n"
                f"💰 Amount: ${amt}\n"
                f"⚠️ Reason: {reason}",
                also_email=False,
            )
        except Exception:
            pass
        logger.warning(f"⚠️ User card warning after {count} declines: {email}")
        return count

    inner = f"""
    <p style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;margin:0 0 20px;">
      Your <strong>${amt}</strong> card payment was declined. No money was charged.
    </p>
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:16px;margin:0 0 24px;">
      <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 4px;">Reason</p>
      <p style="font-size:15px;color:#fca5a5;margin:0;font-weight:600;">{safe_reason}</p>
    </div>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 24px;">
      Use a card that belongs to you, or add credit with crypto. Repeated declines can lock card payments on this account.
    </p>
    <div style="text-align:center;">
      <a href="https://calliotel.com/buy-credits" style="background:#F5A623;color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block;">Try again</a>
    </div>"""
    await _send_card_email(
        email,
        "Your card payment didn't go through",
        _decline_email_shell("Payment didn't go through", "#ef4444", inner),
    )
    return count


@router.post("/create-checkout")
async def create_stripe_checkout(
    request: Request,
    body: CreateCheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Card payments are not available yet")

    user_id = str(current_user["_id"])
    email   = current_user.get("email", "")

    client_ip, is_monitor = await _enforce_card_payment_guards(
        request, current_user, body.amount
    )

    # ── 9. Create Stripe Checkout Session ────────────────────────────────────
    order_id  = str(uuid.uuid4())
    amount_cents = int(round(body.amount * 100))

    # Monitor/E2E health-check accounts: return a dummy response immediately.
    # Never create a real Stripe session for them — it pollutes the Stripe
    # dashboard with open unpaid sessions and wastes API quota.
    if is_monitor:
        logger.debug(f"Monitor account checkout — returning dummy session (no Stripe call): {email}")
        return {
            "session_url": "https://checkout.stripe.com/monitor-dummy-check",
            "order_id":    order_id,
            "monitor_ok":  True,
        }

    # Same amount already opened in the last 15 min → send them back to that
    # Stripe page instead of creating a new session every couple of minutes.
    reuse_after = (datetime.now(timezone.utc) - timedelta(minutes=RESERVATION_WINDOW_MINUTES)).isoformat()
    existing = await db.stripe_payments.find_one(
        {
            "user_id": user_id,
            "status": "pending",
            "amount_usd": body.amount,
            "session_url": {"$exists": True, "$nin": [None, ""]},
            "created_at": {"$gte": reuse_after},
        },
        sort=[("created_at", -1)],
    )
    if existing:
        logger.info(
            f"Reusing pending checkout {existing.get('session_id')} for {email} ${body.amount}"
        )
        return {
            "session_url": existing["session_url"],
            "order_id": existing.get("order_id") or order_id,
            "reused": True,
        }

    # Persist pending record before hitting Stripe (idempotency safety)
    await db.stripe_payments.insert_one({
        "order_id":   order_id,
        "user_id":    user_id,
        "email":      email,
        "amount_usd": body.amount,
        "status":     "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    stripe.api_key = STRIPE_SECRET_KEY

    # Determine frontend base URL
    frontend_url = os.environ.get("FRONTEND_URL", "https://calliotel.com")

    checkout_kwargs = dict(
        mode="payment",
        customer_email=email,
        billing_address_collection="auto",
        # Wallet balance is stored value, so consumer-financing products are
        # excluded even when enabled globally. Keep cards, card wallets, PayPal
        # and eligible local methods under Stripe's dynamic selection.
        excluded_payment_method_types=[
            "affirm", "afterpay_clearpay", "klarna", "zip", "sunbit", "scalapay",
        ],
        # Local currency + local wallets (iDEAL, UPI, PIX, GrabPay…) when Stripe supports them.
        adaptive_pricing={"enabled": True},
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": f"Calliotel Wallet Top-up — ${body.amount:.0f}",
                    "description": "Credits never expire · Instant activation",
                },
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        metadata={
            "order_id":   order_id,
            "user_id":    user_id,
            "amount_usd": str(body.amount),
        },
        payment_intent_data={
            "metadata": {
                "order_id": order_id,
                "user_id":  user_id,
            },
        },
        success_url=(
            f"{frontend_url}/buy-credits"
            f"?stripe_success=1&session_id={{CHECKOUT_SESSION_ID}}&amount={body.amount:.0f}"
        ),
        cancel_url=f"{frontend_url}/buy-credits",
    )
    try:
        try:
            # Checkout uses Stripe's Dashboard-managed dynamic payment methods
            # when payment_method_types is omitted. Stripe then chooses eligible
            # cards, wallets and local methods for the customer's country/device.
            session = stripe.checkout.Session.create(**checkout_kwargs)
        except stripe.error.InvalidRequestError as e1:
            # Older account API versions may not support adaptive pricing yet.
            # Remove only that optional feature; keep dynamic payment methods.
            logger.warning("Stripe checkout adaptive-pricing fallback: %s", e1)
            kw = {k: v for k, v in checkout_kwargs.items() if k != "adaptive_pricing"}
            session = stripe.checkout.Session.create(**kw)
    except stripe.error.StripeError as e:
        error_str = str(e)
        logger.error(f"Stripe checkout creation error for {email}: {error_str}")

        # Save the error into the DB record so it's always traceable
        await db.stripe_payments.update_one(
            {"order_id": order_id},
            {"$set": {
                "status":     "failed",
                "error":      error_str,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )

        # Instant Telegram alert — boss knows the moment a payment fails
        try:
            from services.telegram_admin_alerts import notify_admins
            await notify_admins(
                f"🚨 Stripe Checkout FAILED\n"
                f"👤 User: {email}\n"
                f"💰 Amount: ${body.amount:.0f}\n"
                f"❌ Error: {error_str}\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
                also_email=False,
            )
        except Exception as _te:
            logger.warning(f"Could not send Stripe failure alert: {_te}")

        raise HTTPException(502, "Payment service error — please try again")

    # Save session_id for webhook correlation
    await db.stripe_payments.update_one(
        {"order_id": order_id},
        {"$set": {"session_id": session.id, "session_url": session.url}},
    )

    # Log IP attempt for rate-limit tracking
    await _record_card_attempt(
        client_ip, user_id, email, body.amount, session_id=session.id
    )

    logger.info(f"Stripe checkout created: {session.id} | {email} | ${body.amount} | ip={client_ip}")
    tg_alert(
        f"🛒 Card checkout started\n"
        f"👤 User: {email}\n"
        f"💰 Amount: ${body.amount:.2f}\n"
        f"🧾 Order: {order_id}\n"
        f"⏳ Awaiting card confirmation"
    )
    return {"session_url": session.url, "order_id": order_id}


@router.post("/create-payment-intent")
async def create_stripe_payment_intent(
    request: Request,
    body: CreateCheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe PaymentIntent for native Apple Pay / Google Pay (mobile only).
    Returns a client_secret the app uses to confirm the payment via the native wallet SDK.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Card payments are not available yet")

    user_id = str(current_user["_id"])
    email   = current_user.get("email", "")

    client_ip, is_monitor = await _enforce_card_payment_guards(
        request, current_user, body.amount
    )

    order_id     = str(uuid.uuid4())
    amount_cents = int(round(body.amount * 100))

    stripe.api_key = STRIPE_SECRET_KEY

    try:
        try:
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency="usd",
                automatic_payment_methods={"enabled": True},
                metadata={
                    "order_id":   order_id,
                    "user_id":    user_id,
                    "amount_usd": str(body.amount),
                },
                statement_descriptor_suffix="CALLIOTEL",
            )
        except stripe.error.InvalidRequestError:
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency="usd",
                payment_method_types=["card", "link"],
                metadata={
                    "order_id":   order_id,
                    "user_id":    user_id,
                    "amount_usd": str(body.amount),
                },
                statement_descriptor_suffix="CALLIOTEL",
            )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe PaymentIntent creation error for {email}: {e}")
        tg_alert(
            f"🚨 Apple/Google Pay FAILED\n"
            f"👤 User: {email}\n"
            f"💰 Amount: ${body.amount:.2f}\n"
            f"❌ Error: {e}\n"
            f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        )
        raise HTTPException(502, "Payment service error — please try again")

    # Persist pending record (skipped for monitor accounts)
    if not is_monitor:
        await db.stripe_payments.insert_one({
            "order_id":          order_id,
            "user_id":           user_id,
            "email":             email,
            "amount_usd":        body.amount,
            "status":            "pending",
            "source":            "mobile_wallet",
            "payment_intent_id": intent.id,
            "created_at":        datetime.now(timezone.utc).isoformat(),
        })

    # Same IP accounting as /create-checkout — this endpoint is subject to the identical guard,
    # so it must consume the identical allowance.
    await _record_card_attempt(
        client_ip, user_id, email, body.amount, payment_intent_id=intent.id
    )

    logger.info(f"Stripe PI created: {intent.id} | {email} | ${body.amount} | ip={client_ip}")
    tg_alert(
        f"🛒 Apple/Google Pay started\n"
        f"👤 User: {email}\n"
        f"💰 Amount: ${body.amount:.2f}\n"
        f"🧾 Order: {order_id}\n"
        f"⏳ Awaiting wallet confirmation"
    )
    return {"client_secret": intent.client_secret, "order_id": order_id}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe checkout.session.completed — credit wallet exactly once."""
    payload = await request.body()
    sig     = request.headers.get("stripe-signature", "")

    stripe.api_key = STRIPE_SECRET_KEY

    import json as _json
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            logger.warning("Stripe webhook signature invalid")
            tg_alert_throttled(
                "stripe-webhook-badsig",
                f"🚨 Stripe webhook REJECTED\n"
                f"❌ Invalid signature — a forged or misconfigured callback was refused\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            )
            raise HTTPException(400, "Invalid webhook signature")
        except Exception as e:
            logger.warning(f"Stripe webhook construct_event error: {e}")
            tg_alert_throttled(
                "stripe-webhook-error",
                f"🚨 Stripe webhook ERROR\n"
                f"❌ {e}\n"
                f"🕐 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            )
            raise HTTPException(400, "Webhook error")
    else:
        logger.warning("Stripe webhook running WITHOUT signature verification — add STRIPE_WEBHOOK_SECRET")

    # Parse event — handle both Stripe object (v5+) and plain dict
    try:
        raw = _json.loads(payload)
    except Exception:
        raise HTTPException(400, "Invalid webhook payload")

    event_type = raw.get("type", "")
    session_data = raw.get("data", {}).get("object", {})

    # ── Payment completed ────────────────────────────────────────────────────
    if event_type == "checkout.session.completed":
        meta       = session_data.get("metadata") or {}
        order_id   = meta.get("order_id")
        amount_usd = float(meta.get("amount_usd", 0))
        email      = session_data.get("customer_email", meta.get("user_id", "unknown"))

        if not order_id or amount_usd <= 0:
            logger.warning(f"Stripe webhook missing metadata on session {session_data.get('id')}")
            return {"ok": True}

        # Atomic claim — only processes once even if Stripe retries
        record = await db.stripe_payments.find_one_and_update(
            {"order_id": order_id, "status": "pending"},
            {"$set": {
                "status":       "completed",
                "session_id":   session_data.get("id"),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if not record:
            logger.info(f"Stripe webhook duplicate for order {order_id} — skipped")
            return {"ok": True}

        user_id = record["user_id"]
        email   = record["email"]
        now     = datetime.now(timezone.utc)

        # Credit wallet
        from services.paid_funds import record_paid_topup
        await record_paid_topup(db, user_id, amount_usd)
        wallet_after = await db.wallets.find_one({"user_id": user_id})
        new_balance = float((wallet_after or {}).get("balance", amount_usd))

        tx_doc = {
            "user_id":        user_id,
            "amount":         amount_usd,
            "type":           "credit",
            "description":    f"Card payment — ${amount_usd:.2f}",
            "source":         "stripe",
            "payment_method": "card",
            "payment_id":     session_data.get("id"),
            "created_at":     now.isoformat(),
        }
        await db.wallet_transactions.insert_one(dict(tx_doc))
        await db.transactions.insert_one(dict(tx_doc))

        logger.info(f"Stripe ✅  Credited ${amount_usd} to {email} | order {order_id}")

        # Receipt email to user
        try:
            user_doc = await db.users.find_one({"_id": record.get("user_id")})
            user_name = (user_doc or {}).get("name", "") if user_doc else ""
            from services.transaction_emails import send_topup_receipt
            send_topup_receipt(
                email=email,
                name=user_name,
                amount=amount_usd,
                method="Credit Card",
                new_balance=new_balance,
                order_code=order_id,
            )
            logger.info(f"✅ Receipt email sent to {email}")
        except Exception as re:
            logger.warning(f"Receipt email failed (stripe): {re}")

        try:
            from services.telegram_admin_alerts import notify_admins
            await notify_admins(
                f"💳 Card Payment Received\n"
                f"💰 Amount: ${amount_usd:.2f}\n"
                f"👤 User: {email}\n"
                f"🆔 Order: {order_id}\n"
                f"✅ Wallet credited automatically",
                also_email=False,
            )
        except Exception as te:
            logger.warning(f"Telegram alert failed (stripe paid): {te}")

        # Push notification to user
        try:
            from routes.push_notifications import send_push_notification, NotificationPayload
            await send_push_notification(
                user_id,
                NotificationPayload(
                    title="💰 Balance Added",
                    body=f"${amount_usd:.2f} has been added to your Calliotel wallet.",
                    icon="/icon-192.png",
                    data={"type": "balance_added", "amount": amount_usd},
                )
            )
        except Exception as pe:
            logger.warning(f"Push notification failed (stripe): {pe}")

    # ── Checkout abandoned / expired ─────────────────────────────────────────
    elif event_type == "checkout.session.expired":
        meta       = session_data.get("metadata") or {}
        order_id   = meta.get("order_id", "")
        amount_usd = float(meta.get("amount_usd", 0))
        email      = session_data.get("customer_email") or meta.get("user_id", "unknown")

        # Mark record as abandoned so the user can retry
        if order_id:
            await db.stripe_payments.update_one(
                {"order_id": order_id, "status": "pending"},
                {"$set": {"status": "abandoned", "updated_at": datetime.now(timezone.utc).isoformat()}},
            )

        logger.info(f"Stripe ⏰  Checkout abandoned | {email} | ${amount_usd}")
        el = (email or "").lower()
        if el in _monitor_email_set() or el.endswith("@calliotel.com"):
            return {"ok": True}
        try:
            recent = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
            already = await db.stripe_abandoned_alerts.find_one(
                {"email": el, "at": {"$gte": recent}}
            )
            if already:
                return {"ok": True}
            await db.stripe_abandoned_alerts.update_one(
                {"email": el},
                {"$set": {"email": el, "at": datetime.now(timezone.utc).isoformat(), "amount": amount_usd}},
                upsert=True,
            )
            from services.telegram_admin_alerts import notify_admins
            await notify_admins(
                f"⏰ Card Checkout Abandoned\n"
                f"💰 Amount: ${amount_usd:.2f}\n"
                f"👤 User: {email}\n"
                f"ℹ️ User opened checkout but did not complete payment",
                also_email=False,
            )
        except Exception as te:
            logger.warning(f"Telegram alert failed (stripe expired): {te}")

    # ── Mobile wallet payment succeeded (Apple Pay / Google Pay) ────────────
    elif event_type == "payment_intent.succeeded":
        meta       = session_data.get("metadata") or {}
        order_id   = meta.get("order_id", "")
        user_id    = meta.get("user_id", "")
        amount_usd = float(meta.get("amount_usd", 0))

        if not order_id or amount_usd <= 0:
            logger.warning(f"Stripe PI webhook missing metadata: {session_data.get('id')}")
            return {"ok": True}

        record = await db.stripe_payments.find_one_and_update(
            {"order_id": order_id, "status": "pending"},
            {"$set": {
                "status":            "completed",
                "payment_intent_id": session_data.get("id"),
                "completed_at":      datetime.now(timezone.utc).isoformat(),
            }},
        )
        if not record:
            logger.info(f"Stripe PI webhook duplicate for order {order_id} — skipped")
            return {"ok": True}

        user_id = record["user_id"]
        email   = record.get("email", user_id)
        now     = datetime.now(timezone.utc)

        from services.paid_funds import record_paid_topup
        await record_paid_topup(db, user_id, amount_usd)
        wallet_after = await db.wallets.find_one({"user_id": user_id})
        new_balance  = float((wallet_after or {}).get("balance", amount_usd))

        tx_doc = {
            "user_id":        user_id,
            "amount":         amount_usd,
            "type":           "credit",
            "description":    f"Apple/Google Pay — ${amount_usd:.2f}",
            "source":         "stripe",
            "payment_method": "wallet",
            "payment_id":     session_data.get("id"),
            "created_at":     now.isoformat(),
        }
        await db.wallet_transactions.insert_one(dict(tx_doc))
        await db.transactions.insert_one(dict(tx_doc))
        logger.info(f"Stripe PI ✅  Credited ${amount_usd} to {email} | order {order_id}")

        try:
            from services.telegram_admin_alerts import notify_admins
            await notify_admins(
                f"📱 Mobile Wallet Payment\n"
                f"💰 Amount: ${amount_usd:.2f}\n"
                f"👤 User: {email}\n"
                f"🆔 Order: {order_id}\n"
                f"✅ Wallet credited (Apple/Google Pay)",
                also_email=False,
            )
        except Exception as te:
            logger.warning(f"Telegram alert failed (stripe PI): {te}")

        try:
            from routes.push_notifications import send_push_notification, NotificationPayload
            await send_push_notification(
                user_id,
                NotificationPayload(
                    title="💰 Balance Added",
                    body=f"${amount_usd:.2f} has been added to your Calliotel wallet.",
                    icon="/icon-192.png",
                    data={"type": "balance_added", "amount": amount_usd},
                )
            )
        except Exception as pe:
            logger.warning(f"Push notification failed (stripe PI): {pe}")

    # ── Card declined ────────────────────────────────────────────────────────
    elif event_type in ("payment_intent.payment_failed", "charge.failed"):
        event_id = raw.get("id") or ""
        if event_type == "charge.failed":
            last_err = {}
            amount_usd = (session_data.get("amount") or 0) / 100
            reason = (
                session_data.get("failure_message")
                or session_data.get("failure_code")
                or "Card declined"
            )
            pm_details = session_data.get("payment_method_details") or {}
            card_info = pm_details.get("card") or {}
            fingerprint = card_info.get("fingerprint") or ""
            billing = session_data.get("billing_details") or {}
            email = (
                billing.get("email")
                or session_data.get("receipt_email")
                or (session_data.get("metadata") or {}).get("email")
                or ""
            )
            pi_id = session_data.get("payment_intent") or ""
            if isinstance(pi_id, dict):
                pi_id = pi_id.get("id") or ""
            charge_id = session_data.get("id") or ""
            meta = session_data.get("metadata") or {}
        else:
            last_err = session_data.get("last_payment_error") or {}
            amount_usd = session_data.get("amount", 0) / 100
            reason = last_err.get("message") or last_err.get("code") or "Card declined"
            pm = last_err.get("payment_method") or {}
            card_info = pm.get("card") or {}
            fingerprint = card_info.get("fingerprint") or ""
            email = (
                session_data.get("receipt_email")
                or (pm.get("billing_details") or {}).get("email")
                or ""
            )
            pi_id = session_data.get("id") or ""
            charge_id = last_err.get("charge") or session_data.get("latest_charge") or ""
            meta = session_data.get("metadata") or {}

        user_id, email = await _resolve_declined_user(meta, email, pi_id)
        decline_key = str(charge_id or event_id or f"{pi_id}:{fingerprint}:{reason}")[:180]
        logger.info(f"Stripe ❌  Payment failed | {email} | ${amount_usd} | {reason}")

        user_strikes = 0
        try:
            user_strikes = await _apply_user_decline_strikes(
                user_id=user_id,
                email=email,
                amount_usd=amount_usd,
                reason=reason,
                payment_intent_id=pi_id,
                decline_key=decline_key,
            )
        except Exception as se:
            logger.warning(f"User decline policy failed: {se}")

        fp_strikes = 0
        try:
            if fingerprint:
                strike = await db.stripe_fingerprint_strikes.find_one_and_update(
                    {"fingerprint": fingerprint},
                    {
                        "$inc": {"count": 1},
                        "$set":  {
                            "last_email": email,
                            "last_user_id": user_id,
                            "last_declined_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "$setOnInsert": {"first_seen_at": datetime.now(timezone.utc).isoformat()},
                    },
                    upsert=True, return_document=True,
                )
                fp_strikes = int((strike or {}).get("count") or 1)
                if fp_strikes >= FINGERPRINT_BLOCK_THRESHOLD:
                    await db.stripe_blocked_fingerprints.update_one(
                        {"fingerprint": fingerprint},
                        {"$set": {
                            "fingerprint": fingerprint,
                            "email":       email,
                            "user_id":     user_id,
                            "blocked_at":  datetime.now(timezone.utc).isoformat(),
                            "reason":      f"auto-blocked after {fp_strikes} declines",
                        }},
                        upsert=True,
                    )
                    logger.warning(f"🚫 Card fingerprint auto-blocked after {fp_strikes} declines: {email}")
                    now_iso = datetime.now(timezone.utc).isoformat()
                    await db.stripe_blocked_users.update_one(
                        {"user_id": user_id or email},
                        {"$set": {
                            "user_id": user_id or email,
                            "email": email,
                            "blocked_at": now_iso,
                            "reason": f"auto-blocked after {fp_strikes} declines on the same card",
                            "documents_required": True,
                            "unlock": "open support ticket",
                        }},
                        upsert=True,
                    )
                    ticket_id = await _open_card_lock_ticket(
                        user_id or email, email, fp_strikes, reason
                    )
                    try:
                        await _expire_open_card_checkouts(user_id, email)
                    except Exception:
                        pass
                    from services.telegram_admin_alerts import notify_admins
                    await notify_admins(
                        f"🚫 Card auto-blocked\n"
                        f"👤 User: {email}\n"
                        f"❌ Declines: {fp_strikes}\n"
                        f"🔑 Fingerprint: {fingerprint[:12]}…\n"
                        f"🎫 Ticket: {ticket_id or 'pending'}\n"
                        f"ℹ️ No more cards — support only",
                        also_email=False,
                    )
        except Exception as fp_err:
            logger.warning(f"Fingerprint tracking error: {fp_err}")

        if user_strikes < USER_DECLINE_WARN_AT:
            try:
                from services.telegram_admin_alerts import notify_admins
                await notify_admins(
                    f"❌ Card Payment Declined\n"
                    f"💰 Amount: ${amount_usd:.2f}\n"
                    f"👤 User: {email}\n"
                    f"⚠️ Reason: {reason}\n"
                    f"🧮 Account declines: {user_strikes}/{USER_DECLINE_BLOCK_AT}",
                    also_email=False,
                )
            except Exception as te:
                logger.warning(f"Telegram alert failed (stripe declined): {te}")

    else:
        logger.debug(f"Stripe webhook ignored event type: {event_type}")

    return {"ok": True}


@router.get("/card-status")
async def card_payment_status(current_user: dict = Depends(get_current_user)):
    """Used by Buy Credits / unlock page: decline strikes and whether documents are required."""
    user_id = str(current_user["_id"])
    email = current_user.get("email") or user_id
    blocked = await db.stripe_blocked_users.find_one(
        {"$or": [{"user_id": user_id}, {"email": email}]}
    )
    strikes = await db.stripe_user_declines.find_one(
        {"$or": [{"user_id": user_id}, {"email": email}]}
    ) or {}
    count = int(strikes.get("count") or 0)
    locked = bool(blocked) or count >= USER_DECLINE_BLOCK_AT
    return {
        "declines": count,
        "warning": count >= USER_DECLINE_WARN_AT and not locked,
        "blocked": locked,
        "documents_required": bool((blocked or {}).get("documents_required") or strikes.get("documents_required")),
        "remaining_before_lock": max(0, USER_DECLINE_BLOCK_AT - count),
        "support_only": locked,
    }


class UnlockDocumentsRequest(BaseModel):
    id_type: str = "passport"
    id_image_b64: str
    selfie_b64: str


@router.post("/unlock-documents")
async def submit_unlock_documents(
    body: UnlockDocumentsRequest,
    current_user: dict = Depends(get_current_user),
):
    """Locked users submit ID + selfie. Admin reviews in Mongo / Telegram — cards stay locked until unblocked."""
    user_id = str(current_user["_id"])
    email = current_user.get("email") or user_id
    blocked = await db.stripe_blocked_users.find_one(
        {"$or": [{"user_id": user_id}, {"email": email}]}
    )
    if not blocked:
        raise HTTPException(400, "Card payments are not locked on this account.")

    def _ok_b64(s: str, label: str) -> str:
        raw = (s or "").strip()
        if "," in raw and raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        if len(raw) < 80:
            raise HTTPException(422, f"{label} is missing")
        # ~1.5MB binary after base64
        if len(raw) > 2_100_000:
            raise HTTPException(422, f"{label} is too large (max 1.5 MB)")
        return raw

    id_b64 = _ok_b64(body.id_image_b64, "ID photo")
    selfie_b64 = _ok_b64(body.selfie_b64, "Selfie")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "email": email,
        "id_type": (body.id_type or "passport")[:40],
        "id_image_b64": id_b64,
        "selfie_b64": selfie_b64,
        "status": "pending_review",
        "created_at": now,
    }
    await db.card_unlock_documents.insert_one(doc)
    await db.stripe_blocked_users.update_one(
        {"user_id": user_id},
        {"$set": {"documents_submitted_at": now, "documents_status": "pending_review"}},
        upsert=True,
    )
    try:
        from services.telegram_admin_alerts import notify_admins
        await notify_admins(
            f"📄 Card-unlock documents received\n"
            f"👤 User: {email}\n"
            f"🪪 ID type: {body.id_type}\n"
            f"ℹ️ Review then unblock stripe_blocked_users if legit",
            also_email=False,
        )
    except Exception:
        pass
    await _inapp_notify(
        user_id,
        "Documents received",
        "We received your ID documents. Card payments stay locked until we review them.",
    )
    return {"success": True, "status": "pending_review"}
