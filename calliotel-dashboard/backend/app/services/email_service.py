import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(*, to_email: str, reset_token: str) -> None:
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
    subject = "Reset your Calliotel password"
    html = f"""
    <p>You requested a password reset for Calliotel.</p>
    <p><a href="{reset_url}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    """

    if not settings.resend_api_key or settings.resend_api_key.startswith("REPLACE_"):
        logger.warning(
            "RESEND_API_KEY not configured; password reset link for %s: %s",
            to_email,
            reset_url,
        )
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )
