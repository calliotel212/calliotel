"""Admin access is an email allowlist — never a client-writable is_admin flag."""
from __future__ import annotations

from fastapi import HTTPException

ADMIN_EMAILS = frozenset({
    "admin@calliotel.com",
    "admin2@calliotel.com",
    "bigboss@calliotel.com",
    "alinmy77@gmail.com",
    "worl212211@yahoo.com",
    "astor539@gmail.com",
    "g_agroup2@yahoo.com",
})


def is_staff_email(email: str | None) -> bool:
    """Owner / staff inboxes — bots often try these on /signup."""
    e = (email or "").strip().lower()
    if not e or "@" not in e:
        return False
    if e in ADMIN_EMAILS:
        return True
    return e.endswith("@calliotel.com")


def admin_email(user: dict | None) -> str:
    if not user:
        return ""
    return str(user.get("email") or user.get("_id") or "").strip().lower()


def is_admin_user(user: dict | None) -> bool:
    return admin_email(user) in ADMIN_EMAILS


def require_admin_user(user: dict | None) -> dict:
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Admin only")
    return user
