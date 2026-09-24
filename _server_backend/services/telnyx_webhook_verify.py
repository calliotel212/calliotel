"""Verify Telnyx API v2 webhook Ed25519 signatures.

Telnyx signs each webhook with an Ed25519 signature over ``timestamp|raw_body``
and sends it in the ``Telnyx-Signature-Ed25519`` / ``Telnyx-Timestamp`` headers.
Callers (routes/calls.py, routes/calls_live.py) reject the request when this
returns False, so the verifier fails closed: if the public key or PyNaCl is
missing, no webhook is trusted.

The public key comes from the ``TELNYX_PUBLIC_KEY`` env var (base64, from the
Telnyx portal). It is read on each call so a late-loaded .env is picked up.
"""
from __future__ import annotations

import base64
import logging
import os
import time

logger = logging.getLogger(__name__)

# Tolerate clock skew / queue delay between Telnyx and this server.
MAX_AGE_SECS = 300


def _public_key() -> str:
    return os.environ.get("TELNYX_PUBLIC_KEY", "").strip()


def _pynacl_available() -> bool:
    try:
        import nacl.signing  # noqa: F401
        return True
    except ImportError:
        return False


def is_configured() -> tuple[bool, str]:
    """Return (ready, reason). ready is True only when webhooks can be verified."""
    if not _public_key():
        return False, "TELNYX_PUBLIC_KEY not set"
    if not _pynacl_available():
        return False, "PyNaCl not installed"
    return True, "ok"


def log_config_status(log: logging.Logger | None = None) -> bool:
    """Log whether Telnyx webhook verification is ready. Returns readiness.

    Safe to call at startup: signals loudly when the fail-closed guard would
    reject every Telnyx webhook (which also breaks legitimate call billing).
    """
    log = log or logger
    ready, reason = is_configured()
    if ready:
        log.info("✅ Telnyx webhook signature verification is configured")
    else:
        log.error(
            "❌ Telnyx webhook verification NOT ready (%s) — all Telnyx call "
            "webhooks will be rejected. Set TELNYX_PUBLIC_KEY and install PyNaCl.",
            reason,
        )
    return ready


def verify_telnyx_signature(
    raw_body: bytes, signature_b64: str | None, timestamp: str | None
) -> bool:
    """Return True when the webhook is authentic.

    Fails closed: returns False when the public key is unset, PyNaCl is missing,
    the timestamp is stale/invalid, or the signature does not verify.
    """
    public_key = _public_key()
    if not public_key:
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
        key_bytes = base64.b64decode(public_key)
        sig = base64.b64decode(signature_b64)
        signed = timestamp.encode("utf-8") + b"|" + raw_body
        VerifyKey(key_bytes).verify(signed, sig)
        return True
    except BadSignatureError:
        return False
    except Exception as e:
        logger.warning(f"Telnyx signature verify error: {e}")
        return False
