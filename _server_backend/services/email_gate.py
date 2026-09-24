"""Block spending until a new email signup confirms their address.

Only accounts explicitly marked ``email_verified: False`` are gated. Existing
customers were auto-verified at signup and Google / Telegram accounts never
use this flag, so none of them are affected.
"""
from __future__ import annotations

from fastapi import HTTPException

EMAIL_NOT_CONFIRMED = "EMAIL_NOT_CONFIRMED"


def needs_email_confirmation(user: dict | None) -> bool:
    if not user:
        return False
    if (user.get("auth_provider") or "email") != "email":
        return False
    return user.get("email_verified") is False


def require_confirmed_email(user: dict | None) -> None:
    if needs_email_confirmation(user):
        raise HTTPException(
            status_code=403,
            detail=(
                "Please confirm your email first. We sent a link to "
                f"{user.get('email')}. Check your inbox and spam folder, "
                "or resend it from the banner at the top of the page."
            ),
            headers={"X-Calliotel-Reason": EMAIL_NOT_CONFIRMED},
        )
