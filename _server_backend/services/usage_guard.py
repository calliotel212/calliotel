"""Used-number guard: one inbound SMS means the number did its job — not refundable."""
import re
from typing import Any


def phone_variants(phone: str) -> list[str]:
    raw = str(phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    out = {raw, digits}
    if digits:
        out.add("+" + digits)
        if digits.startswith("1") and len(digits) == 11:
            out.add("+" + digits)
            out.add(digits[1:])
            out.add("+1" + digits[1:])
        elif len(digits) == 10:
            out.add("+1" + digits)
            out.add("1" + digits)
    return [p for p in out if p]


async def used_numbers_for_user(db, user_id: Any, email: str = "") -> list[dict]:
    """Return numbers this user already used (inbound SMS, OTP code, or a call)."""
    ids = [x for x in {user_id, str(user_id or ""), email} if x]
    nums = []
    if ids:
        nums = await db.user_numbers.find(
            {"$or": [{"user_id": {"$in": ids}}, {"user_email": email}]},
            {"phone_number": 1, "status": 1},
        ).to_list(length=200)
        legacy = await db.purchased_numbers.find(
            {"$or": [{"user_id": {"$in": ids}}, {"user_email": email}]},
            {"phone_number": 1, "status": 1},
        ).to_list(length=200)
        nums.extend(legacy)

    used = []
    seen = set()
    for n in nums:
        phone = n.get("phone_number") or n.get("_id")
        if not phone:
            continue
        key = re.sub(r"\D", "", str(phone))
        if key in seen:
            continue
        seen.add(key)
        variants = phone_variants(str(phone))
        sms_n = await db.sms_messages.count_documents({
            "direction": "inbound",
            "$or": [
                {"to_number": {"$in": variants}},
                {"to": {"$in": variants}},
                {"phone_number": {"$in": variants}},
            ],
        })
        call_n = 0
        try:
            call_n = await db.voice_calls.count_documents({
                "$or": [
                    {"to_number": {"$in": variants}},
                    {"to": {"$in": variants}},
                ],
            })
        except Exception:
            call_n = 0
        if sms_n > 0 or call_n > 0:
            used.append({"phone": phone, "sms": int(sms_n), "calls": int(call_n)})

    otp = await db.otp_orders.find(
        {"$or": [{"user_id": {"$in": ids}}, {"user_email": email}], "status": "got_sms"},
        {"phone_number": 1, "service_name": 1},
    ).to_list(length=50)
    for o in otp:
        phone = o.get("phone_number")
        key = re.sub(r"\D", "", str(phone or ""))
        if key and key not in seen:
            seen.add(key)
            used.append({"phone": phone, "sms": 1, "calls": 0, "otp": o.get("service_name")})
    return used
