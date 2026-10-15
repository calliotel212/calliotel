"""Cloudflare Turnstile check for email signup.

With no TURNSTILE_SECRET_KEY set, signup behaves exactly as before, so the code
can ship before the Cloudflare keys exist. Once the secret is set, a missing or
bad token is rejected. If Cloudflare itself is unreachable we let the signup
through rather than take signup down; IP limits and disposable-domain checks
still apply.
"""
from __future__ import annotations

import logging
import os

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def turnstile_enabled() -> bool:
    return bool((os.environ.get("TURNSTILE_SECRET_KEY") or "").strip())


async def assert_human(token: str | None, ip: str = "") -> None:
    secret = (os.environ.get("TURNSTILE_SECRET_KEY") or "").strip()
    if not secret:
        return
    if not token or not token.strip():
        raise HTTPException(
            status_code=400,
            detail="Please complete the security check and try again.",
        )
    data = {"secret": secret, "response": token.strip()}
    if ip:
        data["remoteip"] = ip
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(VERIFY_URL, data=data)
        result = resp.json()
    except Exception as e:
        logger.error("Turnstile verify unreachable, allowing signup: %s", e)
        return
    if not result.get("success"):
        logger.warning("Turnstile rejected signup: %s", result.get("error-codes"))
        raise HTTPException(
            status_code=400,
            detail="Security check failed. Please refresh the page and try again.",
        )
