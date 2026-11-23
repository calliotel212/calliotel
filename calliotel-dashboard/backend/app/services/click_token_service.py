"""Signed click redirect tokens (JWT) for ``GET /r/{token}``."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from app.core.config import settings

CLICK_TOKEN_TYPE = "adsfind_click"
CLICK_TOKEN_EXPIRE_HOURS = 48


def create_click_token(*, campaign_id: str, publisher_id: str | None = None) -> str:
    expire = datetime.now(UTC) + timedelta(hours=CLICK_TOKEN_EXPIRE_HOURS)
    payload: dict[str, Any] = {
        "campaign_id": campaign_id,
        "type": CLICK_TOKEN_TYPE,
        "exp": expire,
    }
    if publisher_id:
        payload["publisher_id"] = publisher_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_click_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid click token") from exc
    if payload.get("type") != CLICK_TOKEN_TYPE:
        raise ValueError("Invalid click token type")
    campaign_id = payload.get("campaign_id")
    if not campaign_id or not isinstance(campaign_id, str):
        raise ValueError("Invalid click token payload")
    return payload


def build_click_url(*, campaign_id: str, publisher_id: str | None = None) -> str:
    tok = create_click_token(campaign_id=campaign_id, publisher_id=publisher_id)
    base = settings.api_public_url.rstrip("/")
    return f"{base}/r/{tok}"