"""Light in-memory rate limit for public advertiser audit funnel."""

from __future__ import annotations

import threading
import time

_WINDOW_SEC = 60
_MAX_PER_WINDOW = 15

_lock = threading.Lock()
_buckets: dict[str, list[float]] = {}


def check_audit_rate_limit(client_key: str) -> bool:
    """Return True if the request is allowed."""
    now = time.monotonic()
    with _lock:
        hits = _buckets.get(client_key, [])
        hits = [t for t in hits if now - t < _WINDOW_SEC]
        if len(hits) >= _MAX_PER_WINDOW:
            _buckets[client_key] = hits
            return False
        hits.append(now)
        _buckets[client_key] = hits
        return True