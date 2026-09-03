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

logger = logging.getLogger(__name__)
router = APIRouter()

# Pricing
CALL_COST_PER_MINUTE = 0.05  # $0.05/min charged to user

# WebRTC credential connection (pre-created in Telnyx portal)
WEBRTC_CONNECTION_ID = "2952821436797945508"
TELNYX_API_KEY = os.environ.get("TELNYX_API_KEY", "")


# ── WebRTC credentials endpoint ───────────────────────────────────────────────

@router.get("/webrtc-token")
async def get_webrtc_token(current_user=Depends(get_current_user)):
    """
    Generate fresh SIP credentials for Telnyx WebRTC SDK.
    Returns sip_username + sip_password — used by the browser to make direct VoIP calls.
    """
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
    n = n.strip()
    return n if n.startswith("+") else f"+{n}"


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
# Maps call_control_id → call info dict
_active_calls: dict = {}


# ── Telnyx Call Control webhook ──────────────────────────────────────────────

@router.post("/webhook/telnyx")
async def call_webhook(request: Request):
    try:
        body = await request.json()
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

        _active_calls[call_control_id] = {
            "user_id": user_id,
            "from": from_number,
            "to": to_number,
            "direction": "inbound",
            "forward_to": forward_to,
            "started_at": datetime.now(timezone.utc),
        }

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
            answered = await answer_call(call_control_id)
            if answered:
                await transfer_call(call_control_id, to=forward_to, from_=to_number)
                logger.info(f"📲 Forwarding inbound {to_number} → {forward_to}")
        else:
            answered = await answer_call(call_control_id)
            if answered:
                await speak_call(
                    call_control_id,
                    "The number you have dialed is not available. Please try again later.",
                )
        return {"status": "ok"}

    # ── Outbound leg 1 answered (user answered their real phone) ─────────────
    # Now bridge to the actual destination
    if event_type == "call.answered":
        info = _active_calls.get(call_control_id)
        if info and info.get("call_type") == "outbound_bridge_leg1":
            destination = info["destination"]
            virtual_number = info["virtual_number"]
            logger.info(f"📲 Leg 1 answered — bridging {virtual_number} → {destination}")
            # Transfer (bridge) this call leg to the destination
            ok = await transfer_call(call_control_id, to=destination, from_=virtual_number)
            if ok:
                info["call_type"] = "outbound_bridge_active"
                info["bridge_started_at"] = datetime.now(timezone.utc)
            else:
                logger.error(f"Bridge transfer failed for {call_control_id}")
                await speak_call(call_control_id, "Sorry, we could not connect your call. Please try again.")
        return {"status": "ok"}

    # ── Call hangup — log it + bill wallet ────────────────────────────────────
    if event_type == "call.hangup":
        info = _active_calls.pop(call_control_id, None)
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
                )
                logger.info(f"📴 Outbound bridge leg 1 failed ({hangup_cause}) for {info.get('virtual_number')} → {info.get('destination')}")
                return {"status": "ok"}

            status = "forwarded" if info.get("forward_to") else "missed"
            if duration > 5:
                status = "answered"

            user_id = info["user_id"]
            from_n = info.get("virtual_number") or info["from"]
            to_n = info.get("destination") or info["to"]

            # Charge wallet for connected calls (duration ≥ 6s)
            call_cost = 0.0
            if duration >= 6:
                call_cost = round((duration / 60) * CALL_COST_PER_MINUTE, 4)
                wallet = await db.wallets.find_one({"user_id": user_id})
                current_balance = float(wallet.get("balance", 0)) if wallet else 0.0
                new_balance = round(current_balance - call_cost, 4)
                now_iso = datetime.now(timezone.utc).isoformat()
                # Update both wallet collections so app header stays in sync
                await db.wallets.update_one(
                    {"user_id": user_id},
                    {"$set": {"balance": new_balance, "updated_at": now_iso}},
                    upsert=True,
                )
                await db.users.update_one(
                    {"_id": user_id},
                    {"$set": {"wallet_balance": new_balance}},
                )
                desc = f"{'Outbound' if direction == 'outbound' else 'Inbound'} call {from_n} → {to_n} ({int(duration)}s)"
                await db.transactions.insert_one({
                    "user_id": user_id,
                    "type": "debit",
                    "amount": call_cost,
                    "description": desc,
                    "balance_after": new_balance,
                    "created_at": now_iso,
                })
                logger.info(f"💳 Call billed: user={user_id} dur={duration}s cost=${call_cost:.4f}")

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
            )

            # Missed call notification — push + email to number owner
            if status == "missed" and direction == "inbound" and not info.get("forward_to"):
                try:
                    import asyncio as _asyncio
                    caller = info.get("from", "Unknown")
                    calliotel_num = info.get("to", "your number")

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
                        owner_name = user_doc.get("full_name") or user_doc.get("name") or "there"
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


@router.post("/outbound")
async def make_outbound_call(req: OutboundCallRequest, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    # Verify ownership
    owned = await _find_number_owner(req.from_number)
    if not owned or owned != user_id:
        raise HTTPException(status_code=403, detail="You don't own that number")

    virtual = _e164(req.from_number)
    destination = _e164(req.to_number)

    # Determine where to call the user (leg 1)
    if req.real_phone:
        # Caller-supplied override — validate strictly before dialling
        real_phone = _validate_phone_number(req.real_phone)
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
        if is_invalid_e164(real_phone):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Your saved callback number is not a valid E.164 phone number. "
                    "Please update it with your full number including country code (e.g. +1 for US)."
                ),
            )

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
        _active_calls[ccid] = {
            "user_id": user_id,
            "call_type": "outbound_bridge_leg1",
            "virtual_number": virtual,
            "destination": destination,
            "real_phone": real_phone,
            "direction": "outbound",
            "started_at": datetime.now(timezone.utc),
        }

    logger.info(f"📞 Outbound bridge: calling {real_phone} (user) first, then bridging to {destination} via {virtual}")

    # Telegram admin alert — outbound call initiated
    try:
        from services.telegram_admin_alerts import notify_admins
        import asyncio as _asyncio
        _asyncio.create_task(notify_admins(
            f"📞 OUTBOUND CALL\n"
            f"From: {virtual}\n"
            f"To: {destination}\n"
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
    )

    return {
        "success": True,
        "call_control_id": ccid,
        "message": f"Calling your phone ({real_phone}) — answer it to connect to {destination}",
    }


# ── Hangup ────────────────────────────────────────────────────────────────────

class HangupRequest(BaseModel):
    call_control_id: str

@router.post("/hangup")
async def hangup(req: HangupRequest, current_user=Depends(get_current_user)):
    ok = await hangup_call(req.call_control_id)
    if not ok:
        raise HTTPException(status_code=502, detail="Could not hang up call")
    _active_calls.pop(req.call_control_id, None)
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
