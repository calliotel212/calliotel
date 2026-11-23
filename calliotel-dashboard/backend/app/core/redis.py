"""AdsFind click fraud uses ``redis.asyncio`` (async-only).

Sync FastAPI handlers do not import this module. The click redirect at ``GET /r/{token}``
is ``async`` and awaits Redis for duplicate detection (24h TTL per fraud hash).

If Redis is unreachable, duplicate blocking is skipped (fail-open for availability);
when Redis is up, duplicates are fail-closed (no wallet debit).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_client: Redis | None = None
_last_ping_ok: bool | None = None

FRAUD_KEY_PREFIX = "adsfind:fraud:"
FRAUD_TTL_SECONDS = 24 * 60 * 60


def fraud_redis_key(fraud_hash: str) -> str:
    return f"{FRAUD_KEY_PREFIX}{fraud_hash}"


async def init_redis() -> None:
    global _client
    if _client is not None:
        return
    _client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        await _client.ping()
        global _last_ping_ok
        _last_ping_ok = True
    except RedisError:
        logger.warning("Redis ping failed on startup; click shield will fail-open until Redis is up")
        _last_ping_ok = False


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_redis() -> Redis | None:
    return _client


async def redis_is_healthy() -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        await client.ping()
        return True
    except RedisError:
        return False


async def fraud_key_exists(fraud_hash: str) -> tuple[bool | None, bool]:
    """Return (seen_before, redis_available).

    ``seen_before`` is only meaningful when ``redis_available`` is True.
    When Redis is down, returns (None, False).
    """
    client = get_redis()
    if client is None:
        return None, False
    key = fraud_redis_key(fraud_hash)
    try:
        val = await client.get(key)
        return val is not None, True
    except RedisError as exc:
        logger.warning("Redis GET failed for click fraud key: %s", exc)
        return None, False


async def mark_fraud_key(fraud_hash: str) -> bool:
    """SET fraud key with TTL. Returns False if Redis unavailable."""
    client = get_redis()
    if client is None:
        return False
    key = fraud_redis_key(fraud_hash)
    try:
        await client.set(key, "1", ex=FRAUD_TTL_SECONDS, nx=True)
        return True
    except RedisError as exc:
        logger.warning("Redis SET failed for click fraud key: %s", exc)
        return False