"""
Telnyx Virtual Numbers Router
Replaces DIDWW as primary provider — full voice + SMS in/out support.
Mounted at /api/didww/* so the frontend requires zero changes.
"""

import logging
import os
import asyncio
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

from routes.auth import get_current_user
from services.telnyx_client import (
    get_balance as telnyx_get_balance,
    search_available_numbers,
    purchase_number,
    list_my_numbers,
    release_number,
    POPULAR_AREA_CODES,
    CALLING_CODES,
)

logger = logging.getLogger(__name__)
router = APIRouter()

mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]

# ── Pricing (same tiers as before) ───────────────────────────────────────────
MARKUP_MULTIPLIER = 2.0  # legacy constant kept for admin reports
MIN_PRICE = 1.99

# Keep checkout and renewal pricing aligned with the public storefront.
# Longer terms improve retention while preserving enough margin to cover the
# provider obligation for the full prepaid period.
DURATION_DISCOUNTS = {1: 0.00, 3: 0.15, 6: 0.20, 12: 0.32}
ALLOWED_DURATIONS = sorted(DURATION_DISCOUNTS.keys())

EMOJI_FLAGS = {
    "US": "🇺🇸", "GB": "🇬🇧", "CA": "🇨🇦", "AU": "🇦🇺", "DE": "🇩🇪",
    "FR": "🇫🇷", "NL": "🇳🇱", "ZA": "🇿🇦", "NG": "🇳🇬", "IN": "🇮🇳",
    "PH": "🇵🇭", "AE": "🇦🇪", "SA": "🇸🇦", "BR": "🇧🇷", "MX": "🇲🇽",
    "KE": "🇰🇪", "SG": "🇸🇬", "JP": "🇯🇵", "SE": "🇸🇪", "ES": "🇪🇸",
    "IT": "🇮🇹", "PR": "🇵🇷", "TH": "🇹🇭",
}

COUNTRY_NAMES = {
    "US": "United States", "GB": "United Kingdom", "CA": "Canada",
    "AU": "Australia", "DE": "Germany", "FR": "France", "NL": "Netherlands",
    "ZA": "South Africa", "NG": "Nigeria", "IN": "India", "PH": "Philippines",
    "AE": "United Arab Emirates", "SA": "Saudi Arabia", "BR": "Brazil",
    "MX": "Mexico", "KE": "Kenya", "SG": "Singapore", "JP": "Japan",
    "SE": "Sweden", "ES": "Spain", "IT": "Italy", "PR": "Puerto Rico",
    "TH": "Thailand", "PL": "Poland", "BE": "Belgium", "NO": "Norway",
    "DK": "Denmark", "FI": "Finland", "AT": "Austria", "CH": "Switzerland",
    "TR": "Turkey", "IL": "Israel", "CO": "Colombia", "CL": "Chile",
    "PE": "Peru", "AR": "Argentina", "DO": "Dominican Republic", "JM": "Jamaica",
    "IE": "Ireland", "GR": "Greece", "HU": "Hungary",
    "NZ": "New Zealand", "LV": "Latvia", "EE": "Estonia",
}

# Countries confirmed working on Telnyx with SMS capability (tested 2026-05-22)
# US/CA/PR: local+SMS  |  GB/NL/SE: mobile+SMS
SUPPORTED_COUNTRIES = [
    "US", "CA", "PR",           # North America — local SMS
    "GB",                       # UK — mobile SMS
    "NL", "SE",                 # EU mobile SMS
    "DO", "JM",                 # Caribbean — local SMS (+1 area codes)
    "IE", "GR", "HU",           # EU — verified Telnyx coverage
    "NZ",                       # Pacific — mobile SMS
    "LV", "EE",                 # Baltic — mobile SMS
]

# Countries that require KYC or have no SMS coverage on Telnyx
KYC_REQUIRED_COUNTRIES = {
    "JP", "KR", "CN", "AR", "CL", "PE", "CO", "TR", "IL", "ID", "PY",
    # No Telnyx SMS coverage:
    "AU", "BR", "MX", "SG", "IN", "NG", "ZA", "KE", "PH", "TH",
    "DE", "FR", "IT", "ES", "PL", "BE", "DK", "FI", "NO", "AT", "CH",
    # Telnyx mobile still requires identity documents (NumberOps):
    "NL",
}

NO_KYC_SUGGESTIONS = "US, CA, UK, PR, DO, JM"

# Countries cache
_AVAILABLE_COUNTRIES_CACHE: list = []
_COUNTRY_CACHE_TS: float = 0.0
_COUNTRY_CACHE_TTL = 3600.0  # 1 hour


def _markup_tier(provider_cost: float) -> float:
    if provider_cost < 2.0:
        return 1.80
    if provider_cost < 5.0:
        return 1.50
    if provider_cost < 15.0:
        return 1.25
    return 1.10


def _user_price(provider_cost: float) -> float:
    raw = provider_cost * _markup_tier(provider_cost)
    return round(max(raw, MIN_PRICE), 2)


def _duration_pricing(provider_cost: float) -> list:
    monthly = _user_price(provider_cost)
    tiers = []
    for months, disc in DURATION_DISCOUNTS.items():
        total = round(monthly * months * (1 - disc), 2)
        per_mo = round(total / months, 2)
        tiers.append({
            "months": months,
            "monthly_equivalent": per_mo,
            "total_price": total,
            "discount_pct": int(disc * 100),
            "savings_vs_monthly": round(monthly * months - total, 2),
        })
    return tiers


def _duration_total(provider_cost: float, months: int) -> tuple:
    if months not in DURATION_DISCOUNTS:
        raise ValueError(f"months must be one of {ALLOWED_DURATIONS}, got {months}")
    monthly = _user_price(provider_cost)
    disc = DURATION_DISCOUNTS[months]
    total = round(monthly * months * (1 - disc), 2)
    per_mo = round(total / months, 2)
    return total, per_mo, int(disc * 100)


# ── Telnyx operational check (balance gate) ──────────────────────────────────

_BALANCE_GATE_CACHE: dict = {"value": None, "ts": 0.0}
_BALANCE_GATE_TTL = 60.0
_TELNYX_OPERATIONAL_FLOOR = float(os.environ.get("TELNYX_OPERATIONAL_FLOOR_USD", "5.0"))


async def _telnyx_is_operational() -> bool:
    import time
    now = time.time()
    if _BALANCE_GATE_CACHE["value"] is not None and (now - _BALANCE_GATE_CACHE["ts"]) < _BALANCE_GATE_TTL:
        return bool(_BALANCE_GATE_CACHE["value"])
    try:
        bal_data = await telnyx_get_balance()
        ok = bal_data["balance"] >= _TELNYX_OPERATIONAL_FLOOR
    except Exception:
        ok = True  # don't take down storefront on transient API error
    _BALANCE_GATE_CACHE["value"] = ok
    _BALANCE_GATE_CACHE["ts"] = now
    return ok


# ── GET /countries ────────────────────────────────────────────────────────────

@router.get("/countries")
async def get_countries():
    """Return countries where Telnyx has available numbers."""
    if not await _telnyx_is_operational():
        return {"countries": [], "provider_available": False, "reason": "telnyx_low_balance"}

    countries = [
        {"iso": iso, "name": COUNTRY_NAMES.get(iso, iso)}
        for iso in SUPPORTED_COUNTRIES
        if iso not in KYC_REQUIRED_COUNTRIES
    ]
    countries.sort(key=lambda x: x["name"])
    return {"countries": countries}


# ── GET /area-codes ───────────────────────────────────────────────────────────

@router.get("/area-codes")
async def get_area_codes(country: str = "US", limit: int = 60):
    """
    Return browsable area codes with pricing for a country.
    Searches Telnyx for available numbers, groups by area code.
    """
    if not await _telnyx_is_operational():
        return {"area_codes": [], "provider_available": False, "reason": "telnyx_low_balance"}

    country_upper = country.upper()
    if country_upper in KYC_REQUIRED_COUNTRIES:
        return {
            "area_codes": [], "provider_available": False,
            "reason": "kyc_required",
            "message": "This country requires identity documents. Please choose a no-KYC country.",
        }

    try:
        numbers = await search_available_numbers(country_iso=country_upper, limit=250)

        # Group by area code
        by_area: dict = {}
        for num in numbers:
            ac = num["area_code"]
            if not ac:
                continue
            if ac not in by_area:
                by_area[ac] = {
                    "area_code": ac,
                    "city": num["region"],
                    "state": "",
                    "country_code": num["calling_code"],
                    "stock": 0,
                    "monthly_cost_wholesale": num["monthly_cost"],
                    "supports_sms": num["supports_sms"],
                    "supports_voice": num["supports_voice"],
                    "is_popular": num["is_popular"],
                    "_sample_number": num["phone_number"],
                }
            by_area[ac]["stock"] += 1
            # use cheapest price for this area code
            if num["monthly_cost"] < by_area[ac]["monthly_cost_wholesale"]:
                by_area[ac]["monthly_cost_wholesale"] = num["monthly_cost"]

        groups = list(by_area.values())
        groups.sort(key=lambda g: (0 if g["is_popular"] else 1, g["city"] or g["area_code"]))

        area_codes = []
        for g in groups[:limit]:
            wc = g["monthly_cost_wholesale"]
            user_price = _user_price(wc)
            tiers = _duration_pricing(wc)
            area_codes.append({
                "area_code": g["area_code"],
                "city": g["city"],
                "state": g["state"],
                "country_code": g["country_code"],
                "stock": max(g["stock"], 1),
                "type": "geographic",
                "monthly_cost": user_price,
                "pricing_tiers": tiers,
                "is_popular": g["is_popular"],
                "supports_sms": g["supports_sms"],
                "supports_voice": g["supports_voice"],
                "_telnyx_area_code": g["area_code"],
                "_telnyx_country": country_upper,
                "_provider_cost": wc,
                # legacy fields — kept for frontend compatibility
                "_did_group_id": g["area_code"],
                "_sku_id": g["_sample_number"],
            })

        return {
            "area_codes": area_codes,
            "total": len(area_codes),
            "country": country,
            "duration_options": ALLOWED_DURATIONS,
            "max_discount_pct": int(max(DURATION_DISCOUNTS.values()) * 100),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Telnyx area-codes error: {e}")
        raise HTTPException(status_code=500, detail="Could not load area codes. Please try again.")


# ── POST /auto-purchase ───────────────────────────────────────────────────────

class PurchaseRequest(BaseModel):
    area_code: str
    country_code: str = "1"
    country: str = "US"
    phone_number: Optional[str] = None   # specific number if user picked one
    did_group_id: Optional[str] = None   # legacy field — ignored but accepted
    sku_id: Optional[str] = None         # legacy field — ignored but accepted
    months: int = 1


@router.post("/auto-purchase")
async def auto_purchase(req: PurchaseRequest, current_user=Depends(get_current_user)):
    """
    Purchase a virtual number via Telnyx.
    Deducts from user wallet on success.
    """
    from services.email_gate import require_confirmed_email
    require_confirmed_email(current_user)

    from services.user_approval import user_requires_approval
    if user_requires_approval(current_user):
        raise HTTPException(
            status_code=403,
            detail="Your account is pending approval. Top up at least $1 of real funds to unlock instantly, or contact support@calliotel.com.",
        )

    user_id = str(current_user["_id"])
    user_email = current_user.get("email", "")

    # Validate duration
    if req.months not in DURATION_DISCOUNTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid plan length. Choose from: {ALLOWED_DURATIONS} months.",
        )

    country_upper = (req.country or "US").upper()
    if country_upper in KYC_REQUIRED_COUNTRIES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"{country_upper} requires local identity documents for activation. "
                f"For instant activation, please pick: {NO_KYC_SUGGESTIONS}."
            ),
        )

    # ── 1. Find an available number for this area code ──
    # Search Telnyx for a number with the requested area code
    numbers = await search_available_numbers(
        country_iso=country_upper,
        area_code=req.area_code,
        limit=10,
    )

    if not numbers:
        # Fallback: broader search without area code filter
        numbers = await search_available_numbers(country_iso=country_upper, limit=50)
        numbers = [n for n in numbers if n["area_code"] == req.area_code]

    if not numbers:
        raise HTTPException(
            status_code=503,
            detail=f"No numbers available for area code {req.area_code}. Try a different city.",
        )

    # If client specified a phone_number, prefer it if it's in our results
    chosen_num = None
    if req.phone_number:
        for n in numbers:
            if n["phone_number"] == req.phone_number:
                chosen_num = n
                break
    if chosen_num is None:
        chosen_num = numbers[0]

    target_phone = chosen_num["phone_number"]
    provider_cost = float(chosen_num["monthly_cost"])

    user_price = _user_price(provider_cost)
    total_due, monthly_equiv, discount_pct = _duration_total(provider_cost, req.months)
    plan_label = f"{req.months}-month plan" if req.months > 1 else "monthly plan"

    # ── 2. Wallet check ──
    from services.wallet_guard import credit as wallet_credit
    from services.wallet_guard import debit_if_funded

    wallet = await db.wallets.find_one({"user_id": user_id})
    balance = float(wallet.get("balance", 0)) if wallet else 0.0

    if balance < total_due:
        if req.months > 1:
            msg = (
                f"Insufficient balance. The {req.months}-month plan costs "
                f"${total_due:.2f} upfront (${monthly_equiv:.2f}/mo, "
                f"{discount_pct}% off). Please add credits."
            )
        else:
            msg = f"Insufficient balance. This number costs ${total_due:.2f}/mo. Please add credits."
        raise HTTPException(status_code=402, detail=msg)

    from services.paid_funds import assert_real_funds_cover
    await assert_real_funds_cover(db, user_id, wallet, total_due)

    # ── 2b. Telnyx balance pre-flight check ──
    try:
        bal_data = await telnyx_get_balance()
        telnyx_bal = bal_data["balance"]
    except Exception:
        telnyx_bal = None

    if telnyx_bal is not None and telnyx_bal < float(provider_cost) + 0.50:
        try:
            await db.didww_purchase_waitlist.insert_one({
                "user_id": user_id, "user_email": user_email,
                "country": country_upper, "area_code": req.area_code,
                "provider": "telnyx", "target_phone": target_phone,
                "provider_cost": provider_cost, "user_price": user_price,
                "subscription_months": req.months, "total_due": total_due,
                "monthly_equivalent": monthly_equiv, "discount_pct": discount_pct,
                "created_at": datetime.now(timezone.utc), "status": "waiting",
                "telnyx_balance_at_attempt": telnyx_bal,
            })
        except Exception as _e:
            logger.warning(f"waitlist insert failed: {_e}")
        try:
            from services.telegram_admin_alerts import notify_admins
            asyncio.create_task(notify_admins(
                f"⚠️ Telnyx low balance — {user_email} couldn't buy "
                f"{country_upper} {req.area_code} (cost ${provider_cost:.2f}). "
                f"Telnyx balance: ${telnyx_bal:.2f}. "
                f"Customer queued. Top up: https://portal.telnyx.com/#/app/billing",
                email_subject="🚨 Telnyx low balance — customer queued",
            ))
        except Exception:
            pass
        raise HTTPException(
            status_code=503,
            detail=(
                "This number is briefly out of stock — we're restocking now and "
                "you'll get an email within 24h to complete the purchase. "
                "Your wallet was NOT charged. Sorry for the delay!"
            ),
        )

    reserved = await debit_if_funded(db, user_id, total_due)
    if not reserved:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance. This number costs ${total_due:.2f}. Please add credits.",
        )
    balance = float(reserved.get("balance", 0))

    # ── 3. Purchase from Telnyx ──
    try:
        from services.telnyx_client import CALLIOTEL_MESSAGING_PROFILE_ID
        order = await purchase_number(
            phone_number=target_phone,
            messaging_profile_id=CALLIOTEL_MESSAGING_PROFILE_ID,
        )
        confirmed_numbers = order.get("phone_numbers", [])
        if not confirmed_numbers:
            raise HTTPException(status_code=502, detail="Order placed but no number received. Contact support.")
        phone_number = confirmed_numbers[0]
        order_id = order.get("order_id", "")
        if order.get("requirements_met") is False:
            try:
                from services.telnyx_client import cancel_pending_number_order
                await cancel_pending_number_order(order_id)
            except Exception as _e:
                logger.warning(f"Could not cancel KYC Telnyx order {order_id}: {_e}")
            raise HTTPException(
                status_code=422,
                detail=(
                    "This number requires identity documents and cannot be activated instantly. "
                    f"Please pick a no-KYC country: {NO_KYC_SUGGESTIONS}."
                ),
            )
        logger.info(f"✅ Telnyx order succeeded: {phone_number}")

        # Invalidate SMS number cache
        try:
            from services.telnyx_sms_client import invalidate_cache
            invalidate_cache()
        except Exception:
            pass

    except HTTPException:
        await wallet_credit(db, user_id, total_due)
        raise
    except Exception as e:
        await wallet_credit(db, user_id, total_due)
        logger.error(f"❌ Telnyx purchase error: {e}")
        raise HTTPException(
            status_code=502,
            detail="Number purchase failed. Please try again or contact support.",
        )

    new_balance = round(float(balance), 2)

    # ── 5. Record subscription ──
    now = datetime.now(timezone.utc)
    next_renewal = now + timedelta(days=30 * req.months)
    # Look up Telnyx internal number_id (needed for future releases/cancellations)
    telnyx_number_id = ""
    try:
        from services.telnyx_client import lookup_number_id
        telnyx_number_id = await lookup_number_id(phone_number)
    except Exception as _e:
        logger.warning(f"Could not resolve number_id for {phone_number}: {_e}")

    subscription = {
        "subscription_id": str(uuid4()),
        "user_id": user_id,
        "user_email": user_email,
        "provider": "telnyx",
        "telnyx_order_id": order_id,
        "number_id": telnyx_number_id,
        "phone_number": phone_number,
        "area_code": req.area_code,
        "country": country_upper,
        "country_code": req.country_code,
        "monthly_cost": user_price,
        "monthly_equivalent": monthly_equiv,
        "provider_cost": provider_cost,
        "profit": round(total_due - provider_cost * req.months, 2),
        "subscription_months": req.months,
        "discount_pct": discount_pct,
        "total_paid": total_due,
        "status": "active",
        "auto_renew": True,
        "purchase_date": now.isoformat(),
        "next_renewal_date": next_renewal.isoformat(),
        "expires_at": next_renewal.isoformat(),
    }
    await db.user_numbers.insert_one(subscription)

    # ── 6. Log transaction ──
    desc = (
        f"Purchased virtual number {phone_number} ({plan_label}"
        + (f", saved {discount_pct}%" if discount_pct else "")
        + ")"
    )
    await db.transactions.insert_one({
        "transaction_id": str(uuid4()),
        "user_id": user_id,
        "type": "virtual_number_purchase",
        "provider": "telnyx",
        "amount": -total_due,
        "description": desc,
        "subscription_months": req.months,
        "discount_pct": discount_pct,
        "timestamp": now.isoformat(),
        "balance_after": new_balance,
    })

    logger.info(
        f"✅ User {user_email} purchased {phone_number} via Telnyx — "
        f"{plan_label}, total ${total_due:.2f} (${monthly_equiv:.2f}/mo, {discount_pct}% off)"
    )

    # ── Admin alert ──
    try:
        from services.telegram_admin_alerts import notify_admins
        asyncio.create_task(notify_admins(
            f"📱 NEW NUMBER PURCHASED: {phone_number} ({country_upper}) by {user_email}\n"
            f"Provider: Telnyx ✅\n"
            f"Voice + SMS: ✅ fully automatic (no manual steps needed)\n"
            f"Plan: {plan_label}, total ${total_due:.2f}",
        ))
    except Exception:
        pass

    return {
        "success": True,
        "phone_number": phone_number,
        "message": f"Number {phone_number} assigned successfully!",
        "monthly_cost": user_price,
        "monthly_equivalent": monthly_equiv,
        "total_paid": total_due,
        "subscription_months": req.months,
        "discount_pct": discount_pct,
        "new_balance": round(new_balance, 2),
        "next_renewal": subscription["next_renewal_date"],
    }


# ── GET /balance (admin) ──────────────────────────────────────────────────────

@router.get("/balance")
async def get_telnyx_balance(current_user=Depends(get_current_user)):
    """Admin: get Telnyx provider account balance."""
    from services.admin_gate import require_admin_user
    require_admin_user(current_user)
    try:
        return await telnyx_get_balance()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch balance: {e}")


# ── GET /admin/pricing (admin) ────────────────────────────────────────────────

@router.get("/admin/pricing")
async def admin_pricing(current_user: dict = Depends(get_current_user)):
    """Admin: pricing breakdown per country."""
    from services.admin_gate import require_admin_user
    require_admin_user(current_user)

    sample_countries = ["US", "GB", "CA", "AU", "BR", "MX", "NG", "SG", "PH", "PR"]
    results = []

    async def fetch_country(iso):
        try:
            nums = await search_available_numbers(country_iso=iso, limit=5)
            if not nums:
                return None
            raw_cost = min(n["monthly_cost"] for n in nums)
            u_price = _user_price(raw_cost)
            return {
                "iso": iso,
                "flag": EMOJI_FLAGS.get(iso, "🌐"),
                "name": COUNTRY_NAMES.get(iso, iso),
                "providerCost": raw_cost,
                "userPrice": u_price,
                "profit": round(u_price - raw_cost, 2),
                "margin": round((u_price - raw_cost) / u_price * 100, 1) if u_price else 0,
            }
        except Exception:
            return None

    tasks = [fetch_country(iso) for iso in sample_countries]
    fetched = await asyncio.gather(*tasks)
    countries = [c for c in fetched if c]

    return {
        "source": "live" if countries else "sample",
        "provider": "telnyx",
        "markup_tiers": [
            {"wholesale_under": 2.0,  "multiplier": 1.80},
            {"wholesale_under": 5.0,  "multiplier": 1.50},
            {"wholesale_under": 15.0, "multiplier": 1.25},
            {"wholesale_under": None, "multiplier": 1.10},
        ],
        "min_price": MIN_PRICE,
        "countries": countries,
    }


# ── POST /admin/cleanup-dead-dids (admin) ─────────────────────────────────────

@router.post("/admin/cleanup-dead-dids")
async def cleanup_dead_numbers(
    current_user: dict = Depends(get_current_user),
    dry_run: bool = Query(True),
):
    """
    Admin: find numbers in Telnyx account that have status != active,
    release them and mark DB records as expired.
    """
    from services.admin_gate import require_admin_user
    require_admin_user(current_user)

    all_numbers = await list_my_numbers()
    dead = [n for n in all_numbers if n.get("status") not in ("active", "port-in-started")]

    if not dead:
        return {"message": "No dead numbers found", "dead_count": 0}

    results = {
        "dead_found": len(dead),
        "released": 0,
        "release_failed": 0,
        "db_records_expired": 0,
        "dry_run": dry_run,
        "details": [],
    }

    now_iso = datetime.now(timezone.utc).isoformat()

    for num in dead:
        phone = num["phone_number"]
        num_id = num["number_id"]
        detail = {"phone_number": phone, "number_id": num_id, "status": num.get("status")}

        if dry_run:
            detail["action"] = "would_release"
            results["details"].append(detail)
            continue

        released = False
        try:
            ok = await release_number(num_id)
            detail["released"] = ok
            released = ok
            if ok:
                results["released"] += 1
            else:
                results["release_failed"] += 1
        except Exception as e:
            detail["error"] = str(e)
            results["release_failed"] += 1

        if released:
            normalized = phone.lstrip("+")
            variants = [phone, f"+{normalized}", normalized]
            q = {"phone_number": {"$in": variants}, "status": {"$ne": "expired"}}
            upd = {"$set": {"status": "expired", "expiration_reason": "dead_cleanup", "expired_at": now_iso}}
            r1 = await db.user_numbers.update_many(q, upd)
            r2 = await db.purchased_numbers.update_many(q, upd)
            db_updated = r1.modified_count + r2.modified_count
            results["db_records_expired"] += db_updated
            detail["db_records_expired"] = db_updated

        results["details"].append(detail)

    return results
