"""IP / identity throttle for login and password-reset (brute-force brake)."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from fastapi import HTTPException


def window_iso(minutes: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


async def assert_not_throttled(
    db,
    *,
    kind: str,
    ip: str,
    identity: str = "",
    limit: int = 8,
    window_minutes: int = 15,
) -> None:
    cutoff = window_iso(window_minutes)
    q = {"kind": kind, "created_at": {"$gte": cutoff}}
    if ip:
        ip_n = await db.auth_throttle.count_documents({**q, "ip": ip})
        if ip_n >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a few minutes and try again.",
            )
    if identity:
        id_n = await db.auth_throttle.count_documents({**q, "identity": identity})
        if id_n >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a few minutes and try again.",
            )


async def record_attempt(db, *, kind: str, ip: str, identity: str = "") -> None:
    await db.auth_throttle.insert_one({
        "kind": kind,
        "ip": ip or "",
        "identity": (identity or "").strip().lower(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
