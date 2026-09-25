"""Kill-switch for the outsider-facing reseller / developer / public programmatic APIs.

These endpoints let an external party obtain an API key (or self-register as a
reseller) and then consume Calliotel services programmatically:

  - /api/reseller-api/*   (reseller_api  — application + admin approval)
  - /api/reseller/*       (reseller_v2   — white-label reseller)
  - /api/developer/*      (api_keys      — developer key management)
  - Developer Public REST API v1 (api_keys.v1)
  - /api/public-api/*     (public_api)

They are DISABLED by default so nobody can sign up and start reselling without
an explicit, deliberate opt-in. To re-enable, set the env var:

    RESELLER_API_ENABLED=1   (also accepts true/yes/on)

The core customer site (auth, numbers, SMS, calls, OTP, wallet, payments) is
unaffected — only the programmatic reseller/developer surface is gated.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_TRUTHY = {"1", "true", "yes", "on", "enabled"}

# Path prefixes owned by the reseller / developer programmatic surface. Any
# mounted route at or under these is removed when the kill-switch is off.
RESELLER_PATH_PREFIXES = (
    "/api/reseller-api",
    "/api/reseller",
    "/api/developer",
    "/api/public-api",
)


def reseller_api_enabled() -> bool:
    """True only when RESELLER_API_ENABLED is explicitly set to a truthy value."""
    return os.environ.get("RESELLER_API_ENABLED", "").strip().lower() in _TRUTHY


def _is_reseller_path(path: str) -> bool:
    p = path or ""
    return any(p == pre or p.startswith(pre + "/") for pre in RESELLER_PATH_PREFIXES)


def prune_reseller_routes(app) -> list[str]:
    """Remove already-mounted reseller/developer routes when the switch is off.

    Drift-proof: works regardless of how the routers were mounted, so it can be
    applied on a production server whose server.py differs from this repo.
    Returns the list of removed route paths (empty when enabled).
    """
    if reseller_api_enabled():
        return []
    removed: list[str] = []
    kept = []
    for route in list(getattr(app.router, "routes", [])):
        path = getattr(route, "path", "") or ""
        if _is_reseller_path(path):
            removed.append(path)
        else:
            kept.append(route)
    if removed:
        app.router.routes[:] = kept
    return removed


def log_reseller_gate_status(log: logging.Logger | None = None) -> bool:
    """Log whether the reseller/developer programmatic APIs are mounted."""
    log = log or logger
    enabled = reseller_api_enabled()
    if enabled:
        log.warning(
            "⚠️ Reseller/developer programmatic APIs are ENABLED "
            "(RESELLER_API_ENABLED). External parties can obtain API keys and "
            "resell services. Unset RESELLER_API_ENABLED to disable."
        )
    else:
        log.info(
            "🔒 Reseller/developer programmatic APIs are DISABLED (default). "
            "Set RESELLER_API_ENABLED=1 to re-enable."
        )
    return enabled
