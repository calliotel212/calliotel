"""Release stale Telnyx inventory that has no active Calliotel owner."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import requests
from pymongo import MongoClient

logger = logging.getLogger(__name__)

TELNYX_API_BASE = "https://api.telnyx.com/v2"
ORPHAN_GRACE = timedelta(hours=24)
MAX_RELEASES_PER_RUN = 50
MIN_OWNERSHIP_RATIO = 0.50


def _normalize(phone: object) -> str:
    digits = "".join(char for char in str(phone or "") if char.isdigit())
    return f"+{digits}" if digits else ""


def _parse_created_at(value: object) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _notify(message: str) -> None:
    try:
        from services.telegram_admin_alerts import notify_admins

        asyncio.run(
            notify_admins(
                message,
                email_subject="Calliotel Telnyx orphan watchdog",
            )
        )
    except Exception as exc:
        logger.warning("Orphan watchdog admin notification failed: %s", exc)


def _provider_numbers(headers: dict[str, str]) -> list[dict]:
    numbers: list[dict] = []
    page = 1
    while True:
        response = requests.get(
            f"{TELNYX_API_BASE}/phone_numbers",
            headers=headers,
            params={"page[size]": 250, "page[number]": page},
            timeout=30,
        )
        response.raise_for_status()
        batch = response.json().get("data", [])
        numbers.extend(batch)
        if len(batch) < 250:
            return numbers
        page += 1


def check_orphaned_numbers() -> dict:
    """Release provider-active numbers with no active DB owner after a grace period."""
    api_key = os.getenv("TELNYX_API_KEY") or os.getenv("TELNYX_API_KEY_V2")
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    if not api_key or not mongo_url or not db_name:
        logger.error("Orphan watchdog skipped: required configuration is missing")
        return {"success": False, "error": "missing_configuration"}

    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    client = MongoClient(
        mongo_url,
        serverSelectionTimeoutMS=10_000,
        connectTimeoutMS=10_000,
    )

    try:
        db = client[db_name]
        owned: set[str] = set()
        for collection_name in ("user_numbers", "purchased_numbers"):
            cursor = db[collection_name].find(
                {"status": "active"},
                {"phone_number": 1},
            )
            owned.update(
                normalized
                for document in cursor
                if (normalized := _normalize(document.get("phone_number")))
            )

        # Pool numbers are intentionally held in the provider account before
        # assignment. Protect any pool record that has not been retired.
        pool_cursor = db.number_pool.find(
            {
                "status": {
                    "$nin": ["expired", "released", "cancelled", "deleted"]
                }
            },
            {"phone_number": 1},
        )
        owned.update(
            normalized
            for document in pool_cursor
            if (normalized := _normalize(document.get("phone_number")))
        )

        provider = _provider_numbers(headers)
        active = [item for item in provider if item.get("status") == "active"]
        matched = [
            item
            for item in active
            if _normalize(item.get("phone_number")) in owned
        ]
        ratio = len(matched) / len(active) if active else 1.0

        if active and ratio < MIN_OWNERSHIP_RATIO:
            message = (
                "🚨 Telnyx orphan watchdog circuit breaker: "
                f"only {len(matched)}/{len(active)} active provider numbers "
                "matched Calliotel. No numbers were released."
            )
            logger.error(message)
            _notify(message)
            return {
                "success": False,
                "error": "ownership_ratio_circuit_breaker",
                "provider_active": len(active),
                "matched": len(matched),
            }

        cutoff = datetime.now(timezone.utc) - ORPHAN_GRACE
        candidates = []
        for item in active:
            phone = _normalize(item.get("phone_number"))
            created_at = _parse_created_at(item.get("created_at"))
            if phone in owned or created_at is None or created_at > cutoff:
                continue
            candidates.append(item)

        if len(candidates) > MAX_RELEASES_PER_RUN:
            message = (
                "🚨 Telnyx orphan watchdog circuit breaker: "
                f"{len(candidates)} release candidates exceeds the "
                f"{MAX_RELEASES_PER_RUN} per-run limit. No numbers were released."
            )
            logger.error(message)
            _notify(message)
            return {
                "success": False,
                "error": "release_limit_circuit_breaker",
                "candidates": len(candidates),
            }

        released: list[str] = []
        failures: list[dict] = []
        now = datetime.now(timezone.utc).isoformat()
        for item in candidates:
            phone = _normalize(item.get("phone_number"))
            response = requests.delete(
                f"{TELNYX_API_BASE}/phone_numbers/{item.get('id')}",
                headers=headers,
                timeout=20,
            )
            if response.status_code not in (200, 204, 404):
                failures.append({"last4": phone[-4:], "status": response.status_code})
                continue

            released.append(phone)
            for collection_name in ("user_numbers", "purchased_numbers"):
                db[collection_name].update_many(
                    {
                        "phone_number": {
                            "$in": [phone, phone.lstrip("+")]
                        },
                        "status": {"$ne": "active"},
                    },
                    {
                        "$set": {
                            "provider_released": True,
                            "orphan_watchdog_released_at": now,
                        }
                    },
                )

        db.telnyx_orphan_audits.insert_one(
            {
                "checked_at": now,
                "provider_active": len(active),
                "matched": len(matched),
                "candidates": len(candidates),
                "released": len(released),
                "failures": failures,
                "released_last4": [phone[-4:] for phone in released],
            }
        )

        if released or failures:
            _notify(
                "🧹 Telnyx orphan watchdog: "
                f"released {len(released)} unowned number(s); "
                f"{len(failures)} failure(s); "
                f"{len(active) - len(released)} active provider number(s) remain."
            )

        logger.info(
            "Telnyx orphan watchdog: active=%d matched=%d candidates=%d "
            "released=%d failures=%d",
            len(active),
            len(matched),
            len(candidates),
            len(released),
            len(failures),
        )
        return {
            "success": not failures,
            "provider_active": len(active),
            "matched": len(matched),
            "candidates": len(candidates),
            "released": len(released),
            "failures": len(failures),
        }
    except Exception as exc:
        logger.exception("Telnyx orphan watchdog failed")
        _notify(f"🚨 Telnyx orphan watchdog failed: {exc}")
        return {"success": False, "error": str(exc)}
    finally:
        client.close()
