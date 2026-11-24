#!/usr/bin/env python3
"""Create or rotate the Calliotel platform publisher API key for voice-ai-platform."""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ads import Publisher, PublisherUser
from app.services.publisher_service import (
    generate_publisher_api_key,
    hash_password,
    hash_publisher_api_key,
)

PLATFORM_EMAIL = "platform@calliotel.ai"
PLATFORM_NAME = "Calliotel Voice Platform"


def seed() -> str:
    raw_key = (os.environ.get("PLATFORM_PUBLISHER_API_KEY") or "").strip()
    if not raw_key:
        raw_key = generate_publisher_api_key()
    with SessionLocal() as db:
        user = db.scalar(select(PublisherUser).where(PublisherUser.email == PLATFORM_EMAIL))
        if user is not None:
            publisher = db.get(Publisher, user.publisher_id)
            if publisher is None:
                raise RuntimeError("Publisher row missing for platform user")
            publisher.api_key_hash = hash_publisher_api_key(raw_key)
            publisher.api_key_last4 = raw_key[-4:]
            db.commit()
            return raw_key

        publisher = Publisher(
            name=PLATFORM_NAME,
            api_key_hash=hash_publisher_api_key(raw_key),
            api_key_last4=raw_key[-4:],
        )
        db.add(publisher)
        db.flush()
        db.add(
            PublisherUser(
                email=PLATFORM_EMAIL,
                password_hash=hash_password("platform-dev-only-change-me"),
                publisher_id=publisher.id,
            )
        )
        db.commit()
    return raw_key


if __name__ == "__main__":
    key = seed()
    print("Platform publisher API key (set PUBLISHER_API_KEY in voice-ai-platform):")
    print(key)