"""
Voice call routes — Telnyx Call Control webhook + call forwarding management.
Webhook: POST /api/calls/webhook/telnyx  (configure in Telnyx portal)

Outbound call flow (TWO-LEG BRIDGE):
  1. User hits POST /api/calls/outbound with {from_number, to_number, real_phone?}
  2. Backend dials the user's real phone (forwarding number or real_phone param) — LEG 1
  3. User answers their real phone → Telnyx fires call.answered
  4. Backend transfers leg 1 to the destination — LEG 2
  5. Destination phone rings showing the virtual number as caller ID
  6. User talks to destination via their real phone
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from typing import Optional
import logging
import os
import httpx
from datetime import datetime, timezone
from uuid import uuid4
from routes.auth import get_current_user
from database import db
from services.telnyx_call_client import answer_call, transfer_call, speak_call, hangup_call, dial_call
from services.telnyx_webhook_verify import verify_telnyx_signature
import html as _html

logger = logging.getLogger(__name__)
router = APIRouter()

# Pricing — fallback / WebRTC gate; outbound uses destination rates (services.voice_rates)
CALL_COST_PER_MINUTE = 0.05
from services.voice_rates import lookup_voice_rate, rate_for_number, estimate_minutes, INBOUND_DEFAULT_RATE

# WebRTC credential connection (pre-created in Telnyx portal)
WEBRTC_CONNECTION_ID = "2952821436797945508"
TELNYX_API_KEY = os.environ.get("TELNYX_API_KEY", "")


# ── WebRTC credentials endpoint ───────────────────────────────────────────────

@router.get("/webrtc-token")
async def get_webrtc_token(current_user=Depends(get_current_user)):
    """
    Generate fresh SIP credentials for Telnyx WebRTC SDK.
    Requires an owned active number and a positive wallet balance (toll-fraud guard).
    """
    user_id = str(current_user.get("_id") or current_user.get("email") or "")
    owned = await db.user_numbers.find_one({"user_id": user_id, "status": "active"})
    if not owned:
        owned = await db.purchased_numbers.find_one({"user_id": user_id, "status": "active"})
    if not owned:
        raise HTTPException(status_code=403, detail="You need an active Calliotel number to use WebRTC calling")
    wallet = await db.wallets.find_one({"user_id": user_id})
    bal = float(wallet.get("balance", 0)) if wallet else 0.0
    if bal < CALL_COST_PER_MINUTE:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance (${bal:.2f}). Add funds before placing calls.",
        )
    headers = {"Authorization": f"Bearer {TELNYX_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10.0) as hclient:
        resp = await hclient.post(
            "https://api.telnyx.com/v2/telephony_credentials",
            headers=headers,
            json={"connection_id": WEBRTC_CONNECTION_ID},
        )
    if resp.status_code not in [200, 201]:
        logger.error(f"Telnyx credential create failed: {resp.status_code} {resp.text[:200]}")
        raise HTTPException(status_code=502, detail="Failed to generate WebRTC credentials")
    data = resp.json().get("data", {})
    return {
        "sip_username": data.get("sip_username", ""),
        "sip_password": data.get("sip_password", ""),
    }


# ── helpers ──────────────────────────────────────────────────────────────────

async def _find_number_owner(phone: str) -> Optional[str]:
    """Return user_id that owns this Calliotel number."""
    normalized = phone.lstrip("+")
    variants = [phone, f"+{normalized}", normalized]
    for v in variants:
        doc = await db.user_numbers.find_one({"phone_number": v, "status": "active"})
        if doc:
            return str(doc.get("user_id", ""))
        doc = await db.purchased_numbers.find_one({"phone_number": v, "status": "active"})
        if doc:
            return str(doc.get("user_id", ""))
    return None


async def _get_forwarding(user_id: str, calliotel_number: str) -> Optional[str]:
    """Return the bridge/forward number: per-number rule first, then global bridge phone."""
    normalized = calliotel_number.lstrip("+")
    variants = [calliotel_number, f"+{normalized}", normalized]
    for v in variants:
        doc = await db.call_forwarding.find_one({"user_id": user_id, "calliotel_number": v})
        if doc and doc.get("forward_to"):
            return doc.get("forward_to")
    # Fall back to global bridge phone stored in user_settings
    settings = await db.user_settings.find_one({"user_id": user_id})
    if settings and settings.get("bridge_phone"):
        return settings["bridge_phone"]
    return None


async def _log_call(
    user_id: str,
    from_number: str,
    to_number: str,
    direction: str,
    status: str,
    duration: int = 0,
    forwarded_to: Optional[str] = None,
    call_control_id: Optional[str] = None,
    cost: float = 0.0,
    rate_per_min: float = CALL_COST_PER_MINUTE,
):
    """
    Insert a new call record, OR update the existing one that shares this
    call_control_id (so outbound calls don't appear twice: once as
    'initiated' and again as 'answered' with the real duration/cost).
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # If we have a call_control_id, try to update an existing record first.
    if call_control_id:
        result = await db.voice_calls.update_one(
            {"call_control_id": call_control_id, "user_id": user_id},
            {"$set": {
                "status": status,
                "duration": duration,
                "cost": cost,
                "rate_per_min": rate_per_min,
                "from_number": from_number,
                "to_number": to_number,
                "forwarded_to": forwarded_to,
                "completed_at": now_iso,
            }},
        )
        if result.matched_count > 0:
            # Successfully updated the existing initiated record — done.
            return

    # No existing record found (or no call_control_id): insert fresh.
    await db.voice_calls.insert_one({
        "id": str(uuid4()),
        "user_id": user_id,
        "direction": direction,
        "from_number": from_number,
        "to_number": to_number,
        "status": status,
        "duration": duration,
        "cost": cost,
        "rate_per_min": rate_per_min,
        "forwarded_to": forwarded_to,
        "call_control_id": call_control_id,
        "created_at": now_iso,
        "initiated_at": now_iso,
    })


def _e164(n: str) -> str:
    """Normalize toward E.164: strip spaces/junk, convert 00→+, ensure leading +."""
    if not n:
        return ""
    s = n.strip().replace(" ", "")
    if s.startswith("00"):
        s = "+" + s[2:]
    # Keep digits and a single leading +
    chars = []
    for i, ch in enumerate(s):
        if ch.isdigit():
            chars.append(ch)
        elif ch == "+" and not chars:
            chars.append("+")
    if not chars:
        return ""
    if chars[0] != "+":
        return "+" + "".join(chars)
    return "".join(chars)


def _validate_phone_number(raw: str) -> str:
    """
    Validate a user-supplied phone number and return the canonical E.164 string.
    Raises HTTPException(422) for any invalid format.

    Delegates to utils.phone.is_valid_e164 so the validation contract is
    shared with the nightly cleanup job (single source of truth).

    Accepted format: +[1-9][digits], total digits 7–15 (ITU E.164).
    Rejected: bare digit strings, +0 prefixes, letters, spaces, punctuation,
    multiple plus signs, overlength numbers.
    """
    from utils.phone import is_valid_e164
    stripped = raw.strip()
    if not stripped.startswith("+"):
        raise HTTPException(
            status_code=422,
            detail=(
                "Phone number must start with '+' and include your country code "
                "(e.g. +1 for US, +44 for UK, +374 for Armenia)."
            ),
        )
    if not is_valid_e164(stripped):
        # Give a targeted message for the most common mistakes.
        if stripped.startswith("+0"):
            msg = (
                "Invalid number: no country code starts with 0. "
                "Include your real country code (e.g. +1, +44, +374)."
            )
        elif len(stripped) < 8:   # + and fewer than 7 digits
            msg = "Phone number is too short. Enter a full number with country code."
        elif len(stripped) > 16:  # + and more than 15 digits
            msg = "Phone number is too long. Check for extra digits."
        else:
            msg = (
                "Phone number may only contain digits after the '+'. "
                "Remove spaces, dashes, parentheses, or letters."
            )
        raise HTTPException(status_code=422, detail=msg)
    return stripped  # already canonical E.164


# ── in-flight call tracker ────────────────────────────────────────────────────
# Maps call_control_id → call info dict (memory + Mongo so webhooks survive restarts)
_active_calls: dict = {}


def _serialize_active(info: dict) -> dict:
    out = dict(info)
    for k, v in list(out.items()):
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


async def _store_active_call(call_control_id: str, info: dict) -> None:
    _active_calls[call_control_id] = info
    try:
        await db.active_calls.update_one(
            {"_id": call_control_id},
            {"$set": {**_serialize_active(info), "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"Could not persist active call {call_control_id}: {e}")


async def _load_active_call(call_control_id: str) -> Optional[dict]:
    info = _active_calls.get(call_control_id)
    if info:
        return info
    try:
        doc = await db.active_calls.find_one({"_id": call_control_id})
        if not doc:
            return None
        doc.pop("_id", None)
        doc.pop("updated_at", None)
        _active_calls[call_control_id] = doc
        return doc
    except Exception as e:
        logger.warning(f"Could not load active call {call_control_id}: {e}")
        return None


async def _pop_active_call(call_control_id: str) -> Optional[dict]:
    info = _active_calls.pop(call_control_id, None)
    try:
        if info is None:
            doc = await db.active_calls.find_one_and_delete({"_id": call_control_id})
            if doc:
                doc.pop("_id", None)
                doc.pop("updated_at", None)
                return doc
        else:
            await db.active_calls.delete_one({"_id": call_control_id})
    except Exception as e:
        logger.warning(f"Could not clear active call {call_control_id}: {e}")
    return info


# ── Telnyx Call Control webhook ──────────────────────────────────────────────

@router.post("/webhook/telnyx")
async def call_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("telnyx-signature-ed25519") or request.headers.get("Telnyx-Signature-Ed25519")
    ts = request.headers.get("telnyx-timestamp") or request.headers.get("Telnyx-Timestamp")
    if not verify_telnyx_signature(raw, sig, ts):
        logger.warning("Rejected Telnyx call webhook — invalid or missing signature")
        return Response(status_code=403)

    try:
        import json as _json
        body = _json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
    except Exception:
        return Response(status_code=400)

    data = body.get("data", {})
    event_type = data.get("event_type", "")
    payload = data.get("payload", {})

    call_control_id = payload.get("call_control_id", "")
    to_number = payload.get("to", "")
    from_number = payload.get("from", "")
    direction = payload.get("direction", "incoming")

    logger.info(f"📞 Call event: {event_type}  dir={direction}  from={from_number}  to={to_number}")

    # ── Inbound call (someone calls the Calliotel virtual number) ─────────────
    if event_type == "call.initiated" and direction == "incoming":
        user_id = await _find_number_owner(to_number)
        if not user_id:
            await hangup_call(call_control_id)
            return {"status": "ok"}

        forward_to = await _get_forwarding(user_id, to_number)

        inbound_rate = rate_for_number(forward_to) if forward_to else INBOUND_DEFAULT_RATE
        await _store_active_call(call_control_id, {
            "user_id": user_id,
            "from": from_number,
            "to": to_number,
            "direction": "inbound",
            "forward_to": forward_to,
            "rate_per_min": inbound_rate,
            "started_at": datetime.now(timezone.utc),
        })

        # Send push notification so the user's phone buzzes even when app is closed
        try:
            from routes.push_notifications import send_push_notification, NotificationPayload
            caller_display = from_number if from_number else "Unknown"
            await send_push_notification(
                user_id=user_id,
                payload=NotificationPayload(
                    title="📞 Incoming call",
                    body=f"From {caller_display} to your number {to_number}",
                    data={"url": "/call-history"},
                ),
            )
        except Exception as push_err:
            logger.warning(f"Push notification failed for inbound call: {push_err}")

        # Telegram admin alert — inbound call
        try:
            from services.telegram_admin_alerts import notify_admins
            fwd_label = f"→ {forward_to}" if forward_to else "⚠️ no forwarding set"
            import asyncio as _asyncio
            _asyncio.create_task(notify_admins(
                f"📞 INBOUND CALL\n"
                f"From: {from_number}\n"
                f"To: {to_number}\n"
                f"Forwarding: {fwd_label}",
                also_email=False,
            ))
        except Exception as _tg_err:
            logger.warning(f"Telegram call alert failed: {_tg_err}")

        if forward_to:
            from utils.phone import is_valid_e164
            fwd = _e164(forward_to)
            if not is_valid_e164(fwd):
                logger.error(f"Inbound forwarding number invalid for {to_number}: {forward_to!r}")
                answered = await answer_call(call_control_id)
                if answered:
                    await speak_call(
                        call_control_id,
                        "This number is not configured correctly. Please try again later.",
                    )
            else:
                answered = await answer_call(call_control_id)
                if answered:
                    ok = await transfer_call(call_control_id, to=fwd, from_=to_number)
                    if ok:
                        logger.info(f"📲 Forwarding inbound {to_number} → {fwd}")
                    else:
                        await speak_call(
                            call_control_id,
                            "Sorry, we could not connect your call. Please try again later.",
                        )
        else:
            answered = await answer_call(call_control_id)
            if answered:
                await speak_call(
                    call_control_id,
                    "The number you have dialed is not available. The owner has not set a forwarding number yet.",
                )
        return {"status": "ok"}

    # ── Outbound leg 1 answered (user answered their real phone) ─────────────
    # Now bridge to the actual destination
    if event_type == "call.answered":
        info = await _load_active_call(call_control_id)
        if info and info.get("call_type") == "outbound_bridge_leg1":
            destination = _e164(info["destination"])
            virtual_number = info["virtual_number"]
            logger.info(f"📲 Leg 1 answered — bridging {virtual_number} → {destination}")
            ok = await transfer_call(call_control_id, to=destination, from_=virtual_number)
            if ok:
                info["call_type"] = "outbound_bridge_active"
                info["bridge_started_at"] = datetime.now(timezone.utc)
                await _store_active_call(call_control_id, info)
            else:
                logger.error(f"Bridge transfer failed for {call_control_id} → {destination}")
                await speak_call(call_control_id, "Sorry, we could not connect your call. Please try again.")
        return {"status": "ok"}

    # ── Call hangup — log it + bill wallet ────────────────────────────────────
    if event_type == "call.hangup":
        info = await _pop_active_call(call_control_id)
        if info:
            duration = payload.get("call_duration_secs", 0) or 0
            direction = info.get("direction", "inbound")
            call_type = info.get("call_type", "")

            # Bridge leg 1 hung up before the bridge was established (user didn't
            # answer their real phone, or the number was unreachable). Update the
            # DB record to "failed" so it doesn't stay stuck as "initiated".
            if call_type == "outbound_bridge_leg1":
                hangup_cause = payload.get("hangup_cause", "")
                await _log_call(
                    user_id=info["user_id"],
                    from_number=info.get("virtual_number", ""),
                    to_number=info.get("destination", ""),
                    direction="outbound",
                    status="failed",
                    duration=0,
                    call_control_id=call_control_id,
                    cost=0.0,
                    rate_per_min=float(info.get("rate_per_min") or CALL_COST_PER_MINUTE),
                )
                logger.info(f"📴 Outbound bridge leg 1 failed ({hangup_cause}) for {info.get('virtual_number')} → {info.get('destination')}")
                return {"status": "ok"}

            status = "forwarded" if info.get("forward_to") else "missed"
            if duration > 5:
                status = "answered"

            user_id = info["user_id"]
            from_n = info.get("virtual_number") or info["from"]
            to_n = info.get("destination") or info["to"]

            # Charge wallet only for real connected legs (not forged initiated→hangup).
            # Idempotent per call_control_id; never drive balance below zero.
            call_cost = 0.0
            billable = (
                call_type == "outbound_bridge_active"
                or (direction == "inbound" and duration >= 6 and info.get("forward_to"))
            )
            if billable and duration >= 6 and call_control_id:
                already = await db.transactions.find_one({
                    "type": "debit",
                    "call_control_id": call_control_id,
                })
                if already:
                    logger.info(f"💳 Skip duplicate call bill for {call_control_id}")
                else:
                    # Cap absurd durations (forged/buggy) at 3 hours
                    safe_dur = min(int(duration), 3 * 3600)
                    bill_rate = float(info.get("rate_per_min") or CALL_COST_PER_MINUTE)
                    if bill_rate <= 0:
                        bill_rate = CALL_COST_PER_MINUTE
                    call_cost = round((safe_dur / 60) * bill_rate, 4)
                    now_iso = datetime.now(timezone.utc).isoformat()
                    # Atomic debit with floor guard
                    from pymongo import ReturnDocument
                    result = await db.wallets.find_one_and_update(
                        {"user_id": user_id, "balance": {"$gte": call_cost}},
                        {"$inc": {"balance": -call_cost}, "$set": {"updated_at": now_iso}},
                        return_document=ReturnDocument.AFTER,
                    )
                    if result is None:
                        # Insufficient funds — clamp to zero instead of going negative
                        wallet = await db.wallets.find_one({"user_id": user_id})
                        current_balance = float(wallet.get("balance", 0)) if wallet else 0.0
                        call_cost = round(min(call_cost, max(current_balance, 0.0)), 4)
                        if call_cost > 0:
                            result = await db.wallets.find_one_and_update(
                                {"user_id": user_id},
                                {"$set": {"balance": 0.0, "updated_at": now_iso}},
                                return_document=ReturnDocument.AFTER,
                                upsert=True,
                            )
                    new_balance = float(result.get("balance", 0)) if result else 0.0
                    await db.users.update_one(
                        {"_id": user_id},
                        {"$set": {"wallet_balance": new_balance}},
                    )
                    desc = (
                        f"{'Outbound' if direction == 'outbound' else 'Inbound'} call "
                        f"{from_n} → {to_n} ({safe_dur}s @ ${bill_rate:.4f}/min)"
                    )
                    await db.transactions.insert_one({
                        "user_id": user_id,
                        "type": "debit",
                        "amount": call_cost,
                        "description": desc,
                        "balance_after": new_balance,
                        "call_control_id": call_control_id,
                        "rate_per_min": bill_rate,
                        "created_at": now_iso,
                    })
                    logger.info(
                        f"💳 Call billed: user={user_id} dur={safe_dur}s "
                        f"rate=${bill_rate:.4f}/min cost=${call_cost:.4f}"
                    )

            await _log_call(
                user_id=user_id,
                from_number=from_n,
                to_number=to_n,
                direction=direction,
                status=status,
                duration=int(duration),
                forwarded_to=info.get("forward_to"),
                call_control_id=call_control_id,
                cost=call_cost,
                rate_per_min=float(info.get("rate_per_min") or CALL_COST_PER_MINUTE),
            )

            # Missed call notification — push + email to number owner
            if status == "missed" and direction == "inbound" and not info.get("forward_to"):
                try:
                    import asyncio as _asyncio
                    caller = _html.escape(str(info.get("from", "Unknown")).replace("\r", "").replace("\n", " "))
                    calliotel_num = _html.escape(str(info.get("to", "your number")).replace("\r", "").replace("\n", " "))

                    # Push notification
                    from routes.push_notifications import send_push_notification, NotificationPayload
                    _asyncio.create_task(send_push_notification(
                        user_id=user_id,
                        payload=NotificationPayload(
                            title="☎️ Missed call",
                            body=f"You missed a call from {caller} on {calliotel_num}. Set a forwarding number to receive future calls.",
                            data={"url": "/numbers"},
                        ),
                    ))

                    # Email notification — look up user email
                    user_doc = await db.users.find_one(
                        {"$or": [{"user_id": user_id}, {"email": user_id}]},
                        {"email": 1, "full_name": 1, "name": 1}
                    )
                    if user_doc and user_doc.get("email"):
                        owner_email = user_doc["email"]
                        owner_name = _html.escape(str(user_doc.get("full_name") or user_doc.get("name") or "there"))
                        html = f"""<div style='font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0d0d0d;color:#ffffff;padding:32px;border-radius:12px;'>
<p style='font-size:16px;color:#aaaaaa;'>Hi {owner_name},</p>
<p style='font-size:16px;line-height:1.6;'>You just missed a call on your Calliotel number <strong style='color:#F5A623;'>{calliotel_num}</strong>.</p>
<table style='width:100%;background:#1a1a1a;border-radius:8px;padding:16px;margin:20px 0;border-collapse:collapse;'>
  <tr><td style='color:#aaaaaa;padding:6px 0;'>Caller</td><td style='color:#ffffff;text-align:right;'>{caller}</td></tr>
  <tr><td style='color:#aaaaaa;padding:6px 0;'>Your number</td><td style='color:#ffffff;text-align:right;'>{calliotel_num}</td></tr>
</table>
<p style='font-size:15px;line-height:1.6;'>To receive future calls directly, set a <strong>forwarding number</strong> in your account — this is the real mobile number where your calls will ring.</p>
<div style='text-align:center;margin:28px 0;'><a href='https://calliotel.com/numbers' style='background:#F5A623;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;'>Set Forwarding Number</a></div>
<p style='font-size:13px;color:#aaaaaa;'>Reply to this email if you need help.</p>
<p style='font-size:13px;color:#aaaaaa;margin-top:16px;'>The Calliotel Team</p>
</div>"""
                        from services.resend_service import send_email
                        _asyncio.create_task(send_email(
                            to=owner_email,
                            subject=f"Missed call from {caller} on your Calliotel number",
                            html=html,
                        ))
                except Exception as _mc_err:
                    logger.warning(f"Missed call notification failed: {_mc_err}")

            # Telegram admin alert — call ended
            try:
                from services.telegram_admin_alerts import notify_admins
                import asyncio as _asyncio
                cost_label = f"${call_cost:.4f}" if call_cost else "free"
                _asyncio.create_task(notify_admins(
                    f"📴 CALL ENDED\n"
                    f"Direction: {direction}\n"
                    f"From: {from_n} → To: {to_n}\n"
                    f"Status: {status} | Duration: {int(duration)}s | Cost: {cost_label}",
                    also_email=False,
                ))
            except Exception as _tg_err:
                logger.warning(f"Telegram hangup alert failed: {_tg_err}")

        return {"status": "ok"}

    return {"status": "ok"}


# ── Outbound call (two-leg bridge) ───────────────────────────────────────────

class OutboundCallRequest(BaseModel):
    from_number: str          # user's Calliotel virtual number
    to_number: str            # destination in E.164
    real_phone: Optional[str] = None  # override: user's real phone to call first


@router.get("/rate")
async def quote_call_rate(to: str = "", current_user=Depends(get_current_user)):
    """
    Live destination rate quote for the keypad.
    GET /api/calls/rate?to=+9613212211
    """
    user_id = str(current_user["_id"])
    cleaned = _e164(to or "")
    info = lookup_voice_rate(cleaned) if cleaned else {
        "rate_per_min": CALL_COST_PER_MINUTE,
        "country": "Enter destination",
        "iso": "XX",
        "prefix": None,
        "matched": False,
        "currency": "USD",
    }
    wallet = await db.wallets.find_one({"user_id": user_id})
    bal = float(wallet.get("balance", 0)) if wallet else 0.0
    rate = float(info["rate_per_min"])
    return {
        **info,
        "to": cleaned or None,
        "balance": bal,
        "est_minutes": estimate_minutes(bal, rate),
        "can_call": bal >= rate and bool(cleaned),
    }


@router.post("/outbound")
async def make_outbound_call(req: OutboundCallRequest, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    # Verify ownership
    owned = await _find_number_owner(req.from_number)
    if not owned or owned != user_id:
        raise HTTPException(status_code=403, detail="You don't own that number")

    virtual = _e164(req.from_number)
    # Destination MUST be valid E.164 — invalid numbers cause Telnyx D11 403 on transfer
    destination = _validate_phone_number(_e164(req.to_number))

    rate_info = lookup_voice_rate(destination)
    dest_rate = float(rate_info["rate_per_min"])

    # Wallet gate — need at least 1 minute at destination rate
    wallet = await db.wallets.find_one({"user_id": user_id})
    bal = float(wallet.get("balance", 0)) if wallet else 0.0
    if bal < dest_rate:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Insufficient balance (${bal:.2f}) for {rate_info['country']} "
                f"(${dest_rate:.2f}/min). Add funds before calling."
            ),
        )

    # Determine where to call the user (leg 1)
    if req.real_phone:
        # Caller-supplied override — validate strictly before dialling
        real_phone = _validate_phone_number(_e164(req.real_phone))
    else:
        real_phone = await _get_forwarding(user_id, virtual)
        # Validate the stored value too — guards against stale pre-validation rows
        if not real_phone:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Please set a valid callback number first (your real phone). "
                    "Tap the callback line on the keypad and enter your full number."
                ),
            )
        from utils.phone import is_invalid_e164
        if is_invalid_e164(_e164(real_phone)):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Your saved callback number is not a valid E.164 phone number. "
                    "Please update it with your full number including country code (e.g. +1 for US)."
                ),
            )
        real_phone = _e164(real_phone)

    # Guard: callback phone must not be a Calliotel virtual number
    callback_is_calliotel = await _find_number_owner(real_phone)
    if callback_is_calliotel:
        raise HTTPException(
            status_code=422,
            detail=(
                "Your callback number is set to a Calliotel virtual number, not a real phone. "
                "Tap the bridge phone row on the keypad and enter your actual mobile number."
            ),
        )

    # Guard: destination must not equal the callback phone (would create a call loop)
    if _e164(real_phone) == _e164(destination):
        raise HTTPException(
            status_code=422,
            detail=(
                "Your callback number matches the number you're trying to call. "
                "Update your bridge phone to your real mobile number first."
            ),
        )

    # Leg 1: call the user's real phone FROM the virtual number
    # They'll see their virtual number calling them, answer, and be bridged to the destination
    result = await dial_call(from_number=virtual, to_number=real_phone)
    if not result["ok"]:
        raise HTTPException(status_code=502, detail=f"Could not initiate call: {result.get('error', 'unknown')}")

    ccid = result.get("call_control_id", "")

    # Store bridge state — when leg 1 is answered the webhook will transfer to destination
    if ccid:
        await _store_active_call(ccid, {
            "user_id": user_id,
            "call_type": "outbound_bridge_leg1",
            "virtual_number": virtual,
            "destination": destination,
            "real_phone": real_phone,
            "direction": "outbound",
            "rate_per_min": dest_rate,
            "rate_country": rate_info.get("country"),
            "started_at": datetime.now(timezone.utc),
        })

    logger.info(
        f"📞 Outbound bridge: calling {real_phone} (user) first, then bridging to "
        f"{destination} via {virtual} @ ${dest_rate:.4f}/min ({rate_info.get('country')})"
    )

    # Telegram admin alert — outbound call initiated
    try:
        from services.telegram_admin_alerts import notify_admins
        import asyncio as _asyncio
        _asyncio.create_task(notify_admins(
            f"📞 OUTBOUND CALL\n"
            f"From: {virtual}\n"
            f"To: {destination} ({rate_info.get('country')})\n"
            f"Rate: ${dest_rate:.2f}/min\n"
            f"Via real phone: {real_phone}",
            also_email=False,
        ))
    except Exception as _tg_err:
        logger.warning(f"Telegram outbound alert failed: {_tg_err}")

    # Log initiation
    await _log_call(
        user_id=user_id,
        from_number=virtual,
        to_number=destination,
        direction="outbound",
        status="initiated",
        call_control_id=ccid,
        rate_per_min=dest_rate,
    )

    return {
        "success": True,
        "call_control_id": ccid,
        "rate_per_min": dest_rate,
        "country": rate_info.get("country"),
        "message": f"Calling your phone ({real_phone}) — answer it to connect to {destination}",
    }


# ── Hangup ────────────────────────────────────────────────────────────────────

class HangupRequest(BaseModel):
    call_control_id: str

@router.post("/hangup")
async def hangup(req: HangupRequest, current_user=Depends(get_current_user)):
    user_id = str(current_user.get("_id") or current_user.get("email") or "")
    info = await _load_active_call(req.call_control_id)
    if not info or str(info.get("user_id")) != user_id:
        raise HTTPException(status_code=403, detail="Call not found or not owned by you")
    ok = await hangup_call(req.call_control_id)
    if not ok:
        raise HTTPException(status_code=502, detail="Could not hang up call")
    await _pop_active_call(req.call_control_id)
    return {"success": True}


# ── Global bridge phone (one real number for all virtual numbers) ─────────────

class BridgePhoneRequest(BaseModel):
    forward_to: str  # the user's real phone number in E.164


@router.get("/bridge-phone")
async def get_bridge_phone(current_user=Depends(get_current_user)):
    """Return the user's globally saved bridge (callback) phone number."""
    user_id = str(current_user["_id"])
    doc = await db.user_settings.find_one({"user_id": user_id})
    bridge = doc.get("bridge_phone") if doc else None
    return {"bridge_phone": bridge}


@router.post("/bridge-phone")
async def set_bridge_phone(req: BridgePhoneRequest, current_user=Depends(get_current_user)):
    """
    Save one real-world phone number that will be used as the callback bridge
    for ALL of this user's virtual numbers when making outbound calls.
    """
    user_id = str(current_user["_id"])
    normalized = _validate_phone_number(req.forward_to)

    # Must not be a Calliotel virtual number
    is_calliotel = await _find_number_owner(normalized)
    if is_calliotel:
        raise HTTPException(
            status_code=422,
            detail="That is a Calliotel virtual number. Enter your real mobile or landline number."
        )

    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {"bridge_phone": normalized, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    # Also wire inbound forwarding for every active Calliotel number this user owns,
    # so inbound calls ring the same real phone used for outbound callbacks.
    try:
        owned_nums = []
        async for doc in db.user_numbers.find({"user_id": user_id, "status": "active"}, {"phone_number": 1}):
            if doc.get("phone_number"):
                owned_nums.append(doc["phone_number"])
        async for doc in db.purchased_numbers.find({"user_id": user_id, "status": "active"}, {"phone_number": 1}):
            pn = doc.get("phone_number")
            if pn and pn not in owned_nums:
                owned_nums.append(pn)
        now_iso = datetime.now(timezone.utc).isoformat()
        for pn in owned_nums:
            await db.call_forwarding.update_one(
                {"user_id": user_id, "calliotel_number": pn},
                {"$set": {
                    "forward_to": normalized,
                    "updated_at": now_iso,
                }, "$setOnInsert": {
                    "created_at": now_iso,
                }},
                upsert=True,
            )
        if owned_nums:
            logger.info(f"📲 Synced inbound forwarding for {len(owned_nums)} number(s) → {normalized}")
    except Exception as sync_err:
        logger.warning(f"Bridge→forwarding sync failed for {user_id}: {sync_err}")

    logger.info(f"🔁 Bridge phone set for {user_id}: {normalized}")
    return {"success": True, "bridge_phone": normalized}


@router.delete("/bridge-phone")
async def delete_bridge_phone(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$unset": {"bridge_phone": ""}},
    )
    return {"success": True}


# ── Call forwarding CRUD ───────────────────────────────────────────────────────

class ForwardingRequest(BaseModel):
    calliotel_number: str
    forward_to: str       # E.164 e.g. +12125551234


@router.get("/forwarding")
async def get_forwarding_rules(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    rules = await db.call_forwarding.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(100)
    return {"rules": rules}


@router.post("/forwarding")
async def set_forwarding(req: ForwardingRequest, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    owned = await _find_number_owner(req.calliotel_number)
    if not owned or owned != user_id:
        raise HTTPException(status_code=403, detail="You don't own that number")

    # Validate E.164 format before anything else
    forward_normalized = _validate_phone_number(req.forward_to)

    # Reject if forward_to is the same as the Calliotel number (would create loops)
    if forward_normalized == _e164(req.calliotel_number):
        raise HTTPException(
            status_code=422,
            detail="Your callback number cannot be the same as your Calliotel number."
        )
    is_calliotel = await _find_number_owner(forward_normalized)
    if is_calliotel:
        raise HTTPException(
            status_code=422,
            detail=(
                "That number is a Calliotel virtual number. "
                "Enter your real mobile or landline number instead."
            )
        )

    await db.call_forwarding.update_one(
        {"user_id": user_id, "calliotel_number": req.calliotel_number},
        {"$set": {
            "forward_to": forward_normalized,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(f"📲 Forwarding set: {req.calliotel_number} → {forward_normalized} (user={user_id})")
    return {"success": True, "calliotel_number": req.calliotel_number, "forward_to": forward_normalized}


# ── Call history ──────────────────────────────────────────────────────────────

@router.get("/history")
async def get_call_history(current_user=Depends(get_current_user), limit: int = 50, skip: int = 0):
    """Return the authenticated user's voice call history, newest first."""
    user_id = str(current_user["_id"])
    cursor = db.voice_calls.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).skip(skip).limit(limit)
    calls = await cursor.to_list(limit)
    return {"calls": calls, "total": await db.voice_calls.count_documents({"user_id": user_id})}


@router.delete("/forwarding/{calliotel_number:path}")
async def remove_forwarding(calliotel_number: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    result = await db.call_forwarding.delete_one(
        {"user_id": user_id, "calliotel_number": calliotel_number}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Forwarding rule not found")
    return {"success": True}
