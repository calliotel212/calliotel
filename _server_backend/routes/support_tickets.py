"""
Support Ticket System
- Logged-in clients create tickets (subject + message) on the website
- New tickets / follow-ups notify the Calliotel Tickets Telegram group via SUPPORT bot
- Admin replies in Telegram by reply-to bot message OR /reply TICKET_ID text
- Admin closes via /close TICKET_ID; client can close on the website
- Statuses: open | answered | closed  (in_progress accepted as alias for answered)

Collections:
  support_tickets
  support_ticket_messages

IMPORTANT: uses SUPPORT_TELEGRAM_BOT_TOKEN / SUPPORT_TELEGRAM_CHAT_ID only.
Does not touch the ops purchase/SMS Telegram bot.
"""
from __future__ import annotations

import logging
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from database import db
from routes.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

ADMIN_EMAILS = {
    "admin@calliotel.com",
    "bigboss@calliotel.com",
    "alinmy77@gmail.com",
    "worl212211@yahoo.com",
    "astor539@gmail.com",
    "g_agroup2@yahoo.com",
}

CATEGORIES = ["billing", "technical", "number", "account", "other"]
STATUS_OPEN = "open"
STATUS_ANSWERED = "answered"
STATUS_CLOSED = "closed"
# Back-compat with older admin UI
STATUS_IN_PROGRESS = "in_progress"

VALID_STATUSES = {STATUS_OPEN, STATUS_ANSWERED, STATUS_CLOSED, STATUS_IN_PROGRESS}

_REPLY_CMD = re.compile(
    r"^/(?:reply|r)\s+(TKT-[A-Z0-9]+)\s+(.+)$",
    re.IGNORECASE | re.DOTALL,
)
_CLOSE_CMD = re.compile(
    r"^/(?:close|c)\s+(TKT-[A-Z0-9]+)\s*$",
    re.IGNORECASE,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_admin(user) -> bool:
    return (user.get("_id") or "").lower() in {a.lower() for a in ADMIN_EMAILS} or (
        user.get("email") or ""
    ).lower() in {a.lower() for a in ADMIN_EMAILS}


def _normalize_status(status: Optional[str]) -> str:
    s = (status or STATUS_OPEN).lower().strip()
    if s == STATUS_IN_PROGRESS:
        return STATUS_ANSWERED
    return s if s in (STATUS_OPEN, STATUS_ANSWERED, STATUS_CLOSED) else STATUS_OPEN


def _user_id(user) -> str:
    return user.get("_id") or user.get("email") or "unknown"


def _public_ticket(ticket: dict, *, include_internal: bool = False) -> dict:
    out = dict(ticket)
    out["id"] = out.pop("_id", out.get("id"))
    out["status"] = _normalize_status(out.get("status"))
    msgs = []
    for m in out.get("messages") or []:
        mm = dict(m)
        if mm.get("is_internal") and not include_internal:
            mm["message"] = "[Internal note]"
        msgs.append(mm)
    out["messages"] = msgs
    return out


async def _append_message(
    ticket_id: str,
    *,
    role: str,
    sender: str,
    message: str,
    is_internal: bool = False,
    telegram_message_id: Optional[int] = None,
) -> dict:
    now = _now()
    msg = {
        "id": secrets.token_hex(6),
        "ticket_id": ticket_id,
        "from": role,
        "sender_email": sender,
        "message": message,
        "created_at": now,
        "is_internal": is_internal,
    }
    if telegram_message_id is not None:
        msg["telegram_message_id"] = int(telegram_message_id)

    await db.support_ticket_messages.insert_one(dict(msg))

    # Keep embedded thread for admin UI + existing clients
    embedded = {
        "id": msg["id"],
        "from": role,
        "sender_email": sender,
        "message": message,
        "created_at": now,
        "is_internal": is_internal,
    }
    return embedded


async def _notify_telegram_ticket(
    ticket: dict,
    *,
    kind: str,
    body: str,
) -> Optional[int]:
    """Send / thread a Telegram notification. Returns telegram message_id if sent."""
    try:
        from services.support_telegram import send_support_message
    except Exception as e:
        logger.warning("support_telegram import failed: %s", e)
        return None

    ticket_id = ticket.get("_id") or ticket.get("id")
    subject = ticket.get("subject") or "(no subject)"
    user_email = ticket.get("user_email") or ticket.get("user_id") or "?"
    status = _normalize_status(ticket.get("status"))

    if kind == "new":
        text = (
            f"🎫 New support ticket\n"
            f"ID: {ticket_id}\n"
            f"User: {user_email}\n"
            f"Subject: {subject}\n"
            f"Status: {status}\n\n"
            f"{body}\n\n"
            f"Reply to this message to answer the client,\n"
            f"or /reply {ticket_id} your text\n"
            f"or /close {ticket_id}"
        )
        reply_to = None
    elif kind == "followup":
        text = (
            f"💬 Client follow-up — {ticket_id}\n"
            f"User: {user_email}\n"
            f"Subject: {subject}\n\n"
            f"{body}\n\n"
            f"Reply to this message (or the original ticket) to answer."
        )
        reply_to = ticket.get("telegram_message_id")
    else:
        text = body
        reply_to = ticket.get("telegram_message_id")

    result = await send_support_message(text, reply_to_message_id=reply_to)
    if not result:
        return None
    mid = result.get("message_id")
    return int(mid) if mid is not None else None


async def _notify_client_admin_reply(ticket: dict, message: str) -> None:
    """Email + optional push/toast path when admin replies."""
    user_email = ticket.get("user_email") or ticket.get("user_id")
    ticket_id = ticket.get("_id") or ticket.get("id")
    if user_email and "@" in str(user_email) and not str(user_email).endswith(".user"):
        await _send_ticket_email(
            str(user_email),
            f"Re: {ticket.get('subject', 'Support')} [{ticket_id}]",
            f"<p>Hi {ticket.get('user_name', 'there')},</p>"
            f"<p>We've replied to your support ticket <b>{ticket_id}</b>:</p>"
            f"<blockquote style='border-left:3px solid #F5A623;padding-left:12px;color:#555'>"
            f"{message}</blockquote>"
            f"<p><a href='https://calliotel.com/support'>View your ticket →</a></p>",
        )
    try:
        user = await db.users.find_one({"$or": [{"_id": user_email}, {"email": user_email}]})
        if user:
            from services.user_notifications import notify_user_fire_and_forget

            notify_user_fire_and_forget(
                user,
                title="Support reply",
                message=f"New reply on ticket {ticket_id}: {message[:120]}",
            )
    except Exception as e:
        logger.debug("client push notify skipped: %s", e)


async def _send_ticket_email(to: str, subject: str, body: str):
    try:
        import resend

        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if not resend.api_key:
            return
        resend.Emails.send(
            {
                "from": "Calliotel Support <support@calliotel.com>",
                "to": [to],
                "subject": subject,
                "html": (
                    f"<div style='font-family:sans-serif;max-width:600px;margin:0 auto'>"
                    f"{body}<br><br>"
                    f"<small style='color:#888'>Calliotel Support — support@calliotel.com</small>"
                    f"</div>"
                ),
            }
        )
    except Exception as e:
        logger.warning(f"Ticket email failed: {e}")


class CreateTicketRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=5, max_length=5000)
    category: str = Field(default="other")
    priority: str = Field(default="normal")


class ReplyRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    is_internal: bool = False


async def create_system_ticket(
    *,
    user_email: str,
    user_name: str = "",
    subject: str,
    message: str,
    category: str = "billing",
    priority: str = "high",
    extra: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Open a support ticket without a logged-in request (card lock, fraud, jobs)."""
    email = (user_email or "").strip()
    if not email:
        return None
    category = category if category in CATEGORIES else "other"
    existing = await db.support_tickets.find_one(
        {
            "user_email": email,
            "auto_card_lock": True,
            "status": {"$in": [STATUS_OPEN, STATUS_ANSWERED, STATUS_IN_PROGRESS]},
        }
    )
    if existing:
        return existing.get("_id")

    ticket_id = "TKT-" + secrets.token_hex(4).upper()
    now = _now()
    msg_text = (message or "").strip() or subject
    first_msg = {
        "id": secrets.token_hex(6),
        "from": "user",
        "sender_email": email,
        "message": msg_text,
        "created_at": now,
        "is_internal": False,
    }
    ticket = {
        "_id": ticket_id,
        "user_id": email,
        "user_email": email,
        "user_name": user_name or str(email).split("@")[0],
        "subject": subject.strip()[:120],
        "category": category,
        "priority": priority if priority in ("low", "normal", "high", "urgent") else "high",
        "status": STATUS_OPEN,
        "messages": [first_msg],
        "created_at": now,
        "updated_at": now,
        "last_reply_at": now,
        "reply_count": 0,
        "telegram_message_id": None,
        "telegram_chat_id": None,
        "auto_card_lock": True,
    }
    if extra:
        ticket.update(extra)
    await db.support_tickets.insert_one(ticket)
    await db.support_ticket_messages.insert_one({**first_msg, "ticket_id": ticket_id})
    logger.info(f"🎫 System ticket {ticket_id} for {email}: {subject}")

    tg_mid = await _notify_telegram_ticket(ticket, kind="new", body=msg_text)
    if tg_mid:
        from services.support_telegram import support_chat_id

        await db.support_tickets.update_one(
            {"_id": ticket_id},
            {"$set": {"telegram_message_id": tg_mid, "telegram_chat_id": support_chat_id()}},
        )
    try:
        await _send_ticket_email(
            "g_agroup2@yahoo.com",
            f"[New Ticket] {subject} — {ticket_id}",
            f"<b>Ticket ID:</b> {ticket_id}<br><b>From:</b> {email}<br>"
            f"<b>Category:</b> {category}<br><br><b>Message:</b><br>{msg_text}<br><br>"
            f"<a href='https://calliotel.com/admin'>Open Admin Dashboard →</a>",
        )
    except Exception:
        pass
    return ticket_id


# ── Client Endpoints ────────────────────────────────────────────────────────


@router.post("/ticket")
async def create_ticket(req: CreateTicketRequest, current_user=Depends(get_current_user)):
    category = req.category if req.category in CATEGORIES else "other"
    ticket_id = "TKT-" + secrets.token_hex(4).upper()
    now = _now()
    user_email = _user_id(current_user)
    msg_text = req.message.strip()

    first_msg = {
        "id": secrets.token_hex(6),
        "from": "user",
        "sender_email": user_email,
        "message": msg_text,
        "created_at": now,
        "is_internal": False,
    }

    ticket = {
        "_id": ticket_id,
        "user_id": user_email,
        "user_email": user_email,
        "user_name": current_user.get("full_name")
        or current_user.get("display_name")
        or str(user_email).split("@")[0],
        "subject": req.subject.strip(),
        "category": category,
        "priority": req.priority if req.priority in ("low", "normal", "high", "urgent") else "normal",
        "status": STATUS_OPEN,
        "messages": [first_msg],
        "created_at": now,
        "updated_at": now,
        "last_reply_at": now,
        "reply_count": 0,
        "telegram_message_id": None,
        "telegram_chat_id": None,
    }
    await db.support_tickets.insert_one(ticket)
    await db.support_ticket_messages.insert_one(
        {
            **first_msg,
            "ticket_id": ticket_id,
        }
    )
    logger.info(f"🎫 New ticket {ticket_id} from {user_email}: {req.subject}")

    tg_mid = await _notify_telegram_ticket(ticket, kind="new", body=msg_text)
    if tg_mid:
        from services.support_telegram import support_chat_id

        await db.support_tickets.update_one(
            {"_id": ticket_id},
            {
                "$set": {
                    "telegram_message_id": tg_mid,
                    "telegram_chat_id": support_chat_id(),
                }
            },
        )

    try:
        await _send_ticket_email(
            "g_agroup2@yahoo.com",
            f"[New Ticket] {req.subject} — {ticket_id}",
            f"<b>Ticket ID:</b> {ticket_id}<br><b>From:</b> {user_email}<br>"
            f"<b>Category:</b> {category}<br><br><b>Message:</b><br>{msg_text}<br><br>"
            f"<a href='https://calliotel.com/admin'>Open Admin Dashboard →</a>",
        )
    except Exception:
        pass

    return {
        "ok": True,
        "ticket_id": ticket_id,
        "message": "Ticket created. We'll reply soon.",
    }


@router.get("/tickets")
async def get_my_tickets(current_user=Depends(get_current_user)):
    user_email = _user_id(current_user)
    tickets = (
        await db.support_tickets.find({"user_id": user_email}, {"messages": 0})
        .sort("updated_at", -1)
        .to_list(50)
    )
    return {"tickets": [_public_ticket(t) for t in tickets]}


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user=Depends(get_current_user)):
    user_email = _user_id(current_user)
    ticket = await db.support_tickets.find_one({"_id": ticket_id.upper()})
    if not ticket:
        ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user_email and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Not your ticket")
    return _public_ticket(ticket, include_internal=_is_admin(current_user))


@router.post("/tickets/{ticket_id}/reply")
async def client_reply(ticket_id: str, req: ReplyRequest, current_user=Depends(get_current_user)):
    user_email = _user_id(current_user)
    tid = ticket_id.upper()
    ticket = await db.support_tickets.find_one({"_id": tid}) or await db.support_tickets.find_one(
        {"_id": ticket_id}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user_email:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if _normalize_status(ticket.get("status")) == STATUS_CLOSED:
        raise HTTPException(status_code=400, detail="Ticket is closed")

    now = _now()
    msg_text = req.message.strip()
    embedded = await _append_message(
        ticket["_id"],
        role="user",
        sender=user_email,
        message=msg_text,
    )
    await db.support_tickets.update_one(
        {"_id": ticket["_id"]},
        {
            "$push": {"messages": embedded},
            "$set": {
                "status": STATUS_OPEN,
                "updated_at": now,
                "last_reply_at": now,
            },
        },
    )
    ticket["status"] = STATUS_OPEN
    await _notify_telegram_ticket(ticket, kind="followup", body=msg_text)
    return {"ok": True, "ticket_id": ticket["_id"]}


@router.post("/tickets/{ticket_id}/close")
async def client_close(ticket_id: str, current_user=Depends(get_current_user)):
    user_email = _user_id(current_user)
    ticket = await db.support_tickets.find_one({"_id": ticket_id.upper()}) or await db.support_tickets.find_one(
        {"_id": ticket_id}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user_email and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Not your ticket")
    now = _now()
    await db.support_tickets.update_one(
        {"_id": ticket["_id"]},
        {"$set": {"status": STATUS_CLOSED, "updated_at": now, "closed_at": now, "closed_by": "client"}},
    )
    try:
        from services.support_telegram import send_support_message

        await send_support_message(
            f"✅ Ticket {ticket['_id']} closed by client ({user_email})",
            reply_to_message_id=ticket.get("telegram_message_id"),
        )
    except Exception:
        pass
    return {"ok": True, "status": STATUS_CLOSED}


# ── Admin Endpoints ────────────────────────────────────────────────────────


@router.get("/admin/tickets")
async def admin_list_tickets(
    status: Optional[str] = None,
    limit: int = 100,
    current_user=Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    q: Dict[str, Any] = {}
    if status and status != "all":
        ns = _normalize_status(status)
        if status.lower() == STATUS_IN_PROGRESS or ns == STATUS_ANSWERED:
            q["status"] = {"$in": [STATUS_ANSWERED, STATUS_IN_PROGRESS]}
        elif ns in (STATUS_OPEN, STATUS_CLOSED):
            q["status"] = ns
    tickets = (
        await db.support_tickets.find(q, {"messages": 0}).sort("updated_at", -1).to_list(limit)
    )
    open_count = await db.support_tickets.count_documents({"status": STATUS_OPEN})
    answered_count = await db.support_tickets.count_documents(
        {"status": {"$in": [STATUS_ANSWERED, STATUS_IN_PROGRESS]}}
    )
    return {
        "tickets": [_public_ticket(t, include_internal=True) for t in tickets],
        "open_count": open_count,
        "in_progress_count": answered_count,
        "answered_count": answered_count,
    }


@router.get("/admin/tickets/{ticket_id}")
async def admin_get_ticket(ticket_id: str, current_user=Depends(get_current_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    ticket = await db.support_tickets.find_one({"_id": ticket_id.upper()}) or await db.support_tickets.find_one(
        {"_id": ticket_id}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _public_ticket(ticket, include_internal=True)


@router.post("/admin/tickets/{ticket_id}/reply")
async def admin_reply_ticket(
    ticket_id: str, req: ReplyRequest, current_user=Depends(get_current_user)
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    ticket = await db.support_tickets.find_one({"_id": ticket_id.upper()}) or await db.support_tickets.find_one(
        {"_id": ticket_id}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = _now()
    admin_email = _user_id(current_user)
    msg_text = req.message.strip()
    embedded = await _append_message(
        ticket["_id"],
        role="admin",
        sender=admin_email,
        message=msg_text,
        is_internal=req.is_internal,
    )
    new_status = (
        ticket["status"]
        if req.is_internal
        else STATUS_ANSWERED
    )
    await db.support_tickets.update_one(
        {"_id": ticket["_id"]},
        {
            "$push": {"messages": embedded},
            "$set": {"status": new_status, "updated_at": now, "last_reply_at": now},
            "$inc": {"reply_count": 1},
        },
    )
    if not req.is_internal:
        await _notify_client_admin_reply(ticket, msg_text)
    logger.info(f"💬 Admin {admin_email} replied to ticket {ticket['_id']} (internal={req.is_internal})")
    return {"ok": True, "ticket_id": ticket["_id"]}


@router.put("/admin/tickets/{ticket_id}/status")
async def admin_update_ticket_status(
    ticket_id: str, status: str, current_user=Depends(get_current_user)
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400, detail="Invalid status. Use: open, answered, closed"
        )
    now = _now()
    ns = _normalize_status(status)
    res = await db.support_tickets.update_one(
        {"_id": ticket_id.upper()},
        {"$set": {"status": ns, "updated_at": now}},
    )
    if res.matched_count == 0:
        res = await db.support_tickets.update_one(
            {"_id": ticket_id},
            {"$set": {"status": ns, "updated_at": now}},
        )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    logger.info(f"🎫 Ticket {ticket_id} status → {ns}")
    return {"ok": True, "status": ns}


# ── Telegram webhook (SUPPORT bot only) ─────────────────────────────────────


async def _admin_reply_from_telegram(ticket_id: str, text: str, admin_label: str) -> bool:
    ticket = await db.support_tickets.find_one({"_id": ticket_id.upper()})
    if not ticket:
        return False
    now = _now()
    msg_text = text.strip()
    if not msg_text:
        return False
    embedded = await _append_message(
        ticket["_id"],
        role="admin",
        sender=admin_label,
        message=msg_text,
    )
    await db.support_tickets.update_one(
        {"_id": ticket["_id"]},
        {
            "$push": {"messages": embedded},
            "$set": {
                "status": STATUS_ANSWERED,
                "updated_at": now,
                "last_reply_at": now,
            },
            "$inc": {"reply_count": 1},
        },
    )
    await _notify_client_admin_reply(ticket, msg_text)
    logger.info(f"💬 Telegram admin reply on {ticket['_id']} from {admin_label}")
    return True


async def _admin_close_from_telegram(ticket_id: str, admin_label: str) -> bool:
    ticket = await db.support_tickets.find_one({"_id": ticket_id.upper()})
    if not ticket:
        return False
    now = _now()
    await db.support_tickets.update_one(
        {"_id": ticket["_id"]},
        {
            "$set": {
                "status": STATUS_CLOSED,
                "updated_at": now,
                "closed_at": now,
                "closed_by": f"telegram:{admin_label}",
            }
        },
    )
    logger.info(f"🎫 Telegram closed {ticket['_id']} by {admin_label}")
    return True


async def _resolve_ticket_from_reply(message: dict) -> Optional[str]:
    """Find ticket id from reply_to_message (stored telegram_message_id) or text."""
    reply = message.get("reply_to_message") or {}
    reply_mid = reply.get("message_id")
    if reply_mid is not None:
        ticket = await db.support_tickets.find_one({"telegram_message_id": int(reply_mid)})
        if ticket:
            return ticket["_id"]
        # Also match follow-up notifications that stored mid on messages
        msg_doc = await db.support_ticket_messages.find_one(
            {"telegram_message_id": int(reply_mid)}
        )
        if msg_doc and msg_doc.get("ticket_id"):
            return msg_doc["ticket_id"]
        # Parse ticket id from the original bot text if present
        reply_text = reply.get("text") or ""
        m = re.search(r"(TKT-[A-Z0-9]+)", reply_text, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    return None


@router.post("/telegram/webhook")
async def support_telegram_webhook(request: Request):
    """Webhook for @CalliotelSupportBot only. Ops bot webhook must stay untouched."""
    # Optional secret header check
    expected = (os.environ.get("SUPPORT_TELEGRAM_WEBHOOK_SECRET") or "").strip()
    if expected:
        got = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if got != expected:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = update.get("message") or update.get("edited_message")
    if not message:
        return {"ok": True}

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    expected_chat = (os.environ.get("SUPPORT_TELEGRAM_CHAT_ID") or "").strip()
    # Admin ticket actions are accepted only from the configured private
    # support group. Never treat arbitrary bot DMs as administrator commands.
    if not expected_chat:
        logger.error("SUPPORT_TELEGRAM_CHAT_ID is not configured; ignoring webhook update")
        return {"ok": True}
    if chat_id != expected_chat:
        return {"ok": True}

    text = (message.get("text") or "").strip()
    if not text:
        return {"ok": True}

    from_user = message.get("from") or {}
    admin_label = (
        from_user.get("username")
        or from_user.get("first_name")
        or str(from_user.get("id") or "admin")
    )

    # Ignore messages from the bot itself
    if from_user.get("is_bot"):
        return {"ok": True}

    from services.support_telegram import send_support_message

    # /close TICKET_ID
    close_m = _CLOSE_CMD.match(text)
    if close_m:
        tid = close_m.group(1).upper()
        ok = await _admin_close_from_telegram(tid, admin_label)
        await send_support_message(
            f"{'✅ Closed' if ok else '❌ Ticket not found'}: {tid}",
            reply_to_message_id=message.get("message_id"),
        )
        return {"ok": True}

    # /reply TICKET_ID text
    reply_m = _REPLY_CMD.match(text)
    if reply_m:
        tid = reply_m.group(1).upper()
        body = reply_m.group(2).strip()
        ok = await _admin_reply_from_telegram(tid, body, admin_label)
        await send_support_message(
            f"{'✅ Replied to' if ok else '❌ Ticket not found'}: {tid}",
            reply_to_message_id=message.get("message_id"),
        )
        return {"ok": True}

    # Prefer: admin replies to the bot's ticket notification message
    if message.get("reply_to_message"):
        tid = await _resolve_ticket_from_reply(message)
        if tid:
            # If the reply text itself is a command, already handled above
            ok = await _admin_reply_from_telegram(tid, text, admin_label)
            if ok:
                await send_support_message(
                    f"✅ Replied to {tid}",
                    reply_to_message_id=message.get("message_id"),
                )
            return {"ok": True}

    # Soft help for unknown commands in the tickets group
    if text.startswith("/"):
        await send_support_message(
            "Support bot commands:\n"
            "• Reply to a ticket notification to answer the client\n"
            "• /reply TKT-XXXXXXXX your message\n"
            "• /close TKT-XXXXXXXX",
            reply_to_message_id=message.get("message_id"),
        )

    return {"ok": True}


@router.get("/telegram/health")
async def support_telegram_health(current_user=Depends(get_current_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    from services.support_telegram import configured, support_chat_id

    return {
        "configured": configured(),
        "chat_id_set": bool(support_chat_id()),
        "bot": "@CalliotelSupportBot",
    }
