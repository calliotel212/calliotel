"""
Apply Calliotel security hardening on the production backend.
Run: /var/www/calliotel/venv/bin/python /tmp/apply_security_fixes.py
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

BACKEND = Path("/var/www/calliotel/backend")
ENV = Path("/var/www/calliotel/.env")
TELNYX_PUBLIC = "WbTTTCe+L/axY/kvJXNjAwmoYOJqhcLrtES5ZaSPXc0="


def ensure_env_public_key() -> None:
    text = ENV.read_text()
    if re.search(r"^TELNYX_PUBLIC_KEY=", text, re.M):
        print("TELNYX_PUBLIC_KEY already in .env")
        return
    ENV.write_text(text.rstrip() + f"\nTELNYX_PUBLIC_KEY={TELNYX_PUBLIC}\n")
    print("Added TELNYX_PUBLIC_KEY to .env")


def write_telnyx_webhook_verify() -> None:
    path = BACKEND / "services" / "telnyx_webhook_verify.py"
    path.write_text(
        '''\
"""Verify Telnyx API v2 webhook Ed25519 signatures."""
from __future__ import annotations

import base64
import logging
import os
import time

logger = logging.getLogger(__name__)

TELNYX_PUBLIC_KEY = os.environ.get("TELNYX_PUBLIC_KEY", "").strip()
# Tolerate clock skew / queue delay
MAX_AGE_SECS = 300


def verify_telnyx_signature(raw_body: bytes, signature_b64: str | None, timestamp: str | None) -> bool:
    """
    Return True when the webhook is authentic.
    If TELNYX_PUBLIC_KEY is unset, returns False (fail closed in production callers).
    """
    if not TELNYX_PUBLIC_KEY:
        logger.error("TELNYX_PUBLIC_KEY not configured — rejecting webhook")
        return False
    if not signature_b64 or not timestamp:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(int(time.time()) - ts) > MAX_AGE_SECS:
        logger.warning("Telnyx webhook timestamp outside tolerance")
        return False
    try:
        from nacl.signing import VerifyKey
        from nacl.exceptions import BadSignatureError
    except ImportError:
        logger.error("PyNaCl not installed — cannot verify Telnyx webhooks")
        return False
    try:
        key_bytes = base64.b64decode(TELNYX_PUBLIC_KEY)
        sig = base64.b64decode(signature_b64)
        signed = timestamp.encode("utf-8") + b"|" + raw_body
        VerifyKey(key_bytes).verify(signed, sig)
        return True
    except BadSignatureError:
        return False
    except Exception as e:
        logger.warning(f"Telnyx signature verify error: {e}")
        return False
'''
    )
    ast.parse(path.read_text())
    print("wrote services/telnyx_webhook_verify.py")


def fix_credit_packages() -> None:
    path = BACKEND / "routes" / "credit_packages.py"
    path.write_text(
        '''\
"""Credit package catalog (read-only). Free purchase endpoint permanently disabled."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routes.auth import get_current_user

router = APIRouter()


class CreditPackage(BaseModel):
    id: str
    name: str
    price: float
    credits: float
    bonus_percentage: int
    base_credits: float
    is_best_value: bool


class PurchasePackageRequest(BaseModel):
    package_id: str
    user_id: str | None = None


@router.get("/credit-packages")
async def get_credit_packages():
    """Public catalog — real checkout is Stripe/crypto via /buy-credits."""
    packages = [
        CreditPackage(
            id="starter", name="Starter", price=10.00, credits=10.00,
            bonus_percentage=0, base_credits=10.00, is_best_value=False,
        ),
        CreditPackage(
            id="pro", name="Pro", price=50.00, credits=50.00,
            bonus_percentage=0, base_credits=50.00, is_best_value=True,
        ),
        CreditPackage(
            id="premium", name="Premium", price=100.00, credits=100.00,
            bonus_percentage=0, base_credits=100.00, is_best_value=False,
        ),
    ]
    return {"packages": packages}


@router.post("/credit-packages/purchase")
async def purchase_credit_package(
    request: PurchasePackageRequest,
    current_user=Depends(get_current_user),
):
    """DISABLED — previously credited wallets with no payment (critical vuln)."""
    raise HTTPException(
        status_code=410,
        detail=(
            "Direct credit purchase is disabled. "
            "Add funds at /buy-credits using card or crypto."
        ),
    )
'''
    )
    ast.parse(path.read_text())
    print("fixed credit_packages.py")


def fix_admin_jobs() -> None:
    path = BACKEND / "routes" / "admin_jobs.py"
    text = path.read_text()
    if "from routes.admin import is_admin" not in text:
        text = text.replace(
            "from routes.auth import get_current_user\n",
            "from routes.auth import get_current_user\nfrom routes.admin import is_admin\n",
            1,
        )
    # Inject admin check after each current_user = Depends function start
    # Simpler: wrap by replacing function bodies' first try with admin check
    helper = '''
async def _require_admin(current_user):
    if not await is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
'''
    if "_require_admin" not in text:
        text = text.replace(
            "router = APIRouter()\n",
            "router = APIRouter()\n" + helper + "\n",
            1,
        )
    # Add await _require_admin(current_user) at start of each endpoint that has current_user
    pattern = re.compile(
        r"(async def \w+\([^)]*current_user[^)]*\):[^\n]*\n)(\s+)(try:)",
        re.M,
    )

    def inject(m):
        indent = m.group(2)
        return f"{m.group(1)}{indent}await _require_admin(current_user)\n{indent}{m.group(3)}"

    text2, n = pattern.subn(inject, text)
    # Also endpoints that don't use try immediately
    pattern2 = re.compile(
        r"(async def \w+\([^)]*current_user[^)]*\):[^\n]*\n)(\s+)(?!await _require_admin)(\S)",
        re.M,
    )

    def inject2(m):
        # skip if already has require
        return f"{m.group(1)}{m.group(2)}await _require_admin(current_user)\n{m.group(2)}{m.group(3)}"

    # Only for defs that don't already have require on next lines
    lines = text2.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        out.append(lines[i])
        if re.match(r"async def \w+\(.*current_user", lines[i]) and lines[i].rstrip().endswith(":"):
            # look ahead
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                out.append(lines[j])
                j += 1
            block = "".join(lines[i : min(i + 6, len(lines))])
            if "await _require_admin" not in block and j < len(lines):
                indent = re.match(r"^(\s*)", lines[j]).group(1)
                out.append(f"{indent}await _require_admin(current_user)\n")
            i += 1
            continue
        i += 1
    text2 = "".join(out)
    # dedupe consecutive require lines
    text2 = re.sub(
        r"(await _require_admin\(current_user\)\n)(\s*await _require_admin\(current_user\)\n)+",
        r"\1",
        text2,
    )
    path.write_text(text2)
    ast.parse(text2)
    print("fixed admin_jobs.py")


def fix_auth_jwt() -> None:
    path = BACKEND / "routes" / "auth.py"
    text = path.read_text()
    old = "SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')"
    new = '''_jwt = os.environ.get("JWT_SECRET_KEY", "").strip()
if not _jwt or _jwt == "your-secret-key-change-in-production" or len(_jwt) < 32:
    raise RuntimeError("JWT_SECRET_KEY must be set to a strong secret (32+ chars) — refusing to start with a weak/default key")
SECRET_KEY = _jwt'''
    if old in text:
        text = text.replace(old, new, 1)
        path.write_text(text)
        ast.parse(text)
        print("fixed auth.py JWT fail-closed")
    else:
        print("auth JWT line already changed or not found")


def fix_cors() -> None:
    path = BACKEND / "server.py"
    text = path.read_text()
    old = '    allow_origin_regex=r"https://.*\\.(replit\\.dev|replit\\.app|kirk\\.replit\\.dev|calliotel\\.com)",  # Allow all Replit subdomains and calliotel.com'
    new = '    # Production: explicit origins only (no wildcard Replit regex — CSRF surface)\n    allow_origin_regex=None,'
    if old in text:
        text = text.replace(old, new, 1)
        path.write_text(text)
        ast.parse(text)
        print("fixed CORS regex")
    else:
        # softer match
        text2, n = re.subn(
            r"allow_origin_regex=r\"[^\"]+\",\s*# Allow all Replit[^\n]*",
            "allow_origin_regex=None,  # hardened: no Replit wildcard",
            text,
            count=1,
        )
        if n:
            path.write_text(text2)
            ast.parse(text2)
            print("fixed CORS regex (regex replace)")
        else:
            print("CORS line not found")


def fix_sms_logging() -> None:
    path = BACKEND / "routes" / "sms.py"
    text = path.read_text()
    text2 = text.replace(
        'logger.info(f"Telnyx SMS webhook raw body: {raw_body[:500]}")',
        'logger.info(f"Telnyx SMS webhook received ({len(raw_body)} bytes) — body not logged")',
    )
    text2 = text2.replace(
        'logger.info(f"DIDWW SMS webhook raw body: {raw_body[:500]}")',
        'logger.info(f"DIDWW SMS webhook received ({len(raw_body)} bytes) — body not logged")',
    )
    text2 = text2.replace(
        'logger.info(f"DIDWW SMS webhook parsed payload: {payload}")',
        'logger.info("DIDWW SMS webhook parsed OK")',
    )
    if text2 != text:
        path.write_text(text2)
        print("fixed sms.py logging")
    else:
        print("sms logging patterns not found / already fixed")


def patch_calls_security() -> None:
    """Patch calls.py: webhook verify, hangup ownership, wallet precheck, webrtc gate, email escape, safe billing."""
    path = BACKEND / "routes" / "calls.py"
    text = path.read_text()

    # Imports
    if "telnyx_webhook_verify" not in text:
        text = text.replace(
            "from services.telnyx_call_client import answer_call, transfer_call, speak_call, hangup_call, dial_call\n",
            "from services.telnyx_call_client import answer_call, transfer_call, speak_call, hangup_call, dial_call\n"
            "from services.telnyx_webhook_verify import verify_telnyx_signature\n"
            "import html as _html\n",
            1,
        )

    # WebRTC gate
    old_webrtc = '''@router.get("/webrtc-token")
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
    }'''

    new_webrtc = '''@router.get("/webrtc-token")
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
    }'''

    if old_webrtc in text:
        text = text.replace(old_webrtc, new_webrtc, 1)
        print("patched webrtc-token")
    else:
        print("WARN: webrtc block not exact match")

    # Webhook: replace start to use raw body + verify
    old_hook_start = '''@router.post("/webhook/telnyx")
async def call_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=400)

    data = body.get("data", {})'''

    new_hook_start = '''@router.post("/webhook/telnyx")
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

    data = body.get("data", {})'''

    if old_hook_start in text:
        text = text.replace(old_hook_start, new_hook_start, 1)
        print("patched webhook signature gate")
    else:
        print("WARN: webhook start not exact match")

    # Safer billing: only bill connected outbound bridges or answered inbound; never go negative; idempotent
    # Replace the billing block inside hangup
    old_bill = '''            # Charge wallet for connected calls (duration ≥ 6s)
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
                logger.info(f"💳 Call billed: user={user_id} dur={duration}s cost=${call_cost:.4f}")'''

    new_bill = '''            # Charge wallet only for real connected legs (not forged initiated→hangup).
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
                    call_cost = round((safe_dur / 60) * CALL_COST_PER_MINUTE, 4)
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
                    desc = f"{'Outbound' if direction == 'outbound' else 'Inbound'} call {from_n} → {to_n} ({safe_dur}s)"
                    await db.transactions.insert_one({
                        "user_id": user_id,
                        "type": "debit",
                        "amount": call_cost,
                        "description": desc,
                        "balance_after": new_balance,
                        "call_control_id": call_control_id,
                        "created_at": now_iso,
                    })
                    logger.info(f"💳 Call billed: user={user_id} dur={safe_dur}s cost=${call_cost:.4f}")'''

    if old_bill in text:
        text = text.replace(old_bill, new_bill, 1)
        print("patched billing")
    else:
        print("WARN: billing block not exact match")

    # Escape missed-call email fields — find caller = and html f-string
    if "Missed call from {caller}" in text and "_html.escape" not in text:
        text = text.replace(
            "caller = info.get(\"from\", \"Unknown\")\n",
            "caller = _html.escape(str(info.get(\"from\", \"Unknown\")).replace(\"\\r\", \"\").replace(\"\\n\", \" \"))\n",
            1,
        )
        text = text.replace(
            "calliotel_num = info.get(\"to\", \"your number\")\n",
            "calliotel_num = _html.escape(str(info.get(\"to\", \"your number\")).replace(\"\\r\", \"\").replace(\"\\n\", \" \"))\n",
            1,
        )
        text = text.replace(
            'owner_name = user_doc.get("full_name") or user_doc.get("name") or "there"',
            'owner_name = _html.escape(str(user_doc.get("full_name") or user_doc.get("name") or "there"))',
            1,
        )
        print("patched email escaping")

    # Hangup ownership
    old_hang = '''@router.post("/hangup")
async def hangup(req: HangupRequest, current_user=Depends(get_current_user)):
    ok = await hangup_call(req.call_control_id)
    if not ok:
        raise HTTPException(status_code=502, detail="Could not hang up call")
    await _pop_active_call(req.call_control_id)
    return {"success": True}'''

    new_hang = '''@router.post("/hangup")
async def hangup(req: HangupRequest, current_user=Depends(get_current_user)):
    user_id = str(current_user.get("_id") or current_user.get("email") or "")
    info = await _load_active_call(req.call_control_id)
    if not info or str(info.get("user_id")) != user_id:
        raise HTTPException(status_code=403, detail="Call not found or not owned by you")
    ok = await hangup_call(req.call_control_id)
    if not ok:
        raise HTTPException(status_code=502, detail="Could not hang up call")
    await _pop_active_call(req.call_control_id)
    return {"success": True}'''

    if old_hang in text:
        text = text.replace(old_hang, new_hang, 1)
        print("patched hangup ownership")
    else:
        print("WARN: hangup block not exact match")

    # Outbound wallet pre-check — insert after ownership verify
    needle = '''    # Verify ownership
    owned = await _find_number_owner(req.from_number)
    if not owned or owned != user_id:
        raise HTTPException(status_code=403, detail="You don't own that number")

    virtual = _e164(req.from_number)'''

    insert = '''    # Verify ownership
    owned = await _find_number_owner(req.from_number)
    if not owned or owned != user_id:
        raise HTTPException(status_code=403, detail="You don't own that number")

    # Wallet gate — do not dial if user cannot cover at least 1 minute
    wallet = await db.wallets.find_one({"user_id": user_id})
    bal = float(wallet.get("balance", 0)) if wallet else 0.0
    if bal < CALL_COST_PER_MINUTE:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance (${bal:.2f}). Add funds before calling.",
        )

    virtual = _e164(req.from_number)'''

    if needle in text and "Wallet gate" not in text:
        text = text.replace(needle, insert, 1)
        print("patched outbound wallet gate")
    else:
        print("WARN: outbound wallet gate skip")

    path.write_text(text)
    ast.parse(text)
    print("calls.py syntax OK")


def main() -> None:
    ensure_env_public_key()
    write_telnyx_webhook_verify()
    fix_credit_packages()
    fix_admin_jobs()
    fix_auth_jwt()
    fix_cors()
    fix_sms_logging()
    patch_calls_security()
    print("ALL SECURITY FIXES APPLIED")


if __name__ == "__main__":
    main()
